/**
 * Simple test script for harvest integration
 * 
 * This script directly loads and displays the harvest run data
 * to verify it can be read correctly before integration.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

async function testHarvestData() {
  console.log('\n🧪 Testing Harvest Data Loading\n');
  console.log('='.repeat(80));

  const runId = 'engineering-and-physical-sciences-research-council-epsrc-award-gbp22000000_2026-01-15T17-16-05-738Z';
  
  try {
    // Load plan.json
    const planPath = path.join(
      process.cwd(),
      '..',
      'frontend',
      'harvest',
      'runs',
      runId,
      'plan.json',
    );

    console.log(`\n📂 Loading plan from: ${planPath}`);
    const planJson = await fs.readFile(planPath, 'utf-8');
    const plan = JSON.parse(planJson);

    console.log(`\n✅ Plan loaded successfully!`);
    console.log(`   - Run ID: ${plan.runId}`);
    console.log(`   - Source Type: ${plan.sourceType}`);
    console.log(`   - Source Name: ${plan.sourceName}`);
    console.log(`   - Source URL: ${plan.sourceUrl}`);
    console.log(`   - Funder: ${plan.funderName} (${plan.funderId})`);
    console.log(`   - Timestamp: ${new Date(plan.timestamp).toLocaleString()}`);
    console.log(`   - Total Opportunities: ${plan.stats.totalOpportunities}`);

    if (plan.config) {
      console.log(`\n⚙️  Configuration:`);
      console.log(`   - Extraction Method: ${plan.config.extractionMethod}`);
      console.log(`   - Tokens Used: ${plan.config.tokensUsed}`);
      console.log(`   - Extraction Confidence: ${(plan.config.extractionConfidence * 100).toFixed(0)}%`);
    }

    console.log(`\n📊 Grants extracted: ${plan.opportunities.length}`);
    
    for (let i = 0; i < Math.min(plan.opportunities.length, 3); i++) {
      const grant = plan.opportunities[i];
      console.log(`\n${i + 1}. ${grant.programName}`);
      console.log(`   Description: ${grant.description?.substring(0, 100)}...`);
      
      if (grant.fundingAmount) {
        const min = grant.fundingAmount.min?.toLocaleString() || '?';
        const max = grant.fundingAmount.max?.toLocaleString() || '?';
        const currency = grant.fundingAmount.currency || 'GBP';
        console.log(`   Funding: ${currency} ${min} - ${max}`);
      }
      
      if (grant.deadline) {
        console.log(`   Deadline: ${grant.deadline.date || grant.deadline.description || 'Not specified'}`);
      }
      
      if (grant.eligibility) {
        console.log(`   Eligibility: ${grant.eligibility}`);
      }
      
      if (grant.alignmentScore) {
        const score = (grant.alignmentScore.overall * 100).toFixed(1);
        console.log(`   Alignment: ${score}% (${grant.alignmentScore.recommendation})`);
        
        if (grant.alignmentScore.dimensions) {
          console.log(`   Dimensions:`);
          Object.entries(grant.alignmentScore.dimensions).forEach(([dim, val]: [string, any]) => {
            console.log(`     - ${dim}: ${(val * 100).toFixed(0)}%`);
          });
        }
        
        if (grant.alignmentScore.matchedStrands && grant.alignmentScore.matchedStrands.length > 0) {
          console.log(`   Matched Strands: ${grant.alignmentScore.matchedStrands.join(', ')}`);
        }
      }
    }

    // Load summary.json
    const summaryPath = path.join(
      process.cwd(),
      '..',
      'frontend',
      'harvest',
      'runs',
      runId,
      'summary.json',
    );

    console.log(`\n\n📋 Loading summary from: ${summaryPath}`);
    const summaryJson = await fs.readFile(summaryPath, 'utf-8');
    const summary = JSON.parse(summaryJson);

    console.log(`\n✅ Summary loaded successfully!`);
    console.log(`   - Status: ${summary.status}`);
    console.log(`   - Executed At: ${new Date(summary.executedAt).toLocaleString()}`);
    console.log(`   - Source: ${summary.source.name}`);
    console.log(`   - Funder: ${summary.funder.name}`);
    console.log(`   - Opportunities Found: ${summary.stats.opportunitiesFound}`);
    console.log(`   - New: ${summary.stats.newOpportunities}`);
    console.log(`   - Updated: ${summary.stats.updatedOpportunities}`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ Data loading test completed successfully!\n');
    console.log('📌 Next step: Use the API endpoint to integrate this data into the database');
    console.log(`   POST /harvest/runs/${runId}/integrate`);
    console.log(`   Body: { "funderId": "${plan.funderId}" }`);

  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error(error);
    throw error;
  }
}

// Run the test
testHarvestData()
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
