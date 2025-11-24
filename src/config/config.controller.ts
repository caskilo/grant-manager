import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ConfigService } from './config.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateFitScoringConfigDto, UpdateEligibilityRulesDto } from './dto/config.dto';

@Controller('config')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConfigController {
  constructor(private configService: ConfigService) {}

  @Get('fit-scoring')
  async getFitScoringConfig() {
    return this.configService.getFitScoringConfig();
  }

  @Patch('fit-scoring')
  @Roles('ADMIN')
  async updateFitScoringConfig(
    @Body() dto: UpdateFitScoringConfigDto,
    @CurrentUser() user: any,
  ) {
    return this.configService.updateFitScoringConfig(dto, user.userId);
  }

  @Get('eligibility-rules')
  async getEligibilityRules() {
    return this.configService.getEligibilityRules();
  }

  @Patch('eligibility-rules')
  @Roles('ADMIN')
  async updateEligibilityRules(
    @Body() dto: UpdateEligibilityRulesDto,
    @CurrentUser() user: any,
  ) {
    return this.configService.updateEligibilityRules(dto, user.userId);
  }
}
