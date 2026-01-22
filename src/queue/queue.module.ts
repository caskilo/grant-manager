import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScoringProcessor } from './processors/scoring.processor';
import { ImportProcessor } from './processors/import.processor';
import { HarvestProcessor } from './processors/harvest.processor';
import { SourceDiscoveryProcessor } from './processors/source-discovery.processor';
import { IntelligentDiscoveryService } from '@/harvest/intelligent-discovery.service';
import { NavigationAnalyzerService } from '../harvest/navigation-analyzer.service';
import { GrantPageExtractorService } from '../harvest/grant-page-extractor.service';
import { ScoringModule } from '../scoring/scoring.module';
import { PrismaModule } from '../prisma/prisma.module';
import { HarvestModule } from '../harvest/harvest.module';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get('REDIS_URL');
        
        // If REDIS_URL is provided (e.g., on Heroku), parse and use it
        if (redisUrl) {
          try {
            const url = new URL(redisUrl);
            return {
              connection: {
                host: url.hostname,
                port: parseInt(url.port || '6379', 10),
                password: url.password || undefined,
                tls: url.protocol === 'rediss:' ? { rejectUnauthorized: false } : undefined,
              },
            };
          } catch (error) {
            console.error('Failed to parse REDIS_URL, falling back to localhost:', error);
          }
        }
        
        // Otherwise, use host/port (local development)
        return {
          connection: {
            host: configService.get('REDIS_HOST') || 'localhost',
            port: configService.get('REDIS_PORT') || 6379,
          },
        };
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'scoring',
    }),
    BullModule.registerQueue({
      name: 'ingestion',
    }),
    BullModule.registerQueue({
      name: 'import',
    }),
    BullModule.registerQueue({
      name: 'harvest',
    }),
    ScoringModule,
    PrismaModule,
    HarvestModule,
  ],
  providers: [
    ScoringProcessor,
    ImportProcessor,
    HarvestProcessor,
    SourceDiscoveryProcessor,
    IntelligentDiscoveryService,
    NavigationAnalyzerService,
    GrantPageExtractorService,
  ],
  exports: [BullModule],
})
export class QueueModule {}
