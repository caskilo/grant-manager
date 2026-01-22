import { OdysseanAlignmentService, GrantForScoring } from '../odyssean-alignment.service';

/**
 * Test Odyssean alignment scoring on sample grants
 */

const TEST_GRANTS: GrantForScoring[] = [
  {
    programName: 'Participatory Democracy Innovation Fund',
    funderName: 'Democratic Futures Foundation',
    description: 'Supports research and practice in deliberative democracy, citizen assemblies, and participatory governance. Projects should demonstrate innovative approaches to democratic decision-making under conditions of uncertainty and complexity. Emphasis on systemic change and institutional reform.',
    eligibility: 'Research organizations, think tanks, NGOs working on democratic innovation',
    fundingAmount: { min: 50000, max: 250000, currency: 'GBP' },
    deadline: '2026-06-30',
    duration: '12-36 months',
    geographies: ['UK', 'Europe'],
    focusAreas: ['deliberative democracy', 'citizen assemblies', 'governance innovation', 'systemic reform'],
    applicantTypes: ['Research organization', 'Think tank', 'NGO'],
    sourceUrl: 'https://example.com/grant1',
  },
  {
    programName: 'Supply Chain Resilience Research',
    funderName: 'Global Infrastructure Fund',
    description: 'Research into critical supply chains, trade chokepoints, and infrastructure resilience. Projects should use futures methodologies and systems thinking to identify vulnerabilities and design interventions for sustainable, resilient global systems.',
    eligibility: 'Academic institutions, research centers, international organizations',
    fundingAmount: { min: 100000, max: 500000, currency: 'GBP' },
    deadline: 'Rolling',
    duration: '24-48 months',
    geographies: ['Global', 'Trade chokepoints'],
    focusAreas: ['supply chain', 'resilience', 'infrastructure', 'futures', 'sustainability'],
    applicantTypes: ['Academic institution', 'Research center'],
    sourceUrl: 'https://example.com/grant2',
  },
  {
    programName: 'Wellbeing and Planetary Boundaries',
    funderName: 'Sustainable Futures Trust',
    description: 'Supports interdisciplinary research on human wellbeing within ecological limits. Projects should integrate capabilities approach, indigenous wisdom, and commons governance to develop long-term sustainable models of flourishing.',
    eligibility: 'Universities, research institutes, community organizations',
    fundingAmount: { min: 75000, max: 300000, currency: 'GBP' },
    deadline: '2026-09-15',
    duration: '18-36 months',
    geographies: ['UK', 'Global South', 'Indigenous communities'],
    focusAreas: ['wellbeing', 'sustainability', 'planetary boundaries', 'commons', 'indigenous knowledge'],
    applicantTypes: ['University', 'Research institute', 'Community organization'],
    sourceUrl: 'https://example.com/grant3',
  },
  {
    programName: 'Small Business Marketing Support',
    funderName: 'Business Growth Fund',
    description: 'Grants for small businesses to improve their digital marketing and social media presence. Funding covers website development, SEO optimization, and social media advertising campaigns.',
    eligibility: 'UK-based small businesses with <50 employees',
    fundingAmount: { min: 5000, max: 15000, currency: 'GBP' },
    deadline: '2026-03-31',
    duration: '6-12 months',
    geographies: ['UK'],
    focusAreas: ['marketing', 'digital', 'business growth'],
    applicantTypes: ['Small business', 'Startup'],
    sourceUrl: 'https://example.com/grant4',
  },
  {
    programName: 'AI Safety and Governance Research',
    funderName: 'Tech Ethics Institute',
    description: 'Research into AI safety, alignment, and governance frameworks. Projects should address existential risks from advanced AI systems and develop participatory governance mechanisms for AI development. Emphasis on public engagement and policy impact.',
    eligibility: 'Research institutions, think tanks, interdisciplinary teams',
    fundingAmount: { min: 150000, max: 750000, currency: 'GBP' },
    deadline: '2026-08-01',
    duration: '24-60 months',
    geographies: ['Global', 'UK', 'Europe'],
    focusAreas: ['AI safety', 'AI governance', 'existential risk', 'participatory governance', 'policy'],
    applicantTypes: ['Research institution', 'Think tank', 'Interdisciplinary team'],
    sourceUrl: 'https://example.com/grant5',
  },
];

async function testAlignment() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║     ODYSSEAN ALIGNMENT SCORING TEST SUITE                      ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const scorer = new OdysseanAlignmentService();

  for (const grant of TEST_GRANTS) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Grant: ${grant.programName}`);
    console.log(`Funder: ${grant.funderName}`);
    console.log(`${'='.repeat(70)}`);

    try {
      const score = await scorer.scoreGrant(grant);

      console.log(`\n📊 Overall Score: ${(score.overall * 100).toFixed(1)}%`);
      console.log(`   Recommendation: ${score.recommendation.toUpperCase()}`);
      console.log(`   Confidence: ${(score.confidence * 100).toFixed(1)}%`);

      console.log(`\n📈 Dimension Scores:`);
      console.log(`   Research Strand Match:    ${(score.dimensions.researchStrandMatch * 100).toFixed(1)}%`);
      console.log(`   Methodological Fit:       ${(score.dimensions.methodologicalFit * 100).toFixed(1)}%`);
      console.log(`   Thematic Alignment:       ${(score.dimensions.thematicAlignment * 100).toFixed(1)}%`);
      console.log(`   Impact Potential:         ${(score.dimensions.impactPotential * 100).toFixed(1)}%`);
      console.log(`   Practical Feasibility:    ${(score.dimensions.practicalFeasibility * 100).toFixed(1)}%`);

      if (score.matchedStrands.length > 0) {
        console.log(`\n🎯 Matched Research Strands:`);
        for (const strand of score.matchedStrands) {
          console.log(`   ${strand.strand}: ${(strand.relevance * 100).toFixed(1)}%`);
          console.log(`      ${strand.reasoning}`);
        }
      }

      if (score.strengths.length > 0) {
        console.log(`\n✅ Strengths:`);
        score.strengths.forEach(s => console.log(`   • ${s}`));
      }

      if (score.concerns.length > 0) {
        console.log(`\n⚠️  Concerns:`);
        score.concerns.forEach(c => console.log(`   • ${c}`));
      }

      console.log(`\n💭 Reasoning:`);
      console.log(`   ${score.reasoning}`);

      if (score.tokensUsed) {
        console.log(`\n🔢 Tokens Used: ${score.tokensUsed}`);
      }

      // Delay between requests
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error: any) {
      console.log(`✗ Error: ${error.message}`);
    }
  }

  console.log('\n\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║     TEST SUITE COMPLETE                                         ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log('Expected Results:');
  console.log('  Grant 1 (Democracy): HIGHLY RELEVANT (Odyssean Process)');
  console.log('  Grant 2 (Supply Chain): HIGHLY RELEVANT (GRAIN)');
  console.log('  Grant 3 (Wellbeing): HIGHLY RELEVANT (Aeonic Flourishing)');
  console.log('  Grant 4 (Marketing): NOT RELEVANT (off-topic)');
  console.log('  Grant 5 (AI Safety): HIGHLY RELEVANT (Odyssean Process + cross-cutting)');
}

// Run tests
testAlignment().catch(console.error);
