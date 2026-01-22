#!/usr/bin/env ts-node

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DiscoveryIntegrationService } from '../src/discovery/discovery-integration.service';

async function bootstrap() {
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

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  try {
    const integrationService = app.get(DiscoveryIntegrationService);
    const result = await integrationService.applyRun(runDate, { dryRun });

    console.log('\n' + '='.repeat(60));
    console.log('Integration Complete');
    console.log('='.repeat(60));
    console.log(`Created ${result.fundersCreated} funders`);
    console.log(`Created ${result.opportunitiesCreated} opportunities`);
    console.log(`Scored ${result.opportunitiesScored} opportunities`);
    
    if (result.warnings.length > 0) {
      console.log('\nWarnings:');
      result.warnings.forEach(w => console.log(`  - ${w}`));
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
