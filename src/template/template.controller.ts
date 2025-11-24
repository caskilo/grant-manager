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
import { TemplateService } from './template.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateTemplateDto, UpdateTemplateDto } from './dto';
import { TemplateType } from '@prisma/client';

@Controller('templates')
@UseGuards(JwtAuthGuard)
export class TemplateController {
  constructor(private templateService: TemplateService) {}

  @Get()
  findAll(
    @Query('type') type?: TemplateType,
    @Query('isActive') isActive?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.templateService.findAll({
      type,
      isActive: isActive === 'false' ? false : true,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('type/:type')
  findByType(@Param('type') type: TemplateType) {
    return this.templateService.findByType(type);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.templateService.findOne(id);
  }

  @Post()
  create(@Body() createTemplateDto: CreateTemplateDto, @Request() req: any) {
    return this.templateService.create(createTemplateDto, req.user.userId);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateTemplateDto: UpdateTemplateDto,
    @Request() req: any,
  ) {
    return this.templateService.update(id, updateTemplateDto, req.user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.templateService.remove(id, req.user.userId);
  }

  @Post(':id/duplicate')
  duplicate(@Param('id') id: string, @Request() req: any) {
    return this.templateService.duplicate(id, req.user.userId);
  }

  @Post(':id/use')
  recordUsage(
    @Param('id') id: string,
    @Body('applicationId') applicationId: string,
    @Request() req: any,
  ) {
    return this.templateService.recordUsage(id, applicationId, req.user.userId);
  }
}
