import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import AppError from '../../errors/AppError';
import { Invoice } from '../invoice/invoice.model';
import { Customer } from '../customer/customer.model';
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

interface IPeriodData {
      totalSales: number;
      totalProfit: number;
      totalOrders: number;
      avgOrderValue: number;
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

const calculateStats = async (startDate: Date, endDate: Date): Promise<IPeriodData> => {
      const result = await Invoice.aggregate([
            {
                  $match: {
                        createdAt: { $gte: startDate, $lte: endDate },
                        totalAmount: { $ne: null },
                  },
            },
            {
                  $group: {
                        _id: null,
                        totalSales: { $sum: '$totalAmount' },
                        totalOrders: { $sum: 1 },
                        avgOrderValue: { $avg: '$totalAmount' },
                  },
            },
      ]);

      if (result.length === 0) {
            return {
                  totalSales: 0,
                  totalProfit: 0,
                  totalOrders: 0,
                  avgOrderValue: 0,
            };
      }

      return {
            totalSales: result[0].totalSales || 0,
            totalProfit: 0,
            totalOrders: result[0].totalOrders || 0,
            avgOrderValue: result[0].avgOrderValue || 0,
      };
};

const calculateGrowth = (current: number, previous: number): number => {
      if (previous === 0) return 0;
      return parseFloat((((current - previous) / previous) * 100).toFixed(1));
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
      filter: 'daily' | 'monthly' | 'yearly' = 'monthly'
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

      // Current period stats
      const currentStats = await Invoice.aggregate([
            { $match: matchCondition },
            {
                  $group: {
                        _id: null,
                        totalSales: { $sum: '$totalAmount' },
                        totalOrders: { $sum: 1 },
                        avgOrderValue: { $avg: '$totalAmount' },
                  },
            },
      ]);

      // Previous period stats
      const previousStats = await Invoice.aggregate([
            { $match: prevMatchCondition },
            {
                  $group: {
                        _id: null,
                        totalSales: { $sum: '$totalAmount' },
                        totalOrders: { $sum: 1 },
                        avgOrderValue: { $avg: '$totalAmount' },
                  },
            },
      ]);

      const current = currentStats[0] || { totalSales: 0, totalOrders: 0, avgOrderValue: 0 };
      const previous = previousStats[0] || { totalSales: 0, totalOrders: 0, avgOrderValue: 0 };

      // Calculate growth percentages
      const salesGrowth = calculateGrowth(current.totalSales || 0, previous.totalSales || 0);
      const profitGrowth = 0; // Will implement when cost field is added
      const ordersGrowth = calculateGrowth(current.totalOrders || 0, previous.totalOrders || 0);
      const avgOrderGrowth = calculateGrowth(current.avgOrderValue || 0, previous.avgOrderValue || 0);

      // Calculate individual metrics scores (0-100 scale)
      // These would ideally come from various sources, but we'll calculate based on available data
      const metrics = {
            // Sales Growth: Based on growth percentage (capped at 100)
            salesGrowth: Math.min(Math.max(salesGrowth + 50, 0), 100),

            // Profit Margin: Based on sales and average order value
            profitMargin: Math.min(
                  Math.max(
                        current.totalOrders > 0 ? (current.totalSales / (current.totalOrders * 100)) * 50 + 50 : 50,
                        0
                  ),
                  100
            ),

            // Stock Management: We'll use inventory data if available
            stockManagement: 90, // Default, can be enhanced with actual inventory data

            // Customer Satisfaction: Based on customer frequency if available
            customerSatisfaction: 93, // Default, can be enhanced with customer data

            // Outstanding Payments: Based on due amounts
            outstandingPayments: 85, // Default, can be enhanced with payment data
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
            totalProfit: 0,
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
                  stockManagement: { score: metrics.stockManagement, status: getStatus(metrics.stockManagement) },
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
