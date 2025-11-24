import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';

export interface EligibilityCheckResult {
  isEligible: boolean;
  reasons: string[];
  details: {
    geographyMatch: boolean;
    applicantTypeMatch: boolean;
    awardSizeMatch: boolean;
  };
}

@Injectable()
export class EligibilityService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  /**
   * Check if an opportunity is eligible based on current rules
   */
  async checkOpportunityEligibility(opportunityId: string): Promise<EligibilityCheckResult> {
    const opportunity = await this.prisma.opportunity.findUnique({
      where: { id: opportunityId },
    });

    if (!opportunity) {
      return {
        isEligible: false,
        reasons: ['Opportunity not found'],
        details: {
          geographyMatch: false,
          applicantTypeMatch: false,
          awardSizeMatch: false,
        },
      };
    }

    const rules = await this.configService.getEligibilityRules();
    
    return this.evaluateEligibility(
      opportunity.geographies,
      opportunity.eligibleApplicantTypes,
      opportunity.minAward ? Number(opportunity.minAward) : null,
      opportunity.maxAward ? Number(opportunity.maxAward) : null,
      rules,
    );
  }

  /**
   * Evaluate eligibility based on provided parameters
   */
  private evaluateEligibility(
    geographies: string[],
    eligibleApplicantTypes: string[],
    minAward: number | null,
    maxAward: number | null,
    rules: any,
  ): EligibilityCheckResult {
    const reasons: string[] = [];
    let geographyMatch = true;
    let applicantTypeMatch = true;
    let awardSizeMatch = true;

    // Check geography
    if (rules.allowedGeographies && rules.allowedGeographies.length > 0) {
      if (!geographies || geographies.length === 0) {
        geographyMatch = false;
        reasons.push('Geography not specified');
      } else {
        const matches = geographies.some((geo: string) =>
          rules.allowedGeographies.some((allowed: string) =>
            geo.toLowerCase().includes(allowed.toLowerCase()) ||
            allowed.toLowerCase().includes(geo.toLowerCase())
          )
        );
        if (!matches) {
          geographyMatch = false;
          reasons.push(`Geographies "${geographies.join(', ')}" not in allowed list: ${rules.allowedGeographies.join(', ')}`);
        }
      }
    }

    // Check applicant type
    if (rules.allowedApplicantTypes && rules.allowedApplicantTypes.length > 0) {
      if (!eligibleApplicantTypes || eligibleApplicantTypes.length === 0) {
        applicantTypeMatch = false;
        reasons.push('Applicant type not specified');
      } else {
        const matches = eligibleApplicantTypes.some((type: string) =>
          rules.allowedApplicantTypes.some((allowed: string) =>
            type.toLowerCase() === allowed.toLowerCase()
          )
        );
        if (!matches) {
          applicantTypeMatch = false;
          reasons.push(`Applicant types "${eligibleApplicantTypes.join(', ')}" not in allowed list: ${rules.allowedApplicantTypes.join(', ')}`);
        }
      }
    }

    // Check award size
    if (rules.minAwardAmount !== null || rules.maxAwardAmount !== null) {
      const oppMinAward = minAward;
      const oppMaxAward = maxAward;

      if (oppMinAward === null && oppMaxAward === null) {
        awardSizeMatch = false;
        reasons.push('Award amount not specified');
      } else {
        // Check if opportunity's award range overlaps with allowed range
        const ruleMin = rules.minAwardAmount ? Number(rules.minAwardAmount) : 0;
        const ruleMax = rules.maxAwardAmount ? Number(rules.maxAwardAmount) : Infinity;

        const oppMin = oppMinAward ?? 0;
        const oppMax = oppMaxAward ?? Infinity;

        // Check if there's any overlap
        const hasOverlap = oppMin <= ruleMax && oppMax >= ruleMin;

        if (!hasOverlap) {
          awardSizeMatch = false;
          const currency = rules.currency || 'GBP';
          reasons.push(
            `Award range (${currency} ${oppMin}-${oppMax}) does not overlap with allowed range (${currency} ${ruleMin}-${ruleMax})`
          );
        }
      }
    }

    const isEligible = geographyMatch && applicantTypeMatch && awardSizeMatch;

    if (isEligible) {
      reasons.push('All eligibility criteria met');
    }

    return {
      isEligible,
      reasons,
      details: {
        geographyMatch,
        applicantTypeMatch,
        awardSizeMatch,
      },
    };
  }

  /**
   * Batch check eligibility for multiple opportunities
   */
  async batchCheckEligibility(opportunityIds: string[]): Promise<Map<string, EligibilityCheckResult>> {
    const results = new Map<string, EligibilityCheckResult>();

    for (const id of opportunityIds) {
      const result = await this.checkOpportunityEligibility(id);
      results.set(id, result);
    }

    return results;
  }

  /**
   * Get all eligible opportunities
   */
  async getEligibleOpportunities() {
    const opportunities = await this.prisma.opportunity.findMany({
      where: {
        status: 'OPEN',
      },
      select: {
        id: true,
        programName: true,
        geographies: true,
        eligibleApplicantTypes: true,
        minAward: true,
        maxAward: true,
      },
    });

    const eligibleOpportunities = [];

    for (const opp of opportunities) {
      const result = await this.checkOpportunityEligibility(opp.id);
      if (result.isEligible) {
        eligibleOpportunities.push({
          ...opp,
          eligibilityCheck: result,
        });
      }
    }

    return eligibleOpportunities;
  }
}
