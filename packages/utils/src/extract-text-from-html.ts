// @ts-expect-error: no types
import { JSDOM } from 'jsdom';

export function extractTextFromHtml(html: string): string {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  // Remove script and style elements
  document.querySelectorAll('script, style').forEach((el: Element) => el.remove());

  const text = document.body.textContent ?? document.body.innerText;
  // console.log('text', text);

  return text
}
