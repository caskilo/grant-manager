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
import { ContactService } from './contact.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateContactDto, UpdateContactDto } from './dto';

@Controller('contacts')
@UseGuards(JwtAuthGuard)
export class ContactController {
  constructor(private contactService: ContactService) {}

  @Get()
  findAll(
    @Query('funderId') funderId?: string,
    @Query('opportunityId') opportunityId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.contactService.findAll({
      funderId,
      opportunityId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contactService.findOne(id);
  }

  @Post()
  create(@Body() createContactDto: CreateContactDto, @Request() req: any) {
    return this.contactService.create(createContactDto, req.user.userId);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateContactDto: UpdateContactDto,
    @Request() req: any,
  ) {
    return this.contactService.update(id, updateContactDto, req.user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.contactService.remove(id, req.user.userId);
  }

  @Get('funder/:funderId/primary')
  getPrimaryForFunder(@Param('funderId') funderId: string) {
    return this.contactService.getPrimaryForFunder(funderId);
  }

  @Get('opportunity/:opportunityId/primary')
  getPrimaryForOpportunity(@Param('opportunityId') opportunityId: string) {
    return this.contactService.getPrimaryForOpportunity(opportunityId);
  }
}
