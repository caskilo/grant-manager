import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { JobType } from '@prisma/client';

export class CreateImportJobDto {
  @IsEnum(JobType)
  jobType: JobType;

  @IsOptional()
  @IsUUID()
  fileAttachmentId?: string;
}
