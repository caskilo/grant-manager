import { IsString, IsArray, IsNumber, IsOptional, IsUrl, ArrayMinSize } from 'class-validator';

export class CreateCatalogueEntryDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  type: string;

  @IsArray()
  @IsString({ each: true })
  focus: string[];

  @IsArray()
  @IsString({ each: true })
  geographies: string[];

  @IsUrl()
  websiteUrl: string;

  @IsOptional()
  @IsNumber()
  typicalAwardMin?: number;

  @IsOptional()
  @IsNumber()
  typicalAwardMax?: number;

  @IsString()
  currency: string;

  @IsString()
  openData: string;

  @IsString()
  notes: string;
}

export class UpdateCatalogueEntryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  focus?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  geographies?: string[];

  @IsOptional()
  @IsUrl()
  websiteUrl?: string;

  @IsOptional()
  @IsNumber()
  typicalAwardMin?: number;

  @IsOptional()
  @IsNumber()
  typicalAwardMax?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  openData?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
