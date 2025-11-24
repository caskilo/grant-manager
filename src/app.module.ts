import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { FunderModule } from './funder/funder.module';
import { OpportunityModule } from './opportunity/opportunity.module';
import { ContactModule } from './contact/contact.module';
import { ApplicationModule } from './application/application.module';
import { TaskModule } from './task/task.module';
import { ReviewModule } from './review/review.module';
import { TemplateModule } from './template/template.module';
import { InteractionModule } from './interaction/interaction.module';
import { AttachmentModule } from './attachment/attachment.module';
import { AuditModule } from './audit/audit.module';
import { ConfigModule } from './config/config.module';
import { EligibilityModule } from './eligibility/eligibility.module';
import { ScoringModule } from './scoring/scoring.module';
import { QueueModule } from './queue/queue.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { ImportModule } from './import/import.module';
import { HarvestModule } from './harvest/harvest.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    FunderModule,
    OpportunityModule,
    ContactModule,
    ApplicationModule,
    TaskModule,
    ReviewModule,
    TemplateModule,
    InteractionModule,
    AttachmentModule,
    AuditModule,
    ConfigModule,
    EligibilityModule,
    ScoringModule,
    QueueModule,
    DiscoveryModule,
    ImportModule,
    HarvestModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
