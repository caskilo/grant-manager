import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { HarvestService } from './harvest.service';
import { HarvestController } from './harvest.controller';
import { ScraperService } from './scraper.service';
import { OpportunityMapperService } from './opportunity-mapper.service';
import { HarvestIntegrationService } from './harvest-integration.service';
import { IntelligentDiscoveryService } from './intelligent-discovery.service';
import { NavigationAnalyzerService } from './navigation-analyzer.service';
import { GrantPageExtractorService } from './grant-page-extractor.service';
import { LLMGrantExtractorService } from './llm-grant-extractor.service';
import { LLMEligibilityExtractorService } from './llm-eligibility-extractor.service';
import { OdysseanAlignmentService } from './odyssean-alignment.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { DiscoveryModule } from '../discovery/discovery.module';
import { ScoringModule } from '../scoring/scoring.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'harvest',
    }),
    PrismaModule,
    AuditModule,
    ScoringModule,
    forwardRef(() => DiscoveryModule),
  ],
  controllers: [HarvestController],
  providers: [
    HarvestService,
    ScraperService,
    OpportunityMapperService,
    HarvestIntegrationService,
    IntelligentDiscoveryService,
    NavigationAnalyzerService,
    GrantPageExtractorService,
    LLMGrantExtractorService,
    LLMEligibilityExtractorService,
    OdysseanAlignmentService,
  ],
  exports: [
    HarvestService,
    ScraperService,
    OpportunityMapperService,
    HarvestIntegrationService,
    IntelligentDiscoveryService,
    NavigationAnalyzerService,
    GrantPageExtractorService,
    LLMGrantExtractorService,
    LLMEligibilityExtractorService,
    OdysseanAlignmentService,
  ],
})
export class HarvestModule {}
