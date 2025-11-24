import { Module } from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { EmbeddingService } from './embedding.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [PrismaModule, ConfigModule],
  providers: [ScoringService, EmbeddingService],
  exports: [ScoringService, EmbeddingService],
})
export class ScoringModule {}
