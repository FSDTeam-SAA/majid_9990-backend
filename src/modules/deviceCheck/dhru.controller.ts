import { Request, Response, NextFunction } from 'express';
import { resolveServiceId } from './deviceCheck.helpers';
import {
      checkImeisBatchService,
      getCheckHistoryReportPdfService,
      getCheckHistoryReportService,
      getRecentChecksHistoryService,
      getServicesService,
      processImeiCheckV1Service,
      processImeiCheckV2Service,
      saveCheckHistoryReportPdfService,
      syncServicesService,
      resolveServicePrice,
      findServiceByServiceId,
} from './dhru.service';

export { resolveServicePrice, findServiceByServiceId };

//! Multiple and single IMEI check (V1)
export const checkImeiFromDhru = async (req: Request, res: Response, next: NextFunction) => {
      try {
            const userId = req.user._id;
            const shopId = String(req.query?.shopId ?? req.body?.shopId ?? '').trim() || undefined;

            const imeiInput = req.body?.imei;
            const imeiList: string[] = Array.isArray(imeiInput)
                  ? imeiInput.map((i: string) => String(i).trim()).filter(Boolean)
                  : [String(imeiInput ?? '').trim()].filter(Boolean);

            if (!imeiList.length) {
                  return res.status(400).json({
                        success: false,
                        message: 'IMEI is required',
                  });
            }

            const requestedServiceId = resolveServiceId(req.body?.serviceId);
            const shouldGenerateFresh =
                  String(req.body?.genarate ?? req.body?.generate ?? '')
                        .trim()
                        .toLowerCase() === 'new';

            const results = await processImeiCheckV1Service(
                  userId,
                  imeiList,
                  requestedServiceId,
                  shouldGenerateFresh,
                  shopId
            );

            return res.status(200).json({
                  success: true,
                  message: 'IMEI check completed',
                  data: results,
            });
      } catch (error) {
            next(error);
      }
};

//! IMEI check with AI risk/price enrichment (V2)
export const checkImeiFromDhruV2 = async (req: Request, res: Response, next: NextFunction) => {
      try {
            const userId = req.user?._id?.toString();
            const shopId = String(req.query?.shopId ?? req.body?.shopId ?? '').trim() || undefined;

            const imeiInput = req.body?.imei;
            const imeiList: string[] = Array.isArray(imeiInput)
                  ? imeiInput.map((i: string) => String(i).trim()).filter(Boolean)
                  : [String(imeiInput ?? '').trim()].filter(Boolean);

            if (!imeiList.length) {
                  return res.status(400).json({
                        success: false,
                        message: 'IMEI is required',
                  });
            }

            const requestedServiceId = resolveServiceId(req.body?.serviceId);
            const shouldGenerateFresh =
                  String(req.body?.genarate ?? req.body?.generate ?? '')
                        .trim()
                        .toLowerCase() === 'new';

            const results = await processImeiCheckV2Service(
                  userId,
                  imeiList,
                  requestedServiceId,
                  shouldGenerateFresh,
                  shopId
            );

            return res.status(200).json({
                  success: true,
                  message: 'IMEI check (v2) completed',
                  data: results,
            });
      } catch (error) {
            next(error);
      }
};

//! Batch IMEI check from uploaded file
export const checkImeisFromFile = async (req: Request, res: Response, next: NextFunction) => {
      const file = req.file;
      const userId = req.user._id;
      const shopId = String(req.query?.shopId ?? req.body?.shopId ?? '').trim() || undefined;
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

            const { results, summary } = await checkImeisBatchService(
                  file,
                  userId,
                  requestedServiceId,
                  shouldGenerateFresh,
                  shopId
            );

            return res.status(200).json({
                  success: true,
                  message: `Processed ${results.length} IMEI value${results.length === 1 ? '' : 's'}`,
                  summary,
                  data: results,
            });
      } catch (error) {
            next(error);
      }
};

export const syncServices = async (_req: Request, res: Response, next: NextFunction) => {
      try {
            const { services, totalServices, totalCategories } = await syncServicesService();

            return res.json({
                  success: true,
                  message: 'IMEI services synced successfully',
                  data: services,
                  meta: {
                        totalServices,
                        totalCategories,
                  },
            });
      } catch (error) {
            next(error);
      }
};

export const getServices = async (_req: Request, res: Response, next: NextFunction) => {
      try {
            const { services, totalServices, totalCategories } = await getServicesService();

            return res.json({
                  success: true,
                  data: services,
                  meta: {
                        totalServices,
                        totalCategories,
                  },
            });
      } catch (error) {
            next(error);
      }
};

export const getRecentChecksHistory = async (req: Request, res: Response, next: NextFunction) => {
      try {
            const pageQuery = Number(req.query.page ?? 1);
            const limitQuery = Number(req.query.limit ?? 10);
            const shopId = String(req.query?.shopId ?? req.body?.shopId ?? '').trim();

            const { history, meta } = await getRecentChecksHistoryService(
                  req.user?._id?.toString(),
                  shopId,
                  pageQuery,
                  limitQuery
            );

            return res.status(200).json({
                  success: true,
                  message: 'Recent checks fetched successfully',
                  data: history,
                  meta,
            });
      } catch (error) {
            next(error);
      }
};

export const getCheckHistoryReport = async (req: Request, res: Response, next: NextFunction) => {
      try {
            const reportId = String(req.params.reportId ?? '').trim();

            if (!reportId) {
                  return res.status(400).json({
                        success: false,
                        message: 'Report id is required',
                  });
            }

            const report = await getCheckHistoryReportService(reportId, req.user._id);

            if (!report) {
                  return res.status(404).json({
                        success: false,
                        message: 'Saved IMEI report not found',
                  });
            }

            return res.status(200).json({
                  success: true,
                  message: 'Saved IMEI report fetched successfully',
                  data: report,
            });
      } catch (error) {
            next(error);
      }
};

export const saveCheckHistoryReportPdf = async (req: Request, res: Response, next: NextFunction) => {
      const file = req.file;

      try {
            if (!file || file.mimetype !== 'application/pdf') {
                  return res.status(400).json({
                        success: false,
                        message: 'A PDF report file is required',
                  });
            }

            const reportId = String(req.params.reportId ?? '').trim();
            const { pdfCertificateUrl } = await saveCheckHistoryReportPdfService(
                  reportId,
                  req.user._id,
                  file
            );

            return res.status(200).json({
                  success: true,
                  message: 'Report PDF saved successfully',
                  data: { pdfCertificateUrl },
            });
      } catch (error) {
            next(error);
      }
};

export const getCheckHistoryReportPdf = async (req: Request, res: Response, next: NextFunction) => {
      try {
            const reportId = String(req.params.reportId ?? '').trim();
            const { pdfPath, filename } = await getCheckHistoryReportPdfService(reportId, req.user._id);

            res.type('application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
            return res.sendFile(pdfPath);
      } catch (error) {
            next(error);
      }
};
