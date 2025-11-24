import { Module } from '@nestjs/common';
import { OpportunityService } from './opportunity.service';
import { OpportunityController } from './opportunity.controller';
import { AuditModule } from '../audit/audit.module';
import { EligibilityModule } from '../eligibility/eligibility.module';
import { ScoringModule } from '../scoring/scoring.module';

@Module({
  imports: [AuditModule, EligibilityModule, ScoringModule],
  controllers: [OpportunityController],
  providers: [OpportunityService],
  exports: [OpportunityService],
})
export class OpportunityModule {}
