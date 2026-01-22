import { LLMGrantExtractorService } from '../llm-grant-extractor.service';

/**
 * Test LLM-based grant extraction on real funder pages
 */

const TEST_CASES = [
  {
    name: 'NIHR - Single Grant Page',
    url: 'https://www.nihr.ac.uk/explore-nihr/funding-programmes/research-for-patient-benefit.htm',
    expectedGrants: 1,
    expectedFields: ['programName', 'description', 'fundingAmount', 'eligibility'],
  },
  {
    name: 'Leverhulme - Grant List',
    url: 'https://www.leverhulme.ac.uk/research-project-grants',
    expectedGrants: 1,
    expectedFields: ['programName', 'description', 'fundingAmount'],
  },
  {
    name: 'Wellcome - Funding Schemes',
    url: 'https://wellcome.org/grant-funding/schemes',
    expectedGrants: 5, // Multiple schemes on one page
    expectedFields: ['programName', 'description'],
  },
];

async function testExtraction() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║     LLM GRANT EXTRACTION TEST SUITE                            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const extractor = new LLMGrantExtractorService();

  for (const testCase of TEST_CASES) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Test: ${testCase.name}`);
    console.log(`URL: ${testCase.url}`);
    console.log(`${'='.repeat(70)}`);

    try {
      // Fetch HTML
      const response = await fetch(testCase.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        console.log(`✗ HTTP ${response.status}: ${response.statusText}`);
        continue;
      }

      const html = await response.text();
      console.log(`✓ Fetched HTML (${(html.length / 1024).toFixed(1)} KB)`);

      // Extract grants
      const result = await extractor.extractFromHtml(html, testCase.url);

      if (!result) {
        console.log('✗ Extraction returned null (API key not set?)');
        continue;
      }

      console.log(`\nResults:`);
      console.log(`  Page Type: ${result.pageType}`);
      console.log(`  Confidence: ${result.confidence.toFixed(2)}`);
      console.log(`  Grants Found: ${result.grants.length}`);
      console.log(`  Tokens Used: ${result.tokensUsed}`);

      // Check expectations
      const grantsMatch = result.grants.length >= testCase.expectedGrants;
      console.log(`  Expected ≥${testCase.expectedGrants} grants: ${grantsMatch ? '✓' : '✗'}`);

      // Display each grant
      for (let i = 0; i < result.grants.length; i++) {
        const grant = result.grants[i];
        console.log(`\n  Grant ${i + 1}:`);
        console.log(`    Name: ${grant.programName}`);
        console.log(`    Description: ${grant.description.substring(0, 150)}...`);
        console.log(`    Confidence: ${grant.confidence.toFixed(2)}`);
        
        if (grant.fundingAmount) {
          const amt = grant.fundingAmount;
          console.log(`    Funding: ${amt.currency || 'GBP'} ${amt.min || '?'} - ${amt.max || '?'}`);
        }
        
        if (grant.deadline) {
          console.log(`    Deadline: ${grant.deadline.date || grant.deadline.description || 'Not specified'}`);
        }
        
        if (grant.geographies?.length) {
          console.log(`    Geography: ${grant.geographies.join(', ')}`);
        }
        
        if (grant.focusAreas?.length) {
          console.log(`    Focus: ${grant.focusAreas.slice(0, 3).join(', ')}`);
        }

        console.log(`    Reasoning: ${grant.reasoning}`);

        // Check expected fields
        const missingFields = testCase.expectedFields.filter(field => {
          if (field === 'fundingAmount') return !grant.fundingAmount;
          if (field === 'deadline') return !grant.deadline;
          return !grant[field as keyof typeof grant];
        });

        if (missingFields.length > 0) {
          console.log(`    ⚠ Missing expected fields: ${missingFields.join(', ')}`);
        }
      }

      console.log(`\n${grantsMatch ? '✓' : '✗'} Test ${grantsMatch ? 'PASSED' : 'FAILED'}`);

    } catch (error: any) {
      console.log(`✗ Error: ${error.message}`);
    }

    // Delay between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║     TEST SUITE COMPLETE                                         ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
}

// Run tests
testExtraction().catch(console.error);
