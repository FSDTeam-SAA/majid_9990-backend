import { companyName } from '../lib/globalType';

type CustomerEmailTemplateInput = {
      customerName: string;
      subject: string;
      message: string;
      senderName?: string;
};

const customerEmailTemplate = ({ customerName, subject, message, senderName }: CustomerEmailTemplateInput) => `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${subject}</title>
</head>

<body style="margin:0; padding:0; background-color:#f4f6f8; font-family:Arial, Helvetica, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr>
      <td align="center">

        <table width="600" cellpadding="0" cellspacing="0"
          style="background:#ffffff; border-radius:12px; overflow:hidden;
          box-shadow:0 8px 24px rgba(0,0,0,0.08);">

          <tr>
            <td style="background:#111827; padding:24px 30px;">
              <h2 style="margin:0; color:#ffffff; font-size:18px; letter-spacing:0.5px;">
                Message from ${companyName}
              </h2>
            </td>
          </tr>

          <tr>
            <td style="padding:30px;">
              <p style="margin:0 0 12px 0; font-size:15px; color:#4b5563;">
                Hello ${customerName},
              </p>

              <h1 style="margin:0 0 16px 0; font-size:22px; color:#111827; font-weight:600;">
                ${subject}
              </h1>

              <p style="font-size:15px; line-height:1.7; color:#4b5563; margin:0; white-space:pre-line;">
                ${message}
              </p>

              ${senderName ? `<p style="margin:24px 0 0 0; font-size:14px; color:#374151;">Best regards,<br />${senderName}</p>` : ''}

              <div style="margin:30px 0; border-top:1px solid #e5e7eb;"></div>

              <p style="font-size:12px; color:#9ca3af; margin:0;">
                This is an automated email from ${companyName}. Please do not reply to this message.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background:#f9fafb; padding:16px 30px; text-align:center;">
              <p style="margin:0; font-size:12px; color:#6b7280;">
                © ${new Date().getFullYear()} ${companyName}. All rights reserved.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
`;

export default customerEmailTemplate;
