import { IsString, IsBoolean, IsOptional, IsObject, IsUUID } from 'class-validator';

export class CreateHarvestSourceDto {
  @IsString()
  name: string;

  @IsString()
  baseUrl: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  cronSchedule?: string;

  @IsOptional()
  @IsObject()
  config?: any;

  @IsOptional()
  @IsUUID()
  funderId?: string;
}
