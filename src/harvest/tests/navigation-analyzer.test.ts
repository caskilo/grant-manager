import { NavigationAnalyzerService } from '../navigation-analyzer.service';

/**
 * Test suite for NavigationAnalyzerService
 * 
 * This tests the analyzer against real funder websites from our catalog
 * to ensure we can reliably find grant/funding pages.
 */

// Expected grant page patterns for each funder
// These are FLEXIBLE patterns - any match is considered success
const FUNDER_TEST_CASES: Array<{
  name: string;
  homepage: string;
  expectedGrantPatterns: string[]; // URL patterns we expect to find (any match = success)
  expectedKeywords: string[]; // Keywords we expect in nav items
  skipReason?: string; // If set, skip this test with reason
}> = [
  {
    name: 'Rockefeller Foundation',
    homepage: 'https://www.rockefellerfoundation.org/',
    expectedGrantPatterns: ['/grant', '/funding', '/our-grants'],
    expectedKeywords: ['grant', 'funding'],
  },
  {
    name: 'Leverhulme Trust',
    homepage: 'https://www.leverhulme.ac.uk/',
    expectedGrantPatterns: ['/grant', '/funding', '/scheme', '/fellowship'],
    expectedKeywords: ['grant', 'funding', 'scheme', 'fellowship'],
  },
  {
    name: 'Wellcome Trust',
    homepage: 'https://wellcome.org/',
    expectedGrantPatterns: ['/funding', '/grant', '/research-funding', '/scheme'],
    expectedKeywords: ['funding', 'grant', 'award'],
  },
  {
    name: 'Ford Foundation',
    homepage: 'https://www.fordfoundation.org/',
    expectedGrantPatterns: ['/grant', '/work', '/funding'],
    expectedKeywords: ['grant', 'work', 'fund'],
  },
  {
    name: 'British Academy',
    homepage: 'https://www.thebritishacademy.ac.uk/',
    expectedGrantPatterns: ['/funding', '/programme', '/award', '/fellowship'],
    expectedKeywords: ['funding', 'programme', 'award', 'fellowship'],
    skipReason: 'Returns 403 Forbidden - requires browser/cookies',
  },
  {
    name: 'Nuffield Foundation',
    homepage: 'https://www.nuffieldfoundation.org/',
    expectedGrantPatterns: ['/funding', '/grant', '/research'],
    expectedKeywords: ['funding', 'grant', 'research'],
  },
  {
    name: 'Gatsby Charitable Foundation',
    homepage: 'https://www.gatsby.org.uk/',
    expectedGrantPatterns: ['/our-work', '/programme', '/plant-science', '/neuroscience'],
    expectedKeywords: ['work', 'programme', 'fund'],
    skipReason: 'Heavy JavaScript site - may need browser rendering',
  },
  {
    name: 'Paul Hamlyn Foundation',
    homepage: 'https://www.phf.org.uk/',
    expectedGrantPatterns: ['/funding', '/grant', '/fund'],
    expectedKeywords: ['funding', 'grant', 'fund'],
  },
  {
    name: 'Esmée Fairbairn Foundation',
    homepage: 'https://esmeefairbairn.org.uk/',
    expectedGrantPatterns: ['/funding', '/grant', '/apply', '/what-we-fund'],
    expectedKeywords: ['funding', 'grant', 'fund', 'apply'],
  },
  {
    name: 'Joseph Rowntree Foundation',
    homepage: 'https://www.jrf.org.uk/',
    expectedGrantPatterns: ['/funding', '/grant', '/our-work'],
    expectedKeywords: ['funding', 'grant', 'work'],
  },
  {
    name: 'MacArthur Foundation',
    homepage: 'https://www.macfound.org/',
    expectedGrantPatterns: ['/grant', '/program', '/what-we-support'],
    expectedKeywords: ['grant', 'program', 'support'],
  },
  {
    name: 'NIHR (National Institute for Health Research)',
    homepage: 'https://www.nihr.ac.uk/',
    expectedGrantPatterns: ['/funding', '/grant', '/opportunity'],
    expectedKeywords: ['funding', 'grant', 'opportunity'],
  },
  {
    name: 'AHRC (Arts & Humanities Research Council)',
    homepage: 'https://www.ukri.org/councils/ahrc/',
    expectedGrantPatterns: ['/funding', '/opportunity', '/call'],
    expectedKeywords: ['funding', 'opportunity', 'call'],
  },
  {
    name: 'EPSRC (Engineering & Physical Sciences Research Council)',
    homepage: 'https://www.ukri.org/councils/epsrc/',
    expectedGrantPatterns: ['/funding', '/opportunity', '/call'],
    expectedKeywords: ['funding', 'opportunity', 'call'],
  },
  {
    name: 'MRC (Medical Research Council)',
    homepage: 'https://www.ukri.org/councils/mrc/',
    expectedGrantPatterns: ['/funding', '/opportunity', '/call'],
    expectedKeywords: ['funding', 'opportunity', 'call'],
  },
  {
    name: 'Royal Society',
    homepage: 'https://royalsociety.org/',
    expectedGrantPatterns: ['/grant', '/funding', '/fellowship', '/award'],
    expectedKeywords: ['grant', 'funding', 'fellowship', 'award'],
  },
  {
    name: 'Baring Foundation',
    homepage: 'https://baringfoundation.org.uk/',
    expectedGrantPatterns: ['/grant', '/funding', '/apply'],
    expectedKeywords: ['grant', 'funding', 'apply'],
  },
  {
    name: 'Garfield Weston Foundation',
    homepage: 'https://garfieldweston.org/',
    expectedGrantPatterns: ['/grant', '/funding', '/apply'],
    expectedKeywords: ['grant', 'funding', 'apply'],
  },
  {
    name: 'Wolfson Foundation',
    homepage: 'https://www.wolfson.org.uk/',
    expectedGrantPatterns: ['/grant', '/funding', '/apply'],
    expectedKeywords: ['grant', 'funding', 'apply'],
  },
];

interface AnalysisResult {
  funderName: string;
  homepage: string;
  success: boolean;
  navElementFound: boolean;
  totalLinksInNav: number;
  fundingSectionFound: boolean;
  fundingSectionText?: string;
  fundingSectionUrl?: string;
  matchedExpectedPattern: boolean;
  allNavItems: Array<{ text: string; url: string; score: number; keywords: string[] }>;
  errors: string[];
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
    redirect: 'follow',
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.text();
}

async function analyzeOneFunder(
  analyzer: NavigationAnalyzerService,
  testCase: typeof FUNDER_TEST_CASES[0]
): Promise<AnalysisResult> {
  const result: AnalysisResult = {
    funderName: testCase.name,
    homepage: testCase.homepage,
    success: false,
    navElementFound: false,
    totalLinksInNav: 0,
    fundingSectionFound: false,
    matchedExpectedPattern: false,
    allNavItems: [],
    errors: [],
  };

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Analyzing: ${testCase.name}`);
  console.log(`URL: ${testCase.homepage}`);
  console.log(`${'='.repeat(60)}`);

  // Handle skipped tests
  if (testCase.skipReason) {
    console.log(`  ⊘ SKIPPED: ${testCase.skipReason}`);
    result.errors.push(`Skipped: ${testCase.skipReason}`);
    return result;
  }

  try {

    const html = await fetchHtml(testCase.homepage);
    console.log(`  ✓ Fetched HTML (${(html.length / 1024).toFixed(1)} KB)`);

    const navigation = await analyzer.analyzeNavigation(html, testCase.homepage);
    
    result.navElementFound = navigation.mainNav.length > 0;
    result.totalLinksInNav = navigation.allLinks.length;
    
    console.log(`  Navigation: ${navigation.mainNav.length} top-level items, ${navigation.allLinks.length} total links`);

    // Collect all nav items for analysis
    for (const item of navigation.mainNav) {
      result.allNavItems.push({
        text: item.text,
        url: item.url,
        score: item.score,
        keywords: item.keywords,
      });
      
      // Also add children
      for (const child of item.children || []) {
        result.allNavItems.push({
          text: `  └─ ${child.text}`,
          url: child.url,
          score: child.score,
          keywords: child.keywords,
        });
      }
    }

    // Log all nav items
    console.log(`\n  Nav Items Found:`);
    for (const item of result.allNavItems.slice(0, 20)) {
      const scoreStr = item.score > 0 ? ` [score: ${item.score.toFixed(2)}]` : '';
      const kwStr = item.keywords.length > 0 ? ` (${item.keywords.join(', ')})` : '';
      console.log(`    - "${item.text}"${scoreStr}${kwStr}`);
      console.log(`      ${item.url}`);
    }

    if (navigation.fundingSection) {
      result.fundingSectionFound = true;
      result.fundingSectionText = navigation.fundingSection.text;
      result.fundingSectionUrl = navigation.fundingSection.url;
      
      console.log(`\n  ✓ Funding Section Identified:`);
      console.log(`    Text: "${navigation.fundingSection.text}"`);
      console.log(`    URL: ${navigation.fundingSection.url}`);
      console.log(`    Score: ${navigation.fundingSection.score}`);
      console.log(`    Keywords: ${navigation.fundingSection.keywords.join(', ')}`);

      // Check if it matches expected patterns
      const urlLower = navigation.fundingSection.url.toLowerCase();
      result.matchedExpectedPattern = testCase.expectedGrantPatterns.some(
        pattern => urlLower.includes(pattern.toLowerCase())
      );
      
      // Also check it's not just the homepage
      const isHomepage = navigation.fundingSection.url === testCase.homepage ||
                         navigation.fundingSection.url.replace(/\/$/, '') === testCase.homepage.replace(/\/$/, '');
      
      if (isHomepage) {
        result.matchedExpectedPattern = false;
        result.errors.push('Funding section URL is the homepage itself');
      }

      if (result.matchedExpectedPattern) {
        console.log(`  ✓ Matches expected pattern!`);
        result.success = true;
      } else {
        console.log(`  ✗ Does not match expected patterns: ${testCase.expectedGrantPatterns.join(', ')}`);
      }
    } else {
      console.log(`\n  ✗ No funding section identified`);
      result.errors.push('No funding section found');
      
      // Look for what we might have missed
      const potentialMatches = result.allNavItems.filter(item => {
        const textLower = item.text.toLowerCase();
        return testCase.expectedKeywords.some(kw => textLower.includes(kw));
      });
      
      if (potentialMatches.length > 0) {
        console.log(`\n  Potential matches we missed:`);
        for (const match of potentialMatches) {
          console.log(`    - "${match.text}" -> ${match.url}`);
        }
      }
    }

  } catch (error: any) {
    result.errors.push(error.message);
    console.log(`  ✗ Error: ${error.message}`);
  }

  return result;
}

async function runAllTests(): Promise<void> {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     NAVIGATION ANALYZER TEST SUITE                             ║');
  console.log('║     Testing grant page detection across funder websites        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  
  const analyzer = new NavigationAnalyzerService();
  const results: AnalysisResult[] = [];

  for (const testCase of FUNDER_TEST_CASES) {
    const result = await analyzeOneFunder(analyzer, testCase);
    results.push(result);
    
    // Small delay to be respectful to servers
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log('\n\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     SUMMARY                                                     ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`\nSuccess: ${successful.length}/${results.length}`);
  console.log(`Failed: ${failed.length}/${results.length}`);
  
  if (successful.length > 0) {
    console.log('\n✓ Successful:');
    for (const r of successful) {
      console.log(`  - ${r.funderName}: "${r.fundingSectionText}" -> ${r.fundingSectionUrl}`);
    }
  }
  
  if (failed.length > 0) {
    console.log('\n✗ Failed:');
    for (const r of failed) {
      console.log(`  - ${r.funderName}: ${r.errors.join(', ')}`);
      if (r.fundingSectionUrl) {
        console.log(`    Found: ${r.fundingSectionUrl}`);
      }
    }
  }

  // Detailed failure analysis
  console.log('\n\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     FAILURE ANALYSIS                                            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  
  for (const r of failed) {
    console.log(`\n${r.funderName}:`);
    console.log(`  Homepage: ${r.homepage}`);
    console.log(`  Errors: ${r.errors.join(', ')}`);
    
    if (r.fundingSectionFound) {
      console.log(`  Found section: "${r.fundingSectionText}" -> ${r.fundingSectionUrl}`);
      console.log(`  Problem: URL doesn't match expected patterns`);
    }
    
    // Show what nav items were found
    const fundingRelated = r.allNavItems.filter(item => item.score > 0);
    if (fundingRelated.length > 0) {
      console.log(`  Funding-related items found but not selected:`);
      for (const item of fundingRelated.slice(0, 5)) {
        console.log(`    - "${item.text}" (score: ${item.score}) -> ${item.url}`);
      }
    }
  }
}

// Run the tests
runAllTests().catch(console.error);
