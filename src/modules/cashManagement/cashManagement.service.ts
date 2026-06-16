import { Types } from 'mongoose';
import AppError from '../../errors/AppError';
import { CashManagement } from './cashManagement.model';
import { ICashManagement, ICashManagementInput, ICashManagementWithAI } from './cashManagement.interface';
import { getOpenAiInsight } from '../deviceCheck/scanInfo.transformer';

class CashManagementService {
      private calculateCashManagementScore(data: {
            startingDayCash: number;
            banked: number;
            cashInDrawer: number;
      }): number {
            const { startingDayCash, banked, cashInDrawer } = data;

            // Total expected cash should equal startingDayCash
            const totalCash = banked + cashInDrawer;

            // Calculate variance percentage
            const variance = Math.abs(totalCash - startingDayCash);
            const variancePercentage = startingDayCash > 0 ? (variance / startingDayCash) * 100 : 0;

            // Score calculation (higher is better)
            // Base score starts at 100, deduct points based on variance
            let score = 100;

            if (variancePercentage <= 1) {
                  // Perfect or near-perfect match
                  score = 100;
            } else if (variancePercentage <= 5) {
                  score = 90;
            } else if (variancePercentage <= 10) {
                  score = 75;
            } else if (variancePercentage <= 20) {
                  score = 50;
            } else if (variancePercentage <= 30) {
                  score = 25;
            } else {
                  score = 10;
            }

            // Additional adjustments
            if (banked === 0 && startingDayCash > 0) {
                  score = Math.max(0, score - 10); // Penalty for not banking anything
            }

            if (cashInDrawer > startingDayCash * 0.5) {
                  score = Math.max(0, score - 5); // Keeping too much cash in drawer
            }

            return Math.round(Math.max(0, Math.min(100, score)));
      }

      private async generateAIInsight(data: {
            shopkeeperName: string;
            startingDayCash: number;
            banked: number;
            cashInDrawer: number;
            score: number;
      }): Promise<string> {
            const { shopkeeperName, startingDayCash, banked, cashInDrawer, score } = data;

            const totalCash = banked + cashInDrawer;
            const variance = Math.abs(totalCash - startingDayCash);
            const variancePercentage = startingDayCash > 0 ? ((variance / startingDayCash) * 100).toFixed(1) : 0;

            let status = 'Good';
            let recommendation = '';

            if (score >= 90) {
                  status = 'Excellent';
                  recommendation = 'Your cash management is excellent. Continue maintaining this practice.';
            } else if (score >= 75) {
                  status = 'Good';
                  recommendation = 'Your cash management is good. Minor improvements can make it excellent.';
            } else if (score >= 50) {
                  status = 'Fair';
                  recommendation = 'Consider reviewing your cash handling procedures. There is room for improvement.';
            } else if (score >= 25) {
                  status = 'Poor';
                  recommendation = 'Immediate attention needed. Review all cash transactions and banking processes.';
            } else {
                  status = 'Critical';
                  recommendation = 'Urgent review required. Implement strict cash handling protocols immediately.';
            }

            const insight = `
Cash Management Report for ${shopkeeperName}
Date: ${new Date().toLocaleDateString()}
Status: ${status} (Score: ${score}/100)

Cash Summary:
- Starting Day Cash: $${startingDayCash.toFixed(2)}
- Banked Cash: $${banked.toFixed(2)}
- Cash in Drawer: $${cashInDrawer.toFixed(2)}
- Total Cash Accounted: $${totalCash.toFixed(2)}
- Variance: $${variance.toFixed(2)} (${variancePercentage}%)

Analysis:
${recommendation}

${
      score < 75
            ? '\nSuggestions for Improvement:\n' +
              (cashInDrawer > startingDayCash * 0.3 ? '- Consider banking more cash regularly\n' : '') +
              (banked === 0 && startingDayCash > 0 ? '- Make regular deposits to reduce cash handling risks\n' : '') +
              (variancePercentage > 10 ? '- Audit your cash transactions for discrepancies\n' : '') +
              '- Maintain detailed records of all cash movements\n'
            : 'Keep up the good work! Your cash management practices are effective.'
}

${score >= 90 ? '🏆 Excellent cash management!' : score >= 75 ? '✅ Good job!' : '⚠️ Please review your cash management practices.'}
    `.trim();

            return insight;
      }

      async createOrUpdateCashManagement(payload: ICashManagementInput): Promise<ICashManagementWithAI> {
            const { shopkeeperId, startingDayCash, banked = 0, cashInDrawer = 0 } = payload;

            if (!Types.ObjectId.isValid(shopkeeperId)) {
                  throw new AppError('Invalid shopkeeper ID', 400);
            }

            if (startingDayCash < 0) {
                  throw new AppError('Starting day cash cannot be negative', 400);
            }

            if (banked < 0) {
                  throw new AppError('Banked amount cannot be negative', 400);
            }

            if (cashInDrawer < 0) {
                  throw new AppError('Cash in drawer cannot be negative', 400);
            }

            // Calculate the score
            const score = this.calculateCashManagementScore({
                  startingDayCash,
                  banked,
                  cashInDrawer,
            });

            // Check if document exists
            const existingDoc = await CashManagement.findOne({ shopkeeperId });

            let cashManagement: ICashManagement | null = null;

            if (existingDoc) {
                  // Update existing document
                  cashManagement = await CashManagement.findOneAndUpdate(
                        { shopkeeperId },
                        {
                              startingDayCash,
                              banked,
                              cashInDrawer,
                              cashManagementScore: score,
                              date: new Date(),
                        },
                        { new: true, runValidators: true }
                  );
            } else {
                  // Create new document
                  cashManagement = await CashManagement.create({
                        shopkeeperId,
                        startingDayCash,
                        banked,
                        cashInDrawer,
                        cashManagementScore: score,
                  });
            }

            if (!cashManagement) {
                  throw new AppError('Failed to save cash management record', 500);
            }

            // Generate AI Insight
            const shopkeeperName = 'Shopkeeper'; // You can fetch user name from User model if needed
            const aiInsight = await this.generateAIInsight({
                  shopkeeperName,
                  startingDayCash,
                  banked,
                  cashInDrawer,
                  score,
            });

            // Update with AI insight
            const updated = await CashManagement.findByIdAndUpdate(cashManagement._id, { aiInsight }, { new: true });

            if (!updated) {
                  throw new AppError('Failed to update cash management with AI insight', 500);
            }

            return updated as ICashManagementWithAI;
      }

      async getCashManagementByShopkeeper(shopkeeperId: string): Promise<ICashManagementWithAI | null> {
            if (!Types.ObjectId.isValid(shopkeeperId)) {
                  throw new AppError('Invalid shopkeeper ID', 400);
            }

            const cashManagement = await CashManagement.findOne({ shopkeeperId }).populate(
                  'shopkeeperId',
                  'firstName lastName email phone'
            );

            if (!cashManagement) {
                  return null;
            }

            // If no AI insight exists, generate it
            if (!cashManagement.aiInsight || !cashManagement.cashManagementScore) {
                  const shopkeeperName = 'Shopkeeper';
                  const score = this.calculateCashManagementScore({
                        startingDayCash: cashManagement.startingDayCash,
                        banked: cashManagement.banked || 0,
                        cashInDrawer: cashManagement.cashInDrawer || 0,
                  });

                  const aiInsight = await this.generateAIInsight({
                        shopkeeperName,
                        startingDayCash: cashManagement.startingDayCash,
                        banked: cashManagement.banked || 0,
                        cashInDrawer: cashManagement.cashInDrawer || 0,
                        score,
                  });

                  const updated = await CashManagement.findByIdAndUpdate(
                        cashManagement._id,
                        {
                              cashManagementScore: score,
                              aiInsight: aiInsight,
                        },
                        { new: true }
                  );

                  return updated as ICashManagementWithAI;
            }

            return cashManagement as ICashManagementWithAI;
      }

      async getAllCashManagementRecords(
            limit: number = 50,
            skip: number = 0
      ): Promise<{ data: ICashManagementWithAI[]; total: number }> {
            const [data, total] = await Promise.all([
                  CashManagement.find()
                        .populate('shopkeeperId', 'firstName lastName email phone')
                        .sort({ createdAt: -1 })
                        .limit(limit)
                        .skip(skip),
                  CashManagement.countDocuments(),
            ]);

            // Generate AI insights for records that don't have them
            const processedData = await Promise.all(
                  data.map(async (record) => {
                        if (!record.aiInsight || !record.cashManagementScore) {
                              const score = this.calculateCashManagementScore({
                                    startingDayCash: record.startingDayCash,
                                    banked: record.banked || 0,
                                    cashInDrawer: record.cashInDrawer || 0,
                              });

                              const shopkeeperName = record.shopkeeperId
                                    ? `${(record.shopkeeperId as any).firstName || ''} ${(record.shopkeeperId as any).lastName || ''}`.trim() ||
                                      'Shopkeeper'
                                    : 'Shopkeeper';

                              const aiInsight = await this.generateAIInsight({
                                    shopkeeperName,
                                    startingDayCash: record.startingDayCash,
                                    banked: record.banked || 0,
                                    cashInDrawer: record.cashInDrawer || 0,
                                    score,
                              });

                              const updated = await CashManagement.findByIdAndUpdate(
                                    record._id,
                                    {
                                          cashManagementScore: score,
                                          aiInsight: aiInsight,
                                    },
                                    { new: true }
                              );

                              return updated as ICashManagementWithAI;
                        }
                        return record as ICashManagementWithAI;
                  })
            );

            return { data: processedData, total };
      }

      async deleteCashManagement(shopkeeperId: string): Promise<void> {
            if (!Types.ObjectId.isValid(shopkeeperId)) {
                  throw new AppError('Invalid shopkeeper ID', 400);
            }

            const result = await CashManagement.findOneAndDelete({ shopkeeperId });
            if (!result) {
                  throw new AppError('Cash management record not found', 404);
            }
      }

      async getCashManagementStats(shopkeeperId: string): Promise<any> {
            if (!Types.ObjectId.isValid(shopkeeperId)) {
                  throw new AppError('Invalid shopkeeper ID', 400);
            }

            const records = await CashManagement.find({ shopkeeperId }).sort({ date: -1 }).limit(30); // Last 30 days

            if (records.length === 0) {
                  return {
                        averageScore: 0,
                        totalRecords: 0,
                        recentTrend: 'No data available',
                        bestDay: null,
                        worstDay: null,
                  };
            }

            const scores = records.map((r) => r.cashManagementScore || 0);
            const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;

            const sortedByScore = [...records].sort(
                  (a, b) => (b.cashManagementScore || 0) - (a.cashManagementScore || 0)
            );

            const trend =
                  records.length >= 2
                        ? (records[0].cashManagementScore || 0) - (records[records.length - 1].cashManagementScore || 0)
                        : 0;

            return {
                  averageScore: Math.round(averageScore),
                  totalRecords: records.length,
                  recentTrend: trend > 5 ? 'Improving' : trend < -5 ? 'Declining' : 'Stable',
                  bestDay: sortedByScore[0],
                  worstDay: sortedByScore[sortedByScore.length - 1],
            };
      }
}

export default new CashManagementService();
