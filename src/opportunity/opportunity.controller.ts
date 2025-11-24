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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OpportunityService } from './opportunity.service';
import {
  CreateOpportunityDto,
  UpdateOpportunityDto,
  OpportunityQueryDto,
} from './dto/opportunity.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { EligibilityService } from '../eligibility/eligibility.service';
import { ScoringService } from '../scoring/scoring.service';

@Controller('opportunities')
@UseGuards(JwtAuthGuard)
export class OpportunityController {
  constructor(
    private opportunityService: OpportunityService,
    private eligibilityService: EligibilityService,
    private scoringService: ScoringService,
  ) {}

  @Get()
  findAll(@Query() query: OpportunityQueryDto) {
    return this.opportunityService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.opportunityService.findOne(id);
  }

  @Post()
  create(@Body() createOpportunityDto: CreateOpportunityDto, @CurrentUser() user: any) {
    return this.opportunityService.create(createOpportunityDto, user.userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateOpportunityDto: UpdateOpportunityDto,
    @CurrentUser() user: any,
  ) {
    return this.opportunityService.update(id, updateOpportunityDto, user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.opportunityService.remove(id, user.userId);
  }

  @Post(':id/calculate-score')
  @HttpCode(HttpStatus.OK)
  async calculateScore(@Param('id') id: string) {
    const score = await this.scoringService.calculateFitScore(id);
    await this.scoringService.updateOpportunityScore(id);
    return score;
  }

  @Get(':id/eligibility')
  async checkEligibility(@Param('id') id: string) {
    return this.eligibilityService.checkOpportunityEligibility(id);
  }

  @Get('eligible/list')
  async getEligibleOpportunities() {
    return this.eligibilityService.getEligibleOpportunities();
  }

  @Post('batch/calculate-scores')
  @HttpCode(HttpStatus.OK)
  async batchCalculateScores(@Body() body: { opportunityIds: string[] }) {
    const scores = await this.scoringService.batchCalculateScores(body.opportunityIds);
    return Object.fromEntries(scores);
  }
}
