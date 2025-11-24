import { Module } from '@nestjs/common';
import { EligibilityService } from './eligibility.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [PrismaModule, ConfigModule],
  providers: [EligibilityService],
  exports: [EligibilityService],
})
export class EligibilityModule {}
