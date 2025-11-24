import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateFitScoringConfigDto, UpdateEligibilityRulesDto } from './dto/config.dto';
import { AuditActionType } from '@prisma/client';

@Injectable()
export class ConfigService {
  constructor(private prisma: PrismaService) {}

  // Fit Scoring Config
  async getFitScoringConfig() {
    const config = await this.prisma.fitScoringConfig.findUnique({
      where: { id: 1 },
    });

    if (!config) {
      // Return default config if not found
      return {
        id: 1,
        weightAlignment: 0.5,
        weightGeography: 0.2,
        weightApplicantType: 0.2,
        weightAwardSize: 0.1,
        thresholdHigh: 7.0,
        thresholdMedium: 4.0,
        updatedAt: new Date(),
      };
    }

    return config;
  }

  async updateFitScoringConfig(dto: UpdateFitScoringConfigDto, userId: string) {
    const config = await this.prisma.fitScoringConfig.upsert({
      where: { id: 1 },
      update: {
        ...dto,
        updatedById: userId,
      },
      create: {
        id: 1,
        weightAlignment: dto.weightAlignment ?? 0.5,
        weightGeography: dto.weightGeography ?? 0.2,
        weightApplicantType: dto.weightApplicantType ?? 0.2,
        weightAwardSize: dto.weightAwardSize ?? 0.1,
        thresholdHigh: dto.thresholdHigh ?? 7.0,
        thresholdMedium: dto.thresholdMedium ?? 4.0,
        updatedById: userId,
      },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: AuditActionType.UPDATE,
        entityType: 'FIT_SCORING_CONFIG',
        entityId: '1',
        metadata: { changes: JSON.parse(JSON.stringify(dto)) },
      },
    });

    return config;
  }

  // Eligibility Rules
  async getEligibilityRules() {
    const rules = await this.prisma.eligibilityRules.findUnique({
      where: { id: 1 },
      include: {
        updatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!rules) {
      // Return default rules if not found
      return {
        id: 1,
        allowedGeographies: [],
        allowedApplicantTypes: [],
        minAwardAmount: null,
        maxAwardAmount: null,
        currency: 'GBP',
        updatedAt: new Date(),
        updatedBy: null,
      };
    }

    return rules;
  }

  async updateEligibilityRules(dto: UpdateEligibilityRulesDto, userId: string) {
    const rules = await this.prisma.eligibilityRules.upsert({
      where: { id: 1 },
      update: {
        ...dto,
        updatedById: userId,
      },
      create: {
        id: 1,
        allowedGeographies: dto.allowedGeographies ?? [],
        allowedApplicantTypes: dto.allowedApplicantTypes ?? [],
        minAwardAmount: dto.minAwardAmount,
        maxAwardAmount: dto.maxAwardAmount,
        currency: dto.currency ?? 'GBP',
        updatedById: userId,
      },
      include: {
        updatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: AuditActionType.UPDATE,
        entityType: 'ELIGIBILITY_RULES',
        entityId: '1',
        metadata: { changes: JSON.parse(JSON.stringify(dto)) },
      },
    });

    return rules;
  }
}
