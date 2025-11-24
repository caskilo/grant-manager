import { Controller, Get, UseGuards } from '@nestjs/common';
import { AttachmentService } from './attachment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('attachments')
@UseGuards(JwtAuthGuard)
export class AttachmentController {
  constructor(private attachmentService: AttachmentService) {}

  @Get()
  findAll() {
    return this.attachmentService.findAll();
  }
}
