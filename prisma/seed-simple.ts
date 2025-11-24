import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default admin user (plain text for now - will be fixed in production)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@odyssean.org' },
    update: {},
    create: {
      email: 'admin@odyssean.org',
      passwordHash: 'admin123-temp', // Temporary - will fix auth service
      name: 'Admin User',
      role: UserRole.ADMIN,
      isActive: true,
    },
  });
  console.log('✅ Created admin user:', admin.email);

  // Create grants officer
  const officer = await prisma.user.upsert({
    where: { email: 'officer@odyssean.org' },
    update: {},
    create: {
      email: 'officer@odyssean.org',
      passwordHash: 'officer123-temp', // Temporary
      name: 'Grants Officer',
      role: UserRole.GRANTS_OFFICER,
      isActive: true,
    },
  });
  console.log('✅ Created grants officer:', officer.email);

  // Create reviewer
  const reviewer = await prisma.user.upsert({
    where: { email: 'reviewer@odyssean.org' },
    update: {},
    create: {
      email: 'reviewer@odyssean.org',
      passwordHash: 'reviewer123-temp', // Temporary
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
      allowedGeographies: ['UK', 'United Kingdom', 'England', 'Scotland', 'Wales', 'Northern Ireland'],
      allowedApplicantTypes: ['CHARITY', 'RESEARCH_INSTITUTE', 'UNIVERSITY'],
      minAwardAmount: 1000,
      maxAwardAmount: 10000000,
      currency: 'GBP',
    },
  });
  console.log('✅ Initialized eligibility rules');

  // Create sample templates
  const templates = [
    {
      name: 'Odyssean Process - 1 Line',
      type: 'BOILERPLATE_1LINE',
      content: 'We advance human flourishing through the Odyssean Process of discovery, integration, and application.',
      description: 'One-line summary of the Odyssean Process',
    },
    {
      name: 'Odyssean Process - 1 Paragraph',
      type: 'BOILERPLATE_1PARA',
      content: 'The Odyssean Process represents our unique approach to advancing human flourishing. Through systematic discovery of fundamental patterns, careful integration across disciplines, and practical application in real-world contexts, we create lasting positive impact. This methodology guides our research, our collaborations, and our commitment to building a better future for all.',
      description: 'Paragraph description of the Odyssean Process',
    },
    {
      name: 'Odyssean Process - 1 Page',
      type: 'BOILERPLATE_1PAGE',
      content: `# The Odyssean Process: Advancing Human Flourishing

## Overview
The Odyssean Process is our comprehensive methodology for creating lasting positive impact through three key phases: Discovery, Integration, and Application.

## Phase 1: Discovery
We systematically explore fundamental patterns and principles that govern complex systems, using both analytical tools and intuitive insight to uncover new possibilities.

## Phase 2: Integration
Across disciplines and perspectives, we weave together insights to create holistic understanding and innovative approaches to challenges.

## Phase 3: Application
We translate understanding into action, implementing solutions that create tangible benefits and demonstrate the power of integrated thinking.

## Impact
Through this process, we advance our three core initiatives: GRAIN (Global Resilience through Agricultural Innovation), the broader Odyssean Process methodology, and the ultimate goal of Aeonic Flourishing - creating conditions for humanity to thrive across generations.

## Commitment
This is not just a methodology—it is our commitment to rigorous inquiry, collaborative action, and the belief that together, we can create a world of greater flourishing for all.`,
      description: 'Full one-page description of the Odyssean Process',
    },
    {
      name: 'Initial Funder Outreach',
      type: 'OUTREACH',
      content: `Dear [Funder Name],

I hope this message finds you well. I am reaching out from the Odyssean Institute to introduce our work and explore potential alignment with your funding priorities.

The Odyssean Institute is dedicated to advancing human flourishing through innovative research and practical application. Our work encompasses three core areas:

1. **GRAIN Initiative**: Developing resilient agricultural systems for a changing world
2. **Odyssean Process**: A unique methodology for discovery, integration, and application
3. **Aeonic Flourishing**: Creating conditions for long-term societal thriving

We believe our work aligns well with your commitment to [mention specific funder interests if known], and we would welcome the opportunity to discuss potential collaboration.

Would you be available for a brief conversation in the coming weeks to explore synergies between our organizations?

Thank you for your time and consideration.

Best regards,
[Your Name]`,
      description: 'Template for initial outreach to potential funders',
    },
  ];

  for (const template of templates) {
    const { description, ...templateData } = template;
    await prisma.template.create({
      data: {
        ...templateData,
        type: template.type as any, // Type cast for enum
        createdById: admin.id,
      },
    });
  }
  console.log('✅ Created sample templates');

  console.log('🎉 Database seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
