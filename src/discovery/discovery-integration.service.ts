import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScoringService } from '../scoring/scoring.service';
import { DiscoverySummary } from './types';
import * as fs from 'fs/promises';
import * as path from 'path';
import { FunderType, ApplicationType } from '@prisma/client';

export interface IntegrationResult {
  success: boolean;
  fundersCreated: number;
  opportunitiesCreated: number;
  opportunitiesScored: number;
  warnings: string[];
  dryRun: boolean;
}

@Injectable()
export class DiscoveryIntegrationService {
  private readonly logger = new Logger(DiscoveryIntegrationService.name);

  constructor(
    private prisma: PrismaService,
    private scoringService: ScoringService,
  ) {}

  /**
   * Map catalogue-friendly type names to FunderType enum
   */
  private mapFunderType(catalogueType: string | null | undefined): FunderType {
    if (!catalogueType) return FunderType.PHILANTHROPIC;
    
    const normalized = catalogueType.toLowerCase().trim();
    
    // Map common catalogue types
    if (normalized.includes('foundation')) return FunderType.PHILANTHROPIC;
    if (normalized.includes('trust')) return FunderType.PHILANTHROPIC;
    if (normalized.includes('charity')) return FunderType.PHILANTHROPIC;
    if (normalized.includes('public') || normalized.includes('research council') || normalized.includes('government')) return FunderType.PUBLIC;
    if (normalized.includes('corporate') || normalized.includes('company')) return FunderType.PRIVATE;
    
    return FunderType.PHILANTHROPIC; // Default
  }

  /**
   * Get catalogue type tag for storage
   */
  private getCatalogueTypeTag(catalogueType: string | null | undefined): string | null {
    if (!catalogueType) return null;
    return `CATALOGUE_TYPE:${catalogueType}`;
  }

  async applyRun(
    runDate: string,
    options: { dryRun?: boolean } = {},
  ): Promise<IntegrationResult> {
    const { dryRun = false } = options;

    this.logger.log(
      `${dryRun ? 'DRY RUN: ' : ''}Applying discovery run for ${runDate}`,
    );

    const summaryPath = path.join(
      __dirname,
      '../../../..',
      'frontend',
      'discovery',
      'runs',
      runDate,
      'summary',
      'discovery-summary.json',
    );

    this.logger.log(`Loading summary from: ${summaryPath}`);

    let summary: DiscoverySummary;
    try {
      const summaryContent = await fs.readFile(summaryPath, 'utf-8');
      summary = JSON.parse(summaryContent);
    } catch (error: any) {
      throw new NotFoundException(
        `Discovery summary not found for run date ${runDate}. Path: ${summaryPath}`,
      );
    }

    const result: IntegrationResult = {
      success: false,
      fundersCreated: 0,
      opportunitiesCreated: 0,
      opportunitiesScored: 0,
      warnings: [],
      dryRun,
    };

    const createdFunderIds = new Map<string, string>();
    const createdOpportunityIds: string[] = [];

    if (summary.plan.newFunders.length > 0) {
      this.logger.log(
        `${dryRun ? '[DRY RUN] ' : ''}Creating ${summary.plan.newFunders.length} new funders...`,
      );

      for (const { funder } of summary.plan.newFunders) {
        this.logger.log(`  - ${funder.funderName}`);

        if (!dryRun) {
          try {
            const adminUser = await this.getAdminUser();

            // Parse geographies from the geography field
            const geographies = funder.geography 
              ? funder.geography
                  .split(/[,\/]/)
                  .map(g => g.trim())
                  .map(g => g.replace(/\(.*?\)/g, '').trim())
                  .filter(g => g.length > 0)
              : [];

            const created = await this.prisma.funder.create({
              data: {
                name: funder.funderName,
                websiteUrl: funder.website || null,
                description: funder.focus || null,
                geographies,
                tags: funder.type ? [`CATALOGUE_TYPE:${funder.type}`, 'DISCOVERY', `RUN_${runDate}`] : ['DISCOVERY', `RUN_${runDate}`],
                notes: funder.notes || null,
                type: this.mapFunderType(funder.type),
                createdById: adminUser.id,
              },
            });

            createdFunderIds.set(funder.funderName, created.id);
            result.fundersCreated++;
          } catch (error: any) {
            result.warnings.push(
              `Failed to create funder "${funder.funderName}": ${error.message}`,
            );
          }
        } else {
          result.fundersCreated++;
        }
      }
    }

    if (summary.plan.newOpportunities.length > 0) {
      this.logger.log(
        `${dryRun ? '[DRY RUN] ' : ''}Creating ${summary.plan.newOpportunities.length} new opportunities...`,
      );

      for (const { opportunity, funderName } of summary.plan.newOpportunities) {
        this.logger.log(`  - ${opportunity.programName} (${funderName})`);

        if (!dryRun) {
          try {
            let funderId = createdFunderIds.get(funderName);

            if (!funderId) {
              const existingFunder = await this.prisma.funder.findFirst({
                where: {
                  OR: [
                    { name: { equals: funderName, mode: 'insensitive' } },
                    { websiteUrl: opportunity.sourceUrl },
                  ],
                },
              });

              if (!existingFunder) {
                result.warnings.push(
                  `Funder "${funderName}" not found for opportunity "${opportunity.programName}", skipping`,
                );
                continue;
              }

              funderId = existingFunder.id;
            }

            const adminUser = await this.getAdminUser();

            const created = await this.prisma.opportunity.create({
              data: {
                funderId,
                programName: opportunity.programName,
                sourceUrl: opportunity.sourceUrl,
                status: (opportunity.status as any) || 'OPEN',
                declaredFocus: opportunity.declaredFocus,
                geographies: opportunity.geographies,
                eligibleApplicantTypes: opportunity.eligibleApplicantTypes,
                minAward: opportunity.minAward || null,
                maxAward: opportunity.maxAward || null,
                currency: opportunity.currency || 'GBP',
                durationMonths: opportunity.durationMonths || null,
                rawDescription: opportunity.rawDescription || '',
                applicationType: ApplicationType.OPEN,
                tags: ['DISCOVERY', `RUN_${runDate}`],
                createdById: adminUser.id,
              },
            });

            createdOpportunityIds.push(created.id);
            result.opportunitiesCreated++;
          } catch (error: any) {
            result.warnings.push(
              `Failed to create opportunity "${opportunity.programName}": ${error.message}`,
            );
          }
        } else {
          result.opportunitiesCreated++;
        }
      }
    }

    if (!dryRun && createdOpportunityIds.length > 0) {
      this.logger.log(
        `Triggering scoring for ${createdOpportunityIds.length} new opportunities...`,
      );

      for (const oppId of createdOpportunityIds) {
        try {
          await this.scoringService.updateOpportunityScore(oppId);
          result.opportunitiesScored++;
        } catch (error: any) {
          result.warnings.push(
            `Failed to score opportunity ${oppId}: ${error.message}`,
          );
        }
      }
    }

    result.success = true;

    this.logger.log(
      `Integration ${dryRun ? '(dry run) ' : ''}complete: ${result.fundersCreated} funders, ${result.opportunitiesCreated} opportunities created`,
    );

    return result;
  }

  async getSummary(runDate: string): Promise<DiscoverySummary> {
    const summaryPath = path.join(
      __dirname,
      '../../../..',
      'frontend',
      'discovery',
      'runs',
      runDate,
      'summary',
      'discovery-summary.json',
    );

    this.logger.log(`Loading summary from: ${summaryPath}`);

    try {
      const summaryContent = await fs.readFile(summaryPath, 'utf-8');
      return JSON.parse(summaryContent);
    } catch (error: any) {
      this.logger.error(`Failed to load summary: ${error.message}`);
      throw new NotFoundException(
        `Discovery summary not found for run date ${runDate}. Path: ${summaryPath}`,
      );
    }
  }

  private async getAdminUser() {
    const adminUser = await this.prisma.user.findFirst({
      where: { role: 'ADMIN' },
    });

    if (!adminUser) {
      throw new Error('No admin user found - cannot create funders/opportunities');
    }

    return adminUser;
  }
}
