import { IsString, IsEnum, IsOptional, IsBoolean, IsArray } from 'class-validator';
import { TemplateType } from '@prisma/client';

export class CreateTemplateDto {
  @IsString()
  name: string;

  @IsEnum(TemplateType)
  type: TemplateType;

  @IsString()
  content: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
