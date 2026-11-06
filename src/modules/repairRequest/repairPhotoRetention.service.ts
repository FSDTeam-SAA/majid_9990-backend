import RepairRequest from './repairRequest.model';
import { deleteFromCloudinary } from '../../utils/cloudinary';

class RepairPhotoRetentionService {
      private isRunning = false;

      /**
       * Purge expired evidence photos (>30 days old) from Cloudinary storage and database
       */
      async purgeExpiredEvidencePhotos(): Promise<{ purgedPhotos: number; updatedRequests: number }> {
            if (this.isRunning) return { purgedPhotos: 0, updatedRequests: 0 };
            this.isRunning = true;
            let purgedPhotos = 0;
            let updatedRequests = 0;

            try {
                  const now = new Date();

                  // Find requests that have at least one photo past autoDeleteAt
                  const requestsWithExpiredPhotos = await RepairRequest.find({
                        'evidencePhotos.autoDeleteAt': { $lte: now },
                  });

                  for (const req of requestsWithExpiredPhotos) {
                        try {
                              const remainingPhotos = [];
                              let requestPurgedCount = 0;

                              for (const photo of req.evidencePhotos || []) {
                                    if (photo.autoDeleteAt && new Date(photo.autoDeleteAt) <= now) {
                                          if (photo.public_id) {
                                                try {
                                                      await deleteFromCloudinary(photo.public_id, 'image');
                                                } catch (cErr) {
                                                      console.warn(`[Repair Photo Retention] Cloudinary deletion failed for ${photo.public_id}:`, cErr);
                                                }
                                          }
                                          requestPurgedCount++;
                                          purgedPhotos++;
                                    } else {
                                          remainingPhotos.push(photo);
                                    }
                              }

                              if (requestPurgedCount > 0) {
                                    req.evidencePhotos = remainingPhotos as any;
                                    req.history = req.history || [];
                                    req.history.push({
                                          title: 'Evidence Photos Auto-Purged',
                                          description: `${requestPurgedCount} evidence photo(s) permanently deleted (30-day retention policy expired).`,
                                          date: now,
                                          actor: 'System',
                                    } as any);

                                    await req.save();
                                    updatedRequests++;
                              }
                        } catch (err) {
                              console.error(`[Repair Photo Retention] Failed to purge photos for repair ${req._id}:`, err);
                        }
                  }

                  if (purgedPhotos > 0) {
                        console.log(`[Repair Photo Retention] Successfully purged ${purgedPhotos} expired evidence photo(s) across ${updatedRequests} repair request(s).`);
                  }
            } catch (error) {
                  console.error('[Repair Photo Retention] Error during auto-delete retention purge:', error);
            } finally {
                  this.isRunning = false;
            }

            return { purgedPhotos, updatedRequests };
      }

      /**
       * Start the background retention schedule (runs on startup and every 24 hours / daily)
       */
      startRetentionJob(intervalMs: number = 24 * 60 * 60 * 1000): void {
            // Initial check after 15 seconds
            setTimeout(() => {
                  void this.purgeExpiredEvidencePhotos().catch((err) => {
                        console.error('[Repair Photo Retention] Initial run failed:', err);
                  });
            }, 15000);

            // Recurring daily check
            setInterval(() => {
                  void this.purgeExpiredEvidencePhotos().catch((err) => {
                        console.error('[Repair Photo Retention] Scheduled run failed:', err);
                  });
            }, intervalMs);

            console.log('[Repair Photo Retention] 30-day evidence photo auto-deletion service initialized.');
      }
}

export const repairPhotoRetentionService = new RepairPhotoRetentionService();
