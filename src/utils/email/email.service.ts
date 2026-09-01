// utils/email/email.service.ts

import sendEmail from '../sendEmail';
import {
      CompletionEmailData,
      generateCompletionEmailHTML,
      generateRepairStatusEmailHTML,
      RepairStatusEmailData,
} from './email.templates';

export interface EmailResult {
      success: boolean;
      error?: string;
}

export const sendRepairStatusEmail = async (
      to: string,
      data: RepairStatusEmailData,
      pdfBuffer?: Buffer,
      customSubject?: string
): Promise<EmailResult> => {
      try {
            const html = generateRepairStatusEmailHTML(data);
            const shopName = data.shopName ? ` - ${data.shopName}` : '';
            const subject = customSubject || `Update on your repair - ${data.deviceModel}${shopName}`;

            const attachments = pdfBuffer
                  ? [
                          {
                                filename: `Repair_Status_${data.requestId}.pdf`,
                                content: pdfBuffer,
                                contentType: 'application/pdf',
                          },
                    ]
                  : undefined;

            const result = await sendEmail({
                  to,
                  subject,
                  html,
                  fromName: data.shopName || 'Imoscan Repair Service',
                  attachments,
            });

            return result;
      } catch (error: any) {
            console.error('Error sending repair status email:', error);
            return {
                  success: false,
                  error: error.message || 'Failed to send email',
            };
      }
};

export const sendRepairCompletionEmail = async (
      to: string,
      data: CompletionEmailData,
      pdfBuffer?: Buffer
): Promise<EmailResult> => {
      try {
            const html = generateCompletionEmailHTML(data);
            const shopName = data.shopName ? ` - ${data.shopName}` : '';
            const subject = `✅ Your Device Repair is Complete! - ${data.deviceModel}${shopName}`;

            const attachments = pdfBuffer
                  ? [
                          {
                                filename: `Repair_Complete_${data.requestId}.pdf`,
                                content: pdfBuffer,
                                contentType: 'application/pdf',
                          },
                    ]
                  : undefined;

            const result = await sendEmail({
                  to,
                  subject,
                  html,
                  fromName: data.shopName || 'Imoscan Repair Service',
                  attachments,
            });

            return result;
      } catch (error: any) {
            console.error('Error sending completion email:', error);
            return {
                  success: false,
                  error: error.message || 'Failed to send email',
            };
      }
};
