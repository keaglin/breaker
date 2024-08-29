import { englishStopwords } from './english-stopwords';

const htmlStopwords = new Set([
  'strong', 'em', 'a', 'href', 'img', 'src', 'alt', 'p', 'div', 'span',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'br', 'table', 'tr', 'td', 'th',
  'target', '_blank', 'www', 's', 'rel', 'noopener', 'noreferrer', 'referrer', 'referrerpolicy',
  'com', 'https', 'figcaption', 'wp', 'png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'bmp', 'tiff',
  'ico', 'cur', 'ani', 'mov', 'mp4', 'webm', 'ogv', 'flv', 'avi', 'mkv', 'wmv', 'mpg', 'mpeg',
  'm4v', '3gp', '3g2', 'm2ts', 'mts', 'm2v', 'm4v', 'mp2', 'mp3', 'mpa', 'mpe', 'mpeg', 'mpg',
  'mpv', 'mxf', 'nsv', 'ogm', 'ogv', 'qt', 'rm', 'rmvb', 'swf', 'vob', 'webm', 'wmv', 'xvid',
  'yuv', 'z', 'srcset', 'html', 'amp', 'http', 'ssl'
]);

const timeStopwords = new Set([
  'today', 'tomorrow', 'yesterday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  ...Array.from({ length: 2100 - 1900 }, (_, i) => (1900 + i).toString()) // Years from 1900 to 2100
]);

// 00 to 2000
const numbersWithLeadingZero = Array.from({ length: 2000 }, (_, i) => i.toString()).flatMap(num => [num, num.padStart(2, '0')]);
const numbersWithLeadingZeros = Array.from({ length: 2000 }, (_, i) => i.toString()).flatMap(num => [num, num.padStart(1, '0')]);
const numbers = Array.from({ length: 2000 }, (_, i) => i.toString());

// any string ending in 'w' or 'px' or 'vw' or 'vh'
const numbersEndingInW = numbers.map(num => `${num}w`);
const numbersEndingInPx = numbers.map(num => `${num}px`);
const numbersEndingInVw = numbers.map(num => `${num}vw`);
const numbersEndingInVh = numbers.map(num => `${num}vh`);

const publicationStopwords = new Set([
  // Add your publication names here
  'nytimes', 'washingtonpost', 'bbc', 'cnn', 'foxnews'
]);

export const stopwordList = new Set([
  ...numbers,
  ...numbersWithLeadingZero,
  ...numbersWithLeadingZeros,
  ...numbersEndingInW,
  ...numbersEndingInPx,
  ...numbersEndingInVw,
  ...numbersEndingInVh,
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
