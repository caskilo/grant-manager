import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ImportService } from './import.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateImportJobDto } from './dto';
import { JobType, ImportJobStatus } from '@prisma/client';

@Controller('import')
@UseGuards(JwtAuthGuard)
export class ImportController {
  constructor(private importService: ImportService) {}

  @Get('jobs')
  findAll(
    @Query('status') status?: ImportJobStatus,
    @Query('jobType') jobType?: JobType,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.importService.findAll({
      status,
      jobType,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('jobs/:id')
  findOne(@Param('id') id: string) {
    return this.importService.findOne(id);
  }

  @Post('jobs')
  create(@Body() createImportJobDto: CreateImportJobDto, @Request() req: any) {
    return this.importService.create(createImportJobDto, req.user.userId);
  }

  @Post('jobs/:id/cancel')
  cancel(@Param('id') id: string, @Request() req: any) {
    return this.importService.cancel(id, req.user.userId);
  }
}
