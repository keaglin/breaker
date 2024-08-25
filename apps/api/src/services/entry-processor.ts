import { GoogleGenerativeAI } from '@google/generative-ai';
import invariant from 'tiny-invariant';
import { summarizePrompt } from './summarizePrompt';

invariant(process.env.GOOGLE_AI_API_KEY, 'GOOGLE_AI_API_KEY is not set');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
  generationConfig: { responseMimeType: 'application/json' },
});

export async function processEntry(content: string) {
  const prompt = `${summarizePrompt}\n\n${content}`;

  const result = await model.generateContent(prompt);

  return result.response.text();
}
