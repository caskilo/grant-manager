#!/usr/bin/env ts-node

/**
 * Discovery Run CLI Script
 * 
 * Executes a discovery workflow run for a given source.
 * 
 * Usage:
 *   pnpm exec ts-node scripts/discovery-run.ts --run-date 2025-11-23 --source-id catalogue_v1
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DiscoveryRunService } from '../src/discovery/discovery-run.service';

async function bootstrap() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const runDate = getArg(args, '--run-date') || new Date().toISOString().split('T')[0];
  const sourceId = getArg(args, '--source-id') || 'catalogue_v1';

  console.log('='.repeat(60));
  console.log('Odyssean Grant Manager - Discovery Run');
  console.log('='.repeat(60));
  console.log(`Run Date: ${runDate}`);
  console.log(`Source ID: ${sourceId}`);
  console.log('='.repeat(60));
  console.log();

  // Create NestJS application context (without HTTP server)
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  try {
    // Get discovery service
    const discoveryService = app.get(DiscoveryRunService);

    // Execute discovery run
    console.log('Starting discovery run...\n');
    const summary = await discoveryService.executeRun(runDate, sourceId);

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('Discovery Run Complete');
    console.log('='.repeat(60));
    console.log(`Status: ${summary.metadata.status}`);
    console.log(`Duration: ${calculateDuration(summary.metadata.startTime, summary.metadata.endTime!)}`);
    console.log();
    console.log('Statistics:');
    console.log(`  - Total funders in source: ${summary.stats.totalFundersInSource}`);
    console.log(`  - New funders: ${summary.stats.newFunders}`);
    console.log(`  - Existing funders: ${summary.stats.existingFunders}`);
    console.log(`  - New opportunities: ${summary.stats.newOpportunities}`);
    console.log(`  - Unchanged opportunities: ${summary.stats.unchangedOpportunities}`);
    console.log();
    console.log('Recommendations:');
    for (const rec of summary.recommendations) {
      console.log(`  - ${rec}`);
    }
    console.log();
    console.log('Output location:');
    console.log(`  discovery/runs/${runDate}/`);
    console.log();
    console.log('Next steps:');
    console.log('  1. Review summary/discovery-summary.md');
    console.log('  2. Review parsed/*.json files');
    console.log('  3. Run integration script to apply changes (if desired)');
    console.log('='.repeat(60));

  } catch (error: any) {
    console.error('\n' + '='.repeat(60));
    console.error('Discovery Run Failed');
    console.error('='.repeat(60));
    console.error(`Error: ${error.message}`);
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

function calculateDuration(start: string, end: string): string {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  const durationMs = endTime - startTime;
  const seconds = Math.floor(durationMs / 1000);
  return `${seconds}s`;
}

bootstrap();
