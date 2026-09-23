import Tesseract from 'tesseract.js';
import { OpenAI } from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { IOCRResult, INIDResult } from './ocr.interface';

let openai: OpenAI | null = null;

const getOpenAIClient = () => {
      if (openai) {
            return openai;
      }

      const apiKey = process.env.OPENAI_API_KEY;

      if (!apiKey) {
            throw new Error('OpenAI API key is not configured');
      }

      openai = new OpenAI({ apiKey });
      return openai;
};

class OCRService {
      private scheduler: Tesseract.Scheduler | null = null;
      private schedulerInitPromise: Promise<Tesseract.Scheduler> | null = null;
      private readonly poolSize = 2;

      /**
       * Initialize the worker pool with Tesseract scheduler
       */
      private async getScheduler(): Promise<Tesseract.Scheduler> {
            if (this.scheduler) {
                  return this.scheduler;
            }

            if (this.schedulerInitPromise) {
                  return this.schedulerInitPromise;
            }

            this.schedulerInitPromise = (async () => {
                  const scheduler = Tesseract.createScheduler();
                  for (let i = 0; i < this.poolSize; i++) {
                        const worker = await Tesseract.createWorker('eng', 1, {
                              logger: (m) => console.log(`[OCR Worker ${i + 1}] Progress:`, m),
                        });
                        scheduler.addWorker(worker);
                  }
                  this.scheduler = scheduler;
                  return scheduler;
            })();

            return this.schedulerInitPromise;
      }

      /**
       * Extract text from image using Tesseract worker scheduler
       */
      async extractTextFromImage(imagePath: string): Promise<string> {
            try {
                  const scheduler = await this.getScheduler();
                  const result = await scheduler.addJob('recognize', imagePath);
                  return result.data.text;
            } catch (error) {
                  console.error('OCR extraction error:', error);
                  throw new Error(`Failed to extract text from image: ${error}`);
            }
      }

      /**
       * Gracefully terminate the worker scheduler pool
       */
      async terminate(): Promise<void> {
            if (this.scheduler) {
                  await this.scheduler.terminate();
                  this.scheduler = null;
                  this.schedulerInitPromise = null;
            }
      }

      /**
       * Extract IMEI numbers from text using OpenAI
       */
      async extractIMEIFromText(text: string): Promise<string[]> {
            try {
                  const client = getOpenAIClient();
                  const message = await client.chat.completions.create({
                        model: 'gpt-3.5-turbo',
                        messages: [
                              {
                                    role: 'system',
                                    content: 'You are an expert at identifying IMEI numbers from text. IMEI numbers are 15-digit numeric strings. Extract all IMEI numbers from the provided text. Return only the IMEI numbers as a JSON array of strings, or an empty array if none found. Example: ["123456789012345", "987654321098765"]',
                              },
                              {
                                    role: 'user',
                                    content: `Extract IMEI numbers from this text:\n\n${text}`,
                              },
                        ],
                        temperature: 0.3,
                  });

                  const response = message.choices[0].message.content || '[]';

                  // Parse JSON response
                  let imeiNumbers: string[] = [];
                  try {
                        imeiNumbers = JSON.parse(response);
                  } catch (parseError) {
                        console.warn('Failed to parse OpenAI response:', response);
                        imeiNumbers = [];
                  }

                  return imeiNumbers;
            } catch (error) {
                  console.error('OpenAI extraction error:', error);
                  throw new Error(`Failed to extract IMEI from text: ${error}`);
            }
      }

      /**
       * Main method to process image and extract IMEI
       */
      async processImageForIMEI(imagePath: string): Promise<IOCRResult> {
            const startTime = Date.now();

            try {
                  // Step 1: Extract text from image
                  const rawText = await this.extractTextFromImage(imagePath);
                  console.log( "raw text:___",rawText)

                  if (!rawText || rawText.trim().length === 0) {
                        return {
                              rawText: '',
                              imeiNumbers: [],
                              confidence: 'low',
                              processingTime: Date.now() - startTime,
                        };
                  }

                  // Step 2: Extract IMEI numbers using OpenAI
                  const imeiNumbers = await this.extractIMEIFromText(rawText);

                  // Determine confidence based on results
                  const confidence = imeiNumbers.length > 0 ? 'high' : rawText.length > 100 ? 'medium' : 'low';

                  return {
                        rawText,
                        imeiNumbers,
                        confidence,
                        processingTime: Date.now() - startTime,
                  };
            } catch (error) {
                  console.error('Error in processImageForIMEI:', error);
                  throw error;
            }
      }

      /**
       * Extract NID / ID number candidates from text using various patterns
       */
      extractNIDFromText(text: string): string | null {
            if (!text || !text.trim()) return null;

            // 1. Check for labeled ID numbers (e.g., "NID: 1234567890", "ID NO: 123456", "Licence: ABCD123456", "Passport: 123456789")
            const labeledPattern = /(?:NID|National\s*ID|ID\s*No\.?|ID\s*Number|Licence\s*No\.?|License\s*No\.?|Driver\s*No\.?|Passport\s*No\.?|Doc\s*No\.?)\s*[:#.-]?\s*([A-Z0-9-]{6,20})/i;
            const labeledMatch = text.match(labeledPattern);
            if (labeledMatch && labeledMatch[1]) {
                  const cleaned = labeledMatch[1].replace(/-/g, '').trim();
                  if (cleaned.length >= 6) return cleaned;
            }

            // 2. UK Driving Licence format (16-18 chars: 5 letters + 6 numbers + 2 letters/numbers + 3 numbers)
            const ukDrivingLicence = text.match(/\b([A-Z]{5}\d{6}[A-Z0-9]{2}\d{3})\b/i);
            if (ukDrivingLicence && ukDrivingLicence[1]) {
                  return ukDrivingLicence[1].toUpperCase();
            }

            // 3. Bangladesh / National ID (10, 13, 17 digits)
            const digitsOnly = text.replace(/\D/g, ' ');
            const candidates = digitsOnly
                  .split(/\s+/)
                  .filter(Boolean)
                  .filter((value) => value.length === 10 || value.length === 13 || value.length === 17);

            if (candidates.length > 0) {
                  const sorted = candidates.sort((a, b) => b.length - a.length);
                  return sorted[0];
            }

            // 4. Passports or general 8-18 char alphanumeric identifiers
            const generalCandidates = text
                  .split(/[\s,;:\n]+/)
                  .map((token) => token.replace(/[^A-Za-z0-9]/g, ''))
                  .filter((token) => token.length >= 8 && token.length <= 18 && /\d/.test(token) && /[A-Za-z]/.test(token));

            if (generalCandidates.length > 0) {
                  return generalCandidates[0];
            }

            return null;
      }

      /**
       * Extract NID / ID number using OpenAI fallback
       */
      async extractNIDWithAI(text: string): Promise<string | null> {
            try {
                  const client = getOpenAIClient();
                  const message = await client.chat.completions.create({
                        model: 'gpt-3.5-turbo',
                        messages: [
                              {
                                    role: 'system',
                                    content: 'You are an expert at identifying government ID / National ID / Driving Licence / Passport numbers from OCR text. Extract the single primary ID or document number. Return only the ID number as a plain string, or null if no valid ID number exists. Do not explain.',
                              },
                              {
                                    role: 'user',
                                    content: `Extract the ID number from this OCR text:\n\n${text}`,
                              },
                        ],
                        temperature: 0.2,
                  });

                  const resText = message.choices[0]?.message?.content?.trim() || '';
                  if (!resText || resText.toLowerCase() === 'null' || resText.toLowerCase().includes('no valid')) {
                        return null;
                  }
                  return resText.replace(/[^A-Za-z0-9-]/g, '').trim();
            } catch (err) {
                  console.warn('OpenAI ID extraction error:', err);
                  return null;
            }
      }

      /**
       * Process one or two NID images and extract NID number
       */
      async processImagesForNID(frontPath?: string, backPath?: string): Promise<INIDResult> {
            const startTime = Date.now();

            try {
                  const texts: string[] = [];

                  if (frontPath) {
                        texts.push(await this.extractTextFromImage(frontPath));
                  }
                  if (backPath) {
                        texts.push(await this.extractTextFromImage(backPath));
                  }

                  const combinedText = texts.join('\n');
                  let nidNumber = this.extractNIDFromText(combinedText);

                  if (!nidNumber && combinedText.trim().length > 0) {
                        nidNumber = await this.extractNIDWithAI(combinedText);
                  }

                  return {
                        nidNumber,
                        isValid: Boolean(nidNumber),
                        message: nidNumber ? 'NID number extracted successfully' : 'No ID number detected in image. Please enter it manually.',
                        processingTime: Date.now() - startTime,
                  };
            } catch (error) {
                  console.error('Error in processImagesForNID:', error);
                  throw error;
            }
      }

      /**
       * Cleanup uploaded file
       */
      cleanupFile(filePath: string): void {
            try {
                  if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                  }
            } catch (error) {
                  console.warn('Failed to delete file:', filePath, error);
            }
      }
}

export default new OCRService();
