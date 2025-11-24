import { Module } from '@nestjs/common';
import { HarvestService } from './harvest.service';
import { HarvestController } from './harvest.controller';
import { AuditModule } from '../audit/audit.module';
import { ScraperService } from './scraper.service';
import { DiscoveryModule } from '../discovery/discovery.module';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    AuditModule,
    DiscoveryModule,
    BullModule.registerQueue({ name: 'harvest' }),
  ],
  controllers: [HarvestController],
  providers: [HarvestService, ScraperService],
  exports: [HarvestService, ScraperService],
})
export class HarvestModule {}
