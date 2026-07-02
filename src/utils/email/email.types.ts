
export interface EmailConfig {
      host: string;
      port: number;
      secure: boolean;
      auth: {
            user: string;
            pass: string;
      };
}

export interface EmailOptions {
      to: string | string[];
      subject: string;
      html: string;
      cc?: string | string[];
      bcc?: string | string[];
      attachments?: Array<{
            filename: string;
            path: string;
            contentType?: string;
      }>;
}

export interface EmailResponse {
      success: boolean;
      messageId?: string;
      error?: string;
}
