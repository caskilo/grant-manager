import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsUrl,
  IsInt,
  IsNumber,
  IsObject,
  IsUUID,
  Min,
  Max,
} from 'class-validator';
import {
  ApplicationType,
  OpportunityStatus,
  RecommendedAction,
  RecordVisibility,
} from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateOpportunityDto {
  @IsUUID()
  funderId: string;

  @IsString()
  programName: string;

  @IsUrl()
  sourceUrl: string;

  @IsOptional()
  @IsUrl()
  opportunityUrl?: string;

  @IsOptional()
  @IsEnum(OpportunityStatus)
  status?: OpportunityStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  declaredFocus?: string[];

  @IsOptional()
  @IsString()
  explicitExclusions?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  geographies?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eligibleApplicantTypes?: string[];

  @IsOptional()
  @IsNumber()
  minAward?: number;

  @IsOptional()
  @IsNumber()
  maxAward?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsInt()
  durationMonths?: number;

  @IsEnum(ApplicationType)
  applicationType: ApplicationType;

  @IsOptional()
  @IsArray()
  deadlines?: any[];

  @IsOptional()
  @IsString()
  reportingRequirements?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  processSteps?: string[];

  @IsOptional()
  @IsString()
  rawDescription?: string;

  @IsOptional()
  @IsEnum(RecordVisibility)
  visibility?: RecordVisibility;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateOpportunityDto {
  @IsOptional()
  @IsString()
  programName?: string;

  @IsOptional()
  @IsUrl()
  sourceUrl?: string;

  @IsOptional()
  @IsEnum(OpportunityStatus)
  status?: OpportunityStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  declaredFocus?: string[];

  @IsOptional()
  @IsString()
  explicitExclusions?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  geographies?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eligibleApplicantTypes?: string[];

  @IsOptional()
  @IsNumber()
  minAward?: number;

  @IsOptional()
  @IsNumber()
  maxAward?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsInt()
  durationMonths?: number;

  @IsOptional()
  @IsEnum(ApplicationType)
  applicationType?: ApplicationType;

  @IsOptional()
  @IsArray()
  deadlines?: any[];

  @IsOptional()
  @IsString()
  reportingRequirements?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  processSteps?: string[];

  @IsOptional()
  @IsString()
  rawDescription?: string;

  @IsOptional()
  @IsEnum(RecordVisibility)
  visibility?: RecordVisibility;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class OpportunityQueryDto {
  @IsOptional()
  @IsUUID()
  funderId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10)
  minScore?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10)
  maxScore?: number;

  @IsOptional()
  @IsEnum(OpportunityStatus)
  status?: OpportunityStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
