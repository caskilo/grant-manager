import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogueParser } from './catalogue-parser';
import {
  DiscoverySource,
  DiscoveryRunMetadata,
  DiscoveryRunPlan,
  DiscoverySummary,
  ParsedCatalogueEntry,
} from './types';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * DiscoveryRunService - Orchestrates discovery workflow runs
 * 
 * Responsibilities:
 * - Initialize discovery run folders
 * - Read sources configuration
 * - Coordinate parsing of catalogue HTML
 * - Compare parsed data with current DB state
 * - Generate discovery summary documents
 */
@Injectable()
export class DiscoveryRunService {
  private readonly logger = new Logger(DiscoveryRunService.name);
  private readonly catalogueParser = new CatalogueParser();

  constructor(private prisma: PrismaService) {}

  /**
   * Execute a discovery run for a given source
   */
  async executeRun(runDate: string, sourceId: string): Promise<DiscoverySummary> {
    this.logger.log(`Starting discovery run for ${sourceId} on ${runDate}`);

    const startTime = new Date().toISOString();
    const metadata: DiscoveryRunMetadata = {
      runDate,
      sourceId,
      sourceName: '',
      startTime,
      status: 'running',
    };

    try {
      // 1. Load source configuration
      const source = await this.loadSource(sourceId);
      metadata.sourceName = source.name;

      // 2. Initialize run folder structure
      const runFolder = await this.initializeRunFolder(runDate);

      // 3. Collect raw data
      const rawPath = await this.collectRawData(source, runFolder);

      // 4. Parse into structured data
      const entries = await this.parseData(source, rawPath, runFolder);

      // 5. Generate discovery plan (compare with DB)
      const plan = await this.generatePlan(entries);

      // 6. Create summary
      const summary = this.createSummary(metadata, plan, entries.length);

      // 7. Write summary documents
      await this.writeSummaryDocuments(runFolder, summary);

      // 8. Update metadata
      metadata.endTime = new Date().toISOString();
      metadata.status = 'completed';
      summary.metadata = metadata;

      this.logger.log(`Discovery run completed successfully`);
      return summary;

    } catch (error: any) {
      this.logger.error(`Discovery run failed: ${error.message}`, error.stack);
      metadata.endTime = new Date().toISOString();
      metadata.status = 'failed';
      metadata.error = error.message;
      throw error;
    }
  }

  /**
   * Load source configuration
   * In production, sources are hardcoded. In development, can be extended to read from file.
   */
  private async loadSource(sourceId: string): Promise<DiscoverySource> {
    // Hardcoded sources that work in both development and production
    const sources: DiscoverySource[] = [
      {
        id: 'catalogue_v1',
        type: 'catalogue',
        name: 'Odyssean Funder Catalogue v1',
        pathOrUrl: process.env.CATALOGUE_URL || 'https://caskilo.github.io/grant-manager/catalogue.json',
        enabled: true,
        notes: 'Funder catalogue fetched from deployed frontend',
      },
    ];

    const source = sources.find(s => s.id === sourceId);
    if (!source) {
      throw new Error(`Source ${sourceId} not found`);
    }

    if (!source.enabled) {
      throw new Error(`Source ${sourceId} is disabled`);
    }

    this.logger.log(`Loaded source: ${source.name} from ${source.pathOrUrl}`);
    return source;
  }

  /**
   * Initialize run folder structure
   * Production: Uses /tmp (ephemeral but writable on Heroku)
   * Development: Uses frontend/discovery/runs/ (client-owned)
   */
  private async initializeRunFolder(runDate: string): Promise<string> {
    const isProduction = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';
    
    const runFolder = isProduction
      ? path.join('/tmp', 'discovery-runs', runDate)
      : path.join(__dirname, '../../../..', 'frontend', 'discovery', 'runs', runDate);

    this.logger.log(`Initializing run folder: ${runFolder}`);

    // Create folders
    await fs.mkdir(path.join(runFolder, 'raw'), { recursive: true });
    await fs.mkdir(path.join(runFolder, 'parsed'), { recursive: true });
    await fs.mkdir(path.join(runFolder, 'summary'), { recursive: true });

    // Write run metadata
    const runMetadata = {
      runDate,
      createdAt: new Date().toISOString(),
    };
    await fs.writeFile(
      path.join(runFolder, 'run.json'),
      JSON.stringify(runMetadata, null, 2)
    );

    this.logger.log(`Initialized run folder: ${runFolder}`);
    return runFolder;
  }

  /**
   * Collect raw data from source
   */
  private async collectRawData(source: DiscoverySource, runFolder: string): Promise<string> {
    const rawFolder = path.join(runFolder, 'raw');
    await fs.mkdir(rawFolder, { recursive: true });

    if (source.type === 'catalogue') {
      const destPath = path.join(rawFolder, 'catalogue_v1.json');
      
      // Check if pathOrUrl is a URL (http/https) or a file path
      if (source.pathOrUrl.startsWith('http://') || source.pathOrUrl.startsWith('https://')) {
        // Fetch from HTTP(S) URL
        const axios = require('axios');
        this.logger.log(`Fetching catalogue from URL: ${source.pathOrUrl}`);
        const response = await axios.get(source.pathOrUrl);
        await fs.writeFile(destPath, JSON.stringify(response.data, null, 2), 'utf-8');
        this.logger.log(`Downloaded catalogue to ${destPath}`);
      } else {
        // Treat as a relative file path (for local development)
        const sourcePath = path.join(
          __dirname,
          '../../../..',
          'frontend',
          'public',
          'catalogue.json'
        );
        this.logger.log(`Copying catalogue from: ${sourcePath}`);
        await fs.copyFile(sourcePath, destPath);
        this.logger.log(`Copied catalogue to ${destPath}`);
      }

      return destPath;
    }

    throw new Error(`Unsupported source type: ${source.type}`);
  }

  /**
   * Parse raw data into structured format
   */
  private async parseData(
    source: DiscoverySource,
    rawPath: string,
    runFolder: string
  ): Promise<ParsedCatalogueEntry[]> {
    const parsedFolder = path.join(runFolder, 'parsed');

    if (source.type === 'catalogue') {
      const content = await fs.readFile(rawPath, 'utf-8');
      const catalogueData = JSON.parse(content);
      
      // Convert catalogue JSON format to ParsedCatalogueEntry format
      const entries: ParsedCatalogueEntry[] = catalogueData.funders.map((funder: any) => ({
        funder: {
          funderName: funder.name,
          website: funder.websiteUrl,
          type: funder.type,
          focus: funder.focus?.join(', ') || '',
          geography: funder.geographies?.join(', ') || '',
          notes: funder.notes || '',
        },
        opportunities: [
          {
            externalId: `${this.slugify(funder.name)}-general`,
            programName: `${funder.name} - General Funding`,
            sourceUrl: funder.websiteUrl,
            declaredFocus: funder.focus || [],
            geographies: funder.geographies || [],
            eligibleApplicantTypes: ['CHARITY', 'UNIVERSITY', 'RESEARCH_INSTITUTE'],
            minAward: funder.typicalAwardMin,
            maxAward: funder.typicalAwardMax,
            currency: funder.currency || 'GBP',
            rawDescription: `${funder.name} is a ${funder.type}. Focus: ${funder.focus?.join(', ') || 'N/A'}. Geography: ${funder.geographies?.join(', ') || 'N/A'}.`,
            status: 'OPEN',
          },
        ],
      }));

      // Write each entry to a separate JSON file
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const filename = `${this.slugify(entry.funder.funderName)}.json`;
        await fs.writeFile(
          path.join(parsedFolder, filename),
          JSON.stringify(entry, null, 2)
        );
      }

      this.logger.log(`Parsed ${entries.length} catalogue entries`);
      return entries;
    }

    throw new Error(`Unsupported source type: ${source.type}`);
  }

  /**
   * Generate discovery plan by comparing with DB
   */
  private async generatePlan(entries: ParsedCatalogueEntry[]): Promise<DiscoveryRunPlan> {
    const plan: DiscoveryRunPlan = {
      newFunders: [],
      existingFunders: [],
      newOpportunities: [],
      updatedOpportunities: [],
      unchangedOpportunities: [],
    };

    // Get all existing funders from DB
    const existingFunders = await this.prisma.funder.findMany({
      select: { id: true, name: true, websiteUrl: true },
    });

    // Get all existing opportunities from DB
    const existingOpportunities = await this.prisma.opportunity.findMany({
      select: { id: true, programName: true, sourceUrl: true, funderId: true },
    });

    for (const entry of entries) {
      // Check if funder exists (match by name or website)
      const matchedFunder = existingFunders.find(
        f =>
          f.name.toLowerCase() === entry.funder.funderName.toLowerCase() ||
          (entry.funder.website && f.websiteUrl === entry.funder.website)
      );

      if (!matchedFunder) {
        plan.newFunders.push({
          funder: entry.funder,
          reason: 'No matching funder found in database',
        });
      } else {
        plan.existingFunders.push({
          id: matchedFunder.id,
          name: matchedFunder.name,
          matched: entry.funder,
        });
      }

      // Check opportunities
      for (const opp of entry.opportunities) {
        const matchedOpp = existingOpportunities.find(
          o =>
            o.sourceUrl === opp.sourceUrl ||
            (o.programName.toLowerCase() === opp.programName.toLowerCase() &&
              matchedFunder &&
              o.funderId === matchedFunder.id)
        );

        if (!matchedOpp) {
          plan.newOpportunities.push({
            opportunity: opp,
            funderName: entry.funder.funderName,
            reason: 'No matching opportunity found in database',
          });
        } else {
          // For now, mark as unchanged (could implement diff logic later)
          plan.unchangedOpportunities.push({
            id: matchedOpp.id,
            programName: matchedOpp.programName,
          });
        }
      }
    }

    this.logger.log(
      `Plan: ${plan.newFunders.length} new funders, ${plan.newOpportunities.length} new opportunities`
    );

    return plan;
  }

  /**
   * Create discovery summary
   */
  private createSummary(
    metadata: DiscoveryRunMetadata,
    plan: DiscoveryRunPlan,
    totalEntries: number
  ): DiscoverySummary {
    const recommendations: string[] = [];
    const notes: string[] = [];

    if (plan.newFunders.length > 0) {
      recommendations.push(
        `Create ${plan.newFunders.length} new funders in the database`
      );
    }

    if (plan.newOpportunities.length > 0) {
      recommendations.push(
        `Create ${plan.newOpportunities.length} new opportunities in the database`
      );
      recommendations.push(
        `Trigger scoring and eligibility checks for new opportunities`
      );
    }

    notes.push(
      `Catalogue contains ${totalEntries} funders with basic metadata`
    );
    notes.push(
      `Opportunities are placeholder entries - real opportunities should be scraped from funder websites`
    );

    return {
      metadata,
      plan,
      stats: {
        totalFundersInSource: totalEntries,
        newFunders: plan.newFunders.length,
        existingFunders: plan.existingFunders.length,
        totalOpportunities: plan.newOpportunities.length + plan.unchangedOpportunities.length,
        newOpportunities: plan.newOpportunities.length,
        updatedOpportunities: plan.updatedOpportunities.length,
        unchangedOpportunities: plan.unchangedOpportunities.length,
      },
      recommendations,
      notes,
    };
  }

  /**
   * Write summary documents (markdown and JSON)
   */
  private async writeSummaryDocuments(
    runFolder: string,
    summary: DiscoverySummary
  ): Promise<void> {
    const summaryFolder = path.join(runFolder, 'summary');

    // Write JSON summary
    await fs.writeFile(
      path.join(summaryFolder, 'discovery-summary.json'),
      JSON.stringify(summary, null, 2)
    );

    // Write markdown summary
    const markdown = this.generateMarkdownSummary(summary);
    await fs.writeFile(
      path.join(summaryFolder, 'discovery-summary.md'),
      markdown
    );

    this.logger.log(`Wrote summary documents to ${summaryFolder}`);
  }

  /**
   * Generate markdown summary document
   */
  private generateMarkdownSummary(summary: DiscoverySummary): string {
    const { metadata, plan, stats, recommendations, notes } = summary;

    let md = `# Discovery Summary – ${metadata.runDate}\n\n`;

    md += `## Metadata\n\n`;
    md += `- **Source**: ${metadata.sourceName} (${metadata.sourceId})\n`;
    md += `- **Run Date**: ${metadata.runDate}\n`;
    md += `- **Start Time**: ${metadata.startTime}\n`;
    md += `- **End Time**: ${metadata.endTime || 'N/A'}\n`;
    md += `- **Status**: ${metadata.status}\n\n`;

    md += `## Statistics\n\n`;
    md += `- Total funders in source: ${stats.totalFundersInSource}\n`;
    md += `- New funders: ${stats.newFunders}\n`;
    md += `- Existing funders: ${stats.existingFunders}\n`;
    md += `- Total opportunities: ${stats.totalOpportunities}\n`;
    md += `- New opportunities: ${stats.newOpportunities}\n`;
    md += `- Updated opportunities: ${stats.updatedOpportunities}\n`;
    md += `- Unchanged opportunities: ${stats.unchangedOpportunities}\n\n`;

    if (plan.newFunders.length > 0) {
      md += `## New Funders (Proposed)\n\n`;
      for (const { funder } of plan.newFunders) {
        md += `### ${funder.funderName}\n\n`;
        md += `- **Type**: ${funder.type || 'N/A'}\n`;
        md += `- **Focus**: ${funder.focus || 'N/A'}\n`;
        md += `- **Geography**: ${funder.geography || 'N/A'}\n`;
        md += `- **Website**: ${funder.website || 'N/A'}\n`;
        md += `- **Notes**: ${funder.notes || 'N/A'}\n`;
        md += `- **Parsed file**: \`parsed/${this.slugify(funder.funderName)}.json\`\n\n`;
      }
    }

    if (plan.newOpportunities.length > 0) {
      md += `## New Opportunities (Proposed)\n\n`;
      for (let i = 0; i < Math.min(plan.newOpportunities.length, 20); i++) {
        const { opportunity, funderName } = plan.newOpportunities[i];
        md += `### ${i + 1}. ${opportunity.programName}\n\n`;
        md += `- **Funder**: ${funderName}\n`;
        md += `- **Source URL**: ${opportunity.sourceUrl}\n`;
        md += `- **Focus**: ${opportunity.declaredFocus.join(', ')}\n`;
        md += `- **Geography**: ${opportunity.geographies.join(', ')}\n`;
        md += `- **Eligible Types**: ${opportunity.eligibleApplicantTypes.join(', ')}\n`;
        if (opportunity.minAward || opportunity.maxAward) {
          const range = [
            opportunity.minAward ? `${opportunity.currency} ${opportunity.minAward.toLocaleString()}` : '',
            opportunity.maxAward ? `${opportunity.currency} ${opportunity.maxAward.toLocaleString()}` : '',
          ].filter(Boolean).join(' - ');
          md += `- **Award Range**: ${range}\n`;
        }
        md += `- **Parsed file**: \`parsed/${this.slugify(funderName)}.json\`\n\n`;
      }

      if (plan.newOpportunities.length > 20) {
        md += `\n_... and ${plan.newOpportunities.length - 20} more opportunities_\n\n`;
      }
    }

    md += `## Recommended Actions\n\n`;
    for (const rec of recommendations) {
      md += `- [ ] ${rec}\n`;
    }
    md += `\n`;

    md += `## Notes & Observations\n\n`;
    for (const note of notes) {
      md += `- ${note}\n`;
    }
    md += `\n`;

    return md;
  }

  /**
   * Helper: slugify text
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
