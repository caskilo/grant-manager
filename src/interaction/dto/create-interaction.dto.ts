import { IsString, IsOptional, IsUUID, IsDateString } from 'class-validator';

export class CreateInteractionDto {
  @IsString()
  interactionType: string;

  @IsString()
  summary: string;

  @IsUUID()
  applicationId: string;

  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsDateString()
  occurredAt: string;
}
