import { NavigationAnalyzerService } from '../navigation-analyzer.service';

/**
 * Quick test script for a single funder
 */

async function testSingleFunder(url: string, name: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing: ${name}`);
  console.log(`URL: ${url}`);
  console.log(`${'='.repeat(80)}\n`);

  try {
    // Fetch HTML
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      console.log(`✗ HTTP ${response.status}: ${response.statusText}`);
      return;
    }

    const html = await response.text();
    console.log(`✓ Fetched HTML (${(html.length / 1024).toFixed(1)} KB)\n`);

    // Analyze
    const analyzer = new NavigationAnalyzerService();
    const navigation = await analyzer.analyzeNavigation(html, url);

    console.log(`Results:`);
    console.log(`  Total links found: ${navigation.mainNav.length}`);
    console.log(`  Funding section: ${navigation.fundingSection ? '✓ YES' : '✗ NO'}\n`);

    if (navigation.fundingSection) {
      console.log(`Funding Section:`);
      console.log(`  Text: "${navigation.fundingSection.text}"`);
      console.log(`  URL: ${navigation.fundingSection.url}`);
      console.log(`  Score: ${navigation.fundingSection.score.toFixed(2)}`);
      console.log(`  Keywords: ${navigation.fundingSection.keywords.join(', ')}\n`);
    }

    // Show top 10 scored links
    console.log(`Top 10 Scored Links:`);
    const topLinks = navigation.mainNav
      .filter(l => l.score > 0)
      .slice(0, 10);
    
    if (topLinks.length === 0) {
      console.log(`  (none found with score > 0)`);
    } else {
      for (const link of topLinks) {
        console.log(`  [${link.score.toFixed(2)}] "${link.text}"`);
        console.log(`       ${link.url}`);
        console.log(`       Keywords: ${link.keywords.join(', ')}`);
      }
    }

    // If no funding section, show ALL links for debugging
    if (!navigation.fundingSection && navigation.mainNav.length > 0) {
      console.log(`\n\nALL Links Found (for debugging):`);
      for (const link of navigation.mainNav.slice(0, 30)) {
        console.log(`  [${link.score.toFixed(2)}] "${link.text}" -> ${link.url}`);
      }
    }

  } catch (error: any) {
    console.log(`✗ Error: ${error.message}`);
  }
}

// Test NIHR
const funderUrl = process.argv[2] || 'https://www.nihr.ac.uk/';
const funderName = process.argv[3] || 'NIHR';

testSingleFunder(funderUrl, funderName).catch(console.error);
