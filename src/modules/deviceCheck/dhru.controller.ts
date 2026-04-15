import { Request, Response, NextFunction } from 'express';
import { dhruService } from './dhru.service';

const DEFAULT_SERVICE_ID = 123; // replace with your real DHRU serviceId

const isValidImei = (imei: string) => /^\d{15}$/.test(imei);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const checkImeiFromDhru = async (req: Request, res: Response, next: NextFunction) => {
      try {
            const { imei } = req.body;

            if (!imei || !isValidImei(String(imei))) {
                  return res.status(400).json({
                        success: false,
                        message: 'Valid 15-digit imei is required',
                  });
            }

            // Step 1: Place order
            const placeOrderResponse = await dhruService.placeImeiOrder(DEFAULT_SERVICE_ID, String(imei));

            const orderId =
                  placeOrderResponse?.SUCCESS?.[0]?.REFERENCEID ||
                  placeOrderResponse?.SUCCESS?.[0]?.ID ||
                  placeOrderResponse?.SUCCESS?.[0]?.ORDERID;

            if (!orderId) {
                  return res.status(500).json({
                        success: false,
                        message: 'Order placed but order id not found',
                        data: placeOrderResponse,
                  });
            }

            // Step 2: Poll for result
            let finalResult: any = null;

            for (let i = 0; i < 5; i++) {
                  await sleep(2000);

                  const result = await dhruService.getImeiOrder(orderId);

                  const resultText = JSON.stringify(result).toLowerCase();

                  if (
                        resultText.includes('completed') ||
                        resultText.includes('success') ||
                        resultText.includes('done')
                  ) {
                        finalResult = result;
                        break;
                  }

                  finalResult = result;
            }

            return res.status(200).json({
                  success: true,
                  message: 'IMEI check completed',
                  data: finalResult,
            });
      } catch (error) {
            next(error);
      }
};
