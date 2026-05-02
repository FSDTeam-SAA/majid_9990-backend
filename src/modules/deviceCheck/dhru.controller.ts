import { Request, Response, NextFunction } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import XLSX from 'xlsx';
import { dhruService } from './dhru.service';
import { getExistingScanInfoByImei, isValidImei, resolveServiceId, runImeiCheck } from './deviceCheck.helpers';

type SingleImeiCheckResult =
      | {
              ok: true;
              message: string;
              data: Record<string, unknown>;
        }
      | {
              ok: false;
              statusCode: number;
              message: string;
              data?: unknown;
        };

type BatchImeiItemResult = {
      rowNumber: number;
      imei: string;
      ok: boolean;
      message: string;
      cached?: boolean;
      serviceId?: number;
      provider?: string;
      data?: unknown;
};

const normalizeImei = (value: unknown) => {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            return String(value).split(/\s+/g).join('').trim();
      }

      return '';
};

const safeDeleteFile = async (filePath?: string) => {
      if (!filePath) {
            return;
      }

      try {
            await fs.unlink(filePath);
      } catch {
            // ignore cleanup errors
      }
};

const processSingleImeiCheck = async (imei: string, serviceId: number, shouldGenerateFresh: boolean): Promise<SingleImeiCheckResult> => {
      if (!imei || !isValidImei(imei)) {
            return {
                  ok: false,
                  statusCode: 400,
                  message: 'Valid 15-digit imei is required',
            };
      }

      const existingScanInfo = shouldGenerateFresh ? null : await getExistingScanInfoByImei(imei);

      if (existingScanInfo) {
            return {
                  ok: true,
                  message: 'IMEI data fetched from database',
                  data: {
                        ...existingScanInfo,
                        oldGenerated: true,
                  },
            };
      }

      if (!Number.isFinite(serviceId) || serviceId <= 0) {
            return {
                  ok: false,
                  statusCode: 400,
                  message: 'Valid serviceId is required',
            };
      }

      const result = await runImeiCheck(String(imei), serviceId);

      if (!result.ok) {
            return {
                  ok: false,
                  statusCode: result.statusCode,
                  message: result.message,
                  data: result.data,
            };
      }

      return {
            ok: true,
            message: shouldGenerateFresh ? `IMEI check regenerated (${result.provider})` : `IMEI check completed (${result.provider})`,
            data: {
                  ...result.structured,
                  providerData: result.providerData,
                  oldGenerated: false,
            },
      };
};

const extractImeisFromWorkbook = (filePath: string) => {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];

      if (!sheetName) {
            return [] as string[];
      }

      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Array<string | number | null | undefined>>(sheet, {
            header: 1,
            blankrows: false,
            defval: '',
      });

      if (!rows.length) {
            return [] as string[];
      }

      const firstRow = rows[0].map((cell) => normalizeImei(cell).toLowerCase());
      const headerLooksLikeImeiColumn = firstRow.some((cell) => cell === 'imei' || cell.includes('imei'));
      const imeiColumnIndex = headerLooksLikeImeiColumn ? Math.max(firstRow.findIndex((cell) => cell === 'imei' || cell.includes('imei')), 0) : 0;
      const dataRows = headerLooksLikeImeiColumn ? rows.slice(1) : rows;

      return dataRows
            .map((row) => normalizeImei(row?.[imeiColumnIndex] ?? row?.[0]))
            .filter((imei) => imei.length > 0);
};

export const checkImeiFromDhru = async (req: Request, res: Response, next: NextFunction) => {
      try {
            const imei = String(req.body?.imei ?? '').trim();
            const shouldGenerateFresh =
                  String(req.body?.genarate ?? req.body?.generate ?? '')
                        .trim()
                        .toLowerCase() === 'new';
            const requestedServiceId = resolveServiceId(req.body?.serviceId);

            const result = await processSingleImeiCheck(imei, requestedServiceId, shouldGenerateFresh);

            if (!result.ok) {
                  return res.status(400).json({
                        success: false,
                        message: result.message,
                        data: result.data,
                  });
            }

            return res.status(200).json({
                  success: true,
                  message: result.message,
                  data: result.data,
            });
      } catch (error) {
            next(error);
      }
};

export const checkImeisFromFile = async (req: Request, res: Response, next: NextFunction) => {
      const file = req.file;
      const shouldGenerateFresh = String(req.body?.genarate ?? req.body?.generate ?? '').trim().toLowerCase() === 'new';
      const requestedServiceId = resolveServiceId(req.body?.serviceId);

      try {
            if (!file) {
                  return res.status(400).json({
                        success: false,
                        message: 'A csv or excel file is required',
                  });
            }

            const extension = path.extname(file.originalname).toLowerCase();

            if (!['.csv', '.xls', '.xlsx'].includes(extension)) {
                  return res.status(400).json({
                        success: false,
                        message: 'Only csv, xls, or xlsx files are supported',
                  });
            }

            const imeis = extractImeisFromWorkbook(file.path).map((imei) => normalizeImei(imei)).filter((imei) => imei.length > 0);

            if (!imeis.length) {
                  return res.status(400).json({
                        success: false,
                        message: 'No IMEI values were found in the file',
                  });
            }

            if (imeis.length > 20) {
                  return res.status(400).json({
                        success: false,
                        message: 'The file can contain at most 20 IMEI values',
                  });
            }

            const results: BatchImeiItemResult[] = [];

            for (let index = 0; index < imeis.length; index += 1) {
                  const imei = imeis[index];
                  const singleResult = await processSingleImeiCheck(imei, requestedServiceId, shouldGenerateFresh);

                  if (singleResult.ok) {
                        results.push({
                              rowNumber: index + 1,
                              imei,
                              ok: true,
                              message: singleResult.message,
                              cached: String(singleResult.message).toLowerCase().includes('database'),
                              serviceId: requestedServiceId,
                              data: singleResult.data,
                        });
                        continue;
                  }

                  results.push({
                        rowNumber: index + 1,
                        imei,
                        ok: false,
                        message: singleResult.message,
                        serviceId: requestedServiceId,
                        data: singleResult.data,
                  });
            }

            const successCount = results.filter((item) => item.ok).length;
            const failedCount = results.length - successCount;

            return res.status(200).json({
                  success: true,
                  message: `Processed ${results.length} IMEI value${results.length === 1 ? '' : 's'}`,
                  summary: {
                        total: results.length,
                        successCount,
                        failedCount,
                        sourceFile: file.originalname,
                  },
                  data: results,
            });
      } catch (error) {
            next(error);
      } finally {
            await safeDeleteFile(file?.path);
      }
};

export const getServices = async (_req: Request, res: Response) => {
      const result = await dhruService.getImeiServices();
      return res.json({
            success: true,
            data: result,
      });
};
