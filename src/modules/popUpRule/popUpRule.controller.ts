import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import popUpRuleService from './popUpRule.service';
import { IPopUpRule } from './popUpRule.interface';

const createRule = catchAsync(async (req: Request, res: Response) => {
      const shopkeeperId = req.user?.id as string;
      const payload: Partial<IPopUpRule> = req.body;

      const result = await popUpRuleService.createRule(shopkeeperId, payload);

      sendResponse(res, {
            statusCode: StatusCodes.CREATED,
            success: true,
            message: 'Pop-up rule created successfully',
            data: result,
      });
});

const updateRule = catchAsync(async (req: Request, res: Response) => {
      const shopkeeperId = req.user?.id as string;
      const id = req.params.id as string;
      const payload: Partial<IPopUpRule> = req.body;

      const result = await popUpRuleService.updateRule(id, payload, shopkeeperId);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Pop-up rule updated successfully',
            data: result,
      });
});

const deleteRule = catchAsync(async (req: Request, res: Response) => {
      const shopkeeperId = req.user?.id as string;
      const id = req.params.id as string;

      await popUpRuleService.deleteRule(id, shopkeeperId);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Pop-up rule deleted successfully',
            data: null,
      });
});

const getRules = catchAsync(async (req: Request, res: Response) => {
      const shopkeeperId = req.user?.id as string;
      const query = req.query;

      const result = await popUpRuleService.getRules(shopkeeperId, query);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Pop-up rules retrieved successfully',
            data: result,
      });
});

const getRuleById = catchAsync(async (req: Request, res: Response) => {
      const shopkeeperId = req.user?.id as string;
      const id = req.params.id as string;

      const result = await popUpRuleService.getRuleById(id, shopkeeperId);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Pop-up rule retrieved successfully',
            data: result,
      });
});

const getRecommendations = catchAsync(async (req: Request, res: Response) => {
      const shopkeeperId = req.user?.id as string;
      // Expecting an array of category IDs from the cart
      const { categoryIds } = req.body;

      if (!categoryIds || !Array.isArray(categoryIds)) {
            return sendResponse(res, {
                  statusCode: StatusCodes.BAD_REQUEST,
                  success: false,
                  message: 'Please provide an array of categoryIds',
                  data: [],
            });
      }

      const result = await popUpRuleService.getRecommendations(shopkeeperId, categoryIds);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Recommendations retrieved successfully',
            data: result,
      });
});

export const popUpRuleController = {
      createRule,
      updateRule,
      deleteRule,
      getRules,
      getRuleById,
      getRecommendations,
};
