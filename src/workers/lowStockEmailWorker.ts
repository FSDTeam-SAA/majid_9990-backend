import sendEmail from '../utils/sendEmail';
import { lowStockEmailTemplate } from '../utils/lowStockEmailTemplate';

export interface LowStockEmailJob {
      userId: string;
      email: string;
      shopkeeperName: string;
      lowStockItems: Array<{
            itemName: string;
            quantity: number;
            minimumStock: number;
            imeiNumber?: string;
      }>;
}

interface QueuedTask {
      job: LowStockEmailJob;
      resolve: () => void;
      reject: (error: Error) => void;
}

class LowStockEmailQueue {
      private concurrency: number;
      private activeCount = 0;
      private queue: QueuedTask[] = [];

      constructor(concurrency = 4) {
            this.concurrency = concurrency;
      }

      async sendEmail(job: LowStockEmailJob): Promise<void> {
            return new Promise<void>((resolve, reject) => {
                  this.queue.push({ job, resolve, reject });
                  this.processNext();
            });
      }

      private async processNext(): Promise<void> {
            if (this.activeCount >= this.concurrency || this.queue.length === 0) {
                  return;
            }

            const task = this.queue.shift();
            if (!task) {
                  return;
            }

            this.activeCount++;

            try {
                  const { email, shopkeeperName, lowStockItems } = task.job;

                  if (!email || !lowStockItems || lowStockItems.length === 0) {
                        throw new Error('Invalid job parameters: missing email or low stock items');
                  }

                  const htmlContent = lowStockEmailTemplate(shopkeeperName, lowStockItems);

                  const result = await sendEmail({
                        to: email,
                        subject: `🚨 Low Stock Alert - ${lowStockItems.length} Item(s) Below Minimum Level`,
                        html: htmlContent,
                  });

                  if (!result.success) {
                        throw new Error(result.error || 'Failed to send email');
                  }

                  console.log(`[LowStockEmailQueue] Email sent successfully to ${email}`);
                  task.resolve();
            } catch (error: any) {
                  console.error(`[LowStockEmailQueue] Failed to send email to ${task.job.email}:`, error);
                  task.reject(error instanceof Error ? error : new Error(String(error)));
            } finally {
                  this.activeCount--;
                  this.processNext();
            }
      }

      getQueueLength(): number {
            return this.queue.length;
      }

      getActiveCount(): number {
            return this.activeCount;
      }
}

// Singleton instance
let emailQueue: LowStockEmailQueue | null = null;

export const getWorkerPool = (): LowStockEmailQueue => {
      if (!emailQueue) {
            const concurrency = parseInt(process.env.LOW_STOCK_EMAIL_WORKERS || '4', 10);
            emailQueue = new LowStockEmailQueue(Number.isFinite(concurrency) && concurrency > 0 ? concurrency : 4);
      }
      return emailQueue;
};

export const enqueueLowStockEmail = async (job: LowStockEmailJob): Promise<void> => {
      try {
            const queue = getWorkerPool();
            // Background enqueue - async operation dispatched to bounded concurrency queue without blocking caller
            queue.sendEmail(job).catch((error) => {
                  console.error('[LowStockEmailQueue] Background delivery failed:', error);
            });
      } catch (error) {
            console.error('[LowStockEmailQueue] Failed to enqueue email:', error);
      }
};

export default {
      getWorkerPool,
      enqueueLowStockEmail,
};
