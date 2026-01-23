import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { IntelligentDiscoveryService } from '../../harvest/intelligent-discovery.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SuggestedSource, SourceDiscoveryResult, SourceDiscoveryRun } from '../../harvest/types';

/**
 * SourceDiscoveryProcessor - Discovers potential harvest sources using intelligent analysis
 * 
 * Uses IntelligentDiscoveryService for:
 * 1. Site structure analysis
 * 2. Section ranking by relevance
 * 3. Multi-level exploration
 * 4. Pattern recognition
 */
@Processor('harvest')
export class SourceDiscoveryProcessor extends WorkerHost {
  private readonly logger = new Logger(SourceDiscoveryProcessor.name);

  constructor(
    private prisma: PrismaService,
    private intelligentDiscovery: IntelligentDiscoveryService,
  ) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    const { funderId, seedUrl, userId, manualLinks = [], searchDepth = 2 } = job.data;
    const jobType = job.name;

    // Only process discover-sources jobs
    if (jobType !== 'discover-sources') {
      return;
    }

    const startTime = Date.now();
    this.logger.log(`\n${'='.repeat(80)}`);
    this.logger.log(`🔍 DISCOVERY JOB STARTED - Job ID: ${job.id}`);
    this.logger.log(`   Funder: ${funderId}`);
    this.logger.log(`   Seed URL: ${seedUrl || 'none'}`);
    this.logger.log(`   Manual links: ${manualLinks.length}`);
    this.logger.log(`   Search depth: ${searchDepth} levels`);
    this.logger.log(`   Time: ${new Date().toISOString()}`);
    this.logger.log(`${'='.repeat(80)}\n`);

    // Track discovery status
    const status = {
      phase: 'initializing',
      seedUrlProcessed: false,
      manualLinksProcessed: 0,
      totalSourcesFound: 0,
      errors: [] as string[],
    };

    // Update job progress
    await job.updateProgress({ phase: 'initializing', percent: 0 });

    try {
      // Load funder
      const funder = await this.prisma.funder.findUnique({
        where: { id: funderId },
        select: { id: true, name: true, websiteUrl: true },
      });

      if (!funder) {
        throw new Error(`Funder ${funderId} not found`);
      }

      const timestamp = new Date().toISOString();
      const funderSlug = this.slugify(funder.name);
      const timestampSlug = timestamp.replace(/[:.]/g, '-');
      const runId = `${funderSlug}_${timestampSlug}`;

      const allDiscoveredSources: any[] = [];

      // Phase 1: Process seed URL (if available)
      status.phase = 'discovering_from_seed';
      if (seedUrl) {
        this.logger.log(`\n📍 PHASE 1: Discovering from seed URL`);
        this.logger.log(`   Target: ${seedUrl}`);
        await job.updateProgress({ phase: 'discovering_from_seed', percent: 10 });
        
        try {
          const discoveredFromSeed = await this.intelligentDiscovery.discoverSources(seedUrl, searchDepth);
          allDiscoveredSources.push(...discoveredFromSeed);
          status.seedUrlProcessed = true;
          this.logger.log(`   ✅ Seed discovery complete: ${discoveredFromSeed.length} sources found`);
        } catch (seedError: any) {
          const errorMsg = `Seed URL discovery failed: ${seedError.message}`;
          this.logger.error(`   ❌ ${errorMsg}`);
          status.errors.push(errorMsg);
          // Continue - don't fail entirely if seed fails but we have manual links
        }
      }

      // Phase 2: Process manual links - just validate and add them
      status.phase = 'processing_manual_links';
      if (manualLinks.length > 0) {
        this.logger.log(`\n📎 PHASE 2: Processing ${manualLinks.length} manual link(s)`);
        await job.updateProgress({ phase: 'processing_manual_links', percent: 40 });
        
        for (let i = 0; i < manualLinks.length; i++) {
          const manualUrl = manualLinks[i];
          this.logger.log(`   [${i + 1}/${manualLinks.length}] Adding: ${manualUrl}`);
          try {
            // Validate URL
            new URL(manualUrl);
            
            // Check if already discovered
            const alreadyFound = allDiscoveredSources.some(s => s.url === manualUrl);
            if (alreadyFound) {
              this.logger.log(`   ⚠️  Manual link already discovered: ${manualUrl}`);
              status.manualLinksProcessed++;
              continue;
            }

            // Add manual link as a suggested source (extraction happens during harvest, not discovery)
            allDiscoveredSources.push({
              url: manualUrl,
              type: 'manual',
              score: 1.0,
              confidence: 1.0,
              reasoning: ['Manually added by user'],
              pageTitle: new URL(manualUrl).hostname,
              opportunityIndicators: 0,
            });

            status.manualLinksProcessed++;
          } catch (manualError: any) {
            const errorMsg = `Failed to process manual link ${manualUrl}: ${manualError.message}`;
            this.logger.error(`      ❌ Error: ${manualError.message}`);
            status.errors.push(errorMsg);
          }
          
          await job.updateProgress({ 
            phase: 'processing_manual_links', 
            percent: 40 + (50 * (i + 1) / manualLinks.length),
            currentUrl: manualUrl
          });
        }
      }

      // Phase 3: Finalize and write results
      status.phase = 'finalizing';
      status.totalSourcesFound = allDiscoveredSources.length;
      this.logger.log(`\n📊 PHASE 3: Finalizing results`);
      this.logger.log(`   Total sources found: ${allDiscoveredSources.length}`);
      await job.updateProgress({ phase: 'finalizing', percent: 90 });

      // Check if we found anything
      if (allDiscoveredSources.length === 0) {
        if (status.errors.length > 0) {
          throw new Error(`Discovery failed - no sources found. Errors: ${status.errors.join('; ')}`);
        } else {
          this.logger.warn('No sources discovered, but no errors occurred either');
        }
      }

      const discoveredSources = allDiscoveredSources;
      this.logger.log(`Total discovery found ${discoveredSources.length} sources`);

      // Phase 3: Convert to suggested sources format (no scoring yet - that happens during harvest)
      this.logger.log(`\n� PHASE 3: Preparing suggested sources`);
      await job.updateProgress({ phase: 'finalizing', percent: 85 });

      const topSources: SuggestedSource[] = discoveredSources.map(source => ({
        url: source.url,
        anchorText: source.pageTitle || source.url,
        title: source.type,
        score: source.score,
        discoveredAt: timestamp,
        pageTitle: source.pageTitle,
        keywords: source.reasoning,
        // No grantData or alignmentScore - those are populated during harvest
      }));

      // Create discovery result with enhanced status info
      const result: SourceDiscoveryResult = {
        funderId: funder.id,
        funderName: funder.name,
        seedUrl,
        discoveredAt: timestamp,
        sources: topSources,
        stats: {
          totalLinksFound: discoveredSources.length,
          linksScored: discoveredSources.length,
          topSourcesReturned: topSources.length,
          manualLinksProvided: manualLinks.length,
          manualLinksProcessed: status.manualLinksProcessed,
          seedUrlProcessed: status.seedUrlProcessed,
        },
        warnings: status.errors.length > 0 ? status.errors : undefined,
      };

      // Write results to filesystem in funder-specific directory (single directory per funder)
      const isProduction = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';
      
      const discoveryDir = isProduction
        ? path.join('/tmp', 'discovery', funderSlug)
        : path.join(process.cwd(), '..', 'frontend', 'discovery', funderSlug);

      await fs.mkdir(discoveryDir, { recursive: true });

      // Read existing sources to merge without duplicates
      const sourcesPath = path.join(discoveryDir, 'sources.json');
      let existingSources: any[] = [];
      try {
        const existingData = await fs.readFile(sourcesPath, 'utf-8');
        const existingResult = JSON.parse(existingData);
        existingSources = existingResult.sources || [];
      } catch (error) {
        // File doesn't exist yet, that's fine
      }

      // Merge sources, avoiding duplicates by URL
      const sourcesByUrl = new Map<string, any>();
      
      // Add existing sources
      for (const source of existingSources) {
        sourcesByUrl.set(source.url, source);
      }
      
      // Add/update with new sources (newer sources override older ones)
      for (const source of topSources) {
        sourcesByUrl.set(source.url, {
          ...source,
          lastDiscoveredAt: timestamp,
        });
      }
      
      const mergedSources = Array.from(sourcesByUrl.values());
      
      // Update result with merged sources
      const mergedResult = {
        ...result,
        sources: mergedSources,
        stats: {
          ...result.stats,
          totalUniqueSources: mergedSources.length,
          newSourcesThisRun: topSources.length,
        },
      };

      // Write merged sources.json
      await fs.writeFile(
        sourcesPath,
        JSON.stringify(mergedResult, null, 2),
      );

      // Write/update summary.md
      const summaryMd = this.generateSummaryMarkdown(mergedResult);
      await fs.writeFile(
        path.join(discoveryDir, 'summary.md'),
        summaryMd,
      );

      // Read existing runs and append new run
      const runsPath = path.join(discoveryDir, 'runs.json');
      let existingRuns: SourceDiscoveryRun[] = [];
      try {
        const runsData = await fs.readFile(runsPath, 'utf-8');
        existingRuns = JSON.parse(runsData);
      } catch (error) {
        // File doesn't exist yet, that's fine
      }

      // Create new run entry
      const newRun: SourceDiscoveryRun = {
        runId,
        funderId: funder.id,
        seedUrl,
        timestamp,
        status: 'completed',
        result: {
          funderId: funder.id,
          funderName: funder.name,
          seedUrl,
          discoveredAt: timestamp,
          sources: topSources,
          stats: {
            ...result.stats,
            newSourcesDiscovered: topSources.length,
          },
        },
      };

      // Append new run and keep last 50 runs
      existingRuns.push(newRun);
      if (existingRuns.length > 50) {
        existingRuns = existingRuns.slice(-50);
      }

      // Write runs.json
      await fs.writeFile(
        runsPath,
        JSON.stringify(existingRuns, null, 2),
      );

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.log(`\n${'='.repeat(80)}`);
      this.logger.log(`✅ DISCOVERY JOB COMPLETED - Job ID: ${job.id}`);
      this.logger.log(`   Duration: ${duration}s`);
      this.logger.log(`   Sources found: ${allDiscoveredSources.length}`);
      this.logger.log(`   Results written to: ${discoveryDir}`);
      this.logger.log(`${'='.repeat(80)}\n`);
      
      await job.updateProgress({ phase: 'completed', percent: 100 });

      return {
        success: true,
        runId,
        sourcesFound: topSources.length,
        discoveryPath: discoveryDir,
      };
    } catch (error) {
      this.logger.error(`Source discovery job ${job.id} failed:`);
      this.logger.error(error.message);
      
      // Write error result to filesystem for debugging
      try {
        const timestamp = new Date().toISOString();
        const funder = await this.prisma.funder.findUnique({
          where: { id: funderId },
          select: { name: true },
        });
        const funderSlug = funder ? this.slugify(funder.name) : 'unknown';
        const isProduction = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';
        
        const errorDir = isProduction
          ? path.join('/tmp', 'discovery', funderSlug)
          : path.join(process.cwd(), '..', 'frontend', 'discovery', funderSlug);

        // Ensure directory exists before writing
        await fs.mkdir(errorDir, { recursive: true });

        // Append error to runs.json
        const runsPath = path.join(errorDir, 'runs.json');
        let existingRuns: SourceDiscoveryRun[] = [];
        try {
          const runsData = await fs.readFile(runsPath, 'utf-8');
          existingRuns = JSON.parse(runsData);
        } catch (err) {
          // File doesn't exist yet
        }

        const errorRun: SourceDiscoveryRun = {
          runId: `error_${timestamp.replace(/[:.]/g, '-')}`,
          funderId,
          seedUrl: seedUrl || null,
          timestamp,
          status: 'failed',
          error: {
            message: error.message,
            stack: error.stack,
          },
        };

        existingRuns.push(errorRun);
        if (existingRuns.length > 50) {
          existingRuns = existingRuns.slice(-50);
        }

        await fs.writeFile(
          runsPath,
          JSON.stringify(existingRuns, null, 2),
        );

        this.logger.log(`Error details written to ${errorDir}/runs.json`);
      } catch (writeError) {
        this.logger.warn(`Failed to write error details: ${writeError.message}`);
      }

      throw error;
    }
  }

  /**
   * Count opportunity indicators in extracted grant data
   */
  private countGrantDataIndicators(grantData: any): number {
    let count = 0;
    if (grantData.deadline) count++;
    if (grantData.maxAward) count++;
    if (grantData.eligibility?.length > 0) count++;
    if (grantData.applicationInfo?.length > 0) count++;
    if (grantData.keyDates?.length > 0) count++;
    return count;
  }

  /**
   * Convert string to URL-safe slug
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Generate human-readable summary markdown
   */
  private generateSummaryMarkdown(result: SourceDiscoveryResult): string {
    const lines: string[] = [];

    lines.push(`# Source Discovery Summary – ${result.funderName}`);
    lines.push('');
    lines.push(`**Discovered at:** ${new Date(result.discoveredAt).toLocaleString()}`);
    lines.push(`**Seed URL:** ${result.seedUrl}`);
    lines.push('');

    lines.push('## Statistics');
    lines.push('');
    lines.push(`- Total links found: ${result.stats.totalLinksFound}`);
    lines.push(`- Links with funding keywords: ${result.stats.linksScored}`);
    lines.push(`- Top sources returned: ${result.stats.topSourcesReturned}`);
    lines.push('');

    lines.push('## Suggested Harvest Sources');
    lines.push('');

    if (result.sources.length === 0) {
      lines.push('*No potential harvest sources found.*');
    } else {
      result.sources.forEach((source, index) => {
        lines.push(`### ${index + 1}. ${source.url}`);
        lines.push('');
        lines.push(`- **Score:** ${(source.score * 100).toFixed(1)}%`);
        if (source.anchorText) {
          lines.push(`- **Anchor text:** ${source.anchorText}`);
        }
        if (source.title) {
          lines.push(`- **Title attribute:** ${source.title}`);
        }
        if (source.keywords.length > 0) {
          lines.push(`- **Matched keywords:** ${source.keywords.join(', ')}`);
        }
        lines.push('');
      });
    }

    lines.push('## Next Steps');
    lines.push('');
    lines.push('1. Review the suggested sources above');
    lines.push('2. Select relevant URLs from the Harvest modal in the Funders UI');
    lines.push('3. Configure scraper selectors for each selected source');
    lines.push('4. Trigger harvest to extract opportunities');
    lines.push('');

    return lines.join('\n');
  }
}
