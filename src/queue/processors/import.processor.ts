import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, BadRequestException } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { FunderType } from '@prisma/client';
import * as csv from 'csv-parse/sync';
import * as fs from 'fs/promises';

@Processor('import')
export class ImportProcessor extends WorkerHost {
  private readonly logger = new Logger(ImportProcessor.name);

  constructor(private prisma: PrismaService) {
    super();
  }

  /**
   * Map catalogue-friendly type names to FunderType enum
   */
  private mapFunderType(catalogueType: string | null | undefined): FunderType {
    if (!catalogueType) return FunderType.PHILANTHROPIC;
    
    const normalized = catalogueType.toLowerCase().trim();
    
    // Map common catalogue types
    if (normalized.includes('foundation')) return FunderType.PHILANTHROPIC;
    if (normalized.includes('trust')) return FunderType.PHILANTHROPIC;
    if (normalized.includes('charity')) return FunderType.PHILANTHROPIC;
    if (normalized.includes('public') || normalized.includes('research council') || normalized.includes('government')) return FunderType.PUBLIC;
    if (normalized.includes('corporate') || normalized.includes('company')) return FunderType.PRIVATE;
    
    return FunderType.PHILANTHROPIC; // Default
  }

  /**
   * Get catalogue type tag for storage
   */
  private getCatalogueTypeTag(catalogueType: string | null | undefined): string | null {
    if (!catalogueType) return null;
    return `CATALOGUE_TYPE:${catalogueType}`;
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
          const tags = record.tags
            ? record.tags.split(',').map((t: string) => t.trim())
            : existing.tags;
          
          // Add catalogue type tag if record has a type
          if (record.type && !tags.some((t: string) => t.startsWith('CATALOGUE_TYPE:'))) {
            tags.push(this.getCatalogueTypeTag(record.type));
          }

          await this.prisma.funder.update({
            where: { id: existing.id },
            data: {
              type: record.type ? this.mapFunderType(record.type) : existing.type,
              websiteUrl: record.websiteUrl || existing.websiteUrl,
              tags: tags.filter((t: string): t is string => t !== null),
            },
          });
          updated++;
        } else {
          const tags = record.tags ? record.tags.split(',').map((t: string) => t.trim()) : [];
          
          // Add catalogue type tag if record has a type
          if (record.type) {
            const catalogueTypeTag = this.getCatalogueTypeTag(record.type);
            if (catalogueTypeTag) {
              tags.push(catalogueTypeTag);
            }
          }

          await this.prisma.funder.create({
            data: {
              name: record.name,
              type: record.type ? this.mapFunderType(record.type) : FunderType.PHILANTHROPIC,
              websiteUrl: record.websiteUrl,
              tags,
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
          const tags: string[] = [];
          
          // Add catalogue type tag if record has a type
          if (record.type) {
            const catalogueTypeTag = this.getCatalogueTypeTag(record.type);
            if (catalogueTypeTag) {
              tags.push(catalogueTypeTag);
            }
          }

          funder = await this.prisma.funder.create({
            data: {
              name: record.funderName,
              type: record.type ? this.mapFunderType(record.type) : FunderType.PHILANTHROPIC,
              tags,
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

