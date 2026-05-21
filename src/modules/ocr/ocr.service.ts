import Tesseract from 'tesseract.js';
import { OpenAI } from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { IOCRResult } from './ocr.interface';

const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
});

class OCRService {
      /**
       * Extract text from image using Tesseract OCR
       */
      async extractTextFromImage(imagePath: string): Promise<string> {
            try {
                  const result = await Tesseract.recognize(imagePath, 'eng', {
                        logger: (m) => console.log('OCR Progress:', m),
                  });

                  return result.data.text;
            } catch (error) {
                  console.error('OCR extraction error:', error);
                  throw new Error(`Failed to extract text from image: ${error}`);
            }
      }

      /**
       * Extract IMEI numbers from text using OpenAI
       */
      async extractIMEIFromText(text: string): Promise<string[]> {
            try {
                  const message = await openai.chat.completions.create({
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
