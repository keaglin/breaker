import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, desc, sql } from 'drizzle-orm';
// import { Pool } from 'pg';
import { removeStopwords } from 'stopword';
import { trends, entries } from './db/schema';
import { db } from './db';
import type { ArrayBufferSink } from 'bun';

export class TrendAnalyzer {
  private db: ReturnType<typeof drizzle>;
  private sink: ArrayBufferSink;

  constructor(dbConfig: any) {
    this.db = db;
    this.sink = new Bun.ArrayBufferSink();
    this.sink.start({ highWaterMark: 1024 * 1024 }); // 1MB buffer
  }

  async startProcessing() {
    const stream = new ReadableStream({
      pull: async (controller) => {
        const unprocessedEntries = await this.db.select().from(entries)
          .where(eq(entries.processed, false))
          .orderBy(desc(entries.publishedAt))
          .limit(50);

        for (const entry of unprocessedEntries) {
          controller.enqueue(entry);
        }
        if (unprocessedEntries.length < 50) {
          await new Promise(resolve => setTimeout(resolve, 60000)); // Wait for 1 minute before next fetch
        }
      }
    });

    const analyzer = new TransformStream({
      transform: async (entry, controller) => {
        await this.analyzeEntry(entry);
        controller.enqueue(entry);
      }
    });

    const sink = new WritableStream({
      write: async (entry) => {
        await this.db.update(entries)
          .set({ processed: true })
          .where(eq(entries.id, entry.id));
      }
    });

    await stream.pipeThrough(analyzer).pipeTo(sink);
  }

  private async analyzeEntry(entry: any) {
    const words = removeStopwords(entry.content.toLowerCase().split(/\W+/));
    const trendCounts = new Map();

    words.forEach(word => {
      trendCounts.set(word, (trendCounts.get(word) || 0) + 1);
    });

    // Save trend data
    const trendData = Array.from(trendCounts.entries()).map(([keyword, frequency]) => ({
      keyword,
      frequency
    }));

    await this.db.insert(trends).values({
      time: new Date(),
      trendType: 'keyword_frequency',
      keyword: trendData[0]?.keyword || '', // Just inserting the top keyword for simplicity
      frequency: trendData[0]?.frequency || 0,
      data: JSON.stringify(trendData)
    });
  }

  async getRecentTrends() {
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

  async detectBursts() {
    // This query is complex and might be easier to do with raw SQL
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
