import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScoringService } from '../scoring/scoring.service';
import { HarvestRunPlan, HarvestRunSummary } from './types';
import { OpportunityStatus, ApplicationType, RecommendedAction } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface HarvestIntegrationResult {
  funderId: string;
  funderName: string;
  opportunitiesCreated: number;
  opportunitiesUpdated: number;
  opportunitiesScored: number;
  warnings: string[];
}

/**
 * HarvestIntegrationService - Applies harvest run plans to the database
 * 
 * Protocol:
 * 1. Load harvest run plan from filesystem
 * 2. Create/update opportunities in DB
 * 3. Trigger scoring for new opportunities
 * 4. Return integration results
 */
@Injectable()
export class HarvestIntegrationService {
  private readonly logger = new Logger(HarvestIntegrationService.name);

  constructor(
    private prisma: PrismaService,
    private scoring: ScoringService,
  ) {}

  /**
   * Apply a harvest run to the database
   */
  async applyRun(
    runId: string,
    options: { dryRun?: boolean; funderId: string },
  ): Promise<HarvestIntegrationResult> {
    this.logger.log(
      `Applying harvest run ${runId} (dryRun: ${options.dryRun ?? false})`,
    );

    const { dryRun = false, funderId } = options;

    // Load plan from filesystem
    const plan = await this.loadPlan(runId);

    if (plan.funderId !== funderId) {
      throw new Error(
        `Harvest run ${runId} is for funder ${plan.funderId}, not ${funderId}`,
      );
    }

    // Verify funder exists
    const funder = await this.prisma.funder.findUnique({
      where: { id: funderId },
      select: { id: true, name: true },
    });

    if (!funder) {
      throw new NotFoundException(`Funder ${funderId} not found`);
    }

    const warnings: string[] = [];
    let opportunitiesCreated = 0;
    let opportunitiesUpdated = 0;
    let opportunitiesScored = 0;

    if (dryRun) {
      this.logger.log('Dry run - no changes will be made');
      return {
        funderId: funder.id,
        funderName: funder.name,
        opportunitiesCreated: plan.stats.newOpportunities,
        opportunitiesUpdated: plan.stats.updatedOpportunities,
        opportunitiesScored: 0,
        warnings: ['Dry run - no actual changes made'],
      };
    }

    // Get admin user for createdById (required field)
    const adminUser = await this.prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true },
    });

    if (!adminUser) {
      throw new Error('No admin user found - required for creating opportunities');
    }

    // Load existing opportunities for comparison
    const existingOpportunities = await this.prisma.opportunity.findMany({
      where: { funderId },
      select: {
        id: true,
        programName: true,
        sourceUrl: true,
      },
    });

    const existingByUrl = new Map(
      existingOpportunities.map((opp) => [opp.sourceUrl, opp]),
    );
    const existingByName = new Map(
      existingOpportunities.map((opp) => [opp.programName.toLowerCase(), opp]),
    );

    // Process each opportunity
    for (const grant of plan.opportunities) {
      try {
        // Handle both old normalized format and new LLM-extracted format
        const programName = grant.programName;
        const sourceUrl = grant.sourceUrl || plan.sourceUrl;
        
        // Extract description
        const description = grant.description || '';
        
        // Store full eligibility text as rawDescription for display
        const rawDescription = grant.eligibility || description;
        
        // Extract structured eligibility from eligibilityDetailed (LLM format)
        const ed = grant.eligibilityDetailed;
        const geographies = ed?.geographicRestrictions || grant.geographies || [];
        const applicantTypes = ed?.organizationTypes || grant.applicantTypes || grant.eligibleApplicantTypes || [];
        const focusAreas = grant.declaredFocus || grant.focusAreas || [];
        
        // Extract funding amounts
        const minAward = grant.fundingAmount?.min || grant.minAward;
        const maxAward = grant.fundingAmount?.max || grant.maxAward;
        const currency = grant.fundingAmount?.currency || grant.currency || 'GBP';
        
        // Extract deadline as structured JSON array
        const deadlineObj = grant.deadline;
        const deadlines = deadlineObj?.date 
          ? [{ date: deadlineObj.date, description: deadlineObj.description, isRolling: deadlineObj.isRolling || false, type: 'application' }]
          : (grant.deadlines || []);
        
        // Extract duration
        const durationMonths = grant.duration?.months || grant.durationMonths;
        
        // Determine status
        const status = deadlineObj?.date ? 'OPEN' : (deadlineObj?.isRolling ? 'OPEN' : 'UNKNOWN');
        
        // Build tags
        const tags: string[] = ['HARVEST', `RUN_${runId}`];
        if (grant.alignmentScore?.recommendation) {
          tags.push(`recommendation:${grant.alignmentScore.recommendation}`);
        }
        
        // Map alignment score to aiFitScore (0-1 → 0-10 scale)
        const aiFitScore = grant.alignmentScore?.overall != null
          ? Math.round(grant.alignmentScore.overall * 100) / 10  // e.g. 0.425 → 4.3
          : undefined;
        
        // Build aiFitReasons from strengths + concerns
        const aiFitReasons: string[] = [];
        if (grant.alignmentScore?.strengths) {
          grant.alignmentScore.strengths.forEach((s: string) => aiFitReasons.push(`✓ ${s}`));
        }
        if (grant.alignmentScore?.concerns) {
          grant.alignmentScore.concerns.forEach((c: string) => aiFitReasons.push(`⚠ ${c}`));
        }
        
        // Map recommendation to aiRecommendedAction (Prisma enum: PURSUE, MONITOR, NO_GO)
        const recommendationMap: Record<string, RecommendedAction> = {
          'highly_relevant': RecommendedAction.PURSUE,
          'relevant': RecommendedAction.PURSUE,
          'somewhat_relevant': RecommendedAction.MONITOR,
          'not_relevant': RecommendedAction.NO_GO,
        };
        const aiRecommendedAction: RecommendedAction | undefined = grant.alignmentScore?.recommendation
          ? recommendationMap[grant.alignmentScore.recommendation] || RecommendedAction.MONITOR
          : undefined;
        
        // Map confidence
        const aiConfidence = grant.confidence || grant.alignmentScore?.confidence;
        
        // Build processSteps from eligibility details
        const processSteps: string[] = [];
        if (ed?.careerStage) processSteps.push(`Career stage: ${ed.careerStage.join(', ')}`);
        if (ed?.collaborationRequirements) processSteps.push(`Collaboration: ${ed.collaborationRequirements}`);
        if (ed?.fundingHistory) processSteps.push(`Funding history: ${ed.fundingHistory}`);
        if (ed?.uncertainties?.length) processSteps.push(`Uncertainties: ${ed.uncertainties.join('; ')}`);
        
        // Store alignment dimensions as JSON in deadlines metadata
        // We'll store the full alignment data in tags for now
        if (grant.alignmentScore?.dimensions) {
          const dims = grant.alignmentScore.dimensions;
          tags.push(`dim:research=${Math.round((dims.researchStrandMatch || 0) * 100)}%`);
          tags.push(`dim:method=${Math.round((dims.methodologicalFit || 0) * 100)}%`);
          tags.push(`dim:theme=${Math.round((dims.thematicAlignment || 0) * 100)}%`);
          tags.push(`dim:impact=${Math.round((dims.impactPotential || 0) * 100)}%`);
          tags.push(`dim:feasibility=${Math.round((dims.practicalFeasibility || 0) * 100)}%`);
        }

        const matchByUrl = existingByUrl.get(sourceUrl);
        const matchByName = existingByName.get(programName.toLowerCase());

        // Extract per-opportunity URL if available
        const opportunityUrl = grant.opportunityUrl || grant.url || grant.link || null;

        // Common data payload for create/update
        const opportunityData = {
          programName,
          description,
          rawDescription,
          ...(opportunityUrl && { opportunityUrl }),
          declaredFocus: focusAreas,
          geographies,
          eligibleApplicantTypes: applicantTypes,
          deadlines,
          processSteps,
          minAward,
          maxAward,
          currency,
          durationMonths,
          status: status as OpportunityStatus,
          tags,
          ...(aiFitScore != null && { aiFitScore }),
          ...(aiFitReasons.length > 0 && { aiFitReasons }),
          ...(aiRecommendedAction && { aiRecommendedAction }),
          ...(aiConfidence != null && { aiConfidence }),
        };

        if (matchByUrl) {
          // Opportunity already exists - update
          await this.prisma.opportunity.update({
            where: { id: matchByUrl.id },
            data: { ...opportunityData, updatedAt: new Date() },
          });

          opportunitiesUpdated++;
        } else if (matchByName) {
          // Same program name but different URL - update
          await this.prisma.opportunity.update({
            where: { id: matchByName.id },
            data: { ...opportunityData, sourceUrl, updatedAt: new Date() },
          });

          opportunitiesUpdated++;
          warnings.push(
            `Updated opportunity "${programName}" with new URL`,
          );
        } else {
          // New opportunity - create
          const created = await this.prisma.opportunity.create({
            data: {
              ...opportunityData,
              funderId: funder.id,
              sourceUrl,
              applicationType: ApplicationType.OPEN,
              createdById: adminUser.id,
            },
          });

          opportunitiesCreated++;

          // Trigger scoring for new opportunity
          try {
            await this.scoring.updateOpportunityScore(created.id);
            opportunitiesScored++;
          } catch (error) {
            this.logger.warn(
              `Failed to score opportunity ${created.id}: ${error.message}`,
            );
            warnings.push(
              `Could not score opportunity "${programName}"`,
            );
          }
        }
      } catch (error) {
        this.logger.error(
          `Failed to process opportunity "${grant.programName}": ${error.message}`,
          error.stack,
        );
        warnings.push(
          `Failed to process opportunity "${grant.programName}": ${error.message}`,
        );
      }
    }

    this.logger.log(
      `Integration complete: ${opportunitiesCreated} created, ${opportunitiesUpdated} updated, ${opportunitiesScored} scored`,
    );

    return {
      funderId: funder.id,
      funderName: funder.name,
      opportunitiesCreated,
      opportunitiesUpdated,
      opportunitiesScored,
      warnings,
    };
  }

  /**
   * Get summary for a harvest run
   */
  async getSummary(runId: string): Promise<HarvestRunSummary> {
    const isProduction = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';
    
    const summaryPath = isProduction
      ? path.join('/tmp', 'harvest', 'runs', runId, 'summary.json')
      : path.join(process.cwd(), '..', 'frontend', 'harvest', 'runs', runId, 'summary.json');

    try {
      const summaryJson = await fs.readFile(summaryPath, 'utf-8');
      return JSON.parse(summaryJson);
    } catch (error) {
      throw new NotFoundException(
        `Harvest run summary not found for ${runId}`,
      );
    }
  }

  /**
   * Load harvest run plan from filesystem
   */
  private async loadPlan(runId: string): Promise<HarvestRunPlan> {
    const isProduction = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';
    
    const planPath = isProduction
      ? path.join('/tmp', 'harvest', 'runs', runId, 'plan.json')
      : path.join(process.cwd(), '..', 'frontend', 'harvest', 'runs', runId, 'plan.json');

    try {
      const planJson = await fs.readFile(planPath, 'utf-8');
      return JSON.parse(planJson);
    } catch (error) {
      throw new NotFoundException(`Harvest run plan not found for ${runId}`);
    }
  }

  /**
   * List available harvest runs for a funder
   */
  async listRunsForFunder(funderId: string): Promise<
    Array<{
      runId: string;
      timestamp: string;
      sourceName: string;
      stats: HarvestRunSummary['stats'];
    }>
  > {
    const isProduction = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';
    
    const runsBasePath = isProduction
      ? path.join('/tmp', 'harvest', 'runs')
      : path.join(process.cwd(), '..', 'frontend', 'harvest', 'runs');

    try {
      await fs.access(runsBasePath);
    } catch {
      return [];
    }

    const entries = await fs.readdir(runsBasePath, { withFileTypes: true });
    const runDirs = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    const runs: Array<{
      runId: string;
      timestamp: string;
      sourceName: string;
      stats: HarvestRunSummary['stats'];
    }> = [];

    for (const runId of runDirs) {
      try {
        const summary = await this.getSummary(runId);

        if (summary.funder.id === funderId) {
          runs.push({
            runId,
            timestamp: summary.executedAt,
            sourceName: summary.source.name,
            stats: summary.stats,
          });
        }
      } catch {
        // Skip runs that can't be read
        continue;
      }
    }

    // Sort by timestamp descending
    runs.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    return runs;
  }
}
