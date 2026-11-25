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

const buildPhotoAttachments = (
      bookingPhotos?: string[],
      completionPhotos?: string[]
) => {
      const attachments: Array<{ filename: string; path: string }> = [];
      const seen = new Set<string>();
      const pushUrl = (url: string, prefix: string, index: number) => {
            const clean = String(url || '').trim();
            if (!/^https?:\/\//i.test(clean) || seen.has(clean) || attachments.length >= 10) {
                  return;
            }
            seen.add(clean);
            const extMatch = clean.match(/\.(jpg|jpeg|png|webp|avif)(?:\?|$)/i);
            const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';
            attachments.push({
                  filename: `${prefix}_${index + 1}.${ext}`,
                  path: clean,
            });
      };

      (bookingPhotos || []).forEach((u, idx) => pushUrl(u, 'Booking_Photo', idx));
      (completionPhotos || []).forEach((u, idx) => pushUrl(u, 'Completion_Photo', idx));
      return attachments;
};

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

            const attachments: Array<{
                  filename: string;
                  content?: Buffer;
                  path?: string;
                  contentType?: string;
            }> = [];
            if (pdfBuffer) {
                  attachments.push({
                        filename: `Repair_Status_${data.requestId}.pdf`,
                        content: pdfBuffer,
                        contentType: 'application/pdf',
                  });
            }
            attachments.push(...buildPhotoAttachments(data.bookingPhotos, data.completionPhotos));

            const result = await sendEmail({
                  to,
                  subject,
                  html,
                  fromName: data.shopName || 'Imoscan Repair Service',
                  attachments: attachments.length > 0 ? attachments : undefined,
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

            const attachments: Array<{
                  filename: string;
                  content?: Buffer;
                  path?: string;
                  contentType?: string;
            }> = [];
            if (pdfBuffer) {
                  attachments.push({
                        filename: `Repair_Complete_${data.requestId}.pdf`,
                        content: pdfBuffer,
                        contentType: 'application/pdf',
                  });
            }
            attachments.push(...buildPhotoAttachments(data.bookingPhotos, data.completionPhotos));

            const result = await sendEmail({
                  to,
                  subject,
                  html,
                  fromName: data.shopName || 'Imoscan Repair Service',
                  attachments: attachments.length > 0 ? attachments : undefined,
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
