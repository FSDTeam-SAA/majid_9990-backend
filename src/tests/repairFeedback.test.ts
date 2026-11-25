import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
      decryptDevicePasscode,
      encryptDevicePasscode,
      isAuthorizedTechnicianRole,
} from '../utils/passcodeCrypto';
import { generateRepairStatusPdfBuffer } from '../modules/repairRequest/repairPdf.service';
import {
      generateCompletionEmailHTML,
      generateRepairStatusEmailHTML,
} from '../utils/email/email.templates';
import deviceCatalogData from '../modules/repairPart/data/deviceCatalog';
import { RepairPartService } from '../modules/repairPart/repairPart.service';

const run = async () => {
      // 1. Passcode AES-256-GCM encryption & masked formatting
      const pinEncrypted = encryptDevicePasscode('pin', '4829');
      assert.equal(pinEncrypted.type, 'pin');
      assert.equal(pinEncrypted.isSet, true);
      assert.equal(pinEncrypted.maskedValue, '••••');
      assert.notEqual(pinEncrypted.encryptedValue, '4829');
      assert.equal(decryptDevicePasscode(pinEncrypted.encryptedValue), '4829');

      const patternEncrypted = encryptDevicePasscode('pattern', '1-2-3-6-9');
      assert.equal(patternEncrypted.type, 'pattern');
      assert.equal(patternEncrypted.maskedValue, 'Pattern (5 dots)');
      assert.equal(decryptDevicePasscode(patternEncrypted.encryptedValue), '1-2-3-6-9');

      // 2. Technician authorization check
      assert.equal(isAuthorizedTechnicianRole({ role: 'shopkeeper' }), true);
      assert.equal(isAuthorizedTechnicianRole({ role: 'admin' }), true);
      assert.equal(isAuthorizedTechnicianRole({ role: 'staff', jobRole: 'Repair Technician' }), true);
      assert.equal(isAuthorizedTechnicianRole({ role: 'staff', jobRole: 'Senior Engineer' }), true);
      assert.equal(isAuthorizedTechnicianRole({ role: 'staff', jobRole: 'Sales Executive' }), false);
      assert.equal(isAuthorizedTechnicianRole({ role: 'staff', jobRole: 'Cashier' }), false);
      assert.equal(
            isAuthorizedTechnicianRole({
                  role: 'staff',
                  jobRole: 'Sales Executive',
                  actorName: 'Ali Khan',
                  assignedTechnician: 'Ali Khan',
            }),
            true
      );

      // 3. Catalogue audit: zero developer notes, Samsung Note, Samsung Tabs, iPad A20 Pro, Watch Series 11/12, Consoles
      const bannedPhrases = [
            '—',
            'different hardware',
            'original hardware',
            'alternative hardware',
            'original uk model',
            'snapdragon revision',
      ];
      for (const item of deviceCatalogData) {
            const lower = item.modelName.toLowerCase();
            for (const phrase of bannedPhrases) {
                  assert.equal(
                        lower.includes(phrase),
                        false,
                        `Developer note "${phrase}" leaked into ${item.brand} ${item.modelName}`
                  );
            }
            assert.ok(item.modelCode.trim().length > 0, `Empty modelCode on ${item.modelName}`);
      }
      assert.ok(deviceCatalogData.some((d) => d.brand === 'Samsung' && d.deviceType === 'Tablet'));
      assert.ok(deviceCatalogData.some((d) => d.brand === 'Samsung' && d.modelName.includes('Galaxy Note 20 Ultra')));
      assert.ok(deviceCatalogData.some((d) => d.brand === 'Apple' && d.modelCode === 'A3595'));
      assert.ok(deviceCatalogData.some((d) => d.brand === 'Apple' && d.modelName.includes('Watch Series 11')));
      assert.ok(deviceCatalogData.some((d) => d.deviceType === 'Console' && d.modelName.includes('PlayStation 5')));

      // Verify searchCatalogue across cleaned catalog
      const s20Results = await RepairPartService.searchCatalogue('SM-G780G', 'Samsung');
      assert.equal(s20Results[0]?.modelName, 'Galaxy S20 FE 4G');
      const noteResults = await RepairPartService.searchCatalogue('Galaxy Note 10+', 'Samsung');
      assert.ok(noteResults.some((d) => d.modelCode === 'SM-N975F'));

      // 4. Repair PDF & Emails include condition, colour, reported issues, and photos
      const pdfBuf = generateRepairStatusPdfBuffer({
            requestId: 'R-54321',
            orderNumber: 'R-54321',
            customerName: 'Sam Patel',
            customerEmail: 'sam@example.com',
            deviceModel: 'iPhone 15 Pro Max',
            imei: '351234567890123',
            serialNumber: 'SN-XYZ-99',
            condition: 'Fair',
            colour: 'Black',
            description: 'Dead Device / No Power',
            issues: [
                  {
                        category: 'Dead Device / No Power',
                        problems: ['Will not turn on', 'No charging draw'],
                        estimatedPrice: 0,
                  },
            ],
            bookingPhotos: ['https://example.com/booking1.jpg'],
            completionPhotos: ['https://example.com/completion1.jpg'],
            status: 'completed',
            statusLabel: 'Repair Completed',
            price: 85,
            currency: 'GBP',
            trackingUrl: 'https://imoscan.com/my-invoice/123',
      });
      const pdfAscii = pdfBuf.toString('latin1');
      assert.ok(pdfAscii.includes('Intake Cond.: Fair'));
      assert.ok(pdfAscii.includes('Colour: Black'));
      assert.ok(pdfAscii.includes('Dead Device / No Power: Will not turn on'));
      assert.ok(pdfAscii.includes('1 Booking photo\\(s\\), 1 Completion photo\\(s\\)'));

      const statusHtml = generateRepairStatusEmailHTML({
            customerName: 'Sam Patel',
            deviceModel: 'iPhone 15 Pro Max',
            imei: '351234567890123',
            serialNumber: 'SN-XYZ-99',
            condition: 'Good',
            colour: 'Silver',
            description: 'Screen Damage',
            issues: [{ category: 'Screen / Display', problems: ['Cracked glass'], estimatedPrice: 120 }],
            bookingPhotos: ['https://example.com/booking1.jpg'],
            completionPhotos: ['https://example.com/completion1.jpg'],
            status: 'ready-for-collection',
            statusLabel: 'Ready to Collect',
            price: 120,
            currency: 'GBP',
            requestId: '54321',
            orderNumber: 'R-54321',
            trackingUrl: 'https://imoscan.com/my-invoice/123',
      });
      assert.ok(statusHtml.includes('Intake Condition:'));
      assert.ok(statusHtml.includes('Good'));
      assert.ok(statusHtml.includes('Silver'));
      assert.ok(statusHtml.includes('Screen / Display'));
      assert.ok(statusHtml.includes('https://example.com/booking1.jpg'));
      assert.ok(statusHtml.includes('https://example.com/completion1.jpg'));

      const completionHtml = generateCompletionEmailHTML({
            customerName: 'Sam Patel',
            deviceModel: 'iPhone 15 Pro Max',
            condition: 'Good',
            colour: 'Blue',
            description: 'Battery replacement',
            issues: [{ category: 'Battery', problems: ['Drains fast'], estimatedPrice: 55 }],
            bookingPhotos: ['https://example.com/b1.jpg'],
            completionPhotos: ['https://example.com/c1.jpg'],
            price: 55,
            currency: 'GBP',
            completionDate: '25 Nov 2026',
            requestId: '54321',
            orderNumber: 'R-54321',
      });
      assert.ok(completionHtml.includes('Intake Condition:'));
      assert.ok(completionHtml.includes('Blue'));
      assert.ok(completionHtml.includes('Drains fast'));
      assert.ok(completionHtml.includes('https://example.com/c1.jpg'));

      // Check shared catalog JSON parity with Flutter & Website
      const rootDir = path.resolve(__dirname, '../../..');
      const backendJson = fs.readFileSync(
            path.join(rootDir, 'majid_9990-backend/src/modules/repairPart/data/deviceCatalog.json'),
            'utf8'
      );
      const flutterJson = fs.readFileSync(
            path.join(rootDir, 'Majid_Flutter_App/assets/data/repair_device_catalog.json'),
            'utf8'
      );
      const websiteJson = fs.readFileSync(
            path.join(rootDir, 'majid-website/src/features/shopkeeper/repairParts/data/deviceCatalog.json'),
            'utf8'
      );
      assert.equal(backendJson, flutterJson);
      assert.equal(backendJson, websiteJson);

      console.log('ALL BACKEND REPAIR FEEDBACK UNIT TESTS PASSED');
};

run().catch((err) => {
      console.error(err);
      process.exit(1);
});
