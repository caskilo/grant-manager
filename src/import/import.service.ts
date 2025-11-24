import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { CreateImportJobDto } from './dto';
import { JobType, ImportJobStatus } from '@prisma/client';

@Injectable()
export class ImportService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    @InjectQueue('import') private importQueue: Queue,
  ) {}

  /**
   * Find all import jobs with pagination
   */
  async findAll(params?: {
    status?: ImportJobStatus;
    jobType?: JobType;
    page?: number;
    limit?: number;
  }) {
    const { status, jobType, page = 1, limit = 50 } = params || {};

    const where: any = {};
    if (status) where.status = status;
    if (jobType) where.jobType = jobType;

    const [data, total] = await Promise.all([
      this.prisma.importJob.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          fileAttachment: { select: { id: true, fileName: true, sizeBytes: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.importJob.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find import job by ID
   */
  async findOne(id: string) {
    const job = await this.prisma.importJob.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        fileAttachment: {
          select: {
            id: true,
            fileName: true,
            sizeBytes: true,
            storageKey: true,
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException(`Import job with ID ${id} not found`);
    }

    return job;
  }

  /**
   * Create new import job and enqueue processing
   */
  async create(data: CreateImportJobDto, userId: string) {
    // Validate file attachment if provided
    if (data.fileAttachmentId) {
      const attachment = await this.prisma.attachment.findUnique({
        where: { id: data.fileAttachmentId },
      });

      if (!attachment) {
        throw new NotFoundException('File attachment not found');
      }
    }

    const job = await this.prisma.importJob.create({
      data: {
        ...data,
        createdById: userId,
        status: 'PENDING',
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        fileAttachment: { select: { id: true, fileName: true } },
      },
    });

    // Enqueue the import job for background processing
    await this.importQueue.add('process-import', {
      jobId: job.id,
      jobType: job.jobType,
      fileAttachmentId: job.fileAttachmentId,
      userId,
    });

    await this.audit.log('CREATE', 'import_job', job.id, userId, {
      jobType: job.jobType,
    });

    return job;
  }

  /**
   * Cancel a pending import job
   */
  async cancel(id: string, userId: string) {
    const job = await this.findOne(id);

    if (job.status !== 'PENDING') {
      throw new BadRequestException('Only pending jobs can be cancelled');
    }

    await this.prisma.importJob.update({
      where: { id },
      data: {
        status: 'FAILED',
        errorMessage: 'Cancelled by user',
        completedAt: new Date(),
      },
    });

    await this.audit.log('UPDATE', 'import_job', id, userId, {
      action: 'cancelled',
    });

    return { message: 'Import job cancelled successfully' };
  }
}
