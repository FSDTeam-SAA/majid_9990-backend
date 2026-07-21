// utils/email/email.service.ts

import sendEmail from '../sendEmail';
import { CompletionEmailData, generateCompletionEmailHTML } from './email.templates';

export interface EmailResult {
      success: boolean;
      error?: string;
}

export const sendRepairCompletionEmail = async (to: string, data: CompletionEmailData): Promise<EmailResult> => {
      try {
            const html = generateCompletionEmailHTML(data);

            const result = await sendEmail({
                  to,
                  subject: '✅ Your Device Repair is Complete!',
                  html,
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
