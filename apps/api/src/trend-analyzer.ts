import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, desc, sql, and, gte, lt, inArray, lte } from 'drizzle-orm';
import { removeStopwords } from 'stopword';
import { trends, entries, hourlyBatches } from './db/schema';
import { db } from './db';
import logger from '@/packages/utils/src/logger';
import type { ArrayBufferSink } from 'bun';
// import { customStopwords, addCustomStopword, removeCustomStopword } from './custom-stopwords';
import { stopwordList } from './stopwords';
// @ts-expect-error: no types
import { JSDOM } from 'jsdom';

/**
 * TrendAnalyzer class for processing and analyzing trends from entry data.
 *
 * This class provides functionality to process batches of entries, analyze trends,
 * and retrieve trend data for various time periods.
 *
 * @example
 * // Initialize the TrendAnalyzer
 * const trendAnalyzer = new TrendAnalyzer();
 *
 * // 1. Get trends for a specific batch
 * const batchId = 'your-batch-id';
 * const batchTrends = await trendAnalyzer.getTrendsForBatch(batchId);
 *
 * // 2. Get trends for a time range
 * const rangeTrends = await trendAnalyzer.getTrendsForTimeRange(startDate, endDate);
 *
 * // 3. Get top trends for each batch in a time range
 * const topTrendsPerBatch = await trendAnalyzer.getTopTrendsPerBatch(startDate, endDate, 5);
 */
export class TrendAnalyzer {
  private db: ReturnType<typeof drizzle>;
  private sink: ArrayBufferSink;
  private trendCounts: Map<string, number> = new Map();
  private coOccurrences: Record<string, Record<string, number>> = {};

  constructor() {
    this.db = db;
    this.sink = new Bun.ArrayBufferSink();
    this.sink.start({ highWaterMark: 1024 * 1024, stream: true }); // 1MB buffer
  }

  async processBatch(batchId: string, entryIds: string[]): Promise<{ success: boolean, processedCount: number }> {
    logger.info(`Processing batch ${batchId} with ${entryIds.length} entries`);

    try {
      // Fetch entries for this batch
      const batchEntries = await this.db.select({
        id: entries.id,
        content: entries.content,
      })
        .from(entries)
        .where(inArray(entries.id, entryIds));

      logger.debug(`Processing ${batchEntries.length} entries for batch ${batchId}`);

      for (const entry of batchEntries) {
        if (entry.content !== null) {
          await this.analyzeEntry(entry as { id: string; content: string });
        } else {
          logger.warn(`Skipping entry ${entry.id} due to null content`);
        }
      }

      logger.debug(`Analyzed ${batchEntries.length} entries. Current trend count: ${this.trendCounts.size}`);

      if (this.trendCounts.size > 0) {
        const batch = await this.db.select().from(hourlyBatches).where(eq(hourlyBatches.id, batchId)).limit(1);
        if (batch.length > 0) {
          await this.saveTrends(batch[0].batchHour);
          logger.info(`Saved trends for batch ${batchId} (${batch[0].batchHour.toISOString()})`);
        } else {
          logger.warn(`Batch ${batchId} not found when saving trends`);
        }
      } else {
        logger.warn(`No trends found for batch ${batchId}`);
      }

      return { success: true, processedCount: batchEntries.length };
    } catch (error) {
      logger.error(`Error processing batch ${batchId}:`, error);
      throw error;
    }
  }

  private filterStopwords(words: string[]): string[] {
    return words.filter(word => !stopwordList.has(word) && Boolean(word));
  }

  private extractTextFromHtml(html: string): string {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    // Remove script and style elements
    document.querySelectorAll('script, style').forEach((el: Element) => el.remove());

    // Get the text content
    return document.body.textContent || '';
  }

  private async analyzeEntry(entry: { id: string, content: string }) {
    // Extract plain text from HTML content
    const plainText = this.extractTextFromHtml(entry.content);

    const originalWords = plainText.toLowerCase().split(/\W+/);
    const words = this.filterStopwords(originalWords);
    const coOccurrences = this.analyzeCoOccurrence(words);

    logger.debug(`Original word count: ${originalWords.length}`);
    logger.debug(`Word count after removing stopwords: ${words.length}`);
    logger.debug(`Sample of original words: ${originalWords.slice(0, 10).join(', ')}`);
    logger.debug(`Sample of words after removing stopwords: ${words.slice(0, 10).join(', ')}`);

    words.forEach(word => {
      this.trendCounts.set(word, (this.trendCounts.get(word) || 0) + 1);
    });

    logger.debug(`Current trend count size: ${this.trendCounts.size}`);
  }

  private async saveTrends(batchHour: Date) {
    // Use batchHour instead of current time
    logger.debug(`Saving trends for batch hour: ${batchHour.toISOString()}`);

    const trendEntries = Array.from(this.trendCounts.entries())
      .filter(([keyword]) => !stopwordList.has(keyword.toLowerCase()))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100);

    logger.debug(`Saving ${trendEntries.length} trends`);
    logger.debug(`Sample trends: ${JSON.stringify(trendEntries.slice(0, 5))}`);

    this.sink.flush();
    for (const [keyword, frequency] of trendEntries) {
      const trendBuffer = this.trendToBuffer(keyword, frequency);
      this.sink.write(trendBuffer);
    }

    const trendsBuffer = this.sink.flush();
    const trendsFromBuffer = this.bufferToTrends(trendsBuffer as ArrayBuffer);

    await this.db.transaction(async (tx) => {
      for (const trend of trendsFromBuffer) {
        await tx.insert(trends).values({
          time: batchHour, // Use batchHour here
          keyword: trend.keyword,
          trendType: 'keyword_frequency',
          frequency: trend.frequency,
          data: JSON.stringify(trend)
        }).onConflictDoUpdate({
          target: [trends.time, trends.keyword],
          set: { frequency: sql`${trends.frequency} + EXCLUDED.frequency` }
        });
      }
    });

    logger.info(`Saved ${trendsFromBuffer.length} trends for batch hour ${batchHour.toISOString()}`);
    logger.debug(`Trends saved: ${JSON.stringify(trendsFromBuffer.slice(0, 5))}`);
    this.trendCounts.clear();
  }

  private trendToBuffer(keyword: string, frequency: number): ArrayBuffer {
    const encoder = new TextEncoder();
    const keywordBuffer = encoder.encode(keyword);
    const buffer = new ArrayBuffer(4 + 4 + keywordBuffer.byteLength);
    const view = new DataView(buffer);
    view.setUint32(0, keywordBuffer.byteLength, true);
    view.setUint32(4, frequency, true);
    new Uint8Array(buffer, 8).set(keywordBuffer);
    return buffer;
  }

  private bufferToTrends(buffer: ArrayBuffer): { keyword: string; frequency: number }[] {
    const trends: { keyword: string; frequency: number }[] = [];
    const view = new DataView(buffer);
    let offset = 0;

    while (offset < buffer.byteLength) {
      const keywordLength = view.getUint32(offset, true);
      offset += 4;
      const frequency = view.getUint32(offset, true);
      offset += 4;
      const keywordBuffer = buffer.slice(offset, offset + keywordLength);
      const keyword = new TextDecoder().decode(keywordBuffer);
      offset += keywordLength;

      trends.push({ keyword, frequency });
    }

    return trends;
  }


  // Analyze which words frequently appear together to identify related concepts
  // This is a simplified co-occurrence analysis
  private analyzeCoOccurrence(words: string[], windowSize: number = 5) {
    const coOccurrences: Record<string, Record<string, number>> = {};

    for (let i = 0; i < words.length; i++) {
      const currentWord = words[i];

      for (let j = Math.max(0, i - windowSize); j < Math.min(words.length, i + windowSize + 1); j++) {
        if (i !== j) {
          const neighborWord = words[j];

          if (!coOccurrences[currentWord]) {
            coOccurrences[currentWord] = {};
          }

          coOccurrences[currentWord][neighborWord] = (coOccurrences[currentWord][neighborWord] || 0) + 1;
        }
      }
    }

    return coOccurrences;
  }

  async getDailyTrends(startDate: Date) {
    // Ensure startDate is set to the beginning of the day
    const dayStart = new Date(startDate);
    dayStart.setHours(0, 0, 0, 0);

    // Set endDate to the last millisecond of the same day
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    return this.db.select({
      keyword: trends.keyword,
      totalFrequency: sql`sum(${trends.frequency})`.as('total_frequency')
    })
      .from(trends)
      .where(and(
        gte(trends.time, dayStart),
        lte(trends.time, dayEnd)
      ))
      .groupBy(trends.keyword)
      .orderBy(desc(sql`total_frequency`))
      .limit(10);
  }

  async getWeeklyTrends(startDate: Date, endDate: Date) {
    return this.db.select({
      keyword: trends.keyword,
      totalFrequency: sql<number>`sum(${trends.frequency})`.as('total_frequency'),
      avgDailyFrequency: sql<number>`avg(${trends.frequency})`.as('avg_daily_frequency'),
      distinctDays: sql<number>`count(distinct date_trunc('day', ${trends.time}))`.as('distinct_days')
    })
      .from(trends)
      .where(and(
        gte(trends.time, startDate),
        lt(trends.time, endDate)
      ))
      .groupBy(trends.keyword)
      .having(sql`count(distinct date_trunc('day', ${trends.time})) >= 3`) // Trend appeared in at least 3 distinct days
      .orderBy(desc(sql`total_frequency`))
      .limit(20);
  }

  async detectBursts() {
    const result = await this.db.execute(sql`
      WITH hourly_counts AS (
        SELECT
          keyword,
          time_bucket('1 hour', time) AS hour,
          SUM(frequency) AS hourly_frequency
        FROM trends
        WHERE time > NOW() - INTERVAL '24 hours'
        GROUP BY keyword, hour
      ),
      keyword_stats AS (
        SELECT
          keyword,
          AVG(hourly_frequency) AS avg_frequency,
          STDDEV(hourly_frequency) AS stddev_frequency
        FROM hourly_counts
        GROUP BY keyword
      )
      SELECT
        hc.keyword,
        hc.hour,
        hc.hourly_frequency,
        (hc.hourly_frequency - ks.avg_frequency) / NULLIF(ks.stddev_frequency, 0) AS burst_score
      FROM hourly_counts hc
      JOIN keyword_stats ks ON hc.keyword = ks.keyword
      WHERE (hc.hourly_frequency - ks.avg_frequency) / NULLIF(ks.stddev_frequency, 0) > 2
      ORDER BY burst_score DESC
      LIMIT 10
    `);
    return result.rows;
  }


  async getTrendsForBatch(batchId: string) {
    const batch = await this.db.select().from(hourlyBatches).where(eq(hourlyBatches.id, batchId)).limit(1);
    if (!batch[0]) {
      throw new Error('Batch not found');
    }

    return this.db.select({
      keyword: trends.keyword,
      frequency: trends.frequency
    })
      .from(trends)
      .where(
        and(
          gte(trends.time, batch[0].batchHour),
          lt(trends.time, new Date(batch[0].batchHour.getTime() + 60 * 60 * 1000))
        )
      )
      .orderBy(desc(trends.frequency))
      .limit(100);
  }

  async getTrendsForTimeRange(startDate: Date, endDate: Date) {
    return this.db.select({
      keyword: trends.keyword,
      totalFrequency: sql`sum(${trends.frequency})`.as('total_frequency')
    })
      .from(trends)
      .where(
        and(
          gte(trends.time, startDate),
          lt(trends.time, endDate)
        )
      )
      .groupBy(trends.keyword)
      .orderBy(desc(sql`total_frequency`))
      .limit(100);
  }

  async getTopTrendsPerBatch(startDate: Date, endDate: Date, topN: number = 10) {
    const batchTrends = await this.db.select({
      batchId: hourlyBatches.id,
      batchHour: hourlyBatches.batchHour,
      keyword: trends.keyword,
      frequency: trends.frequency
    })
      .from(hourlyBatches)
      .innerJoin(trends,
        and(
          gte(trends.time, hourlyBatches.batchHour),
          lt(trends.time, sql`${hourlyBatches.batchHour} + interval '1 hour'`)
        )
      )
      .where(
        and(
          gte(hourlyBatches.batchHour, startDate),
          lt(hourlyBatches.batchHour, endDate),
          eq(hourlyBatches.isProcessed, true)
        )
      )
      .orderBy(hourlyBatches.batchHour, desc(trends.frequency));

    const topTrendsPerBatch = new Map<string, Array<{ keyword: string, frequency: number }>>();

    for (const trend of batchTrends) {
      if (!topTrendsPerBatch.has(trend.batchId)) {
        topTrendsPerBatch.set(trend.batchId, []);
      }
      const batchTrends = topTrendsPerBatch.get(trend.batchId)!;
      if (batchTrends.length < topN) {
        batchTrends.push({ keyword: trend.keyword, frequency: Number(trend.frequency) });
      }
    }

    return Array.from(topTrendsPerBatch.entries()).map(([batchId, trends]) => ({
      batchId,
      batchHour: batchTrends.find(t => t.batchId === batchId)?.batchHour,
      trends
    }));
  }

  async getTopCoOccurrences(word: string, limit: number = 10) {
    const coOccurrences = this.coOccurrences[word] || {};
    return Object.entries(coOccurrences)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
  }
}

export const trendAnalyzer = new TrendAnalyzer();
