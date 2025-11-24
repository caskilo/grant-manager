import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApplicationService } from './application.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('applications')
@UseGuards(JwtAuthGuard)
export class ApplicationController {
  constructor(private applicationService: ApplicationService) {}

  @Get()
  findAll() {
    return this.applicationService.findAll();
  }
}
