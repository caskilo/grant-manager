import * as fs from 'fs/promises';
import * as path from 'path';
import { CatalogueParser } from '../src/discovery/catalogue-parser';
import { v4 as uuidv4 } from 'uuid';

/**
 * Migration script to populate catalogue.json from the existing HTML catalogue
 * Run with: npx ts-node scripts/populate-catalogue.ts
 */
async function populateCatalogue() {
  console.log('🚀 Starting catalogue population from HTML...');

  const htmlPath = path.join(__dirname, '../../frontend/public/odyssean_funder_catalogue_v1.html');
  const cataloguePath = path.join(__dirname, '../../frontend/discovery/catalogue.json');

  try {
    // Read HTML catalogue
    console.log(`📖 Reading HTML from: ${htmlPath}`);
    const html = await fs.readFile(htmlPath, 'utf-8');

    // Parse HTML
    console.log('⚙️  Parsing HTML catalogue...');
    const parser = new CatalogueParser();
    const entries = parser.parse(html);
    console.log(`✅ Parsed ${entries.length} entries from HTML`);

    // Transform to catalogue format
    const now = new Date().toISOString();
    const catalogue = {
      version: '2.0',
      lastModified: now,
      funders: entries.map((entry) => {
        const opp = entry.opportunities[0];
        return {
          id: uuidv4(),
          name: entry.funder.funderName,
          type: entry.funder.type || 'Other',
          focus: entry.funder.focus 
            ? entry.funder.focus.split(',').map(f => f.trim()).filter(Boolean)
            : [],
          geographies: entry.funder.geography
            ? entry.funder.geography
                .split(/[,\/]/)
                .map(g => g.trim())
                .map(g => g.replace(/\(.*?\)/g, '').trim())
                .filter(g => g.length > 0)
            : [],
          websiteUrl: entry.funder.website || '',
          typicalAwardMin: opp?.minAward,
          typicalAwardMax: opp?.maxAward,
          currency: opp?.currency || 'GBP',
          openData: entry.funder.notes?.includes('Yes') 
            ? 'Yes' 
            : entry.funder.notes?.includes('Partial') 
              ? 'Partial' 
              : 'No',
          notes: entry.funder.notes || '',
          createdAt: now,
          updatedAt: now,
        };
      }),
    };

    // Write to catalogue.json
    console.log(`💾 Writing catalogue to: ${cataloguePath}`);
    await fs.writeFile(cataloguePath, JSON.stringify(catalogue, null, 2), 'utf-8');

    console.log('✅ Successfully populated catalogue.json');
    console.log(`📊 Total funders: ${catalogue.funders.length}`);
    console.log('\n🎉 Migration complete!');
  } catch (error) {
    console.error('❌ Error during migration:', error);
    process.exit(1);
  }
}

populateCatalogue();
