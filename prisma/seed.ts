import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function main() {
  console.log('🌱 Seeding database...');

  // Create default admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@odyssean.org' },
    update: {},
    create: {
      email: 'admin@odyssean.org',
      passwordHash: adminPassword,
      name: 'Admin User',
      role: UserRole.ADMIN,
      isActive: true,
    },
  });
  console.log('✅ Created admin user:', admin.email);

  // Create grants officer
  const officerPassword = await bcrypt.hash('officer123', 10);
  const officer = await prisma.user.upsert({
    where: { email: 'officer@odyssean.org' },
    update: {},
    create: {
      email: 'officer@odyssean.org',
      passwordHash: officerPassword,
      name: 'Grants Officer',
      role: UserRole.GRANTS_OFFICER,
      isActive: true,
    },
  });
  console.log('✅ Created grants officer:', officer.email);

  // Create reviewer
  const reviewerPassword = await bcrypt.hash('reviewer123', 10);
  const reviewer = await prisma.user.upsert({
    where: { email: 'reviewer@odyssean.org' },
    update: {},
    create: {
      email: 'reviewer@odyssean.org',
      passwordHash: reviewerPassword,
      name: 'Reviewer User',
      role: UserRole.REVIEWER,
      isActive: true,
    },
  });
  console.log('✅ Created reviewer:', reviewer.email);

  // Initialize FitScoringConfig (single row)
  const fitConfig = await prisma.fitScoringConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      weightAlignment: 0.5,
      weightGeography: 0.2,
      weightApplicantType: 0.2,
      weightAwardSize: 0.1,
      thresholdHigh: 7.0,
      thresholdMedium: 4.0,
    },
  });
  console.log('✅ Initialized fit scoring config');

  // Initialize EligibilityRules (single row)
  const eligibilityRules = await prisma.eligibilityRules.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      allowedGeographies: ['UK', 'England', 'Scotland', 'Wales', 'Northern Ireland', 'Europe'],
      allowedApplicantTypes: [
        'Charity',
        'CIC',
        'Research Institute',
        'University',
        'Non-profit',
      ],
      minAwardAmount: 5000,
      maxAwardAmount: 500000,
      currency: 'GBP',
    },
  });
  console.log('✅ Initialized eligibility rules');

  // Create sample templates
  const template1Line = await prisma.template.create({
    data: {
      name: 'Odyssean Process - 1 Line',
      type: 'BOILERPLATE_1LINE',
      content:
        'The Odyssean Process is a modular method for comprehensive, legitimate, and tractable decision-making under conditions of extreme risk and uncertainty.',
      tags: ['odyssean-process', 'core'],
      createdById: admin.id,
    },
  });
  console.log('✅ Created 1-line template');

  const template1Para = await prisma.template.create({
    data: {
      name: 'Odyssean Process - 1 Paragraph',
      type: 'BOILERPLATE_1PARA',
      content:
        'Public trust has been falling around the world, with demonstrable corruption, inaction on critical issues, and regulatory capture contributing to greater exposure to risk. The Odyssean Process is calibrated to raise the quality of agenda setting through expert elicitation, problem and policy formulation via advanced exploratory modelling (Decision Making Under Deep Uncertainty), and drafting and adopting policies through citizen assemblies. We have pioneered their integration as a comprehensive approach to tackling Grand Challenges.',
      tags: ['odyssean-process', 'core'],
      createdById: admin.id,
    },
  });
  console.log('✅ Created 1-paragraph template');

  const template1Page = await prisma.template.create({
    data: {
      name: 'Odyssean Process - 1 Page',
      type: 'BOILERPLATE_1PAGE',
      content: `With negative tipping points approaching—most markedly in the climate system, but also potentially across numerous decisive areas of our civilisation—we are in revolutionary times. Radical change is coming whether we want it or not; it is up to us whether we are reactive victims of circumstance, or use the tools at our disposal to intelligently target a radically beneficial future.

The Odyssean Process addresses the fact that in many democracies, and autocracies, agenda setting is myopic and suicidal. We admit climate emergencies, but immediately subvert all interventions that might do something about it. We acknowledge nightmare scenarios around AI, but we do very little to regulate. We sense everything worsening, yet seemingly haven't the means to grasp these trends and reverse them.

This Process is both long term in its outlook, seeking to lay the foundations for better systems, and it is acutely focused on securing win-wins now. The technical aspects enable consensus and optimal interventions to emerge from modelling and deliberation, providing a key tool in bridging polarised divisions.

The Odyssean Process integrates three proven methodologies:
1. Expert elicitation of judgement for rigorous agenda setting
2. Decision Making Under Deep Uncertainty (DMDU) to probe thousands of scenarios
3. Citizen assemblies to generate popular and tractable recommendations by the public, for the public

Each module alone adds value to existing institutions, but their integration creates a comprehensive framework for addressing existential challenges with legitimacy, tractability, and robustness.`,
      tags: ['odyssean-process', 'core'],
      createdById: admin.id,
    },
  });
  console.log('✅ Created 1-page template');

  const outreachTemplate = await prisma.template.create({
    data: {
      name: 'Initial Funder Outreach',
      type: 'OUTREACH',
      content: `Dear [Funder Contact Name],

I am writing on behalf of the Odyssean Institute, a research institute focused on addressing Grand Challenges through innovative governance and decision-making methodologies.

We are interested in [specific program name] and believe our work on [relevant research strand] aligns strongly with your funding priorities, particularly [specific alignment points].

Would you be available for a brief call to discuss potential collaboration opportunities?

Best regards,
[Your Name]
Odyssean Institute`,
      tags: ['outreach', 'initial-contact'],
      createdById: admin.id,
    },
  });
  console.log('✅ Created outreach template');

  console.log('🎉 Seeding completed successfully!');
  console.log('\n📝 Default credentials:');
  console.log('   Admin: admin@odyssean.org / admin123');
  console.log('   Officer: officer@odyssean.org / officer123');
  console.log('   Reviewer: reviewer@odyssean.org / reviewer123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
