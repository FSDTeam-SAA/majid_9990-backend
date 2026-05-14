import { Worker } from 'worker_threads';
import path from 'path';
import { Types } from 'mongoose';

interface LowStockEmailJob {
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

class LowStockEmailWorkerPool {
      private workerScript: string;
      private maxWorkers: number;
      private activeWorkers: Set<Worker> = new Set();

      constructor(maxWorkers: number = 4) {
            this.maxWorkers = maxWorkers;
            this.workerScript = path.join(__dirname, '../workers/lowStockEmailWorkerThread.js');
      }

      async sendEmail(job: LowStockEmailJob): Promise<void> {
            return new Promise((resolve, reject) => {
                  // Wait for an available worker slot
                  const checkWorkerSlot = () => {
                        if (this.activeWorkers.size < this.maxWorkers) {
                              this.createWorker(job, resolve, reject);
                        } else {
                              // Wait and retry
                              setTimeout(checkWorkerSlot, 100);
                        }
                  };

                  checkWorkerSlot();
            });
      }

      private createWorker(job: LowStockEmailJob, resolve: () => void, reject: (error: Error) => void): void {
            const worker = new Worker(this.workerScript);
            this.activeWorkers.add(worker);

            worker.on('message', (message) => {
                  if (message.type === 'success') {
                        console.log(`[LowStockEmailWorker] Email sent to ${job.email}`);
                        resolve();
                  } else if (message.type === 'error') {
                        console.error(`[LowStockEmailWorker] Failed to send email to ${job.email}:`, message.error);
                        reject(new Error(message.error));
                  }
            });

            worker.on('error', (error) => {
                  console.error('[LowStockEmailWorker] Worker error:', error);
                  reject(error);
            });

            worker.on('exit', (code) => {
                  this.activeWorkers.delete(worker);
                  if (code !== 0) {
                        console.error(`[LowStockEmailWorker] Worker exited with code ${code}`);
                  }
            });

            worker.postMessage({ job });
      }

      async shutdown(): Promise<void> {
            const promises = Array.from(this.activeWorkers).map(
                  (worker) =>
                        new Promise<void>((resolve) => {
                              worker.terminate().then(() => resolve());
                        })
            );
            await Promise.all(promises);
            this.activeWorkers.clear();
      }
}

// Singleton instance
let workerPool: LowStockEmailWorkerPool | null = null;

export const getWorkerPool = (): LowStockEmailWorkerPool => {
      if (!workerPool) {
            workerPool = new LowStockEmailWorkerPool(parseInt(process.env.LOW_STOCK_EMAIL_WORKERS || '4', 10));
      }
      return workerPool;
};

export const enqueueLowStockEmail = async (job: LowStockEmailJob): Promise<void> => {
      try {
            const pool = getWorkerPool();
            await pool.sendEmail(job);
      } catch (error) {
            console.error('[LowStockEmailWorker] Failed to enqueue email:', error);
            // Don't throw - let the system continue even if email fails
      }
};

export default {
      getWorkerPool,
      enqueueLowStockEmail,
};
