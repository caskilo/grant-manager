import { Module } from '@nestjs/common';
import { ImportService } from './import.service';
import { ImportController } from './import.controller';
import { AuditModule } from '../audit/audit.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [AuditModule, QueueModule],
  controllers: [ImportController],
  providers: [ImportService],
  exports: [ImportService],
})
export class ImportModule {}
