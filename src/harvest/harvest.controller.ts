import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { HarvestService } from './harvest.service';
import { HarvestIntegrationService } from './harvest-integration.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateHarvestSourceDto, UpdateHarvestSourceDto } from './dto';

@Controller('harvest')
@UseGuards(JwtAuthGuard)
export class HarvestController {
  constructor(
    private harvestService: HarvestService,
    private integrationService: HarvestIntegrationService,
  ) {}

  @Get('sources')
  findAll(
    @Query('enabled') enabled?: string,
    @Query('funderId') funderId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.harvestService.findAll({
      enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
      funderId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('sources/:id')
  findOne(@Param('id') id: string) {
    return this.harvestService.findOne(id);
  }

  @Post('sources')
  create(@Body() createDto: CreateHarvestSourceDto, @Request() req: any) {
    return this.harvestService.create(createDto, req.user.userId);
  }

  @Put('sources/:id')
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateHarvestSourceDto,
    @Request() req: any,
  ) {
    return this.harvestService.update(id, updateDto, req.user.userId);
  }

  @Delete('sources/:id')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.harvestService.remove(id, req.user.userId);
  }

  @Post('sources/:id/trigger')
  triggerHarvest(@Param('id') id: string, @Request() req: any) {
    return this.harvestService.triggerHarvest(id, req.user.userId);
  }

  @Post('funders/:funderId/discover-sources')
  discoverSources(
    @Param('funderId') funderId: string,
    @Body() body: { manualLinks?: string[]; searchDepth?: number },
    @Request() req: any,
  ) {
    return this.harvestService.discoverSourcesForFunder(funderId, req.user.userId, {
      manualLinks: body?.manualLinks,
      searchDepth: body?.searchDepth,
    });
  }

  @Get('funders/:funderId/suggested-sources')
  getSuggestedSources(@Param('funderId') funderId: string) {
    return this.harvestService.getSuggestedSources(funderId);
  }

  @Get('jobs/:jobId/status')
  getJobStatus(@Param('jobId') jobId: string) {
    return this.harvestService.getJobStatus(jobId);
  }

  @Get('funders/:funderId/runs')
  listRuns(@Param('funderId') funderId: string) {
    return this.integrationService.listRunsForFunder(funderId);
  }

  @Get('runs/:runId/summary')
  getRunSummary(@Param('runId') runId: string) {
    return this.integrationService.getSummary(runId);
  }

  @Post('runs/:runId/integrate')
  integrateRun(
    @Param('runId') runId: string,
    @Body() body: { funderId: string; dryRun?: boolean },
    @Request() req: any,
  ) {
    return this.integrationService.applyRun(runId, {
      funderId: body.funderId,
      dryRun: body.dryRun ?? false,
    });
  }
}
