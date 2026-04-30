import { companyName } from "../lib/globalType";

const announcementTemplate = (title: string, message: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Announcement</title>
</head>

<body style="margin:0; padding:0; background-color:#f4f6f8; font-family:Arial, Helvetica, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr>
      <td align="center">

        <!-- Email Container -->
        <table width="600" cellpadding="0" cellspacing="0" 
          style="background:#ffffff; border-radius:12px; overflow:hidden; 
          box-shadow:0 8px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#111827; padding:24px 30px;">
              <h2 style="margin:0; color:#ffffff; font-size:18px; letter-spacing:0.5px;">
                Official Announcement
              </h2>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:30px;">
              
              <h1 style="
                margin:0 0 16px 0;
                font-size:22px;
                color:#111827;
                font-weight:600;
              ">
                ${title}
              </h1>

              <p style="
                font-size:15px;
                line-height:1.6;
                color:#4b5563;
                margin:0;
                white-space:pre-line;
              ">
                ${message}
              </p>

              <!-- Divider -->
              <div style="margin:30px 0; border-top:1px solid #e5e7eb;"></div>

              <p style="
                font-size:12px;
                color:#9ca3af;
                margin:0;
              ">
                This is an automated message. Please do not reply to this email.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb; padding:16px 30px; text-align:center;">
              <p style="margin:0; font-size:12px; color:#6b7280;">
                © ${new Date().getFullYear()} Your ${companyName}. All rights reserved.
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

export default announcementTemplate;
