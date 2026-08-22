// utils/sendEmail.ts

import nodemailer from 'nodemailer';
import config from '../config/config';
import { companyName } from '../lib/globalType';

interface SendEmailParams {
      to: string;
      subject: string;
      html: string;
      fromName?: string;
}

interface SendEmailResponse {
      success: boolean;
      messageId?: string;
      error?: string;
}

const sendEmail = async ({ to, subject, html, fromName }: SendEmailParams): Promise<SendEmailResponse> => {
      try {
            // Validate email configuration
            if (!config.email?.emailAddress || !config.email?.emailPass) {
                  throw new Error('Email configuration is missing');
            }

            const transporter = nodemailer.createTransport({
                  host: 'smtp.gmail.com',
                  port: 587,
                  secure: false,
                  auth: {
                        user: config.email.emailAddress,
                        pass: config.email.emailPass,
                  },
                  tls: {
                        rejectUnauthorized: false,
                  },
            });

            // Verify connection configuration
            await transporter.verify();

            const sender = fromName || companyName || 'Imoscan';

            const mailOptions = {
                  from: `"${sender}" <${config.email.emailAddress}>`,
                  to,
                  subject,
                  html,
            };

            const info = await transporter.sendMail(mailOptions);

            console.log('Email sent successfully:', info.messageId);

            return {
                  success: true,
                  messageId: info.messageId,
            };
      } catch (error: any) {
            console.error('Email sending failed:', error);
            return {
                  success: false,
                  error: error.message || 'Failed to send email',
            };
      }
};

export default sendEmail;
