// src/modules/repairRequest/repairPdf.service.ts

export interface RepairPdfData {
      requestId: string;
      customerName: string;
      customerEmail: string;
      customerPhone?: string;
      deviceModel: string;
      imei?: string;
      description: string;
      status: string;
      statusLabel: string;
      statusNote?: string;
      price?: number;
      shopName?: string;
      shopPhone?: string;
      shopAddress?: string;
      technicianFeedback?: string;
      waitingForPartsDays?: number;
      waitingForPartsDescription?: string;
      technicianNotes?: Array<{
            partName: string;
            cost: number;
            time: number;
      }>;
      trackingUrl: string;
      createdAt?: Date | string;
      updatedAt?: Date | string;
}

const asText = (value: unknown): string => {
      if (value === null || value === undefined || value === '') return 'N/A';
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);

      try {
            return JSON.stringify(value);
      } catch {
            return String(value);
      }
};

const pdfText = (value: unknown): string =>
      asText(value)
            .replace(/[^\x20-\x7E]/g, '?')
            .replace(/\\/g, '\\\\')
            .replace(/\(/g, '\\(')
            .replace(/\)/g, '\\)');

const wrapLine = (line: string, maxLength = 88): string[] => {
      if (!line) return [''];

      const words = line.split(/\s+/);
      const lines: string[] = [];
      let currentLine = '';

      for (const word of words) {
            const nextLine = currentLine ? `${currentLine} ${word}` : word;
            if (nextLine.length <= maxLength || !currentLine) {
                  currentLine = nextLine;
                  continue;
            }

            lines.push(currentLine);
            currentLine = word;
      }

      if (currentLine) lines.push(currentLine);
      return lines;
};

const formatStatusLabel = (status: string): string => {
      const map: Record<string, string> = {
            inProgress: 'IN PROGRESS / ORDER BOOKED',
            'order-assigned': 'TECHNICIAN ASSIGNED',
            diagnosing: 'DIAGNOSING IN PROGRESS',
            quote_sent: 'QUOTE SENT',
            'start-work': 'REPAIR IN PROGRESS',
            repairing: 'REPAIR IN PROGRESS',
            'waiting-for-parts': 'WAITING FOR PARTS',
            completed: 'REPAIR COMPLETED',
            approved: 'QUOTE APPROVED',
            rejected: 'REPAIR REJECTED',
            collected: 'DEVICE COLLECTED',
            inReview: 'UNDER REVIEW',
      };
      return map[status] || status.replace(/[-_]/g, ' ').toUpperCase();
};

const buildRepairLines = (data: RepairPdfData): string[] => {
      const shopTitle = data.shopName ? data.shopName.toUpperCase() : 'IMOSCAN REPAIR SERVICES';
      const formattedDate = new Date(data.updatedAt || Date.now()).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
      });

      const lines: string[] = [
            '========================================================================================',
            `  ${shopTitle}`,
            '  DEVICE REPAIR STATUS & UPDATE REPORT',
            '========================================================================================',
            '',
            `Report Date: ${formattedDate}`,
            `Repair Request ID: #${data.requestId.toUpperCase()}`,
            '',
            '----------------------------------------------------------------------------------------',
            'CURRENT STATUS',
            '----------------------------------------------------------------------------------------',
            `Status: ${data.statusLabel || formatStatusLabel(data.status)}`,
            '',
      ];

      if (data.status === 'waiting-for-parts' || data.waitingForPartsDescription) {
            lines.push('PARTS ORDER STATUS:');
            if (data.waitingForPartsDays) {
                  lines.push(`Estimated Arrival: ${data.waitingForPartsDays} day(s)`);
            }
            if (data.waitingForPartsDescription) {
                  lines.push(`Parts Details: ${data.waitingForPartsDescription}`);
            }
            lines.push('');
      }

      if (data.statusNote) {
            lines.push(`Update Note: ${data.statusNote}`);
            lines.push('');
      }

      lines.push(
            '----------------------------------------------------------------------------------------',
            'DEVICE & CUSTOMER INFORMATION',
            '----------------------------------------------------------------------------------------',
            `Device Model:  ${data.deviceModel}`,
            `IMEI / Serial: ${data.imei || 'N/A'}`,
            `Customer Name: ${data.customerName}`,
            `Contact Email: ${data.customerEmail}`,
            `Contact Phone: ${data.customerPhone || 'N/A'}`,
            '',
            'ISSUE DESCRIPTION:',
            data.description || 'No initial issue description provided.',
            ''
      );

      if (data.technicianNotes && data.technicianNotes.length > 0) {
            lines.push(
                  '----------------------------------------------------------------------------------------',
                  'PARTS & SERVICE BREAKDOWN',
                  '----------------------------------------------------------------------------------------'
            );
            data.technicianNotes.forEach((note, idx) => {
                  lines.push(
                        `${idx + 1}. ${note.partName} - Cost: $${Number(note.cost).toFixed(2)} (Est. Time: ${note.time} hrs)`
                  );
            });
            lines.push('');
      }

      if (data.price && data.price > 0) {
            lines.push(`Total Repair Price / Estimate: $${Number(data.price).toFixed(2)}`, '');
      }

      if (data.technicianFeedback) {
            lines.push(
                  '----------------------------------------------------------------------------------------',
                  'TECHNICIAN FEEDBACK / SUMMARY',
                  '----------------------------------------------------------------------------------------',
                  data.technicianFeedback,
                  ''
            );
      }

      lines.push(
            '----------------------------------------------------------------------------------------',
            'LIVE TRACKING & VERIFICATION',
            '----------------------------------------------------------------------------------------',
            'You can view real-time live updates, timeline progress, and photos for this repair at:',
            data.trackingUrl,
            '',
            '----------------------------------------------------------------------------------------',
            `Thank you for trusting ${data.shopName || 'our repair service'} with your device.`,
            'This is an automated status update document generated by the system.',
            '========================================================================================'
      );

      return lines.flatMap((line) => wrapLine(line));
};

const createPdfBuffer = (lines: string[]): Buffer => {
      const linesPerPage = 46;
      const pages = Array.from({ length: Math.max(Math.ceil(lines.length / linesPerPage), 1) }, (_, index) =>
            lines.slice(index * linesPerPage, (index + 1) * linesPerPage)
      );
      const pageObjectIds = pages.map((_, index) => 4 + index * 2);
      const contentObjectIds = pages.map((_, index) => 5 + index * 2);
      const objects: string[] = [];

      objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
      objects[2] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
      objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

      pages.forEach((pageLines, index) => {
            const pageObjectId = pageObjectIds[index];
            const contentObjectId = contentObjectIds[index];
            const content = [
                  'BT',
                  '/F1 9.5 Tf',
                  '45 790 Td',
                  '15 TL',
                  ...pageLines.flatMap((line, lineIndex) => [
                        `(${pdfText(line)}) Tj`,
                        ...(lineIndex === pageLines.length - 1 ? [] : ['T*']),
                  ]),
                  'ET',
            ].join('\n');

            objects[pageObjectId] =
                  `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectId} 0 R >>`;
            objects[contentObjectId] =
                  `<< /Length ${Buffer.byteLength(content, 'ascii')} >>\nstream\n${content}\nendstream`;
      });

      const header = '%PDF-1.4\n';
      const chunks: Buffer[] = [Buffer.from(header, 'ascii')];
      const offsets = [0];
      let offset = Buffer.byteLength(header, 'ascii');

      for (let objectId = 1; objectId < objects.length; objectId += 1) {
            const object = `${objectId} 0 obj\n${objects[objectId]}\nendobj\n`;
            const objectBuffer = Buffer.from(object, 'ascii');
            offsets[objectId] = offset;
            chunks.push(objectBuffer);
            offset += objectBuffer.length;
      }

      const xrefOffset = offset;
      const xref = [
            `xref\n0 ${objects.length}`,
            '0000000000 65535 f ',
            ...offsets.slice(1).map((item) => `${String(item).padStart(10, '0')} 00000 n `),
            `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
      ].join('\n');
      chunks.push(Buffer.from(xref, 'ascii'));

      return Buffer.concat(chunks);
};

export const generateRepairStatusPdfBuffer = (data: RepairPdfData): Buffer => {
      const lines = buildRepairLines(data);
      return createPdfBuffer(lines);
};
