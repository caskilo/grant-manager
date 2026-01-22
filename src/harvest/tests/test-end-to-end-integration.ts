// Load environment variables from .env file
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(__dirname, '..', '..', '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

import { NavigationAnalyzerService } from '../navigation-analyzer.service';
import { IntelligentDiscoveryService } from '../intelligent-discovery.service';
import { GrantPageExtractorService } from '../grant-page-extractor.service';
import { LLMGrantExtractorService } from '../llm-grant-extractor.service';
import { OdysseanAlignmentService } from '../odyssean-alignment.service';

/**
 * End-to-End Integration Test
 * 
 * Tests the complete flow:
 * 1. Navigation analysis (find grant pages)
 * 2. LLM extraction (extract grant data)
 * 3. Odyssean alignment scoring (score for fit)
 * 
 * Budget: ~$0.10 for 2-3 funders
 */

const TEST_FUNDERS = [
  {
    name: 'NIHR (National Institute for Health Research)',
    url: 'https://www.nihr.ac.uk/',
    expectedGrants: 1,
    expectedRelevance: 'somewhat_relevant', // Health research, not core OI focus
  },
  {
    name: 'Joseph Rowntree Foundation',
    url: 'https://www.jrf.org.uk/',
    expectedGrants: 1,
    expectedRelevance: 'relevant', // Social justice, policy - good fit
  },
  // Add one more if budget allows
  // {
  //   name: 'Wellcome Trust',
  //   url: 'https://wellcome.org/',
  //   expectedGrants: 3,
  //   expectedRelevance: 'somewhat_relevant',
  // },
];

interface TestResult {
  funder: string;
  success: boolean;
  sourcesFound: number;
  grantsExtracted: number;
  grantsScored: number;
  extractionMethod: string[];
  alignmentScores: Array<{
    program: string;
    overall: number;
    recommendation: string;
    confidence: number;
  }>;
  tokensUsed: number;
  errors: string[];
}

async function testEndToEnd() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║     END-TO-END INTEGRATION TEST                                 ║');
  console.log('║     LLM Extraction + Odyssean Alignment Scoring                 ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Initialize services
  const navAnalyzer = new NavigationAnalyzerService();
  const grantExtractor = new GrantPageExtractorService();
  const llmExtractor = new LLMGrantExtractorService();
  const odysseanAlignment = new OdysseanAlignmentService();
  const intelligentDiscovery = new IntelligentDiscoveryService(
    navAnalyzer,
    grantExtractor,
  );

  const results: TestResult[] = [];
  let totalTokens = 0;
  const startTime = Date.now();

  for (const funder of TEST_FUNDERS) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Testing: ${funder.name}`);
    console.log(`URL: ${funder.url}`);
    console.log(`${'='.repeat(70)}`);

    const result: TestResult = {
      funder: funder.name,
      success: false,
      sourcesFound: 0,
      grantsExtracted: 0,
      grantsScored: 0,
      extractionMethod: [],
      alignmentScores: [],
      tokensUsed: 0,
      errors: [],
    };

    try {
      // Step 1: Discovery
      console.log('\n📍 Step 1: Running discovery...');
      const sources = await intelligentDiscovery.discoverSources(funder.url, 2);
      result.sourcesFound = sources.length;
      console.log(`   ✓ Found ${sources.length} sources`);

      // Step 2: Check extraction
      console.log('\n📄 Step 2: Checking grant extraction...');
      for (const source of sources) {
        if (source.grantData) {
          result.grantsExtracted++;
          
          // Determine extraction method
          const method = source.reasoning.find(r => r.includes('Extraction:'))?.split(':')[1]?.trim() || 'unknown';
          result.extractionMethod.push(method);
          
          console.log(`   ✓ Extracted: ${source.grantData.programName}`);
          console.log(`     Method: ${method}`);
          if (source.grantData.llmConfidence) {
            console.log(`     LLM Confidence: ${(source.grantData.llmConfidence * 100).toFixed(1)}%`);
          }
        }
      }

      // Step 3: Score alignment
      console.log('\n📊 Step 3: Scoring Odyssean alignment...');
      for (const source of sources) {
        if (source.grantData) {
          try {
            const alignmentScore = await odysseanAlignment.scoreGrant({
              programName: source.grantData.programName,
              description: source.grantData.description || '',
              funderName: funder.name,
              eligibility: source.grantData.eligibility,
              fundingAmount: {
                min: source.grantData.minAward,
                max: source.grantData.maxAward,
                currency: source.grantData.currency,
              },
              deadline: source.grantData.deadline,
              geographies: source.grantData.geographies,
              focusAreas: source.grantData.focusAreas,
              applicantTypes: source.grantData.applicantTypes,
              sourceUrl: source.url,
            });

            result.grantsScored++;
            result.alignmentScores.push({
              program: source.grantData.programName,
              overall: alignmentScore.overall,
              recommendation: alignmentScore.recommendation,
              confidence: alignmentScore.confidence,
            });

            if (alignmentScore.tokensUsed) {
              result.tokensUsed += alignmentScore.tokensUsed;
            }

            console.log(`   ✓ Scored: ${source.grantData.programName}`);
            console.log(`     Overall: ${(alignmentScore.overall * 100).toFixed(1)}%`);
            console.log(`     Recommendation: ${alignmentScore.recommendation}`);
            console.log(`     Confidence: ${(alignmentScore.confidence * 100).toFixed(1)}%`);
            
            if (alignmentScore.matchedStrands.length > 0) {
              console.log(`     Matched Strands:`);
              for (const strand of alignmentScore.matchedStrands.slice(0, 2)) {
                console.log(`       - ${strand.strand}: ${(strand.relevance * 100).toFixed(1)}%`);
              }
            }

          } catch (error: any) {
            result.errors.push(`Scoring failed: ${error.message}`);
            console.log(`   ✗ Scoring failed: ${error.message}`);
          }
        }
      }

      totalTokens += result.tokensUsed;

      // Validate results
      result.success = 
        result.sourcesFound >= funder.expectedGrants &&
        result.grantsExtracted >= funder.expectedGrants &&
        result.grantsScored >= funder.expectedGrants;

      console.log(`\n${result.success ? '✅' : '⚠️'} Test ${result.success ? 'PASSED' : 'INCOMPLETE'}`);
      console.log(`   Sources: ${result.sourcesFound}/${funder.expectedGrants} expected`);
      console.log(`   Extracted: ${result.grantsExtracted}/${funder.expectedGrants} expected`);
      console.log(`   Scored: ${result.grantsScored}/${funder.expectedGrants} expected`);
      console.log(`   Tokens: ${result.tokensUsed}`);

    } catch (error: any) {
      result.errors.push(error.message);
      console.log(`\n✗ Test FAILED: ${error.message}`);
    }

    results.push(result);

    // Delay between funders to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('\n\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║     TEST SUMMARY                                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const successCount = results.filter(r => r.success).length;
  const totalSources = results.reduce((sum, r) => sum + r.sourcesFound, 0);
  const totalExtracted = results.reduce((sum, r) => sum + r.grantsExtracted, 0);
  const totalScored = results.reduce((sum, r) => sum + r.grantsScored, 0);

  console.log(`Tests Passed: ${successCount}/${results.length}`);
  console.log(`Total Sources Found: ${totalSources}`);
  console.log(`Total Grants Extracted: ${totalExtracted}`);
  console.log(`Total Grants Scored: ${totalScored}`);
  console.log(`Total Tokens Used: ${totalTokens}`);
  console.log(`Duration: ${duration}s`);

  // Cost estimate
  const estimatedCost = (totalTokens / 1000000) * 5; // Rough estimate
  console.log(`Estimated Cost: $${estimatedCost.toFixed(4)}`);

  // Extraction method breakdown
  const extractionMethods = results.flatMap(r => r.extractionMethod);
  const llmCount = extractionMethods.filter(m => m === 'llm').length;
  const heuristicCount = extractionMethods.filter(m => m === 'heuristic').length;
  const basicCount = extractionMethods.filter(m => m === 'basic analysis').length;

  console.log(`\nExtraction Methods:`);
  console.log(`  LLM: ${llmCount}`);
  console.log(`  Heuristic: ${heuristicCount}`);
  console.log(`  Basic: ${basicCount}`);

  // Alignment score distribution
  const allScores = results.flatMap(r => r.alignmentScores);
  if (allScores.length > 0) {
    const avgScore = allScores.reduce((sum, s) => sum + s.overall, 0) / allScores.length;
    const highlyRelevant = allScores.filter(s => s.recommendation === 'highly_relevant').length;
    const relevant = allScores.filter(s => s.recommendation === 'relevant').length;
    const somewhatRelevant = allScores.filter(s => s.recommendation === 'somewhat_relevant').length;
    const notRelevant = allScores.filter(s => s.recommendation === 'not_relevant').length;

    console.log(`\nAlignment Scores:`);
    console.log(`  Average: ${(avgScore * 100).toFixed(1)}%`);
    console.log(`  Highly Relevant: ${highlyRelevant}`);
    console.log(`  Relevant: ${relevant}`);
    console.log(`  Somewhat Relevant: ${somewhatRelevant}`);
    console.log(`  Not Relevant: ${notRelevant}`);
  }

  // Errors
  const allErrors = results.flatMap(r => r.errors);
  if (allErrors.length > 0) {
    console.log(`\n⚠️ Errors Encountered: ${allErrors.length}`);
    allErrors.forEach(err => console.log(`  - ${err}`));
  }

  console.log('\n' + '='.repeat(70));
  
  if (successCount === results.length && estimatedCost < 0.10) {
    console.log('🎉 ALL TESTS PASSED - Integration working perfectly!');
    console.log('✅ LLM extraction functioning');
    console.log('✅ Odyssean alignment scoring functioning');
    console.log('✅ Within budget');
  } else if (successCount > 0) {
    console.log('⚠️ PARTIAL SUCCESS - Some tests passed');
  } else {
    console.log('❌ ALL TESTS FAILED - Check configuration');
  }
}

// Run tests
testEndToEnd().catch(console.error);
