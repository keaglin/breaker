import { GoogleGenerativeAI } from '@google/generative-ai';
import invariant from 'tiny-invariant';
import { summarizePrompt } from './summarizePrompt';
import logger from '@/packages/utils/src/logger';

invariant(process.env.GOOGLE_AI_API_KEY, 'GOOGLE_AI_API_KEY is not set');
invariant(process.env.DATABASE_URL, 'DATABASE_URL is not set');

/**
 * Gemini 1.5 Flash
 * Current API limits
 * 15 RPM (requests per minute)
 * 1 million TPM (tokens per minute)
 * 1,500 RPD (requests per day)
 */

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
  generationConfig: { responseMimeType: 'application/json' },
});

interface SummaryResult {
  summary: string;
  keypoints: string[];
  takeaways: string[];
}

export async function processEntry(content: string): Promise<SummaryResult | Error> {
  const prompt = `${summarizePrompt}\n\n${content}`;

  try {
    const result = await model.generateContent(prompt);
    // logger.debug('Raw summary result', result);

    const summary = result.response.candidates?.[0]?.content?.parts?.[0]?.text;
    // console.debug('Raw summary', summary);

    const parsedSummary: SummaryResult = JSON.parse(summary ?? '');
    //   console.debug('Parsed summary', parsedSummary);
    //   // throw new Error('test');
    //   return parsedSummary;
    return parsedSummary;
  } catch (error) {
    logger.error(`Error parsing summary:`, error);
    // throw new Error(`Failed to parse summary: ${error}`);
    return error as Error;
  }
}
