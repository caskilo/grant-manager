import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FunderService } from './funder.service';
import { CreateFunderDto, UpdateFunderDto, FunderQueryDto } from './dto/funder.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('funders')
@UseGuards(JwtAuthGuard)
export class FunderController {
  constructor(private funderService: FunderService) {}

  @Get()
  findAll(@Query() query: FunderQueryDto) {
    return this.funderService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.funderService.findOne(id);
  }

  @Post()
  create(@Body() createFunderDto: CreateFunderDto, @CurrentUser() user: any) {
    return this.funderService.create(createFunderDto, user.userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateFunderDto: UpdateFunderDto,
    @CurrentUser() user: any,
  ) {
    return this.funderService.update(id, updateFunderDto, user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.funderService.remove(id, user.userId);
  }
}
