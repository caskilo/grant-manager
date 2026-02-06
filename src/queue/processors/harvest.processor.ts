import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { LLMGrantExtractorService } from '../../harvest/llm-grant-extractor.service';
import { OdysseanAlignmentService } from '../../harvest/odyssean-alignment.service';
import { HarvestIntegrationService } from '../../harvest/harvest-integration.service';
import { HarvestRunPlan, HarvestRunSummary } from '../../harvest/types';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * HarvestProcessor - Executes LLM-based grant extraction and scoring
 * 
 * Protocol:
 * 1. Load HarvestSource configuration
 * 2. Fetch page HTML
 * 3. Extract grants using LLM (with fallback to heuristics)
 * 4. Score grants for Odyssean Institute alignment
 * 5. Generate plan.json and summary
 * 6. Update harvest source metadata
 */
@Processor('harvest')
export class HarvestProcessor extends WorkerHost {
  private readonly logger = new Logger(HarvestProcessor.name);

  constructor(
    private prisma: PrismaService,
    private llmExtractor: LLMGrantExtractorService,
    private odysseanAlignment: OdysseanAlignmentService,
    private integrationService: HarvestIntegrationService,
  ) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    const jobType = job.name;
    
    // Only process harvest jobs (not discovery jobs)
    if (jobType === 'discover-sources') {
      return; // Let SourceDiscoveryProcessor handle this
    }

    const { sourceId, userId } = job.data;
    this.logger.log(`\n${'='.repeat(80)}`);
    this.logger.log(`🌾 HARVEST JOB STARTED - Job ID: ${job.id}`);
    this.logger.log(`   Source: ${sourceId}`);
    this.logger.log(`   Time: ${new Date().toISOString()}`);
    this.logger.log(`${'='.repeat(80)}\n`);

    try {
      // Phase 1: Load configuration
      await job.updateProgress({ phase: 'loading_config', percent: 5 });
      this.logger.log(`\n📋 PHASE 1: Loading configuration`);
      
      const source = await this.prisma.harvestSource.findUnique({
        where: { id: sourceId },
      });

      if (!source) {
        throw new Error(`Harvest source ${sourceId} not found`);
      }

      if (!source.enabled) {
        throw new Error(`Harvest source ${source.name} is disabled`);
      }

      // Update lastRunAt
      await this.prisma.harvestSource.update({
        where: { id: sourceId },
        data: { lastRunAt: new Date() },
      });

      // Load funder information
      const funder = await this.prisma.funder.findUnique({
        where: { id: source.funderId! },
        select: { id: true, name: true },
      });

      if (!funder) {
        throw new Error(`Funder not found for harvest source ${source.id}`);
      }

      this.logger.log(`   ✓ Source: ${source.name}`);
      this.logger.log(`   ✓ URL: ${source.baseUrl}`);
      this.logger.log(`   ✓ Funder: ${funder.name}`);

      // Phase 2: Fetch page and extract grants using LLM
      await job.updateProgress({ phase: 'scraping_opportunities', percent: 20, currentUrl: source.baseUrl });
      this.logger.log(`\n🕷️  PHASE 2: Extracting grants with LLM`);
      this.logger.log(`   Fetching: ${source.baseUrl}`);
      
      // Fetch HTML
      const response = await fetch(source.baseUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      this.logger.log(`   ✓ Fetched ${html.length} characters`);

      // Extract grants using LLM (with fallback to heuristics)
      this.logger.log(`   Extracting grants...`);
      const extractionResult = await this.llmExtractor.extractFromHtml(html, source.baseUrl);

      if (!extractionResult || extractionResult.grants.length === 0) {
        throw new Error('No grants extracted from page');
      }

      this.logger.log(`   ✓ Extracted ${extractionResult.grants.length} grants (confidence: ${(extractionResult.confidence * 100).toFixed(0)}%)`);
      this.logger.log(`   ✓ Tokens used: ${extractionResult.tokensUsed}`);

      // Generate run ID and directories
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const runId = `${this.slugify(source.name)}_${timestamp}`;
      const isProduction = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';
      
      const harvestDir = isProduction
        ? path.join('/tmp', 'harvest', 'runs', runId)
        : path.join(process.cwd(), '..', 'frontend', 'harvest', 'runs', runId);

      await fs.mkdir(harvestDir, { recursive: true });

      // Phase 3: Score grants for Odyssean alignment
      await job.updateProgress({ phase: 'normalizing_data', percent: 40 });
      this.logger.log(`\n🔄 PHASE 3: Scoring Odyssean alignment`);
      
      const scoredGrants = [];
      let totalTokens = extractionResult.tokensUsed;

      for (let i = 0; i < extractionResult.grants.length; i++) {
        const grant = extractionResult.grants[i];
        this.logger.log(`   [${i + 1}/${extractionResult.grants.length}] Scoring: ${grant.programName}`);
        
        try {
          const alignmentScore = await this.odysseanAlignment.scoreGrant({
            programName: grant.programName,
            description: grant.description,
            funderName: funder.name,
            eligibility: grant.eligibility,
            fundingAmount: grant.fundingAmount,
            deadline: grant.deadline?.date || grant.deadline?.description,
            duration: grant.duration?.description,
            geographies: grant.geographies,
            focusAreas: grant.focusAreas,
            applicantTypes: grant.applicantTypes,
            sourceUrl: source.baseUrl,
          });

          totalTokens += alignmentScore.tokensUsed || 0;

          scoredGrants.push({
            ...grant,
            alignmentScore,
          });

          this.logger.log(`     → ${(alignmentScore.overall * 100).toFixed(1)}% | ${alignmentScore.recommendation}`);
        } catch (error: any) {
          this.logger.warn(`     ✗ Scoring failed: ${error.message}`);
          scoredGrants.push({
            ...grant,
            alignmentScore: null,
          });
        }

        await job.updateProgress({ 
          phase: 'normalizing_data', 
          percent: 40 + (30 * (i + 1) / extractionResult.grants.length)
        });
      }

      this.logger.log(`   ✓ Scored ${scoredGrants.length} grants`);
      this.logger.log(`   ✓ Total tokens used: ${totalTokens}`);

      // Phase 4: Generate plan and summary
      await job.updateProgress({ phase: 'generating_plan', percent: 60 });
      this.logger.log(`\n📝 PHASE 4: Generating harvest plan`);
      
      const plan: HarvestRunPlan = {
        runId,
        sourceType: 'llm_extraction',
        sourceName: source.name,
        sourceUrl: source.baseUrl,
        funderId: funder.id,
        funderName: funder.name,
        config: { 
          extractionMethod: 'llm',
          tokensUsed: totalTokens,
          extractionConfidence: extractionResult.confidence,
        },
        timestamp: new Date().toISOString(),
        stats: {
          totalOpportunities: scoredGrants.length,
          newOpportunities: scoredGrants.length, // All are new from this harvest
          updatedOpportunities: 0,
          unchangedOpportunities: 0,
        },
        opportunities: scoredGrants as any, // Store scored grants with alignment
      };

      await fs.writeFile(
        path.join(harvestDir, 'plan.json'),
        JSON.stringify(plan, null, 2),
      );
      this.logger.log(`   ✓ Plan saved to ${runId}/plan.json`);

      // Create summary
      const summary: HarvestRunSummary = {
        runId,
        source: {
          id: source.id,
          name: source.name,
          baseUrl: source.baseUrl,
        },
        funder: {
          id: funder.id,
          name: funder.name,
        },
        executedAt: new Date().toISOString(),
        status: 'completed',
        stats: {
          opportunitiesFound: scoredGrants.length,
          newOpportunities: scoredGrants.length,
          updatedOpportunities: 0,
        },
      };

      await fs.writeFile(
        path.join(harvestDir, 'summary.json'),
        JSON.stringify(summary, null, 2),
      );

      // Generate human-readable summary markdown
      const summaryMd = this.generateSummaryMarkdown(scoredGrants, funder.name, source.name, totalTokens);
      await fs.writeFile(
        path.join(harvestDir, 'summary.md'),
        summaryMd,
      );
      this.logger.log(`   ✓ Summary generated`);

      // Phase 5: Auto-integrate opportunities into DB
      await job.updateProgress({ phase: 'integrating', percent: 80 });
      this.logger.log(`\n🔗 PHASE 5: Auto-integrating opportunities into database`);

      let integrationResult;
      try {
        integrationResult = await this.integrationService.applyRun(runId, {
          funderId: funder.id,
          dryRun: false,
        });
        this.logger.log(`   ✓ Created: ${integrationResult.opportunitiesCreated}`);
        this.logger.log(`   ✓ Updated: ${integrationResult.opportunitiesUpdated}`);
        this.logger.log(`   ✓ Scored: ${integrationResult.opportunitiesScored}`);
        if (integrationResult.warnings.length > 0) {
          integrationResult.warnings.forEach(w => this.logger.warn(`   ⚠ ${w}`));
        }
      } catch (error: any) {
        this.logger.error(`   ✗ Auto-integration failed: ${error.message}`);
        this.logger.error(`   Opportunities saved to plan.json but not yet in DB. Run manual integration.`);
      }

      // Phase 6: Finalize
      await job.updateProgress({ phase: 'finalizing', percent: 95 });
      this.logger.log(`\n✅ PHASE 6: Finalizing`);
      
      // Update harvest source success metadata
      await this.prisma.harvestSource.update({
        where: { id: sourceId },
        data: { lastSuccessAt: new Date() },
      });

      this.logger.log(`   ✓ Metadata updated`);
      this.logger.log(`\n${'='.repeat(80)}`);
      this.logger.log(`🎉 HARVEST JOB COMPLETED SUCCESSFULLY`);
      this.logger.log(`   Run ID: ${runId}`);
      this.logger.log(`   Grants extracted: ${scoredGrants.length}`);
      this.logger.log(`   Opportunities created: ${integrationResult?.opportunitiesCreated ?? 'N/A'}`);
      this.logger.log(`   Tokens used: ${totalTokens}`);
      this.logger.log(`   Extraction confidence: ${(extractionResult.confidence * 100).toFixed(0)}%`);
      this.logger.log(`${'='.repeat(80)}\n`);

      return {
        success: true,
        runId,
        grantsExtracted: scoredGrants.length,
        opportunitiesCreated: integrationResult?.opportunitiesCreated ?? 0,
        opportunitiesUpdated: integrationResult?.opportunitiesUpdated ?? 0,
        tokensUsed: totalTokens,
        extractionConfidence: extractionResult.confidence,
        harvestPath: harvestDir,
      };
    } catch (error) {
      this.logger.error(`Harvest job ${job.id} failed:`, error);
      throw error;
    }
  }

  /**
   * Generate human-readable summary markdown for LLM-extracted grants
   */
  private generateSummaryMarkdown(scoredGrants: any[], funderName: string, sourceName: string, totalTokens: number): string {
    const lines: string[] = [];

    lines.push(`# Harvest Run Summary – ${funderName}`);
    lines.push('');
    lines.push(`**Source:** ${sourceName}`);
    lines.push(`**Executed at:** ${new Date().toLocaleString()}`);
    lines.push(`**Extraction method:** LLM with fallback`);
    lines.push(`**Tokens used:** ${totalTokens}`);
    lines.push('');

    lines.push('## Statistics');
    lines.push('');
    lines.push(`- Total grants extracted: **${scoredGrants.length}**`);
    lines.push(`- Highly relevant: **${scoredGrants.filter(g => g.alignmentScore?.recommendation === 'highly_relevant').length}**`);
    lines.push(`- Relevant: **${scoredGrants.filter(g => g.alignmentScore?.recommendation === 'relevant').length}**`);
    lines.push(`- Somewhat relevant: **${scoredGrants.filter(g => g.alignmentScore?.recommendation === 'somewhat_relevant').length}**`);
    lines.push(`- Not relevant: **${scoredGrants.filter(g => g.alignmentScore?.recommendation === 'not_relevant').length}**`);
    lines.push('');

    if (scoredGrants.length > 0) {
      lines.push('## Extracted Grants');
      lines.push('');

      const topGrants = scoredGrants.slice(0, 10); // Show first 10
      topGrants.forEach((grant, index) => {
        lines.push(`### ${index + 1}. ${grant.programName}`);
        lines.push('');
        if (grant.alignmentScore) {
          const score = (grant.alignmentScore.overall * 100).toFixed(1);
          lines.push(`**Odyssean Alignment:** ${score}% (${grant.alignmentScore.recommendation})`);
        }
        if (grant.description) {
          lines.push(`- **Description:** ${grant.description.substring(0, 200)}...`);
        }
        if (grant.deadline) {
          lines.push(`- **Deadline:** ${grant.deadline.date || grant.deadline.description || 'Not specified'}`);
        }
        if (grant.fundingAmount) {
          const min = grant.fundingAmount.min;
          const max = grant.fundingAmount.max;
          const currency = grant.fundingAmount.currency || '';
          if (min && max) {
            lines.push(`- **Funding:** ${currency}${min.toLocaleString()} - ${currency}${max.toLocaleString()}`);
          } else if (max) {
            lines.push(`- **Funding:** Up to ${currency}${max.toLocaleString()}`);
          }
        }
        lines.push('');
      });

      if (scoredGrants.length > 10) {
        lines.push(`*... and ${scoredGrants.length - 10} more grants*`);
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Slugify text for directory names
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
