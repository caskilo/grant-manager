#!/usr/bin/env ts-node

/**
 * Discovery Integration CLI Script
 * 
 * Applies changes from a discovery run to the database.
 * 
 * Usage:
 *   pnpm exec ts-node scripts/discovery-integrate.ts --run-date 2025-11-23 [--dry-run]
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ScoringService } from '../src/scoring/scoring.service';
import { DiscoverySummary } from '../src/discovery/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import { FunderType, ApplicationType } from '@prisma/client';

async function bootstrap() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const runDate = getArg(args, '--run-date') || new Date().toISOString().split('T')[0];
  const dryRun = args.includes('--dry-run');

  console.log('='.repeat(60));
  console.log('Odyssean Grant Manager - Discovery Integration');
  console.log('='.repeat(60));
  console.log(`Run Date: ${runDate}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will apply changes)'}`);
  console.log('='.repeat(60));
  console.log();

  // Create NestJS application context
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  try {
    // Get services
    const prisma = app.get(PrismaService);
    const scoringService = app.get(ScoringService);

    // Load discovery summary
    const summaryPath = path.join(
      process.cwd(),
      '..',
      '.project',
      'discovery',
      'runs',
      runDate,
      'summary',
      'discovery-summary.json'
    );

    console.log(`Loading summary from: ${summaryPath}\n`);
    const summaryContent = await fs.readFile(summaryPath, 'utf-8');
    const summary: DiscoverySummary = JSON.parse(summaryContent);

    // Display summary
    console.log('Summary:');
    console.log(`  - New funders: ${summary.stats.newFunders}`);
    console.log(`  - New opportunities: ${summary.stats.newOpportunities}`);
    console.log();

    if (dryRun) {
      console.log('DRY RUN MODE - No changes will be made\n');
    }

    // Track created IDs
    const createdFunderIds = new Map<string, string>();
    const createdOpportunityIds: string[] = [];

    // Create new funders
    if (summary.plan.newFunders.length > 0) {
      console.log(`Creating ${summary.plan.newFunders.length} new funders...`);

      for (const { funder } of summary.plan.newFunders) {
        console.log(`  - ${funder.funderName}`);

        if (!dryRun) {
          // Get a default user ID for createdBy (use first admin)
          const adminUser = await prisma.user.findFirst({
            where: { role: 'ADMIN' },
          });

          if (!adminUser) {
            throw new Error('No admin user found - cannot create funders');
          }

          const created = await prisma.funder.create({
            data: {
              name: funder.funderName,
              websiteUrl: funder.website || null,
              description: funder.focus || null,
              tags: funder.type ? [funder.type] : [],
              notes: funder.notes || null,
              type: FunderType.PHILANTHROPIC,
              createdById: adminUser.id,
            },
          });

          createdFunderIds.set(funder.funderName, created.id);
        }
      }
      console.log();
    }

    // Create new opportunities
    if (summary.plan.newOpportunities.length > 0) {
      console.log(`Creating ${summary.plan.newOpportunities.length} new opportunities...`);

      for (const { opportunity, funderName } of summary.plan.newOpportunities) {
        console.log(`  - ${opportunity.programName} (${funderName})`);

        if (!dryRun) {
          // Find or get funder ID
          let funderId = createdFunderIds.get(funderName);

          if (!funderId) {
            // Look up existing funder
            const existingFunder = await prisma.funder.findFirst({
              where: {
                OR: [
                  { name: { equals: funderName, mode: 'insensitive' } },
                  { websiteUrl: opportunity.sourceUrl },
                ],
              },
            });

            if (!existingFunder) {
              console.warn(`    WARNING: Funder "${funderName}" not found, skipping opportunity`);
              continue;
            }

            funderId = existingFunder.id;
          }

          // Get admin user for createdBy
          const adminUser = await prisma.user.findFirst({
            where: { role: 'ADMIN' },
          });

          if (!adminUser) {
            throw new Error('No admin user found');
          }

          // Create opportunity
          const created = await prisma.opportunity.create({
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
              // Default application type for discovered opportunities
              applicationType: ApplicationType.OPEN,
              tags: ['DISCOVERY', `RUN_${runDate}`],
              createdById: adminUser.id,
            },
          });

          createdOpportunityIds.push(created.id);
        }
      }
      console.log();
    }

    // Trigger scoring for new opportunities
    if (!dryRun && createdOpportunityIds.length > 0) {
      console.log(`Triggering scoring for ${createdOpportunityIds.length} new opportunities...`);

      for (const oppId of createdOpportunityIds) {
        try {
          await scoringService.updateOpportunityScore(oppId);
          console.log(`  - Scored opportunity ${oppId}`);
        } catch (error: any) {
          console.warn(`  - Failed to score opportunity ${oppId}: ${error.message}`);
        }
      }
      console.log();
    }

    // Summary
    console.log('='.repeat(60));
    console.log('Integration Complete');
    console.log('='.repeat(60));
    if (dryRun) {
      console.log('DRY RUN - No changes were made');
    } else {
      console.log(`Created ${createdFunderIds.size} funders`);
      console.log(`Created ${createdOpportunityIds.length} opportunities`);
      console.log(`Scored ${createdOpportunityIds.length} opportunities`);
    }
    console.log('='.repeat(60));

  } catch (error: any) {
    console.error('\n' + '='.repeat(60));
    console.error('Integration Failed');
    console.error('='.repeat(60));
    console.error(`Error: ${error.message}`);
    console.error(error.stack);
    console.error('='.repeat(60));
    process.exit(1);
  } finally {
    await app.close();
  }
}

function getArg(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 && index < args.length - 1 ? args[index + 1] : undefined;
}

bootstrap();
