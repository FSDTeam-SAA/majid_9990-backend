import { StatusCodes } from 'http-status-codes';
import { FilterQuery, Types } from 'mongoose';
import AppError from '../../errors/AppError';
import { Invoice } from '../invoice/invoice.model';
import { Inventory } from '../inventory/inventory.model';

interface IDashboardStats {
      // Existing stats
      totalSales: number;
      totalProfit: number;
      totalOrders: number;
      avgOrderValue: number;
      salesGrowth: number;
      profitGrowth: number;
      ordersGrowth: number;
      avgOrderGrowth: number;

      // Business Health Score
      businessHealthScore: {
            overall: number;
            rating: 'Excellent' | 'Good' | 'Fair' | 'Needs Improvement' | 'Critical';
            benchmark: number;
            message: string;
      };

      // Individual metrics
      metrics: {
            salesGrowth: { score: number; status: string };
            profitMargin: { score: number; status: string };
            stockManagement: { score: number; status: string };
            customerSatisfaction: { score: number; status: string };
            outstandingPayments: { score: number; status: string };
      };

      // AI Insights
      insights: string[];
}

const getDateRange = (filter: 'daily' | 'monthly' | 'yearly') => {
      const now = new Date();
      const start = new Date();
      const end = new Date();

      switch (filter) {
            case 'daily':
                  start.setHours(0, 0, 0, 0);
                  end.setHours(23, 59, 59, 999);
                  break;
            case 'monthly':
                  start.setDate(1);
                  start.setHours(0, 0, 0, 0);
                  end.setMonth(end.getMonth() + 1);
                  end.setDate(0);
                  end.setHours(23, 59, 59, 999);
                  break;
            case 'yearly':
                  start.setMonth(0, 1);
                  start.setHours(0, 0, 0, 0);
                  end.setMonth(11, 31);
                  end.setHours(23, 59, 59, 999);
                  break;
            default:
                  throw new AppError('Invalid filter type', StatusCodes.BAD_REQUEST);
      }

      return { start, end };
};

const getPreviousPeriodRange = (filter: 'daily' | 'monthly' | 'yearly') => {
      const now = new Date();
      const start = new Date();
      const end = new Date();

      switch (filter) {
            case 'daily':
                  start.setDate(start.getDate() - 1);
                  start.setHours(0, 0, 0, 0);
                  end.setDate(end.getDate() - 1);
                  end.setHours(23, 59, 59, 999);
                  break;
            case 'monthly':
                  start.setMonth(start.getMonth() - 1);
                  start.setDate(1);
                  start.setHours(0, 0, 0, 0);
                  end.setMonth(end.getMonth());
                  end.setDate(0);
                  end.setHours(23, 59, 59, 999);
                  break;
            case 'yearly':
                  start.setFullYear(start.getFullYear() - 1);
                  start.setMonth(0, 1);
                  start.setHours(0, 0, 0, 0);
                  end.setFullYear(end.getFullYear() - 1);
                  end.setMonth(11, 31);
                  end.setHours(23, 59, 59, 999);
                  break;
            default:
                  throw new AppError('Invalid filter type', StatusCodes.BAD_REQUEST);
      }

      return { start, end };
};

const calculateGrowth = (current: number, previous: number): number => {
      if (previous === 0) {
            return current > 0 ? 100 : 0;
      }
      return parseFloat((((current - previous) / previous) * 100).toFixed(1));
};

interface IPeriodInvoiceResult {
      totalSales: number;
      totalCost: number;
      totalProfit: number;
      totalOrders: number;
      avgOrderValue: number;
      totalDue: number;
      invoices: any[];
}

const calculatePeriodInvoicesAndProfit = async (matchCondition: any): Promise<IPeriodInvoiceResult> => {
      const invoices = await Invoice.find(matchCondition)
            .select('totalAmount amountPaid dueAmount paymentStatus lineItems itemsIds customerInfo')
            .lean();

      if (!invoices.length) {
            return {
                  totalSales: 0,
                  totalCost: 0,
                  totalProfit: 0,
                  totalOrders: 0,
                  avgOrderValue: 0,
                  totalDue: 0,
                  invoices: [],
            };
      }

      // Collect all itemIds from lineItems and itemsIds
      const itemIdsSet = new Set<string>();
      for (const inv of invoices) {
            if (Array.isArray(inv.lineItems)) {
                  for (const line of inv.lineItems) {
                        if (line?.itemId) {
                              itemIdsSet.add(line.itemId.toString());
                        }
                  }
            }
            if (Array.isArray(inv.itemsIds)) {
                  for (const id of inv.itemsIds) {
                        if (id) {
                              itemIdsSet.add(id.toString());
                        }
                  }
            }
      }

      const validObjectIds = Array.from(itemIdsSet)
            .filter((id) => Types.ObjectId.isValid(id))
            .map((id) => new Types.ObjectId(id));

      const inventoryItems = validObjectIds.length > 0
            ? await Inventory.find({ _id: { $in: validObjectIds } })
                    .select('purchasePrice variants')
                    .lean()
            : [];

      const inventoryMap = new Map<string, any>();
      for (const item of inventoryItems) {
            inventoryMap.set(item._id.toString(), item);
      }

      let totalSales = 0;
      let totalCost = 0;
      let totalDue = 0;

      for (const inv of invoices) {
            const invoiceSales = Number(inv.totalAmount) || 0;
            totalSales += invoiceSales;
            totalDue += Number(inv.dueAmount) || 0;

            let invoiceCost = 0;
            if (Array.isArray(inv.lineItems) && inv.lineItems.length > 0) {
                  for (const line of inv.lineItems) {
                        const item = inventoryMap.get(line.itemId?.toString());
                        if (item) {
                              let unitCost = Number(item.purchasePrice) || 0;
                              if (line.variantId && Array.isArray(item.variants)) {
                                    const variant = item.variants.find(
                                          (v: any) => v._id?.toString() === line.variantId?.toString()
                                    );
                                    if (variant && variant.purchasePrice !== undefined && variant.purchasePrice !== null) {
                                          unitCost = Number(variant.purchasePrice) || 0;
                                    }
                              }
                              const qty = Math.max(1, Number(line.quantity) || 1);
                              invoiceCost += unitCost * qty;
                        }
                  }
            } else if (Array.isArray(inv.itemsIds) && inv.itemsIds.length > 0) {
                  for (const id of inv.itemsIds) {
                        const item = inventoryMap.get(id?.toString());
                        if (item) {
                              const unitCost = Number(item.purchasePrice) || 0;
                              invoiceCost += unitCost;
                        }
                  }
            }
            totalCost += invoiceCost;
      }

      const totalOrders = invoices.length;
      const avgOrderValue = totalOrders > 0 ? parseFloat((totalSales / totalOrders).toFixed(2)) : 0;
      const totalProfit = Math.max(0, parseFloat((totalSales - totalCost).toFixed(2)));

      return {
            totalSales: parseFloat(totalSales.toFixed(2)),
            totalCost: parseFloat(totalCost.toFixed(2)),
            totalProfit,
            totalOrders,
            avgOrderValue,
            totalDue: parseFloat(totalDue.toFixed(2)),
            invoices,
      };
};

const calculateStockManagement = async (shopkeeperId?: string, shopId?: string) => {
      const inventoryFilter: FilterQuery<any> = {};

      if (shopkeeperId && Types.ObjectId.isValid(shopkeeperId)) {
            inventoryFilter.userId = new Types.ObjectId(shopkeeperId);
      }

      if (shopId && Types.ObjectId.isValid(shopId)) {
            const targetShopId = new Types.ObjectId(shopId);
            inventoryFilter.$or = [{ storeId: targetShopId }, { storeId: null }, { storeId: { $exists: false } }];
      }

      const inventoryList = await Inventory.find(inventoryFilter)
            .select('quantity minStockLevel variants status type')
            .lean();

      const totalProducts = inventoryList.length;
      if (totalProducts === 0) {
            return {
                  score: 100,
                  status: 'Good',
                  totalProducts: 0,
                  totalStockUnits: 0,
                  inStockCount: 0,
                  lowStockCount: 0,
                  outOfStockCount: 0,
            };
      }

      let inStockCount = 0;
      let lowStockCount = 0;
      let outOfStockCount = 0;
      let totalStockUnits = 0;

      for (const item of inventoryList) {
            let totalQty = 0;
            if (Array.isArray(item.variants) && item.variants.length > 0) {
                  totalQty = item.variants.reduce((sum: number, v: any) => sum + (Number(v.quantity) || 0), 0);
            } else {
                  totalQty = Number(item.quantity) || 0;
            }
            totalStockUnits += totalQty;

            const minLevel = Number(item.minStockLevel) > 0 ? Number(item.minStockLevel) : 3;

            if (totalQty <= 0) {
                  outOfStockCount++;
            } else if (totalQty <= minLevel) {
                  lowStockCount++;
            } else {
                  inStockCount++;
            }
      }

      // Proportional score: in-stock items give 100%, low-stock items give 50%, out-of-stock gives 0%
      const scoreRatio = (inStockCount * 1.0 + lowStockCount * 0.5) / totalProducts;
      const score = Math.min(Math.max(Math.round(scoreRatio * 100), 0), 100);

      return {
            score,
            status: getStatus(score),
            totalProducts,
            totalStockUnits,
            inStockCount,
            lowStockCount,
            outOfStockCount,
      };
};

const calculateBusinessHealthScore = (metrics: {
      salesGrowth: number;
      profitMargin: number;
      stockManagement: number;
      customerSatisfaction: number;
      outstandingPayments: number;
}) => {
      // Calculate weighted average
      const weights = {
            salesGrowth: 0.25,
            profitMargin: 0.25,
            stockManagement: 0.2,
            customerSatisfaction: 0.15,
            outstandingPayments: 0.15,
      };

      const overall =
            metrics.salesGrowth * weights.salesGrowth +
            metrics.profitMargin * weights.profitMargin +
            metrics.stockManagement * weights.stockManagement +
            metrics.customerSatisfaction * weights.customerSatisfaction +
            metrics.outstandingPayments * weights.outstandingPayments;

      const roundedScore = Math.round(overall);

      // Rating system
      let rating: 'Excellent' | 'Good' | 'Fair' | 'Needs Improvement' | 'Critical';
      let message: string;

      if (roundedScore >= 85) {
            rating = 'Excellent';
            message = 'Your business is performing better than 84% of similar shops using imoscan.';
      } else if (roundedScore >= 70) {
            rating = 'Good';
            message = 'Your business is performing well. Focus on improving outstanding payments.';
      } else if (roundedScore >= 55) {
            rating = 'Fair';
            message = 'Your business has room for improvement. Consider reviewing your sales strategy.';
      } else if (roundedScore >= 40) {
            rating = 'Needs Improvement';
            message = 'Your business needs attention. Focus on key areas like sales and profit margin.';
      } else {
            rating = 'Critical';
            message = 'Your business requires immediate action. Review all metrics and create improvement plan.';
      }

      return {
            overall: roundedScore,
            rating,
            benchmark: 84,
            message,
      };
};

const generateAIInsights = (
      metrics: {
            salesGrowth: number;
            profitMargin: number;
            stockManagement: number;
            customerSatisfaction: number;
            outstandingPayments: number;
      },
      stats: {
            totalSales: number;
            totalOrders: number;
            avgOrderValue: number;
      }
): string[] => {
      const insights: string[] = [];

      // Sales insights
      if (metrics.salesGrowth >= 80) {
            insights.push('📈 Excellent sales growth! Consider expanding your product line.');
      } else if (metrics.salesGrowth >= 60) {
            insights.push('📊 Good sales growth. Focus on upselling to increase revenue further.');
      } else if (metrics.salesGrowth < 40) {
            insights.push('⚠️ Sales growth is below average. Try promotional campaigns or bundle offers.');
      }

      // Profit margin insights
      if (metrics.profitMargin >= 80) {
            insights.push('💰 Strong profit margins. Consider reinvesting in marketing.');
      } else if (metrics.profitMargin >= 60) {
            insights.push('💵 Healthy profit margins. Look for cost optimization opportunities.');
      } else if (metrics.profitMargin < 40) {
            insights.push('🔻 Profit margins need improvement. Review pricing strategy and supplier costs.');
      }

      // Stock management insights
      if (metrics.stockManagement >= 80) {
            insights.push('📦 Excellent inventory management. Keep up the good work!');
      } else if (metrics.stockManagement >= 60) {
            insights.push('📋 Good stock management. Consider implementing just-in-time inventory.');
      } else if (metrics.stockManagement < 40) {
            insights.push('⚠️ Stock management needs attention. Review slow-moving items and reorder points.');
      }

      // Customer satisfaction insights
      if (metrics.customerSatisfaction >= 80) {
            insights.push('⭐ High customer satisfaction. Leverage this for word-of-mouth marketing.');
      } else if (metrics.customerSatisfaction >= 60) {
            insights.push('👍 Good customer satisfaction. Consider loyalty programs to retain customers.');
      } else if (metrics.customerSatisfaction < 40) {
            insights.push('😟 Customer satisfaction is low. Review your service quality and follow-up process.');
      }

      // Outstanding payments insights
      if (metrics.outstandingPayments >= 80) {
            insights.push('✅ Excellent payment collection. Your cash flow is healthy.');
      } else if (metrics.outstandingPayments >= 60) {
            insights.push('💳 Good payment management. Consider offering early payment discounts.');
      } else if (metrics.outstandingPayments < 40) {
            insights.push('⚠️ High outstanding payments. Implement stricter credit policies and follow-ups.');
      }

      // Additional insights based on total stats
      if (stats.totalOrders > 100 && stats.avgOrderValue > 50) {
            insights.push('🎯 High volume and high value orders. Great business performance!');
      }

      if (stats.totalOrders > 100 && stats.avgOrderValue < 30) {
            insights.push(
                  '💡 High order volume but low average value. Consider bundle offers to increase ticket size.'
            );
      }

      if (stats.totalOrders < 50 && stats.avgOrderValue > 100) {
            insights.push('💎 Low volume but high value orders. Focus on premium customers and personalized service.');
      }

      // Limit to top 5 insights
      return insights.slice(0, 5);
};

const getDashboardStats = async (
      shopkeeperId?: string,
      filter: 'daily' | 'monthly' | 'yearly' = 'monthly',
      shopId?: string
): Promise<IDashboardStats> => {
      const { start, end } = getDateRange(filter);
      const { start: prevStart, end: prevEnd } = getPreviousPeriodRange(filter);

      // Build match condition for shopkeeper if provided
      const matchCondition: any = {
            createdAt: { $gte: start, $lte: end },
            totalAmount: { $ne: null },
      };

      const prevMatchCondition: any = {
            createdAt: { $gte: prevStart, $lte: prevEnd },
            totalAmount: { $ne: null },
      };

      if (shopkeeperId) {
            if (!Types.ObjectId.isValid(shopkeeperId)) {
                  throw new AppError('Invalid shopkeeperId', StatusCodes.BAD_REQUEST);
            }
            matchCondition.shopkeeperId = new Types.ObjectId(shopkeeperId);
            prevMatchCondition.shopkeeperId = new Types.ObjectId(shopkeeperId);
      }

      if (shopId && Types.ObjectId.isValid(shopId)) {
            matchCondition.shopId = new Types.ObjectId(shopId);
            prevMatchCondition.shopId = new Types.ObjectId(shopId);
      }

      // Current period stats (sales, orders, profit, cost, dues)
      const current = await calculatePeriodInvoicesAndProfit(matchCondition);

      // Previous period stats
      const previous = await calculatePeriodInvoicesAndProfit(prevMatchCondition);

      // Calculate growth percentages
      const salesGrowth = calculateGrowth(current.totalSales || 0, previous.totalSales || 0);
      const profitGrowth = calculateGrowth(current.totalProfit || 0, previous.totalProfit || 0);
      const ordersGrowth = calculateGrowth(current.totalOrders || 0, previous.totalOrders || 0);
      const avgOrderGrowth = calculateGrowth(current.avgOrderValue || 0, previous.avgOrderValue || 0);

      // Profit margin percentage
      const profitMarginPercentage =
            current.totalSales > 0 ? (current.totalProfit / current.totalSales) * 100 : 0;
      const profitMarginScore = Math.min(Math.max(Math.round(profitMarginPercentage), 0), 100);

      // Stock management from real inventory data
      const stockManagementData = await calculateStockManagement(shopkeeperId, shopId);

      // Outstanding Payments score from real invoice due amounts
      let outstandingPaymentsScore = 100;
      if (current.totalSales > 0) {
            const paidRatio = Math.max(0, (current.totalSales - current.totalDue) / current.totalSales);
            outstandingPaymentsScore = Math.min(Math.max(Math.round(paidRatio * 100), 0), 100);
      }

      // Customer Satisfaction score from real customer repeats and payment completion
      let customerSatisfactionScore = 90;
      if (current.invoices.length > 0) {
            const customerMap = new Map<string, number>();
            let paidOrPartialCount = 0;

            for (const inv of current.invoices) {
                  if (inv.customerInfo) {
                        const cId = inv.customerInfo.toString();
                        customerMap.set(cId, (customerMap.get(cId) || 0) + 1);
                  }
                  if (inv.paymentStatus === 'paid' || inv.paymentStatus === 'partial' || (!inv.paymentStatus && !inv.dueAmount)) {
                        paidOrPartialCount++;
                  }
            }

            const fulfillmentRate = paidOrPartialCount / current.invoices.length;
            const totalUniqueCustomers = customerMap.size;
            const repeatCustomers = Array.from(customerMap.values()).filter((cnt) => cnt > 1).length;
            const loyaltyBonus = totalUniqueCustomers > 0 ? (repeatCustomers / totalUniqueCustomers) * 20 : 10;

            customerSatisfactionScore = Math.min(
                  Math.max(Math.round(fulfillmentRate * 80 + loyaltyBonus), 0),
                  100
            );
      } else {
            customerSatisfactionScore = 100;
      }

      const salesGrowthScore = Math.min(Math.max(Math.round(salesGrowth + 50), 0), 100);

      const metrics = {
            salesGrowth: salesGrowthScore,
            profitMargin: profitMarginScore,
            stockManagement: stockManagementData.score,
            customerSatisfaction: customerSatisfactionScore,
            outstandingPayments: outstandingPaymentsScore,
      };

      // Calculate business health score
      const healthScore = calculateBusinessHealthScore(metrics);

      // Generate AI insights
      const insights = generateAIInsights(metrics, {
            totalSales: current.totalSales || 0,
            totalOrders: current.totalOrders || 0,
            avgOrderValue: current.avgOrderValue || 0,
      });

      return {
            // Basic stats
            totalSales: current.totalSales || 0,
            totalProfit: current.totalProfit || 0,
            totalOrders: current.totalOrders || 0,
            avgOrderValue: current.avgOrderValue || 0,
            salesGrowth,
            profitGrowth,
            ordersGrowth,
            avgOrderGrowth,

            // Business Health Score
            businessHealthScore: healthScore,

            // Individual metrics
            metrics: {
                  salesGrowth: { score: metrics.salesGrowth, status: getStatus(metrics.salesGrowth) },
                  profitMargin: { score: metrics.profitMargin, status: getStatus(metrics.profitMargin) },
                  stockManagement: { score: stockManagementData.score, status: stockManagementData.status },
                  customerSatisfaction: {
                        score: metrics.customerSatisfaction,
                        status: getStatus(metrics.customerSatisfaction),
                  },
                  outstandingPayments: {
                        score: metrics.outstandingPayments,
                        status: getStatus(metrics.outstandingPayments),
                  },
            },

            // AI Insights
            insights,
      };
};

// Helper function to get status based on score
const getStatus = (score: number): string => {
      if (score >= 85) return 'Excellent';
      if (score >= 70) return 'Good';
      if (score >= 55) return 'Fair';
      if (score >= 40) return 'Needs Improvement';
      return 'Critical';
};

const dashboardService = {
      getDashboardStats,
};

export default dashboardService;
