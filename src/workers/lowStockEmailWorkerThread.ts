import { parentPort } from 'worker_threads';
import sendEmail from '../utils/sendEmail';
import { lowStockEmailTemplate } from '../utils/lowStockEmailTemplate';

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

const sendEmailWorker = async (job: LowStockEmailJob): Promise<void> => {
      try {
            const { email, shopkeeperName, lowStockItems } = job;

            if (!email || !lowStockItems || lowStockItems.length === 0) {
                  throw new Error('Invalid job parameters: missing email or low stock items');
            }

            // Generate email HTML
            const htmlContent = lowStockEmailTemplate(shopkeeperName, lowStockItems);

            // Send email
            const result = await sendEmail({
                  to: email,
                  subject: `🚨 Low Stock Alert - ${lowStockItems.length} Item(s) Below Minimum Level`,
                  html: htmlContent,
            });

            if (!result.success) {
                  throw new Error(result.error || 'Failed to send email');
            }
      } catch (error: any) {
            throw new Error(error.message || 'Unknown error in email worker');
      }
};

parentPort?.on('message', async (message) => {
      try {
            const { job } = message;
            await sendEmailWorker(job);

            parentPort?.postMessage({
                  type: 'success',
                  message: 'Email sent successfully',
            });
      } catch (error: any) {
            parentPort?.postMessage({
                  type: 'error',
                  error: error.message || 'Unknown error',
            });
      }
});
