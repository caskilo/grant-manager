import { Module } from '@nestjs/common';
import { FunderService } from './funder.service';
import { FunderController } from './funder.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [FunderController],
  providers: [FunderService],
  exports: [FunderService],
})
export class FunderModule {}
