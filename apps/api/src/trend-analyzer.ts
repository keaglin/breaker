import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, desc, sql } from 'drizzle-orm';
import { removeStopwords } from 'stopword';
import { trends, entries } from './db/schema';
import { db } from './db';
import logger from '@/packages/utils/src/logger';
import type { ArrayBufferSink } from 'bun';

export class TrendAnalyzer {
  private db: ReturnType<typeof drizzle>;
  private sink: ArrayBufferSink;
  private trendCounts: Map<string, number> = new Map();

  constructor() {
    this.db = db;
    this.sink = new Bun.ArrayBufferSink();
    this.sink.start({ highWaterMark: 1024 * 1024, stream: true }); // 1MB buffer
  }

  async processBatch(batchEntries: Array<{ id: string, content: string }>, batchHour: Date) {
    logger.debug(`Processing ${batchEntries.length} entries for hour ${batchHour.toISOString()}`);

    for (const entry of batchEntries) {
      await this.analyzeEntry(entry);
    }

    await this.saveTrends(batchHour);
  }

  private async analyzeEntry(entry: { id: string, content: string }) {
    const originalWords = entry.content.toLowerCase().split(/\W+/);
    const words = removeStopwords(originalWords);

    logger.debug(`Original word count: ${originalWords.length}`);
    logger.debug(`Word count after removing stopwords: ${words.length}`);
    logger.debug(`Sample of original words: ${originalWords.slice(0, 10).join(', ')}`);
    logger.debug(`Sample of words after removing stopwords: ${words.slice(0, 10).join(', ')}`);

    words.forEach(word => {
      this.trendCounts.set(word, (this.trendCounts.get(word) || 0) + 1);
    });

    logger.debug(`Current trend count size: ${this.trendCounts.size}`);

    // Remove this condition
    // if (this.trendCounts.size >= this.batchSize) {
    //   await this.saveTrends(batchHour);
    // }
  }

  private async saveTrends(batchHour: Date) {
    const now = new Date();
    const trendEntries = Array.from(this.trendCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100); // Top 100 trends

    logger.debug(`Saving ${trendEntries.length} trends`);
    logger.debug(`Sample trends: ${JSON.stringify(trendEntries.slice(0, 5))}`);

    for (const [keyword, frequency] of trendEntries) {
      const trendBuffer = this.trendToBuffer(keyword, frequency);
      this.sink.write(trendBuffer);
    }

    const trendsBuffer = this.sink.flush();
    const trendsFromBuffer = this.bufferToTrends(trendsBuffer as ArrayBuffer);

    await this.db.transaction(async (tx) => {
      for (const trend of trendsFromBuffer) {
        await tx.insert(trends).values({
          time: now,
          keyword: trend.keyword,
          trendType: 'keyword_frequency',
          frequency: trend.frequency,
          data: JSON.stringify(trend)
        }).onConflictDoUpdate({
          target: [trends.time, trends.keyword],
          set: { frequency: sql`${trends.frequency} + ${trend.frequency}` }
        });
      }
    });

    logger.info(`Saved ${trendsFromBuffer.length} trends at ${now}`);
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

  private async markEntriesAsProcessed(startId: string, endId: string) {
    await this.db.update(entries)
      .set({ processedForTrends: true })
      .where(sql`${entries.id} >= ${startId} AND ${entries.id} <= ${endId}`);
  }

  async getDailyTrends() {
    return this.db.select({
      keyword: trends.keyword,
      totalFrequency: sql`sum(${trends.frequency})`.as('total_frequency')
    })
      .from(trends)
      .where(sql`${trends.time} > NOW() - INTERVAL '1 day'`)
      .groupBy(trends.keyword)
      .orderBy(desc(sql`total_frequency`))
      .limit(10);
  }

  async getWeeklyTrends() {
    return this.db.select({
      keyword: trends.keyword,
      totalFrequency: sql<number>`sum(${trends.frequency})`.as('total_frequency'),
      avgDailyFrequency: sql<number>`avg(${trends.frequency})`.as('avg_daily_frequency'),
      distinctDays: sql<number>`count(distinct date_trunc('day', ${trends.time}))`.as('distinct_days')
    })
      .from(trends)
      .where(sql`${trends.time} > NOW() - INTERVAL '7 days'`)
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
}
