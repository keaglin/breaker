import { englishStopwords } from './english-stopwords';

const htmlStopwords = new Set([
  'strong', 'em', 'a', 'href', 'img', 'src', 'alt', 'p', 'div', 'span',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'br', 'table', 'tr', 'td', 'th',
  'target', '_blank', 'www', 's', 'rel', 'noopener', 'noreferrer', 'referrer', 'referrerpolicy',
  'com', 'https', 'figcaption'
]);

const timeStopwords = new Set([
  'today', 'tomorrow', 'yesterday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  ...Array.from({ length: 2100 - 1900 }, (_, i) => (1900 + i).toString()) // Years from 1900 to 2100
]);

const numbers = Array.from({ length: 100 }, (_, i) => i.toString());

const publicationStopwords = new Set([
  // Add your publication names here
  'nytimes', 'washingtonpost', 'bbc', 'cnn', 'foxnews'
]);

export const stopwordList = new Set([
  ...numbers,
  ...englishStopwords,
  ...htmlStopwords,
  ...timeStopwords,
  ...publicationStopwords
]);

/**
   * Stopword lists for different languages.
   * Each language has its own set of common words to be filtered out.
   *
   * @property {Set<string>} en - English stopwords
   * @property {Set<string>} es - Spanish stopwords
   * // ... other languages can be added here
   * const stopwordLists = {
   *   en: new Set(['the', 'is', 'at', ...]),
   *   es: new Set(['el', 'la', 'en', ...]),
   *   // ... other languages
   * };
   */

/**
 * Filters out stopwords from an array of words based on the specified language.
 *
 * @param {string[]} words - The array of words to filter
 * @param {string} [language='en'] - The language code for stopword filtering (default: 'en')
 * @returns {string[]} An array of words with stopwords removed
 *
 * private filterStopwords(words: string[], language: string = 'en'): string[] {
 *   const stopwords = stopwordLists[language] || stopwordLists.en;
 *   return words.filter(word => !stopwords.has(word));
 * }
 */
