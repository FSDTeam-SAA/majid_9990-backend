export const lowStockEmailTemplate = (
      shopkeeperName: string,
      lowStockItems: Array<{
            itemName: string;
            quantity: number;
            minimumStock: number;
            imeiNumber?: string;
      }>
) => {
      const itemsList = lowStockItems
            .map(
                  (item) => `
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 12px; color: #111827; font-size: 14px;">
                ${item.itemName}
              </td>
              <td style="padding: 12px; color: #111827; font-size: 14px; text-align: center;">
                ${item.quantity}
              </td>
              <td style="padding: 12px; color: #111827; font-size: 14px; text-align: center;">
                ${item.minimumStock}
              </td>
              <td style="padding: 12px; color: ${item.quantity <= 0 ? '#dc2626' : '#f59e0b'}; font-weight: bold; font-size: 13px; text-align: center;">
                ${item.quantity <= 0 ? 'Out of Stock' : 'Low Stock'}
              </td>
            </tr>
            `
            )
            .join('');

      return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Low Stock Alert</title>
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
            <td style="background:linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding:24px 30px;">
              <h2 style="margin:0; color:#ffffff; font-size:18px; letter-spacing:0.5px;">
                Low Stock Alert
              </h2>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:30px;">
              <p style="
                font-size:14px;
                color:#4b5563;
                margin:0 0 16px 0;
              ">
                Hi <strong>${shopkeeperName}</strong>,
              </p>

              <p style="
                font-size:14px;
                line-height:1.6;
                color:#4b5563;
                margin:0 0 24px 0;
              ">
                The following items in your inventory have fallen below their minimum stock levels. Please reorder these items to maintain adequate stock levels.
              </p>

              <!-- Items Table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px; border-collapse: collapse;">
                <thead>
                  <tr style="background-color: #f3f4f6; border-bottom: 2px solid #e5e7eb;">
                    <th style="padding: 12px; text-align: left; color: #111827; font-weight: bold; font-size: 13px;">
                      Item Name
                    </th>
                    <th style="padding: 12px; text-align: center; color: #111827; font-weight: bold; font-size: 13px;">
                      Current Qty
                    </th>
                    <th style="padding: 12px; text-align: center; color: #111827; font-weight: bold; font-size: 13px;">
                      Min. Qty
                    </th>
                    <th style="padding: 12px; text-align: center; color: #111827; font-weight: bold; font-size: 13px;">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsList}
                </tbody>
              </table>

              <!-- Call to Action -->
              <div style="
                background-color: #f0fdf4;
                border-left: 4px solid #22c55e;
                padding: 16px;
                margin-bottom: 24px;
                border-radius: 4px;
              ">
                <p style="
                  font-size: 13px;
                  color: #166534;
                  margin: 0;
                ">
                  <strong>Tip:</strong> Timely reordering helps avoid stockouts and maintains customer satisfaction.
                </p>
              </div>

              <!-- Footer Message -->
              <p style="
                font-size:13px;
                color:#6b7280;
                margin:0;
                line-height:1.6;
              ">
                If you have any questions or need assistance managing your inventory, please contact our support team.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb; padding:20px 30px; border-top:1px solid #e5e7eb; text-align:center;">
              <p style="
                font-size:12px;
                color:#9ca3af;
                margin:0;
              ">
                This is an automated alert from your inventory management system.<br/>
                <span style="color:#d1d5db;">© 2026. All rights reserved.</span>
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
};
