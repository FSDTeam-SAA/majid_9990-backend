// utils/email/email.templates.ts
import { getCurrencySymbol } from '../currency';
export { getCurrencySymbol };

export interface EmailRepairIssue {
      category: string;
      problems?: string[];
      estimatedPrice?: number;
      estimatedTime?: string;
      partName?: string;
}

export interface CompletionEmailData {
      customerName: string;
      deviceModel: string;
      imei?: string;
      serialNumber?: string;
      condition?: string;
      colour?: string;
      description: string;
      issues?: EmailRepairIssue[];
      bookingPhotos?: string[];
      completionPhotos?: string[];
      price?: number;
      currency?: string;
      currencySymbol?: string;
      technicianFeedback?: string;
      completionDate: string;
      requestId: string;
      orderNumber?: string;
      shopName?: string;
      trackingUrl?: string;
}

export interface RepairStatusEmailData {
      customerName: string;
      deviceModel: string;
      imei?: string;
      serialNumber?: string;
      condition?: string;
      colour?: string;
      description: string;
      issues?: EmailRepairIssue[];
      bookingPhotos?: string[];
      completionPhotos?: string[];
      status: string;
      statusLabel: string;
      statusNote?: string;
      price?: number;
      currency?: string;
      currencySymbol?: string;
      shopName?: string;
      requestId: string;
      orderNumber?: string;
      trackingUrl: string;
      technicianFeedback?: string;
      waitingForPartsDays?: number;
      waitingForPartsDescription?: string;
}

const renderIssuesListHtml = (
      issues: EmailRepairIssue[] | undefined,
      fallbackDesc: string,
      currSymbol: string
): string => {
      if (!issues || issues.length === 0) {
            return `<span>${fallbackDesc || 'No issue recorded'}</span>`;
      }
      const rows = issues
            .map((iss) => {
                  const probs = (iss.problems || []).filter(Boolean).join(', ');
                  const priceStr =
                        iss.estimatedPrice != null && Number(iss.estimatedPrice) > 0
                              ? `${currSymbol}${Number(iss.estimatedPrice).toFixed(2)}`
                              : 'Price TBC';
                  const partHtml = iss.partName ? ` <span style="color:#6b7280;">(Part: ${iss.partName})</span>` : '';
                  return `<li style="margin:4px 0;"><strong>${iss.category}</strong>${probs ? `: ${probs}` : ''}${partHtml} &mdash; <strong>${priceStr}</strong></li>`;
            })
            .join('');
      return `<ul style="margin:6px 0 0 18px; padding:0;">${rows}</ul>`;
};

export const renderRepairPhotosHtml = (bookingPhotos?: string[], completionPhotos?: string[]): string => {
      const booking = (bookingPhotos || []).filter((u) => /^https?:\/\//i.test(u));
      const completion = (completionPhotos || []).filter((u) => /^https?:\/\//i.test(u));
      if (booking.length === 0 && completion.length === 0) return '';

      const renderGroup = (title: string, urls: string[]) => {
            if (urls.length === 0) return '';
            const thumbs = urls
                  .map(
                        (u, idx) =>
                              `<a href="${u}" target="_blank" style="display:inline-block; margin:4px 6px 4px 0; border:1px solid #d1d5db; border-radius:6px; overflow:hidden; text-decoration:none;"><img src="${u}" alt="${title} ${idx + 1}" width="84" height="84" style="display:block; object-fit:cover; width:84px; height:84px;" /></a>`
                  )
                  .join('');
            return `
            <div style="margin-bottom:10px;">
              <div style="font-size:12px; font-weight:700; color:#374151; margin-bottom:4px;">${title} (${urls.length})</div>
              <div>${thumbs}</div>
            </div>`;
      };

      return `
        <div style="background-color:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:14px 16px; margin:16px 0;">
          <div style="font-size:12px; font-weight:700; text-transform:uppercase; color:#1f2937; margin-bottom:8px;">
            Inspection & Completion Photos (Also Attached)
          </div>
          ${renderGroup('Booking Photos', booking)}
          ${renderGroup('Completion Photos', completion)}
        </div>`;
};

const getStatusBadgeColors = (status: string): { bg: string; text: string; border: string } => {
      switch (status) {
            case 'waiting-for-parts':
                  return { bg: '#FEF3C7', text: '#D97706', border: '#F59E0B' };
            case 'start-work':
            case 'repairing':
                  return { bg: '#EDE9FE', text: '#7C3AED', border: '#8B5CF6' };
            case 'diagnosing':
            case 'inReview':
                  return { bg: '#E0F2FE', text: '#0284C7', border: '#38BDF8' };
            case 'quote_sent':
            case 'quote-sent':
                  return { bg: '#FCE7F3', text: '#DB2777', border: '#EC4899' };
            case 'completed':
            case 'ready-for-collection':
            case 'approved':
                  return { bg: '#D1FAE5', text: '#059669', border: '#10B981' };
            case 'rejected':
                  return { bg: '#FEE2E2', text: '#DC2626', border: '#EF4444' };
            default:
                  return { bg: '#EFF6FF', text: '#2563EB', border: '#3B82F6' };
      }
};

export const generateRepairStatusEmailHTML = (data: RepairStatusEmailData): string => {
      const {
            customerName,
            deviceModel,
            imei,
            description,
            status,
            statusLabel,
            statusNote,
            price,
            shopName,
            requestId,
            trackingUrl,
            technicianFeedback,
            waitingForPartsDays,
            waitingForPartsDescription,
      } = data;

      const shopDisplayName = shopName || 'Imoscan Repair Services';
      const badgeColors = getStatusBadgeColors(status);
      const currSymbol = getCurrencySymbol(data.currency, data.currencySymbol);
      const priceDisplay = price != null && !isNaN(Number(price)) ? `${currSymbol}${Number(price).toFixed(2)}` : undefined;

      return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Update on your repair - #${requestId}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background-color: #f3f4f6;
          margin: 0;
          padding: 0;
          color: #1f2937;
        }
        .container {
          max-width: 600px;
          margin: 32px auto;
          background-color: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.06);
          border: 1px solid #e5e7eb;
        }
        .header {
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          padding: 32px 28px;
          text-align: center;
          color: #ffffff;
        }
        .shop-name {
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #94a3b8;
          margin-bottom: 8px;
        }
        .header-title {
          font-size: 24px;
          font-weight: 800;
          margin: 0;
          color: #ffffff;
          letter-spacing: -0.02em;
        }
        .content {
          padding: 32px 28px;
        }
        .greeting {
          font-size: 16px;
          color: #374151;
          margin-bottom: 20px;
          line-height: 1.5;
        }
        .status-card {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 20px;
          margin: 20px 0;
          text-align: center;
        }
        .status-badge {
          display: inline-block;
          background-color: ${badgeColors.bg};
          color: ${badgeColors.text};
          border: 1px solid ${badgeColors.border};
          padding: 8px 20px;
          border-radius: 9999px;
          font-weight: 700;
          font-size: 14px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .details-card {
          background-color: #f9fafb;
          border-left: 4px solid #2563eb;
          padding: 18px 20px;
          margin: 24px 0;
          border-radius: 8px;
        }
        .detail-row {
          margin: 8px 0;
          font-size: 14px;
          color: #4b5563;
        }
        .detail-label {
          font-weight: 700;
          color: #1f2937;
          display: inline-block;
          width: 130px;
        }
        .note-box {
          background-color: #f0f9ff;
          border: 1px solid #bae6fd;
          border-radius: 10px;
          padding: 16px 20px;
          margin: 20px 0;
          color: #0369a1;
          font-size: 14px;
          line-height: 1.6;
        }
        .note-title {
          font-weight: 700;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 4px;
          color: #0284c7;
        }
        .cta-container {
          text-align: center;
          margin: 32px 0 24px 0;
        }
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #ffffff !important;
          padding: 14px 36px;
          border-radius: 9999px;
          text-decoration: none;
          font-weight: 700;
          font-size: 15px;
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
          letter-spacing: 0.02em;
        }
        .pdf-notice {
          background-color: #f8fafc;
          border: 1px dashed #cbd5e1;
          border-radius: 8px;
          padding: 12px 16px;
          margin-top: 24px;
          font-size: 13px;
          color: #64748b;
          text-align: center;
        }
        .footer {
          text-align: center;
          padding: 24px 28px;
          background-color: #f8fafc;
          border-top: 1px solid #e5e7eb;
          color: #9ca3af;
          font-size: 12px;
          line-height: 1.6;
        }
        .footer a {
          color: #2563eb;
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="shop-name">${shopDisplayName}</div>
          <h1 class="header-title">Repair Status Update</h1>
        </div>
        
        <div class="content">
          <div class="greeting">
            Hello <strong>${customerName}</strong>,
            <br>
            Here is the latest update regarding your device repair at <strong>${shopDisplayName}</strong>.
          </div>
          
          <div class="status-card">
            <span class="status-badge">${statusLabel}</span>
          </div>

          ${
                waitingForPartsDescription || status === 'waiting-for-parts'
                      ? `
          <div class="note-box">
            <div class="note-title">Parts Order Status</div>
            ${waitingForPartsDescription ? `<p style="margin: 4px 0 0 0;">${waitingForPartsDescription}</p>` : ''}
            ${waitingForPartsDays ? `<p style="margin: 6px 0 0 0; font-weight: 600;">Estimated arrival: ~${waitingForPartsDays} day(s)</p>` : ''}
          </div>`
                      : ''
          }

          ${
                statusNote
                      ? `
          <div class="note-box">
            <div class="note-title">Technician Note</div>
            <p style="margin: 4px 0 0 0;">${statusNote}</p>
          </div>`
                      : ''
          }

          <div class="details-card">
            <div class="detail-row"><span class="detail-label">Job Reference:</span> ${data.orderNumber || `#${requestId.toUpperCase()}`}</div>
            <div class="detail-row"><span class="detail-label">Device Model:</span> ${deviceModel}</div>
            ${data.condition ? `<div class="detail-row"><span class="detail-label">Intake Condition:</span> ${data.condition}</div>` : ''}
            ${data.colour ? `<div class="detail-row"><span class="detail-label">Colour:</span> ${data.colour}</div>` : ''}
            ${imei ? `<div class="detail-row"><span class="detail-label">IMEI Number:</span> ${imei}</div>` : ''}
            ${data.serialNumber ? `<div class="detail-row"><span class="detail-label">Serial Number:</span> ${data.serialNumber}</div>` : ''}
            <div class="detail-row"><span class="detail-label">Reported Issues:</span> ${renderIssuesListHtml(data.issues, description, currSymbol)}</div>
            ${priceDisplay ? `<div class="detail-row"><span class="detail-label">Estimated Price:</span> ${priceDisplay}</div>` : ''}
          </div>

          ${renderRepairPhotosHtml(data.bookingPhotos, data.completionPhotos)}

          ${
                technicianFeedback
                      ? `
          <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 14px;">
            <strong style="color: #1f2937;">Technician Feedback:</strong>
            <p style="margin: 6px 0 0 0; color: #4b5563; font-style: italic;">${technicianFeedback}</p>
          </div>`
                      : ''
          }

          <div class="cta-container">
            <a href="${trackingUrl}" target="_blank" class="button">
              View Live Repair Status &rarr;
            </a>
          </div>

          <div class="pdf-notice">
            📎 <strong>PDF Status Report Attached:</strong> You can open the attached PDF report (<code>Repair_Status_${requestId}.pdf</code>) anytime to check full details offline.
          </div>
        </div>
        
        <div class="footer">
          <p style="margin: 0 0 6px 0;">
            Can't click the button? Copy and paste this URL into your browser:
            <br>
            <a href="${trackingUrl}">${trackingUrl}</a>
          </p>
          <p style="margin: 12px 0 0 0; color: #9ca3af;">
            This is an automated notification from ${shopDisplayName}. Please do not reply directly to this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const generateCompletionEmailHTML = (data: CompletionEmailData): string => {
      const {
            customerName,
            deviceModel,
            description,
            price,
            currency,
            currencySymbol,
            technicianFeedback,
            completionDate,
            requestId,
            shopName,
            trackingUrl,
      } = data;

      const shopDisplayName = shopName || 'Imoscan Repair Services';
      const currSymbol = getCurrencySymbol(currency, currencySymbol);
      const priceDisplay = price != null && !isNaN(Number(price))
            ? `${currSymbol}${Number(price).toFixed(2)}`
            : 'To be determined';
      const feedbackDisplay = technicianFeedback || 'No additional feedback provided.';

      return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your Device Repair is Complete!</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background-color: #f4f7fa;
          margin: 0;
          padding: 0;
          color: #1f2937;
        }
        .email-container {
          max-width: 600px;
          margin: 40px auto;
          background-color: #ffffff;
          border-radius: 16px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
          overflow: hidden;
          border: 1px solid #e5e7eb;
        }
        .header {
          background: linear-gradient(135deg, #10b981, #059669);
          padding: 32px 20px;
          text-align: center;
        }
        .header h1 {
          color: #ffffff;
          margin: 0;
          font-size: 26px;
          font-weight: 800;
        }
        .content {
          padding: 32px 28px;
        }
        .greeting {
          font-size: 16px;
          color: #1f2937;
          margin-bottom: 20px;
          line-height: 1.5;
        }
        .greeting strong {
          color: #059669;
        }
        .card {
          background-color: #f8fafc;
          border-left: 4px solid #10b981;
          padding: 16px 20px;
          margin: 20px 0;
          border-radius: 6px;
        }
        .card p {
          margin: 8px 0;
          color: #374151;
          font-size: 14px;
        }
        .card .label {
          font-weight: 700;
          color: #1f2937;
          display: inline-block;
          width: 140px;
        }
        .status-badge {
          display: inline-block;
          background-color: #10b981;
          color: white;
          padding: 8px 20px;
          border-radius: 20px;
          font-weight: 700;
          font-size: 14px;
          text-transform: uppercase;
        }
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: white !important;
          padding: 14px 36px;
          border-radius: 9999px;
          text-decoration: none;
          font-weight: 700;
          margin-top: 15px;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }
        .pdf-notice {
          background-color: #f8fafc;
          border: 1px dashed #cbd5e1;
          border-radius: 8px;
          padding: 12px 16px;
          margin-top: 24px;
          font-size: 13px;
          color: #64748b;
          text-align: center;
        }
        .footer {
          text-align: center;
          padding: 20px;
          background-color: #f8fafc;
          color: #6b7280;
          font-size: 12px;
          border-top: 1px solid #e5e7eb;
        }
        .footer a {
          color: #2563eb;
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(255,255,255,0.85); margin-bottom: 6px;">${shopDisplayName}</div>
          <h1>Repair Completed</h1>
        </div>
        
        <div class="content">
          <div class="greeting">
            Dear <strong>${customerName}</strong>,
          </div>
          
          <p style="font-size: 15px; line-height: 1.6; color: #4b5563;">
            We are pleased to inform you that the repair of your device at <strong>${shopDisplayName}</strong> has been <strong>completed</strong> and is ready.
          </p>
          
          <div class="card">
            <p><span class="label">Job Reference:</span> ${data.orderNumber || `#${requestId}`}</p>
            <p><span class="label">Device Model:</span> ${deviceModel}</p>
            ${data.condition ? `<p><span class="label">Intake Condition:</span> ${data.condition}</p>` : ''}
            ${data.colour ? `<p><span class="label">Colour:</span> ${data.colour}</p>` : ''}
            ${data.imei ? `<p><span class="label">IMEI Number:</span> ${data.imei}</p>` : ''}
            ${data.serialNumber ? `<p><span class="label">Serial Number:</span> ${data.serialNumber}</p>` : ''}
            <div style="margin:8px 0; color:#374151; font-size:14px;"><span class="label">Reported Issues:</span> ${renderIssuesListHtml(data.issues, description, currSymbol)}</div>
            <p><span class="label">Final Price:</span> ${priceDisplay}</p>
            <p><span class="label">Completion Date:</span> ${completionDate}</p>
          </div>

          ${renderRepairPhotosHtml(data.bookingPhotos, data.completionPhotos)}
          
          <div style="text-align: center; margin: 24px 0;">
            <span class="status-badge">&#10003; Completed</span>
          </div>

          ${
                technicianFeedback
                      ? `
          <div style="background-color: #f3f4f6; padding: 16px 20px; border-radius: 8px; margin: 20px 0;">
            <h4 style="margin: 0 0 8px 0; color: #1f2937;">Technician Feedback:</h4>
            <p style="margin: 0; color: #4b5563; font-style: italic;">${feedbackDisplay}</p>
          </div>`
                      : ''
          }

          ${
                trackingUrl
                      ? `
          <div style="text-align: center; margin: 28px 0 16px 0;">
            <a href="${trackingUrl}" target="_blank" class="button">
              View Live Repair Status &rarr;
            </a>
          </div>`
                      : ''
          }

          <div class="pdf-notice">
            📎 <strong>PDF Status Report Attached:</strong> A full status receipt (<code>Repair_Status_${requestId}.pdf</code>) is attached to this email.
          </div>
        </div>
        
        <div class="footer">
          <p>Thank you for trusting us with your device repair.</p>
          ${trackingUrl ? `<p><a href="${trackingUrl}">Track live status here</a></p>` : ''}
          <p style="margin-top: 10px; font-size: 11px; color: #9ca3af;">
            This is an automated message, please do not reply to this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};
