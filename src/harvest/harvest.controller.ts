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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateHarvestSourceDto, UpdateHarvestSourceDto } from './dto';

@Controller('harvest')
@UseGuards(JwtAuthGuard)
export class HarvestController {
  constructor(private harvestService: HarvestService) {}

  @Get('sources')
  findAll(
    @Query('enabled') enabled?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.harvestService.findAll({
      enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
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
}
