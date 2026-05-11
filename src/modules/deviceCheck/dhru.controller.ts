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
import ScanInfo from './scanInfo.model';
import locationService from '../location/location.service';

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

const processMultipleServiceCheck = async (
      userId: string,
      imei: string,
      service: any,
      serviceIds: number[],
      shouldGenerateFresh: boolean,
      shouldCharge: boolean,
      servicePrice: number
): Promise<SingleImeiCheckResult> => {
      type BundledCheckResult = {
            serviceId: number;
            ok: boolean;
            cached: boolean;
            provider?: string;
            message?: string;
            statusCode?: number;
            data?: unknown;
            providerData?: unknown;
      };

      try {
            // Run IMEI checks against all serviceIds in parallel
            const checkResults: BundledCheckResult[] = await Promise.all(
                  serviceIds.map(async (svcId) => {
                        const existingScanInfo = shouldGenerateFresh
                              ? null
                              : await getExistingScanInfoByImei(imei, svcId);

                        if (existingScanInfo) {
                              return {
                                    serviceId: svcId,
                                    ok: true,
                                    cached: true,
                                    data: existingScanInfo,
                              };
                        }

                        const result = await runImeiCheck(String(imei), svcId, userId);
                        return {
                              serviceId: svcId,
                              ok: result.ok,
                              cached: false,
                              provider: result.ok ? result.provider : undefined,
                              message: result.ok ? undefined : result.message,
                              statusCode: result.ok ? undefined : result.statusCode,
                              data: result.ok ? result.structured : result.data,
                              providerData: result.ok ? result.providerData : undefined,
                        };
                  })
            );

            console.log('processMultipleServiceCheck results:', checkResults);

            // Check if all checks failed
            const allFailed = checkResults.every((r) => !r.ok);
            if (allFailed) {
                  if (shouldCharge) {
                        await creditUserBalance({
                              userId,
                              amount: servicePrice,
                              currency: service.currency ?? 'USD',
                              source: 'refund',
                              description: `Refund for failed bundled IMEI service ${service.name}`,
                              serviceId: service.serviceId,
                              serviceName: service.name,
                              imei,
                              metadata: {
                                    normalizedName: service.normalizedName,
                                    reason: 'All bundled checks failed',
                                    bundledServiceIds: serviceIds,
                              },
                        }).catch(() => undefined);
                  }

                  return {
                        ok: false,
                        statusCode: 400,
                        message: 'All bundled IMEI checks failed',
                        data: {
                              bundledServiceId: service.serviceId,
                              serviceName: service.name,
                              results: checkResults.map((r) => ({
                                    serviceId: r.serviceId,
                                    ok: r.ok,
                                    message: r.message,
                              })),
                        },
                  };
            }

            const successfulResults = checkResults.filter((r) => r.ok);
            const normalizedResults = successfulResults.map((result) => {
                  const structuredData = (result.data && typeof result.data === 'object' ? result.data : {}) as Record<
                        string,
                        any
                  >;
                  const providerData = result.cached
                        ? (structuredData.providerData ?? null)
                        : (result.providerData ?? null);

                  return {
                        serviceId: result.serviceId,
                        cached: result.cached,
                        provider: result.provider ?? null,
                        providerData,
                        aiInsight: structuredData.aiInsight ?? null,
                        riskAnalysis: structuredData.riskMeter ?? null,
                        data: structuredData,
                  };
            });

            const primaryResult = normalizedResults[0] ?? null;
            const mergedProviderData = (() => {
                  const keyValues = new Map<string, Set<any>>();

                  for (const item of normalizedResults) {
                        const pd = item.providerData as Record<string, any> | null;
                        if (!pd || typeof pd !== 'object') continue;

                        for (const [k, v] of Object.entries(pd)) {
                              if (!keyValues.has(k)) keyValues.set(k, new Set());
                              try {
                                    keyValues.get(k)!.add(v);
                              } catch {
                                    keyValues.get(k)!.add(String(v));
                              }
                        }
                  }

                  const merged: Record<string, any> = {};

                  for (const [k, values] of keyValues.entries()) {
                        const list = Array.from(values).filter((x) => x !== undefined && x !== null);
                        if (!list.length) continue;

                        if (k === 'result') {
                              // concatenate unique result strings
                              const uniq = Array.from(new Set(list.map(String)));
                              merged.result = uniq.join('\n\n');
                              continue;
                        }

                        if (list.length === 1) {
                              merged[k] = list[0];
                        } else {
                              merged[k] = Array.from(
                                    new Set(list.map((v) => (typeof v === 'object' ? JSON.stringify(v) : v)))
                              ).map((v) => {
                                    try {
                                          return JSON.parse(String(v));
                                    } catch {
                                          return v;
                                    }
                              });
                        }
                  }

                  return merged;
            })();

            const mergedAiInsights = normalizedResults
                  .map((item) => item.aiInsight)
                  .filter((item): item is Record<string, unknown> => Boolean(item));

            const mergedRiskAnalyses = normalizedResults
                  .map((item) => item.riskAnalysis)
                  .filter((item): item is Record<string, unknown> => Boolean(item));

            const mergedData: Record<string, any> = {
                  bundledServiceId: service.serviceId,
                  bundledServiceName: service.name,
                  bundledServiceCategory: service.category,
                  totalChecks: checkResults.length,
                  successfulChecks: successfulResults.length,
                  failedChecks: checkResults.length - successfulResults.length,
                  oldGenerated: successfulResults.every((r) => r.cached),
                  providerData: mergedProviderData,
                  providerServices: normalizedResults.map((item) => ({
                        serviceId: item.serviceId,
                        cached: item.cached,
                        provider: item.provider,
                        data: item.providerData,
                  })),
                  aiInsight: {
                        ...(primaryResult?.aiInsight ?? {}),
                        services: mergedAiInsights,
                  },
                  riskAnalysis: {
                        ...(primaryResult?.riskAnalysis ?? {}),
                        services: mergedRiskAnalyses,
                  },
            };

            return {
                  ok: true,
                  message: `Bundled IMEI check completed (${successfulResults.length}/${checkResults.length} services)`,
                  data: mergedData,
            };
      } catch (error) {
            if (shouldCharge) {
                  await creditUserBalance({
                        userId,
                        amount: servicePrice,
                        currency: service.currency ?? 'USD',
                        source: 'refund',
                        description: `Refund for failed bundled IMEI service ${service.name}`,
                        serviceId: service.serviceId,
                        serviceName: service.name,
                        imei,
                        metadata: {
                              normalizedName: service.normalizedName,
                              reason: error instanceof Error ? error.message : 'Unknown error',
                              bundledServiceIds: serviceIds,
                        },
                  }).catch(() => undefined);
            }

            throw error;
      }
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

      // Check if this is a custom bundled service with multiple serviceIds
      const hasMultipleServices = Array.isArray(service.serviceIds) && service.serviceIds.length > 1;

      if (hasMultipleServices) {
            return await processMultipleServiceCheck(
                  userId,
                  imei,
                  service,
                  service.serviceIds,
                  shouldGenerateFresh,
                  shouldCharge,
                  servicePrice
            );
      }

      const existingScanInfo = shouldGenerateFresh ? null : await getExistingScanInfoByImei(imei, serviceId);

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

      const result = await runImeiCheck(String(imei), serviceId, userId);
      console.log('runImeiCheck', result);

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

// export const checkImeiFromDhru = async (req: Request, res: Response, next: NextFunction) => {
//

//! this is for multiple imei check also single imei check
export const checkImeiFromDhru = async (req: Request, res: Response, next: NextFunction) => {
      try {
            const userId = req.user._id;

            // ===== IMEI NORMALIZATION =====
            const imeiInput = req.body?.imei;

            const imeiList: string[] = Array.isArray(imeiInput)
                  ? imeiInput.map((i: string) => String(i).trim()).filter(Boolean)
                  : [String(imeiInput ?? '').trim()].filter(Boolean);

            // ===== VALIDATION =====
            if (!imeiList.length) {
                  return res.status(400).json({
                        success: false,
                        message: 'IMEI is required',
                  });
            }

            // ===== SERVICE ID =====
            const requestedServiceId = resolveServiceId(req.body?.serviceId);

            // ===== GENERATE FLAG =====
            const shouldGenerateFresh =
                  String(req.body?.genarate ?? req.body?.generate ?? '')
                        .trim()
                        .toLowerCase() === 'new';

            // ===== PROCESS ALL IMEIs IN PARALLEL =====
            const results = await Promise.all(
                  imeiList.map(async (imei) => {
                        const result = await processSingleImeiCheck(
                              userId,
                              imei,
                              requestedServiceId,
                              shouldGenerateFresh
                        );

                        return {
                              imei,
                              ...result,
                        };
                  })
            );

            // ===== RESPONSE =====
            return res.status(200).json({
                  success: true,
                  message: 'IMEI check completed',
                  data: results,
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
      const clientIp = locationService.parseIp(_req);
      const currencyCode = await locationService.getCurrencyCodeForIp(clientIp || '');
      const exchangeRate = await locationService.getUsdToCurrencyRate(currencyCode);
      const services = await readStoredServices();

      const convertedServices = services.map((group) => ({
            ...group,
            services: group.services.map((service) => {
                  const basePrice = Number(service.price);
                  const isFree = String(service.price).toUpperCase() === 'FREE' || basePrice === 0;
                  const convertedPrice = isFree ? 0 : locationService.convertUsdAmount(basePrice, exchangeRate);

                  return {
                        ...service,
                        price: convertedPrice,
                        currency: currencyCode,
                        baseCurrency: 'USD',
                        priceLabel: isFree ? 'FREE' : `${convertedPrice} ${currencyCode}`,
                  };
            }),
      }));

      return res.json({
            success: true,
            data: convertedServices,
            meta: {
                  totalServices: convertedServices.reduce((count, group) => count + group.services.length, 0),
                  totalCategories: convertedServices.length,
                  currency: currencyCode,
            },
      });
};

export const getRecentChecksHistory = async (req: Request, res: Response, next: NextFunction) => {
      try {
            const pageQuery = Number(req.query.page ?? 1);
            const limitQuery = Number(req.query.limit ?? 10);
            const page = Number.isFinite(pageQuery) && pageQuery > 0 ? Math.floor(pageQuery) : 1;
            const limit = Number.isFinite(limitQuery) && limitQuery > 0 ? Math.min(Math.floor(limitQuery), 50) : 10;
            const skip = (page - 1) * limit;

            const filter = req.user?._id ? { userId: req.user._id } : {};

            const [history, total] = await Promise.all([
                  ScanInfo.find(filter)
                        .select('userId deviceName imei deviceStatus riskMeter marketValue createdAt updatedAt')
                        .sort({ updatedAt: -1 })
                        .skip(skip)
                        .limit(limit)
                        .lean(),
                  ScanInfo.countDocuments(filter),
            ]);

            return res.status(200).json({
                  success: true,
                  message: 'Recent checks fetched successfully',
                  data: history,
                  meta: {
                        page,
                        limit,
                        total,
                        totalPage: Math.ceil(total / limit) || 1,
                  },
            });
      } catch (error) {
            next(error);
      }
};
