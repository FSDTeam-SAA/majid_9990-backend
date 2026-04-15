import nodemailer from 'nodemailer';
import config from '../config/config';


interface SendEmailParams {
      to: string;
      subject: string;
      html: string;
}

interface SendEmailResponse {
      success: boolean;
      error?: string;
}

const sendEmail = async ({ to, subject, html }: SendEmailParams): Promise<SendEmailResponse> => {
      try {
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

            const mailOptions = {
                  from: config.email.emailAddress,
                  to,
                  subject,
                  html,
            };

            await transporter.sendMail(mailOptions);


            return { success: true };
      } catch (error: any) {
            return { success: false, error: error.message };
      }
};

export default sendEmail;
