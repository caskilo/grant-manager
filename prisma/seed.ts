import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function main() {
  console.log('🌱 Seeding database...');

  // Seed users
  const defaultPassword = await bcrypt.hash('OIadmin26', 10);

  const users = [
    // Admins
    { email: 'will.guest@odyssean.org', username: 'willguest', name: 'Will Guest', role: UserRole.ADMIN },
    { email: 'jonathan.salter@odyssean.org', username: 'jonathansalter', name: 'Jonathan Salter', role: UserRole.ADMIN },
    { email: 'giuseppe.dalpra@odyssean.org', username: 'giuseppedalpra', name: 'Giuseppe Dal Pra', role: UserRole.ADMIN },
    // Grants Officers
    { email: 'surya.prabhat@odyssean.org', username: 'suryaprabhat', name: 'Surya Prabhat', role: UserRole.GRANTS_OFFICER },
    { email: 'candacia.greeman@odyssean.org', username: 'candaciagreeman', name: 'Candacia Greeman', role: UserRole.GRANTS_OFFICER },
    { email: 'niamh.duncan@odyssean.org', username: 'niamhduncan', name: 'Niamh Duncan', role: UserRole.GRANTS_OFFICER },
    { email: 'giulia.mouland@odyssean.org', username: 'giuliamouland', name: 'Giulia Mouland', role: UserRole.GRANTS_OFFICER },
    { email: 'jacob.haimes@odyssean.org', username: 'jacobhaimes', name: 'Jacob Haimes', role: UserRole.GRANTS_OFFICER },
  ];

  let admin: any;
  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: {
        email: u.email,
        username: u.username,
        passwordHash: defaultPassword,
        name: u.name,
        role: u.role,
        isActive: true,
      },
    });
    if (u.username === 'willguest') admin = user;
    console.log(`✅ Created ${u.role.toLowerCase()}: ${u.username} (${u.name})`);
  }

  // Deactivate old placeholder users if they exist
  for (const oldEmail of ['admin@odyssean.org', 'officer@odyssean.org', 'reviewer@odyssean.org']) {
    const old = await prisma.user.findUnique({ where: { email: oldEmail } });
    if (old) {
      await prisma.user.update({ where: { id: old.id }, data: { isActive: false } });
      console.log(`🗑️  Deactivated old placeholder user: ${oldEmail}`);
    }
  }

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

  // Seed catalogue from catalogue.json
  console.log('📚 Seeding catalogue...');
  
  let catalogueData;
  const isProduction = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';
  
  if (isProduction) {
    // Production: Fetch from deployed frontend
    const frontendUrl = process.env.FRONTEND_URL || 'https://caskilo.github.io/grant-manager';
    const catalogueUrl = `${frontendUrl}/catalogue.json`;
    console.log(`📥 Fetching catalogue from: ${catalogueUrl}`);
    
    try {
      const response = await fetch(catalogueUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      catalogueData = await response.json();
    } catch (error) {
      console.error('❌ Failed to fetch catalogue from frontend:', error);
      console.log('⚠️  Skipping catalogue seeding');
      catalogueData = null;
    }
  } else {
    // Development: Read from local file
    const cataloguePath = path.join(__dirname, '../../frontend/public/catalogue.json');
    if (fs.existsSync(cataloguePath)) {
      console.log(`📖 Reading local catalogue from: ${cataloguePath}`);
      catalogueData = JSON.parse(fs.readFileSync(cataloguePath, 'utf-8'));
    } else {
      console.log('⚠️  Local catalogue.json not found, skipping catalogue seeding');
      catalogueData = null;
    }
  }
  
  if (catalogueData) {
    
    let catalogueCount = 0;
    for (const funder of catalogueData.funders) {
      const existing = await prisma.catalogue.findFirst({
        where: { name: { equals: funder.name, mode: 'insensitive' } },
      });
      
      if (!existing) {
        await prisma.catalogue.create({
          data: {
            id: funder.id,
            name: funder.name,
            description: funder.focus ? funder.focus.join(', ') : null,
            type: funder.type,
            focus: funder.focus || [],
            geographies: funder.geographies || [],
            websiteUrl: funder.websiteUrl,
            typicalAwardMin: funder.typicalAwardMin,
            typicalAwardMax: funder.typicalAwardMax,
            currency: funder.currency || 'GBP',
            openData: funder.openData || 'No',
            notes: funder.notes || '',
          },
        });
        catalogueCount++;
      }
    }
    console.log(`✅ Seeded ${catalogueCount} catalogue entries`);
  } else {
    console.log('⚠️  catalogue.json not found, skipping catalogue seeding');
  }

  console.log('🎉 Seeding completed successfully!');
  console.log('\n📝 Default credentials (all users):');
  console.log('   Username: <firstname><lastname> / OIadmin26');
  console.log('   Admins: willguest, jonathansalter, giuseppedalpra');
  console.log('   Officers: suryaprabhat, candaciagreeman, niamhduncan, giuliamouland, jacobhaimes');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
