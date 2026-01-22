import { Module } from '@nestjs/common';
import { DiscoveryRunService } from './discovery-run.service';
import { DiscoveryIntegrationService } from './discovery-integration.service';
import { DiscoveryController } from './discovery.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ScoringModule } from '../scoring/scoring.module';

@Module({
  imports: [PrismaModule, ScoringModule],
  controllers: [DiscoveryController],
  providers: [DiscoveryRunService, DiscoveryIntegrationService],
  exports: [DiscoveryRunService, DiscoveryIntegrationService],
})
export class DiscoveryModule {}
