import axios, { type AxiosInstance, type AxiosError } from 'axios';
import logger from '../../../../../packages/utils/src/logger';
import invariant from 'tiny-invariant';

// New interfaces based on the Miniflux API reference
export interface MinifluxFeed {
  id: number;
  user_id: number;
  title: string;
  site_url: string;
  feed_url: string;
  checked_at: string;
  etag_header: string;
  last_modified_header: string;
  parsing_error_message: string;
  parsing_error_count: number;
  scraper_rules: string;
  rewrite_rules: string;
  crawler: boolean;
  blocklist_rules: string;
  keeplist_rules: string;
  user_agent: string;
  username: string;
  password: string;
  disabled: boolean;
  ignore_http_cache: boolean;
  fetch_via_proxy: boolean;
  category: MinifluxCategory;
  icon: {
    feed_id: number;
    icon_id: number;
  } | null;
}

export interface MinifluxEntry {
  id: number;
  user_id: number;
  feed_id: number;
  title: string;
  url: string;
  comments_url: string;
  author: string;
  content: string;
  hash: string;
  published_at: string;
  created_at: string;
  status: string;
  share_code: string;
  starred: boolean;
  reading_time: number;
  enclosures: any[] | null;
  feed: MinifluxFeed;
}

export interface MinifluxCategory {
  id: number;
  user_id: number;
  title: string;
}

export class MinifluxClient {
  private static instance: MinifluxClient;
  private apiClient: AxiosInstance;

  private constructor(apiUrl: string, apiKey: string) {
    this.apiClient = axios.create({
      baseURL: apiUrl,
      headers: {
        'X-Auth-Token': apiKey,
      },
    });

    // Add request interceptor for logging
    this.apiClient.interceptors.request.use((config) => {
      logger.info(`Making request to Miniflux: ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    });

    // Add response interceptor for error handling
    this.apiClient.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response) {
          logger.error(`Miniflux API error: ${error.response.status} ${error.response.statusText}`, {
            url: error.config?.url,
            method: error.config?.method,
            data: error.response.data,
          });
        } else if (error.request) {
          logger.error('Miniflux API error: No response received', { error: error.message });
        } else {
          logger.error('Miniflux API error: Request setup failed', { error: error.message });
        }
        return Promise.reject(error);
      }
    );
  }

  public static getInstance(): MinifluxClient {
    if (!MinifluxClient.instance) {
      invariant(process.env.MINIFLUX_API_URL, 'MINIFLUX_API_URL is not set');
      invariant(process.env.MINIFLUX_API_KEY, 'MINIFLUX_API_KEY is not set');

      MinifluxClient.instance = new MinifluxClient(
        process.env.MINIFLUX_API_URL,
        process.env.MINIFLUX_API_KEY
      );
    }
    return MinifluxClient.instance;
  }

  async seedDatabase() {
    try {
      logger.info('Starting database seed process');

      // Get all feeds
      const feeds = await this.getFeeds();
      logger.info(`Retrieved ${feeds.length} feeds`);

      const allEntries = [];

      // Get entries for each feed
      for (const feed of feeds) {
        logger.info(`Fetching entries for feed ${feed.id}`);
        const entries = await this.getEntries({ feed_id: feed.id, limit: 100 }); // Adjust limit as needed
        allEntries.push(...entries);
        logger.info(`Retrieved ${entries.length} entries for feed ${feed.id}`);
      }

      logger.info(`Total entries retrieved: ${allEntries.length}`);

      return {
        feeds,
        entries: allEntries
      };
    } catch (error) {
      logger.error('Failed to seed database from Miniflux', { error });
      throw error;
    }
  }

  async getUsers() {
    try {
      const response = await this.apiClient.get('/v1/users');
      return response.data;
    } catch (error) {
      logger.error('Failed to get users from Miniflux', { error });
      throw error;
    }
  }

  async getFeeds(afterId?: number): Promise<MinifluxFeed[]> {
    try {
      const response = await this.apiClient.get<MinifluxFeed[]>('/v1/feeds');
      let feeds = response.data;

      if (afterId) {
        feeds = feeds.filter((feed) => feed.id > afterId);
      }

      return feeds;
    } catch (error) {
      logger.error('Failed to get feeds from Miniflux', { error, afterId });
      throw error;
    }
  }

  async getEntries(params: {
    feed_id?: number;
    status?: string;
    limit?: number;
    offset?: number;
    after_entry_id?: number;
    order?: 'id' | 'status' | 'published_at';
    direction?: 'asc' | 'desc';
  }): Promise<MinifluxEntry[]> {
    try {
      const response = await this.apiClient.get<{ entries: MinifluxEntry[] }>('/v1/entries', { params });
      return response.data.entries;
    } catch (error) {
      logger.error('Failed to get entries from Miniflux', { error, params });
      throw error;
    }
  }

  async refreshFeed(feedId: number) {
    try {
      await this.apiClient.put(`/v1/feeds/${feedId}/refresh`);
      logger.info(`Successfully refreshed feed ${feedId}`);
    } catch (error) {
      logger.error(`Failed to refresh feed ${feedId}`, { error });
      throw error;
    }
  }
}

// Export the singleton instance
export const minifluxClient = MinifluxClient.getInstance();
