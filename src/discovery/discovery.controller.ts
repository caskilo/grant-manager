import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { IsOptional, IsBoolean, IsString } from 'class-validator';
import { DiscoveryRunService } from './discovery-run.service';
import { DiscoveryIntegrationService } from './discovery-integration.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

class RunCatalogueDto {
  @IsOptional()
  @IsString()
  sourceId?: string;

  @IsOptional()
  @IsString()
  runDate?: string;
}

class IntegrateRunDto {
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

@Controller('discovery')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.GRANTS_OFFICER)
export class DiscoveryController {
  private readonly logger = new Logger(DiscoveryController.name);

  constructor(
    private discoveryRunService: DiscoveryRunService,
    private discoveryIntegrationService: DiscoveryIntegrationService,
  ) {}

  @Post('runs/catalogue')
  @HttpCode(HttpStatus.OK)
  async runCatalogue(@Body() dto: RunCatalogueDto) {
    const sourceId = dto.sourceId || 'catalogue_v1';
    const runDate = dto.runDate || new Date().toISOString().split('T')[0];

    const summary = await this.discoveryRunService.executeRun(runDate, sourceId);

    return {
      message: 'Discovery run completed',
      runDate,
      sourceId,
      stats: summary.stats,
      metadata: summary.metadata,
      recommendations: summary.recommendations,
    };
  }

  @Get('runs/:runDate/summary')
  async getSummary(@Param('runDate') runDate: string) {
    return this.discoveryIntegrationService.getSummary(runDate);
  }

  @Post('runs/:runDate/integrate')
  @HttpCode(HttpStatus.OK)
  async integrateRun(
    @Param('runDate') runDate: string,
    @Body() dto: IntegrateRunDto,
  ) {
    this.logger.log(`Integration request for runDate: ${runDate}, dryRun: ${dto.dryRun}`);
    
    try {
      const result = await this.discoveryIntegrationService.applyRun(runDate, {
        dryRun: dto.dryRun || false,
      });

      this.logger.log(`Integration completed: ${result.fundersCreated} funders, ${result.opportunitiesCreated} opportunities`);

      return {
        message: result.dryRun
          ? 'Dry run completed - no changes made'
          : 'Discovery run integrated successfully',
        result,
      };
    } catch (error: any) {
      this.logger.error(`Integration failed: ${error.message}`, error.stack);
      throw error;
    }
  }
}
