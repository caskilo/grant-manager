import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CatalogueService } from './catalogue.service';
import { CreateCatalogueEntryDto, UpdateCatalogueEntryDto } from './dto/catalogue-entry.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('catalogue')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.GRANTS_OFFICER)
export class CatalogueController {
  constructor(private catalogueService: CatalogueService) {}

  @Get('enums')
  async getEnums() {
    return this.catalogueService.getEnums();
  }

  @Get()
  async getAll() {
    const entries = await this.catalogueService.getAll();
    return {
      data: entries,
      meta: {
        total: entries.length,
      },
    };
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.catalogueService.getById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateCatalogueEntryDto) {
    return this.catalogueService.create(dto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateCatalogueEntryDto) {
    return this.catalogueService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.catalogueService.delete(id);
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  async importFromHtml(@Body() body: { html: string }) {
    return this.catalogueService.importFromHtml(body.html);
  }

  @Post('scrape')
  @HttpCode(HttpStatus.OK)
  async scrapeUrl(@Body() body: { url: string }) {
    return this.catalogueService.scrapeUrl(body.url);
  }
}
