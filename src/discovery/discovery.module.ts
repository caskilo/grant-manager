import { Module } from '@nestjs/common';
import { DiscoveryRunService } from './discovery-run.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [DiscoveryRunService],
  exports: [DiscoveryRunService],
})
export class DiscoveryModule {}
