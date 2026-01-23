import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScoringService } from '../scoring/scoring.service';
import { HarvestRunPlan, HarvestRunSummary } from './types';
import { OpportunityStatus, ApplicationType } from '@prisma/client';
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
        const sourceUrl = plan.sourceUrl; // LLM grants don't have individual URLs
        
        // Extract data from LLM format
        const description = grant.description || '';
        const eligibility = Array.isArray(grant.eligibility) ? grant.eligibility : 
                           (grant.eligibility ? [grant.eligibility] : []);
        const geographies = grant.geographies || [];
        const applicantTypes = grant.applicantTypes || [];
        const focusAreas = grant.focusAreas || [];
        
        // Extract funding amounts
        const minAward = grant.fundingAmount?.min || grant.minAward;
        const maxAward = grant.fundingAmount?.max || grant.maxAward;
        const currency = grant.fundingAmount?.currency || grant.currency || 'GBP';
        
        // Extract deadline
        const deadlineStr = grant.deadline?.date || grant.deadline?.description || grant.deadlines;
        const deadlines = deadlineStr ? [deadlineStr] : [];
        
        // Extract duration
        const durationMonths = grant.duration?.months || grant.durationMonths;
        
        // Determine status
        const status = grant.deadline?.date ? 'OPEN' : 'UNKNOWN';
        
        // Build tags from alignment score
        const tags: string[] = [];
        if (grant.alignmentScore) {
          tags.push(`alignment:${Math.round(grant.alignmentScore.overall * 100)}%`);
          tags.push(`recommendation:${grant.alignmentScore.recommendation}`);
          if (grant.alignmentScore.matchedStrands) {
            grant.alignmentScore.matchedStrands.forEach((strand: string) => {
              tags.push(`strand:${strand}`);
            });
          }
        }

        const matchByUrl = existingByUrl.get(sourceUrl);
        const matchByName = existingByName.get(programName.toLowerCase());

        if (matchByUrl) {
          // Opportunity already exists - update if needed
          await this.prisma.opportunity.update({
            where: { id: matchByUrl.id },
            data: {
              programName,
              description,
              rawDescription: description,
              declaredFocus: focusAreas,
              geographies,
              eligibleApplicantTypes: applicantTypes,
              deadlines,
              minAward,
              maxAward,
              currency,
              durationMonths,
              status: status as OpportunityStatus,
              tags,
              updatedAt: new Date(),
            },
          });

          opportunitiesUpdated++;
        } else if (matchByName) {
          // Same program name but different URL - likely an update
          await this.prisma.opportunity.update({
            where: { id: matchByName.id },
            data: {
              sourceUrl,
              description,
              rawDescription: description,
              declaredFocus: focusAreas,
              geographies,
              eligibleApplicantTypes: applicantTypes,
              deadlines,
              minAward,
              maxAward,
              currency,
              durationMonths,
              status: status as OpportunityStatus,
              tags,
              updatedAt: new Date(),
            },
          });

          opportunitiesUpdated++;
          warnings.push(
            `Updated opportunity "${programName}" with new URL`,
          );
        } else {
          // New opportunity - create it
          const created = await this.prisma.opportunity.create({
            data: {
              funderId: funder.id,
              programName,
              sourceUrl,
              description,
              rawDescription: description,
              declaredFocus: focusAreas,
              geographies,
              eligibleApplicantTypes: applicantTypes,
              deadlines,
              minAward,
              maxAward,
              currency,
              durationMonths,
              status: status as OpportunityStatus,
              applicationType: ApplicationType.OPEN,
              tags,
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
