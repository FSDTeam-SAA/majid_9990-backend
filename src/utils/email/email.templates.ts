// utils/email/email.templates.ts

export interface CompletionEmailData {
      customerName: string;
      deviceModel: string;
      description: string;
      price?: number;
      technicianFeedback?: string;
      completionDate: string;
      requestId: string;
}

export const generateCompletionEmailHTML = (data: CompletionEmailData): string => {
      const { customerName, deviceModel, description, price, technicianFeedback, completionDate, requestId } = data;

      const priceDisplay = price ? `$${price.toFixed(2)}` : 'To be determined';
      const feedbackDisplay = technicianFeedback || 'No additional feedback provided.';

      return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #f4f7fa;
          margin: 0;
          padding: 0;
        }
        .email-container {
          max-width: 600px;
          margin: 40px auto;
          background-color: #ffffff;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #2563eb, #1e40af);
          padding: 30px 20px;
          text-align: center;
        }
        .header h1 {
          color: #ffffff;
          margin: 0;
          font-size: 28px;
          font-weight: 600;
        }
        .content {
          padding: 30px;
        }
        .greeting {
          font-size: 18px;
          color: #1f2937;
          margin-bottom: 20px;
        }
        .greeting strong {
          color: #2563eb;
        }
        .card {
          background-color: #f8fafc;
          border-left: 4px solid #2563eb;
          padding: 15px 20px;
          margin: 20px 0;
          border-radius: 6px;
        }
        .card p {
          margin: 8px 0;
          color: #374151;
        }
        .card .label {
          font-weight: 600;
          color: #1f2937;
        }
        .status-badge {
          display: inline-block;
          background-color: #10b981;
          color: white;
          padding: 6px 16px;
          border-radius: 20px;
          font-weight: 600;
          font-size: 14px;
        }
        .feedback-section {
          background-color: #f3f4f6;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
        }
        .feedback-section h3 {
          margin: 0 0 10px 0;
          color: #1f2937;
        }
        .feedback-section p {
          margin: 0;
          color: #4b5563;
          font-style: italic;
        }
        .divider {
          border: none;
          border-top: 1px solid #e5e7eb;
          margin: 25px 0;
        }
        .footer {
          text-align: center;
          padding: 20px;
          background-color: #f8fafc;
          color: #6b7280;
          font-size: 14px;
        }
        .footer a {
          color: #2563eb;
          text-decoration: none;
        }
        .footer a:hover {
          text-decoration: underline;
        }
        .button {
          display: inline-block;
          background-color: #2563eb;
          color: white;
          padding: 12px 30px;
          border-radius: 6px;
          text-decoration: none;
          font-weight: 600;
          margin-top: 15px;
        }
        .button:hover {
          background-color: #1e40af;
        }
        .text-center {
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <h1>Repair Completed</h1>
        </div>
        
        <div class="content">
          <div class="greeting">
            Dear <strong>${customerName}</strong>,
          </div>
          
          <p>We are pleased to inform you that the repair of your device has been <strong>completed</strong>.</p>
          
          <div class="card">
            <p><span class="label">Device Model:</span> ${deviceModel}</p>
            <p><span class="label">Issue Description:</span> ${description}</p>
            <p><span class="label">Final Price:</span> ${priceDisplay}</p>
            <p><span class="label">Completion Date:</span> ${completionDate}</p>
            <p><span class="label">Request ID:</span> #${requestId}</p>
          </div>
          
          <div class="text-center">
            <span class="status-badge">✓ Completed</span>
          </div>
        </div>
        
        <div class="footer">
          <p>Thank you for trusting us with your device repair.</p>

          <p style="margin-top: 10px; font-size: 12px; color: #9ca3af;">
            This is an automated message, please do not reply to this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};
