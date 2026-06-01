import OpenAI from 'openai';

const openaiApiKey = process.env.OPENAI_API_KEY;
const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const client = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

export type TechnicianFeedbackInput = {
      customerName: string;
      deviceModel: string;
      issueReported: string;
};

const buildFallbackMessage = ({ customerName, deviceModel, issueReported }: TechnicianFeedbackInput) =>
      `Hi ${customerName}, your ${deviceModel} issue (${issueReported}) has been fixed. Please check everything before you leave. Your repair is still under warranty, and we’re here if you need any further help.`;

export const generateTechnicianFeedback = async (input: TechnicianFeedbackInput): Promise<string> => {
      const customerName = input.customerName.trim();
      const deviceModel = input.deviceModel.trim();
      const issueReported = input.issueReported.trim();

      if (!client) {
            throw new Error('OPENAI_API_KEY is not configured');
      }

      const completion = await client.chat.completions.create({
            model: openaiModel,
            temperature: 0.4,
            messages: [
                  {
                        role: 'system',
                        content: 'You write short, professional technician feedback for a completed repair job. Return only the message text. Keep it to 1-2 lines. Include the customer name, device model, reported issue, confirmation that the issue is fixed, a reminder to check the device before leaving, a warranty reminder, and an offer of further help.',
                  },
                  {
                        role: 'user',
                        content: `Customer name: ${customerName}\nDevice model: ${deviceModel}\nIssue reported: ${issueReported}`,
                  },
            ],
      });

      const message = completion.choices[0]?.message?.content?.trim();
      if (!message) {
            throw new Error('AI did not return technician feedback');
      }

      return message;
};

export const buildTechnicianFeedbackFallback = buildFallbackMessage;
