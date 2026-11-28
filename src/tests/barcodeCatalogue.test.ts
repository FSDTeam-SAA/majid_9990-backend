import assert from 'assert';
import masterCatalogueService, {
      normalizeBarcodeVariants,
} from '../modules/masterCatalogue/masterCatalogue.service';
import {
      findLocalCatalogueByBarcode,
      getLocalCatalogueStats,
      loadStructuredCatalogueItems,
      searchLocalCatalogue,
} from '../modules/masterCatalogue/localCatalogueIndex';

const run = async () => {
      // 1. Verify GTIN / UPC-A / EAN-13 / EAN-8 variant normalization preserves leading zeros
      const upcVariants = normalizeBarcodeVariants('887276333205');
      assert(upcVariants.includes('887276333205'), 'should include original UPC-A');
      assert(upcVariants.includes('0887276333205'), 'should include leading-zero EAN-13');
      assert(upcVariants.includes('00887276333205'), 'should include GTIN-14');

      const eanNonZeroVariants = normalizeBarcodeVariants('8806086510011');
      assert(eanNonZeroVariants.includes('08806086510011'), 'non-zero EAN-13 should expand to GTIN-14');

      // 2. Verify all extracted structured datasets load with Android, Laptop/PC, Mac, GPU, Console, Home, Beats
      const structured = loadStructuredCatalogueItems();
      assert(
            structured.length >= 8000,
            `Expected at least 8000 structured records across Watch/Audio/Android/Mac/Laptop/PC/GPU/Console/Home, got ${structured.length}`
      );

      // 3. Spot-check real barcodes from every newly added catalogue category
      const samples: Array<{ code: string; brand: string; category: string }> = [
            { code: '8806086510011', brand: 'Samsung', category: 'Smartphone' }, // Samsung phone (EAN-13)
            { code: '0887276333205', brand: 'Samsung', category: 'Tablet' }, // Samsung tablet (EAN-13)
            { code: '887276333205', brand: 'Samsung', category: 'Tablet' }, // Samsung tablet via UPC-A alias
            { code: '0197105958579', brand: 'ASUS', category: 'Laptop' }, // ASUS laptop
            { code: '0198155878411', brand: 'Lenovo', category: 'Monitor' }, // Lenovo monitor
            { code: '0885909401468', brand: 'Apple', category: 'Laptop' }, // MacBook (A1342)
            { code: '4712900743449', brand: 'ASUS', category: 'Graphics Card' }, // GPU
            { code: '0711719051831', brand: 'PlayStation', category: 'Gaming Console' }, // Console
            { code: '195951201412', brand: 'Beats', category: 'Audio' }, // Beats supplement via UPC-A
            { code: '5705260087994', brand: 'Bang & Olufsen', category: 'Audio' }, // B&O Beolit 20
            { code: '017817852470', brand: 'Bose', category: 'Audio' }, // Bose SoundLink Flex via UPC-A
            { code: '1200130024269', brand: 'JBL', category: 'Audio' }, // JBL Boombox 4 (Seven Brand)
            { code: '840136805854', brand: 'Sonos', category: 'Audio' }, // Sonos Era 100 via UPC-A
            { code: '8717755779632', brand: 'Sonos', category: 'Audio' }, // Sonos Era 100 via distinct EAN-13
            { code: '6942886102673', brand: 'Vaporesso', category: 'Vape' }, // UK Vape
      ];

      for (const sample of samples) {
            const hit = await masterCatalogueService.findByBarcode(sample.code);
            assert(hit, `Expected barcode ${sample.code} (${sample.brand}) to resolve`);
            assert.strictEqual(hit.brand, sample.brand);
            assert.strictEqual(hit.category, sample.category);
      }

      // 3b. Verify UK Vape & Audio search
      const vapeSearch = searchLocalCatalogue({ query: 'Vaporesso Armour', category: 'Vape' });
      assert(vapeSearch.results.length > 0, 'Expected UK Vape search results for Vaporesso Armour');
      assert.strictEqual(vapeSearch.results[0].specs?.currency, 'GBP');

      const sonosSearch = searchLocalCatalogue({ query: 'Era 100', brand: 'Sonos', category: 'Audio' });
      assert(sonosSearch.results.length > 0, 'Expected Sonos Audio search results for Era 100');

      // 4. Confirm Mac CONFLICT barcodes (marked "Do not import") were excluded
      assert.strictEqual(
            findLocalCatalogueByBarcode('0190198115072'),
            null,
            'Mac CONFLICT row 0190198115072 must NOT be imported'
      );
      assert.strictEqual(
            findLocalCatalogueByBarcode('0885909924684'),
            null,
            'Mac CONFLICT row 0885909924684 must NOT be imported'
      );

      // 5. Verify keyword search across newly imported catalogues
      const laptopSearch = await masterCatalogueService.searchCatalogue({
            query: 'ThinkVision',
            category: 'Monitor',
      });
      assert(laptopSearch.results.length > 0, 'Expected Monitor search results for ThinkVision');

      const androidSearch = searchLocalCatalogue({ query: 'Galaxy Tab S', brand: 'Samsung', category: 'Tablet' });
      assert(androidSearch.results.length > 0, 'Expected Samsung tablet search results');

      const stats = getLocalCatalogueStats();
      assert(stats.totalItems > 10000, `Expected >10000 total indexed barcodes, got ${stats.totalItems}`);

      console.log(`PASS: barcodeCatalogue tests passed (${stats.totalItems} indexed items, ${stats.totalBrands} brands, ${stats.totalCategories} categories)`);
};

run().catch((err) => {
      console.error(err);
      process.exit(1);
});
