import { GoogleGenerativeAI } from '@google/generative-ai';
import invariant from 'tiny-invariant';
import { summarizePrompt } from './summarizePrompt';
import PgBoss from 'pg-boss';
import logger from '@/packages/utils/src/logger';

invariant(process.env.GOOGLE_AI_API_KEY, 'GOOGLE_AI_API_KEY is not set');
invariant(process.env.DATABASE_URL, 'DATABASE_URL is not set');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
  generationConfig: { responseMimeType: 'application/json' },
});


export async function processEntry(entryId: string, content: string) {
  const prompt = `${summarizePrompt}\n\n${content}`;

  const result = await model.generateContent(prompt);
  const summary = result.response.text();

  // Update the entry in the database with the summary
  // await updateEntryWithSummary(entryId, summary);

  return summary;
}
