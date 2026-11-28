import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ExcelJS from 'exceljs';
import { IMasterCatalogue } from '../modules/masterCatalogue/masterCatalogue.interface';
import { MasterCatalogue } from '../modules/masterCatalogue/masterCatalogue.model';
import { loadStructuredCatalogueItems } from '../modules/masterCatalogue/localCatalogueIndex';

dotenv.config();

const REPO_DATA_DIR = path.resolve(__dirname, '../../data/catalogue');
const PRELOADED_DIR = path.resolve(
      __dirname,
      '../../../feedback nov 26/preloaded data inventory'
);
const ALT_PRELOADED_DIR = path.resolve(
      __dirname,
      '../../../feedback nov 26/IMOSCAN_iPad_Barcode_Developer_Bundle'
);

interface ParseResult {
      sourceFile: string;
      totalParsed: number;
      validCount: number;
      items: Partial<IMasterCatalogue>[];
}

/**
 * Parses IMOSCAN iPad Barcode Lookup JSON
 */
export const parseIpadJson = (filePath?: string): ParseResult => {
      const candidates = [
            filePath,
            path.join(REPO_DATA_DIR, 'IMOSCAN_iPad_Barcode_Lookup.json'),
            path.join(PRELOADED_DIR, 'IMOSCAN_iPad_Barcode_Lookup.json'),
            path.join(ALT_PRELOADED_DIR, 'IMOSCAN_iPad_Barcode_Lookup.json'),
      ].filter(Boolean) as string[];

      let resolvedPath = '';
      for (const p of candidates) {
            if (fs.existsSync(p)) {
                  resolvedPath = p;
                  break;
            }
      }

      if (!resolvedPath) {
            console.warn('[Importer] iPad JSON file not found in search paths.');
            return { sourceFile: '', totalParsed: 0, validCount: 0, items: [] };
      }

      console.log(`[Importer] Parsing iPad JSON: ${resolvedPath}`);
      const rawContent = fs.readFileSync(resolvedPath, 'utf-8');
      const parsed = JSON.parse(rawContent);
      const rows: any[] = Array.isArray(parsed?.rows) ? parsed.rows : [];

      const items: Partial<IMasterCatalogue>[] = [];

      for (const row of rows) {
            const barcode = String(row.ean || row.upc || row.gtin14 || row.part_number || '').trim();
            if (!barcode) continue;

            items.push({
                  rowId: row.row_id,
                  deviceName: row.device_name || `${row.model || 'iPad'} ${row.storage || ''} ${row.colour || ''}`.trim(),
                  model: row.model || 'iPad',
                  brand: 'Apple',
                  category: 'Tablet',
                  year: row.year ? Number(row.year) : undefined,
                  storage: row.storage || undefined,
                  colour: row.colour || undefined,
                  connectivity: row.connectivity || undefined,
                  glass: row.glass || undefined,
                  modelNumber: row.model_number || undefined,
                  partNumber: row.part_number || undefined,
                  partBase: row.part_base || undefined,
                  upc: row.upc ? String(row.upc).trim() : undefined,
                  ean: row.ean ? String(row.ean).trim() : undefined,
                  gtin14: row.gtin14 ? String(row.gtin14).trim() : undefined,
                  barcode,
                  sku: row.part_number || row.row_id || barcode,
                  imageUrl: row.image_url || undefined,
                  sourceStatus: row.source_status || 'preloaded',
                  sourceUrl: row.source_url || undefined,
                  autoFillApproved: Boolean(row.auto_fill_approved),
                  sources: Array.isArray(row.sources) ? row.sources : [],
            });
      }

      return {
            sourceFile: resolvedPath,
            totalParsed: rows.length,
            validCount: items.length,
            items,
      };
};

/**
 * Parses IMOSCAN iPhone EAN / UPC Research data (from JSON or Excel)
 */
export const parseIphoneData = async (filePath?: string): Promise<ParseResult> => {
      const jsonCandidates = [
            filePath?.replace(/\.xlsx$/i, '.json'),
            path.join(REPO_DATA_DIR, 'IMOSCAN_iPhone_EAN_UPC_Research.json'),
            path.join(PRELOADED_DIR, 'IMOSCAN_iPhone_EAN_UPC_Research.json'),
            path.resolve(__dirname, '../../../feedback nov 26/IMOSCAN_iPhone_EAN_UPC_Research.json'),
      ].filter(Boolean) as string[];

      for (const jp of jsonCandidates) {
            if (fs.existsSync(jp)) {
                  console.log(`[Importer] Parsing iPhone JSON: ${jp}`);
                  const parsed = JSON.parse(fs.readFileSync(jp, 'utf-8'));
                  const rawRows: any[] = Array.isArray(parsed?.rows) ? parsed.rows : [];
                  const items: Partial<IMasterCatalogue>[] = [];

                  for (const r of rawRows) {
                        const barcode = String(r.ean || r.upc || r.part_number || '').trim();
                        if (!barcode || !r.model) continue;

                        const deviceName = `${r.model} ${r.storage || ''} ${r.colour || ''}`.trim();
                        items.push({
                              deviceName,
                              model: r.model,
                              brand: 'Apple',
                              category: 'Phone',
                              storage: r.storage || undefined,
                              colour: r.colour || undefined,
                              partNumber: r.part_number || undefined,
                              upc: r.upc || undefined,
                              ean: r.ean || undefined,
                              barcode,
                              sku: r.part_number || barcode,
                              imageUrl: r.image_url && r.image_url.startsWith('http') ? r.image_url : undefined,
                              imageKey: r.image_key || undefined,
                              market: r.market || undefined,
                              sourceStatus: r.evidence || 'research',
                              sourceUrl: r.source_url || undefined,
                              autoFillApproved: String(r.image_status || '').toLowerCase().includes('checked'),
                        });
                  }

                  return {
                        sourceFile: jp,
                        totalParsed: rawRows.length,
                        validCount: items.length,
                        items,
                  };
            }
      }

      console.warn('[Importer] iPhone dataset not found in search paths.');
      return { sourceFile: '', totalParsed: 0, validCount: 0, items: [] };
};

/**
 * Parses Apple Watch data from pre-generated JSON
 */
export const parseWatchData = (filePath?: string): ParseResult => {
      const candidates = [
            filePath,
            path.join(REPO_DATA_DIR, 'IMOSCAN_Apple_Watch_Developer_Catalogue.json'),
            path.join(PRELOADED_DIR, 'IMOSCAN_Apple_Watch_Developer_Catalogue.json'),
      ].filter(Boolean) as string[];

      for (const p of candidates) {
            if (fs.existsSync(p)) {
                  console.log(`[Importer] Parsing Apple Watch JSON: ${p}`);
                  const parsed = JSON.parse(fs.readFileSync(p, 'utf-8'));
                  const rows: any[] = Array.isArray(parsed?.rows) ? parsed.rows : [];
                  return {
                        sourceFile: p,
                        totalParsed: rows.length,
                        validCount: rows.length,
                        items: rows,
                  };
            }
      }
      return { sourceFile: '', totalParsed: 0, validCount: 0, items: [] };
};

/**
 * Parses Apple / Beats Audio data from pre-generated JSON
 */
export const parseAudioData = (filePath?: string): ParseResult => {
      const candidates = [
            filePath,
            path.join(REPO_DATA_DIR, 'Apple_Audio_Catalogue.json'),
            path.join(PRELOADED_DIR, 'Apple_Audio_Catalogue.json'),
      ].filter(Boolean) as string[];

      for (const p of candidates) {
            if (fs.existsSync(p)) {
                  console.log(`[Importer] Parsing Audio JSON: ${p}`);
                  const parsed = JSON.parse(fs.readFileSync(p, 'utf-8'));
                  const rows: any[] = Array.isArray(parsed?.rows) ? parsed.rows : [];
                  return {
                        sourceFile: p,
                        totalParsed: rows.length,
                        validCount: rows.length,
                        items: rows,
                  };
            }
      }
      return { sourceFile: '', totalParsed: 0, validCount: 0, items: [] };
};

/**
 * Main seeding execution function
 */
export const runSeeder = async (options: {
      dryRun?: boolean;
      limit?: number;
      mongoUri?: string;
}) => {
      console.log('=== IMOSCAN MASTER CATALOGUE DATA SEEDER ===');
      console.log(`Mode: ${options.dryRun ? 'DRY-RUN (No database writes)' : 'LIVE IMPORT'}`);

      // 1. Parse all datasets
      const ipadResult = parseIpadJson();
      const iphoneResult = await parseIphoneData();
      const structuredItems = loadStructuredCatalogueItems();

      let allItems = [
            ...ipadResult.items,
            ...iphoneResult.items,
            ...structuredItems,
      ];

      if (options.limit && options.limit > 0) {
            console.log(`Applying limit of ${options.limit} items`);
            allItems = allItems.slice(0, options.limit);
      }

      console.log('\n--- Parse Summary ---');
      console.log(`iPad catalog items:       ${ipadResult.validCount} / ${ipadResult.totalParsed}`);
      console.log(`iPhone catalog items:     ${iphoneResult.validCount} / ${iphoneResult.totalParsed}`);
      console.log(`Structured catalog items: ${structuredItems.length} (Watch, Audio/Beats/B&O/Bose/Sonos/7-Brand, Android, Mac, Laptops, PCs, GPUs, Consoles, Home, UK Vape)`);
      console.log(`Total valid variants ready for catalogue: ${allItems.length}`);

      if (allItems.length > 0) {
            console.log('\nSample items parsed:');
            console.log(JSON.stringify(allItems.slice(0, 2), null, 2));
      }

      if (options.dryRun) {
            console.log('\n[Dry-run completed successfully. Database was not modified.]');
            return {
                  totalItems: allItems.length,
                  ipadCount: ipadResult.validCount,
                  iphoneCount: iphoneResult.validCount,
            };
      }

      // 2. Connect to MongoDB and import
      const mongoUri = options.mongoUri || process.env.MONGO_URI;
      if (!mongoUri) {
            throw new Error('MONGO_URI is required for live import. Check your .env file.');
      }

      console.log(`\nConnecting to MongoDB...`);
      await mongoose.connect(mongoUri);
      console.log('MongoDB connected.');

      // Batch write in chunks of 250
      const CHUNK_SIZE = 250;
      let totalInserted = 0;
      let totalModified = 0;

      for (let i = 0; i < allItems.length; i += CHUNK_SIZE) {
            const chunk = allItems.slice(i, i + CHUNK_SIZE);
            const ops = chunk.map((item) => ({
                  updateOne: {
                        filter: { barcode: item.barcode },
                        update: {
                              $set: {
                                    ...item,
                                    updatedAt: new Date(),
                              },
                              $setOnInsert: {
                                    createdAt: new Date(),
                              },
                        },
                        upsert: true,
                  },
            }));

            const result = await MasterCatalogue.bulkWrite(ops as any, { ordered: false });
            totalInserted += result.upsertedCount;
            totalModified += result.modifiedCount;
            console.log(
                  `Processed chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(allItems.length / CHUNK_SIZE)} (Upserted: ${result.upsertedCount}, Modified: ${result.modifiedCount})`
            );
      }

      console.log('\n=== Live Import Complete ===');
      console.log(`Total items processed: ${allItems.length}`);
      console.log(`Total new items created: ${totalInserted}`);
      console.log(`Total existing items updated: ${totalModified}`);

      await mongoose.disconnect();
      console.log('MongoDB disconnected.');

      return {
            totalItems: allItems.length,
            totalInserted,
            totalModified,
      };
};

// Direct script execution
if (require.main === module) {
      const isDryRun = process.argv.includes('--dry-run') || !process.argv.includes('--import');
      const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
      const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

      runSeeder({ dryRun: isDryRun, limit })
            .then(() => process.exit(0))
            .catch((err) => {
                  console.error('Seeder failed with error:', err);
                  process.exit(1);
            });
}
