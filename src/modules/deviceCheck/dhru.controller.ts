import { Request, Response, NextFunction } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import XLSX from 'xlsx';
import AppError from '../../errors/AppError';
import { ImeiServiceCatalog } from './imeiService.model';
import { curatedDhruServices, normalizeServiceName } from './dhru.services.catalog';
import { dhruService } from './dhru.service';
import { getExistingScanInfoByImei, isValidImei, resolveServiceId, runImeiCheck } from './deviceCheck.helpers';
import { creditUserBalance, debitUserBalance } from '../payment/balanceTransaction.service';

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

type UpstreamService = {
      serviceId: number;
      name: string;
      price?: string;
};

const extractUpstreamServices = (response: unknown): UpstreamService[] => {
      const payload = response as Record<string, any>;
      const candidates =
            payload?.data?.['Service List'] ??
            payload?.data?.services ??
            payload?.data?.SERVICE_LIST ??
            payload?.data?.['service list'] ??
            payload?.services ??
            payload?.SERVICE_LIST ??
            payload?.['Service List'] ??
            payload;

      if (!Array.isArray(candidates)) {
            return [];
      }

      return candidates
            .map((item: any) => ({
                  serviceId: Number(item?.service ?? item?.serviceId ?? item?.serviceid ?? item?.id),
                  name: String(item?.name ?? item?.serviceName ?? item?.SERVICE_NAME ?? '').trim(),
                  price: String(item?.price ?? item?.PRICE ?? '').trim(),
            }))
            .filter((item) => Number.isFinite(item.serviceId) && item.serviceId > 0 && item.name.length > 0);
};

const formatPriceLabel = (price: string) => (price.toUpperCase() === 'FREE' ? 'FREE' : `${price}$`);

export const resolveServicePrice = (service: { price: string; isFree: boolean }) => {
      if (service.isFree || service.price.toUpperCase() === 'FREE') {
            return 0;
      }

      const parsedPrice = Number(service.price);

      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
            throw new AppError('Invalid service price', 500);
      }

      return Number(parsedPrice.toFixed(3));
};

export const findServiceByServiceId = async (serviceId: number) => {
      return await ImeiServiceCatalog.findOne({
            $or: [{ serviceId }, { serviceIds: serviceId }],
      }).lean();
};

const groupByCategory = <T extends { category: string }>(items: T[]) => {
      const groups = new Map<string, T[]>();

      for (const item of items) {
            const existing = groups.get(item.category) ?? [];
            existing.push(item);
            groups.set(item.category, existing);
      }

      return Array.from(groups.entries()).map(([category, services]) => ({ category, services }));
};

const syncCuratedServices = async (upstreamServices: UpstreamService[]) => {
      const upstreamLookup = new Map<string, UpstreamService[]>();

      for (const service of upstreamServices) {
            const key = normalizeServiceName(service.name);
            const existing = upstreamLookup.get(key) ?? [];
            existing.push(service);
            upstreamLookup.set(key, existing);
      }

      const catalogDocuments = curatedDhruServices.map((service) => {
            const normalizedName = normalizeServiceName(service.name);
            const matches = upstreamLookup.get(normalizedName) ?? [];
            const serviceIds = Array.from(new Set(matches.map((item) => item.serviceId)));
            const sourceNames = Array.from(new Set(matches.map((item) => item.name)));

            return {
                  category: service.category,
                  name: service.name,
                  normalizedName,
                  price: service.price,
                  currency: 'USD',
                  isFree: service.price.toUpperCase() === 'FREE',
                  serviceId: serviceIds[0] ?? null,
                  serviceIds,
                  sourceNames,
            };
      });

      if (catalogDocuments.length) {
            await ImeiServiceCatalog.bulkWrite(
                  catalogDocuments.map((document) => ({
                        updateOne: {
                              filter: { normalizedName: document.normalizedName },
                              update: { $set: document },
                              upsert: true,
                        },
                  }))
            );
      }

      return groupByCategory(
            catalogDocuments.map((document) => ({
                  ...document,
                  priceLabel: formatPriceLabel(document.price),
            }))
      );
};

const readStoredServices = async () => {
      const storedServices = await ImeiServiceCatalog.find().sort({ category: 1, name: 1 }).lean();

      return groupByCategory(
            storedServices.map((document) => ({
                  ...document,
                  priceLabel: formatPriceLabel(document.price),
            }))
      );
};

const processSingleImeiCheck = async (
      userId: string,
      imei: string,
      serviceId: number,
      shouldGenerateFresh: boolean
): Promise<SingleImeiCheckResult> => {
      if (!imei || !isValidImei(imei)) {
            return {
                  ok: false,
                  statusCode: 400,
                  message: 'Valid 15-digit imei is required',
            };
      }

      if (!Number.isFinite(serviceId) || serviceId <= 0) {
            return {
                  ok: false,
                  statusCode: 400,
                  message: 'Valid serviceId is required',
            };
      }

      const service = await findServiceByServiceId(serviceId);

      if (!service) {
            return {
                  ok: false,
                  statusCode: 404,
                  message: 'Service not found in the catalog',
            };
      }

      const servicePrice = resolveServicePrice(service);
      const shouldCharge = servicePrice > 0;

      if (shouldCharge) {
            try {
                  await debitUserBalance({
                        userId,
                        amount: servicePrice,
                        currency: service.currency ?? 'USD',
                        source: 'imei_service',
                        description: `IMEI service charge for ${service.name}`,
                        serviceId,
                        serviceName: service.name,
                        imei,
                        metadata: {
                              normalizedName: service.normalizedName,
                        },
                  });
            } catch (error) {
                  if (error instanceof AppError) {
                        return {
                              ok: false,
                              statusCode: error.statusCode || 400,
                              message: error.message,
                        };
                  }

                  throw error;
            }
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

      const result = await runImeiCheck(String(imei), serviceId);

      if (!result.ok) {
            if (shouldCharge) {
                  await creditUserBalance({
                        userId,
                        amount: servicePrice,
                        currency: service.currency ?? 'USD',
                        source: 'refund',
                        description: `Refund for failed IMEI service ${service.name}`,
                        serviceId,
                        serviceName: service.name,
                        imei,
                        metadata: {
                              normalizedName: service.normalizedName,
                              reason: result.message,
                        },
                  }).catch(() => undefined);
            }

            return {
                  ok: false,
                  statusCode: result.statusCode,
                  message: result.message,
                  data: result.data,
            };
      }

      return {
            ok: true,
            message: shouldGenerateFresh
                  ? `IMEI check regenerated (${result.provider})`
                  : `IMEI check completed (${result.provider})`,
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
      const imeiColumnIndex = headerLooksLikeImeiColumn
            ? Math.max(
                    firstRow.findIndex((cell) => cell === 'imei' || cell.includes('imei')),
                    0
              )
            : 0;
      const dataRows = headerLooksLikeImeiColumn ? rows.slice(1) : rows;

      return dataRows.map((row) => normalizeImei(row?.[imeiColumnIndex] ?? row?.[0])).filter((imei) => imei.length > 0);
};

export const checkImeiFromDhru = async (req: Request, res: Response, next: NextFunction) => {
      try {
            const userId = req.user._id;
            const imei = String(req.body?.imei ?? '').trim();
            const shouldGenerateFresh =
                  String(req.body?.genarate ?? req.body?.generate ?? '')
                        .trim()
                        .toLowerCase() === 'new';
            const requestedServiceId = resolveServiceId(req.body?.serviceId);

            const result = await processSingleImeiCheck(userId, imei, requestedServiceId, shouldGenerateFresh);

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
      const userId = req.user._id;
      const shouldGenerateFresh =
            String(req.body?.genarate ?? req.body?.generate ?? '')
                  .trim()
                  .toLowerCase() === 'new';
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

            const imeis = extractImeisFromWorkbook(file.path)
                  .map((imei) => normalizeImei(imei))
                  .filter((imei) => imei.length > 0);

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
                  const singleResult = await processSingleImeiCheck(
                        userId,
                        imei,
                        requestedServiceId,
                        shouldGenerateFresh
                  );

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

export const syncServices = async (_req: Request, res: Response) => {
      const result = await dhruService.getImeiServices();
      const upstreamServices = extractUpstreamServices(result);
      const services = await syncCuratedServices(upstreamServices);

      return res.json({
            success: true,
            message: 'IMEI services synced successfully',
            data: services,
            meta: {
                  totalServices: services.reduce((count, group) => count + group.services.length, 0),
                  totalCategories: services.length,
            },
      });
};

export const getServices = async (_req: Request, res: Response) => {
      const services = await readStoredServices();

      return res.json({
            success: true,
            data: services,
            meta: {
                  totalServices: services.reduce((count, group) => count + group.services.length, 0),
                  totalCategories: services.length,
            },
      });
};
