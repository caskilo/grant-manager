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
import { InteractionService } from './interaction.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateInteractionDto, UpdateInteractionDto } from './dto';

@Controller('interactions')
@UseGuards(JwtAuthGuard)
export class InteractionController {
  constructor(private interactionService: InteractionService) {}

  @Get()
  findAll(
    @Query('interactionType') interactionType?: string,
    @Query('contactId') contactId?: string,
    @Query('applicationId') applicationId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.interactionService.findAll({
      interactionType,
      contactId,
      applicationId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('stats')
  getStatsByType(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.interactionService.getStatsByType({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get('contact/:contactId/recent')
  getRecentForContact(
    @Param('contactId') contactId: string,
    @Query('limit') limit?: string,
  ) {
    return this.interactionService.getRecentForContact(
      contactId,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Get('application/:applicationId/recent')
  getRecentForApplication(
    @Param('applicationId') applicationId: string,
    @Query('limit') limit?: string,
  ) {
    return this.interactionService.getRecentForApplication(
      applicationId,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.interactionService.findOne(id);
  }

  @Post()
  create(@Body() createInteractionDto: CreateInteractionDto, @Request() req: any) {
    return this.interactionService.create(createInteractionDto, req.user.userId);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateInteractionDto: UpdateInteractionDto,
    @Request() req: any,
  ) {
    return this.interactionService.update(id, updateInteractionDto, req.user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.interactionService.remove(id, req.user.userId);
  }
}
