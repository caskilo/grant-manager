import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, BadRequestException } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import * as csv from 'csv-parse/sync';
import * as fs from 'fs/promises';

@Processor('import')
export class ImportProcessor extends WorkerHost {
  private readonly logger = new Logger(ImportProcessor.name);

  constructor(private prisma: PrismaService) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    this.logger.log(`Processing import job ${job.id}`);

    const { jobId, jobType, fileAttachmentId, userId } = job.data;

    try {
      await this.prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: 'RUNNING',
          startedAt: new Date(),
        },
      });

      let summary: any = {};

      switch (jobType) {
        case 'FUNDER_CSV':
          summary = await this.processFunderCsv(fileAttachmentId, userId);
          break;
        case 'OPPORTUNITY_CSV':
          summary = await this.processOpportunityCsv(fileAttachmentId, userId);
          break;
        default:
          throw new Error(`Unsupported job type: ${jobType}`);
      }

      await this.prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          summary,
        },
      });

      this.logger.log(`Import job ${jobId} completed successfully`);
      return { success: true, summary };
    } catch (error) {
      this.logger.error(`Import job ${jobId} failed:`, error);

      await this.prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage: error.message,
        },
      });

      throw error;
    }
  }

  private async processFunderCsv(fileAttachmentId: string, userId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: fileAttachmentId },
    });

    if (!attachment) {
      throw new BadRequestException('File attachment not found');
    }

    const fileContent = await fs.readFile(attachment.storageKey, 'utf-8');

    const records: any[] = csv.parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const record of records) {
      try {
        const existing = await this.prisma.funder.findFirst({
          where: { name: record.name },
        });

        if (existing) {
          await this.prisma.funder.update({
            where: { id: existing.id },
            data: {
              type: record.type || existing.type,
              websiteUrl: record.websiteUrl || existing.websiteUrl,
              tags: record.tags
                ? record.tags.split(',').map((t: string) => t.trim())
                : existing.tags,
            },
          });
          updated++;
        } else {
          await this.prisma.funder.create({
            data: {
              name: record.name,
              type: record.type || 'PHILANTHROPIC',
              websiteUrl: record.websiteUrl,
              tags: record.tags ? record.tags.split(',').map((t: string) => t.trim()) : [],
              createdById: userId,
            },
          });
          created++;
        }
      } catch (error) {
        errors++;
        this.logger.error(`Error processing funder record:`, error);
      }
    }

    return {
      totalRecords: records.length,
      created,
      updated,
      errors,
    };
  }

  private async processOpportunityCsv(fileAttachmentId: string, userId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: fileAttachmentId },
    });

    if (!attachment) {
      throw new BadRequestException('File attachment not found');
    }

    const fileContent = await fs.readFile(attachment.storageKey, 'utf-8');

    const records: any[] = csv.parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const record of records) {
      try {
        let funder = await this.prisma.funder.findFirst({
          where: { name: record.funderName },
        });

        if (!funder) {
          funder = await this.prisma.funder.create({
            data: {
              name: record.funderName,
              type: 'PHILANTHROPIC',
              createdById: userId,
            },
          });
        }

        const existing = await this.prisma.opportunity.findFirst({
          where: {
            programName: record.programName,
            funderId: funder.id,
          },
        });

        if (existing) {
          await this.prisma.opportunity.update({
            where: { id: existing.id },
            data: {
              rawDescription: record.description || existing.rawDescription,
              status: record.status || existing.status,
              geographies: record.geographies
                ? record.geographies.split(',').map((g: string) => g.trim())
                : existing.geographies,
            },
          });
          updated++;
        } else {
          await this.prisma.opportunity.create({
            data: {
              funderId: funder.id,
              programName: record.programName,
              sourceUrl: record.sourceUrl || '',
              rawDescription: record.description,
              status: record.status || 'OPEN',
              applicationType: 'OPEN',
              geographies: record.geographies
                ? record.geographies.split(',').map((g: string) => g.trim())
                : [],
              createdById: userId,
            },
          });
          created++;
        }
      } catch (error) {
        errors++;
        this.logger.error(`Error processing opportunity record:`, error);
      }
    }

    return {
      totalRecords: records.length,
      created,
      updated,
      errors,
    };
  }
}

