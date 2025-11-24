import { IsString, IsEmail, IsOptional, IsBoolean, IsUUID } from 'class-validator';

export class CreateContactDto {
  @IsOptional()
  @IsUUID()
  funderId?: string;

  @IsOptional()
  @IsUUID()
  opportunityId?: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  roleTitle?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
