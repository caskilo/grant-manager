import { IsNumber, IsOptional, IsArray, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateFitScoringConfigDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  @Type(() => Number)
  weightAlignment?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  @Type(() => Number)
  weightGeography?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  @Type(() => Number)
  weightApplicantType?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  @Type(() => Number)
  weightAwardSize?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  @Type(() => Number)
  thresholdHigh?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  @Type(() => Number)
  thresholdMedium?: number;
}

export class UpdateEligibilityRulesDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedGeographies?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedApplicantTypes?: string[];

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  minAwardAmount?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxAwardAmount?: number;

  @IsOptional()
  @IsString()
  currency?: string;
}
