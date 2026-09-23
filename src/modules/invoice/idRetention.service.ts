import { Invoice } from './invoice.model';
import { Consent } from '../consent/consent.model';
import { deleteFromCloudinary } from '../../utils/cloudinary';

class IdRetentionService {
      private isRunning = false;

      /**
       * Purge expired ID images (>28 days old) from Cloudinary storage and database
       */
      async purgeExpiredIdImages(): Promise<{ purgedInvoices: number; purgedConsents: number }> {
            if (this.isRunning) return { purgedInvoices: 0, purgedConsents: 0 };
            this.isRunning = true;
            let purgedInvoices = 0;
            let purgedConsents = 0;

            try {
                  const now = new Date();

                  // 1. Find invoices where ID image retention expired
                  const expiredInvoices = await Invoice.find({
                        $or: [
                              { idImageDeleteAfter: { $lte: now, $ne: null } },
                              { 'idImages.deleteAfter': { $lte: now, $ne: null } },
                        ],
                        'idImages.isDeleted': { $ne: true },
                  });

                  for (const inv of expiredInvoices) {
                        try {
                              if (inv.idImages?.front?.public_id) {
                                    await deleteFromCloudinary(inv.idImages.front.public_id, 'image');
                              }
                              if (inv.idImages?.back?.public_id) {
                                    await deleteFromCloudinary(inv.idImages.back.public_id, 'image');
                              }

                              await Invoice.findByIdAndUpdate(inv._id, {
                                    $set: {
                                          'idImages.front': null,
                                          'idImages.back': null,
                                          'idImages.isDeleted': true,
                                          'idImages.deletedAt': now,
                                    },
                              });
                              purgedInvoices++;
                        } catch (err) {
                              console.error(`Failed to purge ID images for invoice ${inv._id}:`, err);
                        }
                  }

                  // 2. Check expired consent records
                  const expiredConsents = await Consent.find({
                        idImageDeleteAfter: { $lte: now, $ne: null },
                  });
                  purgedConsents = expiredConsents.length;

                  if (purgedInvoices > 0 || purgedConsents > 0) {
                        console.log(`[ID Retention Job] Purged ID images from ${purgedInvoices} invoices and cleaned ${purgedConsents} consent records.`);
                  }
            } catch (error) {
                  console.error('[ID Retention Job] Error during ID image retention purge:', error);
            } finally {
                  this.isRunning = false;
            }

            return { purgedInvoices, purgedConsents };
      }

      /**
       * Start the background retention schedule (runs on startup and every 1 hour)
       */
      startRetentionJob(intervalMs: number = 60 * 60 * 1000): void {
            // Initial check after 10 seconds
            setTimeout(() => {
                  void this.purgeExpiredIdImages().catch((err) => {
                        console.error('[ID Retention Job] Initial run failed:', err);
                  });
            }, 10000);

            // Recurring hourly check
            setInterval(() => {
                  void this.purgeExpiredIdImages().catch((err) => {
                        console.error('[ID Retention Job] Scheduled run failed:', err);
                  });
            }, intervalMs);

            console.log('[ID Retention Job] 28-day ID image retention service initialized.');
      }
}

export const idRetentionService = new IdRetentionService();
