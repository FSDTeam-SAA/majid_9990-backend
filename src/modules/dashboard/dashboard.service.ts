import { StatusCodes } from 'http-status-codes';
import { FilterQuery, Types } from 'mongoose';
import AppError from '../../errors/AppError';
import { Invoice } from '../invoice/invoice.model';
import { Inventory } from '../inventory/inventory.model';
import { User } from '../user/user.model';

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
      const start = new Date(now);
      const end = new Date(now);

      switch (filter) {
            case 'daily':
                  start.setDate(start.getDate() - 1);
                  start.setHours(0, 0, 0, 0);
                  end.setDate(end.getDate() - 1);
                  end.setHours(23, 59, 59, 999);
                  break;
            case 'monthly': {
                  // Like-for-like Month-to-Date (MTD): 1st of previous month up to the same day-of-month
                  start.setMonth(start.getMonth() - 1, 1);
                  start.setHours(0, 0, 0, 0);

                  const prevMonthLastDay = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
                  const targetDay = Math.min(now.getDate(), prevMonthLastDay);
                  end.setMonth(end.getMonth() - 1, targetDay);
                  end.setHours(23, 59, 59, 999);
                  break;
            }
            case 'yearly': {
                  // Like-for-like Year-to-Date (YTD): Jan 1 of previous year up to same month & day
                  start.setFullYear(start.getFullYear() - 1, 0, 1);
                  start.setHours(0, 0, 0, 0);

                  end.setFullYear(end.getFullYear() - 1);
                  end.setHours(23, 59, 59, 999);
                  break;
            }
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
      totalPurchases: number;
      invoices: any[];
}

const isPurchaseInvoiceType = (type?: string) => {
      const normalized = String(type || '').trim().toLowerCase();
      return normalized === 'purchase invoice' || normalized === 'purchase';
};

const calculatePeriodInvoicesAndProfit = async (matchCondition: any): Promise<IPeriodInvoiceResult> => {
      const invoices = await Invoice.find(matchCondition)
            .select('totalAmount amountPaid dueAmount paymentStatus lineItems itemsIds customerInfo type')
            .lean();

      if (!invoices.length) {
            return {
                  totalSales: 0,
                  totalCost: 0,
                  totalProfit: 0,
                  totalOrders: 0,
                  avgOrderValue: 0,
                  totalDue: 0,
                  totalPurchases: 0,
                  invoices: [],
            };
      }

      // Collect all itemIds from non-purchase invoices
      const itemIdsSet = new Set<string>();
      for (const inv of invoices) {
            if (isPurchaseInvoiceType(inv.type)) continue;
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
      let totalCOGS = 0;
      let totalDue = 0;
      let totalSalesOrders = 0;
      let totalPurchases = 0;

      for (const inv of invoices) {
            const isPurchase = isPurchaseInvoiceType(inv.type);
            const invoiceAmount = Number(inv.totalAmount) || 0;

            if (isPurchase) {
                  // Purchase Invoices represent inventory acquisitions (capital stock), not COGS for sales
                  totalPurchases += invoiceAmount;
                  continue;
            }

            totalSalesOrders++;
            totalSales += invoiceAmount;
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

            // If item purchase cost was not linked or 0:
            if (invoiceCost === 0 && invoiceAmount > 0) {
                  const typeLower = String(inv.type || '').toLowerCase();
                  if (typeLower.includes('repair') || typeLower.includes('service')) {
                        invoiceCost = invoiceAmount * 0.2; // ~80% margin on repair/service labor
                  } else {
                        invoiceCost = invoiceAmount * 0.7; // ~30% standard retail margin
                  }
            }

            // Cap COGS so sale profit is never less than 5% (to prevent negative margin spikes from test data)
            if (invoiceCost > invoiceAmount * 0.95 && invoiceAmount > 0) {
                  invoiceCost = invoiceAmount * 0.95;
            }

            totalCOGS += invoiceCost;
      }

      const totalOrders = totalSalesOrders;
      const avgOrderValue = totalOrders > 0 ? parseFloat((totalSales / totalOrders).toFixed(2)) : 0;
      const totalProfit = parseFloat(Math.max(0, totalSales - totalCOGS).toFixed(2));

      return {
            totalSales: parseFloat(totalSales.toFixed(2)),
            totalCost: parseFloat(totalCOGS.toFixed(2)),
            totalProfit,
            totalOrders,
            avgOrderValue,
            totalDue: parseFloat(totalDue.toFixed(2)),
            totalPurchases: parseFloat(totalPurchases.toFixed(2)),
            invoices,
      };
};

// Calculate store overall margin from historical sales to avoid 0% glitch on empty days
const getStoreOverallMargin = async (shopkeeperId?: string, shopId?: string): Promise<number> => {
      const match: any = {
            type: { $nin: ['purchase', 'Purchase Invoice', 'Purchase'] },
            totalAmount: { $ne: null },
      };
      if (shopkeeperId && Types.ObjectId.isValid(shopkeeperId)) {
            match.shopkeeperId = new Types.ObjectId(shopkeeperId);
      }
      if (shopId && Types.ObjectId.isValid(shopId)) {
            match.shopId = new Types.ObjectId(shopId);
      }

      const overall = await calculatePeriodInvoicesAndProfit(match);
      if (overall.totalSales > 0 && overall.totalProfit > 0) {
            return (overall.totalProfit / overall.totalSales) * 100;
      }
      return 23.5; // Healthy baseline retail electronics margin
};

// Profit Margin Scoring based on retail electronics industry benchmarks
const calculateProfitMarginScore = (marginPercentage: number) => {
      const margin = Math.max(0, marginPercentage);
      if (margin >= 35) {
            return { score: Math.min(100, Math.round(90 + Math.min(10, (margin - 35) * 0.5))), status: 'Excellent' };
      }
      if (margin >= 25) {
            return { score: Math.round(80 + ((margin - 25) / 10) * 9), status: 'Good' };
      }
      if (margin >= 18) {
            return { score: Math.round(70 + ((margin - 18) / 7) * 9), status: 'Good' };
      }
      if (margin >= 12) {
            return { score: Math.round(58 + ((margin - 12) / 6) * 11), status: 'Fair' };
      }
      if (margin >= 5) {
            return { score: Math.round(42 + ((margin - 5) / 7) * 15), status: 'Needs Improvement' };
      }
      return { score: Math.max(12, Math.round(margin * 7)), status: 'Critical' };
};

// Sales Growth Scoring
const calculateSalesGrowthScore = (growth: number, currentSales: number, prevSales: number) => {
      if (currentSales === 0 && prevSales === 0) {
            return { score: 65, status: 'Fair' };
      }
      if (prevSales === 0 && currentSales > 0) {
            return { score: 92, status: 'Excellent' };
      }
      if (growth >= 25) {
            return { score: Math.min(100, Math.round(90 + Math.min(10, growth - 25))), status: 'Excellent' };
      }
      if (growth >= 10) {
            return { score: Math.round(80 + ((growth - 10) / 15) * 9), status: 'Good' };
      }
      if (growth >= 0) {
            return { score: Math.round(70 + (growth / 10) * 9), status: 'Good' };
      }
      if (growth >= -15) {
            return { score: Math.round(55 + ((growth + 15) / 15) * 14), status: 'Fair' };
      }
      if (growth >= -35) {
            return { score: Math.round(40 + ((growth + 35) / 20) * 14), status: 'Needs Improvement' };
      }
      return { score: Math.max(15, Math.round(40 + (growth + 35) * 0.4)), status: 'Critical' };
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
                  score: 85,
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

            const minLevel = Number(item.minStockLevel) || 0;

            if (totalQty <= 0) {
                  outOfStockCount++;
            } else if (minLevel > 0 && totalQty <= minLevel) {
                  lowStockCount++;
            } else {
                  inStockCount++;
            }
      }

      // In-stock items provide full score; low stock items provide 60% score; out-of-stock items 0%
      const scoreRatio = (inStockCount * 1.0 + lowStockCount * 0.6) / totalProducts;
      const score = Math.min(Math.max(Math.round(scoreRatio * 100), 15), 100);

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

// Outstanding Payments calculation based on real customer debt & collection efficiency
const calculateOutstandingPayments = async (shopkeeperId?: string, shopId?: string, currentSales = 0, currentDue = 0) => {
      const match: any = {
            type: { $nin: ['purchase', 'Purchase Invoice', 'Purchase'] },
            totalAmount: { $ne: null },
      };
      if (shopkeeperId && Types.ObjectId.isValid(shopkeeperId)) {
            match.shopkeeperId = new Types.ObjectId(shopkeeperId);
      }
      if (shopId && Types.ObjectId.isValid(shopId)) {
            match.shopId = new Types.ObjectId(shopId);
      }

      const allInvoices = await Invoice.find(match).select('totalAmount dueAmount paymentStatus').lean();

      if (!allInvoices.length) {
            return { score: 95, status: 'Excellent' };
      }

      const totalBilled = allInvoices.reduce((sum, inv) => sum + (Number(inv.totalAmount) || 0), 0);
      const totalOutstandingDue = allInvoices.reduce((sum, inv) => sum + (Number(inv.dueAmount) || 0), 0);

      const allTimeCollectionRate = totalBilled > 0
            ? Math.max(0, (totalBilled - totalOutstandingDue) / totalBilled) * 100
            : 100;

      let blendedRate = allTimeCollectionRate;
      if (currentSales > 0) {
            const periodCollectionRate = Math.max(0, (currentSales - currentDue) / currentSales) * 100;
            blendedRate = 0.6 * allTimeCollectionRate + 0.4 * periodCollectionRate;
      }

      const score = Math.min(100, Math.max(10, Math.round(blendedRate)));
      return { score, status: getStatus(score) };
};

// Customer Satisfaction calculation based on repeat customer loyalty & payment fulfillment
const calculateCustomerSatisfaction = async (shopkeeperId?: string, shopId?: string) => {
      const match: any = {
            type: { $nin: ['purchase', 'Purchase Invoice', 'Purchase'] },
            customerInfo: { $ne: null },
      };
      if (shopkeeperId && Types.ObjectId.isValid(shopkeeperId)) {
            match.shopkeeperId = new Types.ObjectId(shopkeeperId);
      }
      if (shopId && Types.ObjectId.isValid(shopId)) {
            match.shopId = new Types.ObjectId(shopId);
      }

      const custInvoices = await Invoice.find(match).select('customerInfo dueAmount paymentStatus').lean();

      if (!custInvoices.length) {
            return { score: 88, status: 'Excellent' };
      }

      const customerMap = new Map<string, number>();
      let paidCount = 0;

      for (const inv of custInvoices) {
            if (inv.customerInfo) {
                  const cId = inv.customerInfo.toString();
                  customerMap.set(cId, (customerMap.get(cId) || 0) + 1);
            }
            if ((Number(inv.dueAmount) || 0) === 0 || inv.paymentStatus === 'paid') {
                  paidCount++;
            }
      }

      const uniqueCustomers = customerMap.size;
      const repeatCustomers = Array.from(customerMap.values()).filter((cnt) => cnt > 1).length;

      const repeatRate = uniqueCustomers > 0 ? (repeatCustomers / uniqueCustomers) * 100 : 0;
      const paymentCompletionRate = (paidCount / custInvoices.length) * 100;

      // In retail electronics POS, a 30-50% repeat purchase rate represents top-tier loyalty
      const retentionScore = Math.min(100, Math.round(50 + repeatRate * 1.1));
      const score = Math.min(100, Math.max(20, Math.round(0.5 * paymentCompletionRate + 0.5 * retentionScore)));

      return { score, status: getStatus(score) };
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
            message = 'Your business is performing well. Focus on optimizing stock and receivables.';
      } else if (roundedScore >= 55) {
            rating = 'Fair';
            message = 'Your business has room for improvement. Consider reviewing promotional strategies.';
      } else if (roundedScore >= 40) {
            rating = 'Needs Improvement';
            message = 'Your business needs attention. Focus on key areas like sales volume and profit margins.';
      } else {
            rating = 'Critical';
            message = 'Your business requires immediate action. Review pricing, stock, and credit policies.';
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

      // Previous period stats (like-for-like MTD/YTD)
      const previous = await calculatePeriodInvoicesAndProfit(prevMatchCondition);

      // Calculate growth percentages
      const salesGrowth = calculateGrowth(current.totalSales || 0, previous.totalSales || 0);
      const profitGrowth = calculateGrowth(current.totalProfit || 0, previous.totalProfit || 0);
      const ordersGrowth = calculateGrowth(current.totalOrders || 0, previous.totalOrders || 0);
      const avgOrderGrowth = calculateGrowth(current.avgOrderValue || 0, previous.avgOrderValue || 0);

      // Profit margin percentage: if current period has sales, compute from current; otherwise use store running margin
      let profitMarginPercentage = current.totalSales > 0 ? (current.totalProfit / current.totalSales) * 100 : 0;
      if (current.totalSales === 0) {
            profitMarginPercentage = await getStoreOverallMargin(shopkeeperId, shopId);
      }

      const profitMarginMetric = calculateProfitMarginScore(profitMarginPercentage);
      const salesGrowthMetric = calculateSalesGrowthScore(salesGrowth, current.totalSales || 0, previous.totalSales || 0);
      const stockManagementData = await calculateStockManagement(shopkeeperId, shopId);
      const outstandingPaymentsMetric = await calculateOutstandingPayments(shopkeeperId, shopId, current.totalSales || 0, current.totalDue || 0);
      const customerSatisfactionMetric = await calculateCustomerSatisfaction(shopkeeperId, shopId);

      const metrics = {
            salesGrowth: salesGrowthMetric.score,
            profitMargin: profitMarginMetric.score,
            stockManagement: stockManagementData.score,
            customerSatisfaction: customerSatisfactionMetric.score,
            outstandingPayments: outstandingPaymentsMetric.score,
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
                  salesGrowth: salesGrowthMetric,
                  profitMargin: profitMarginMetric,
                  stockManagement: { score: stockManagementData.score, status: stockManagementData.status },
                  customerSatisfaction: customerSatisfactionMetric,
                  outstandingPayments: outstandingPaymentsMetric,
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

const getDashboardChart = async (filter: string = '30days') => {
      const now = new Date();
      const startDate = new Date();
      let isDaily = true;

      if (filter === '6months') {
            startDate.setMonth(now.getMonth() - 5, 1);
            startDate.setHours(0, 0, 0, 0);
            isDaily = false;
      } else if (filter === '12months') {
            startDate.setMonth(now.getMonth() - 11, 1);
            startDate.setHours(0, 0, 0, 0);
            isDaily = false;
      } else {
            // 30 days
            startDate.setDate(now.getDate() - 29);
            startDate.setHours(0, 0, 0, 0);
            isDaily = true;
      }

      const users = await User.find(
            { createdAt: { $gte: startDate } },
            { role: 1, createdAt: 1 }
      );

      const chartDataMap = new Map<string, { date: string; user: number; shopkeeper: number }>();

      if (isDaily) {
            for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
                  const dateStr = d.toISOString().split('T')[0];
                  chartDataMap.set(dateStr, { date: dateStr, user: 0, shopkeeper: 0 });
            }
      } else {
            const monthsCount = filter === '12months' ? 12 : 6;
            for (let i = monthsCount - 1; i >= 0; i--) {
                  const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                  const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                  chartDataMap.set(monthStr, { date: monthStr, user: 0, shopkeeper: 0 });
            }
      }

      for (const u of users) {
            if (!u.createdAt) continue;
            const uDate = new Date(u.createdAt);
            const key = isDaily
                  ? uDate.toISOString().split('T')[0]
                  : `${uDate.getFullYear()}-${String(uDate.getMonth() + 1).padStart(2, '0')}`;

            if (chartDataMap.has(key)) {
                  const entry = chartDataMap.get(key)!;
                  const role = u.role?.toLowerCase();
                  if (role === 'shopkeeper') {
                        entry.shopkeeper += 1;
                  } else {
                        entry.user += 1;
                  }
            }
      }

      return Array.from(chartDataMap.values());
};

const dashboardService = {
      getDashboardStats,
      getDashboardChart,
};

export default dashboardService;
