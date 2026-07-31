import fs from 'node:fs/promises';
import path from 'node:path';

type ScanReport = Record<string, any>;

const REPORTS_DIRECTORY = path.resolve(__dirname, '../../../uploads', 'imei-reports');

const asText = (value: unknown) => {
      if (value === null || value === undefined || value === '') return 'N/A';
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);

      try {
            return JSON.stringify(value);
      } catch {
            return String(value);
      }
};

const pdfText = (value: unknown) =>
      asText(value)
            .replace(/[^\x20-\x7E]/g, '?')
            .replace(/\\/g, '\\\\')
            .replace(/\(/g, '\\(')
            .replace(/\)/g, '\\)');

const wrapLine = (line: string, maxLength = 94) => {
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

const buildReportLines = (report: ScanReport) => {
      const lines = [
            'IMOSCAN DEVICE REPORT',
            `Report ID: ${asText(report._id)}`,
            `Generated: ${new Date(report.createdAt ?? Date.now()).toISOString()}`,
            '',
            'DEVICE SUMMARY',
            `Device: ${asText(report.deviceName)}`,
            `IMEI / Serial: ${asText(report.imei)}`,
            `Status: ${asText(report.deviceStatus)}`,
            `Risk: ${asText(report.riskMeter?.label)} (${asText(report.riskMeter?.score)}/100)`,
            `Market value: ${asText(report.marketValue?.currency)} ${asText(report.marketValue?.amount)}`,
            '',
            'AI INSIGHT',
            `${asText(report.aiInsight?.title)}: ${asText(report.aiInsight?.message)}`,
            '',
            'VERIFICATION CHECKS',
      ];

      for (const check of Object.values(report.checks ?? {}) as ScanReport[]) {
            lines.push(`${asText(check?.title)}: ${asText(check?.description)} (${asText(check?.status)})`);
      }

      const providerFields = report.parsedProviderData ?? report.providerData ?? {};
      const entries = Object.entries(providerFields as ScanReport);

      if (entries.length) {
            lines.push('', 'DEVICE DETAILS');
            for (const [label, value] of entries) {
                  lines.push(`${label.replace(/_/g, ' ')}: ${asText(value)}`);
            }
      }

      return lines.flatMap((line) => wrapLine(line));
};

const createPdfBuffer = (lines: string[]) => {
      const linesPerPage = 48;
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
                  '/F1 10 Tf',
                  '50 790 Td',
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

export const getSavedScanReportPdfPath = (reportId: string) => path.join(REPORTS_DIRECTORY, `${reportId}.pdf`);

export const ensureSavedScanReportPdf = async (report: ScanReport) => {
      const reportId = String(report._id ?? '').trim();
      if (!reportId) {
            throw new Error('Cannot save a PDF without a scan report id');
      }
      const pdfPath = getSavedScanReportPdfPath(reportId);

      await fs.mkdir(REPORTS_DIRECTORY, { recursive: true });

      try {
            await fs.access(pdfPath);
      } catch {
            await fs.writeFile(pdfPath, createPdfBuffer(buildReportLines(report)));
      }

      return pdfPath;
};
