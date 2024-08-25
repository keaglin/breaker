import axios, { type AxiosInstance, type AxiosError } from 'axios';
import logger from '../../../../../packages/utils/src/logger';

export class MinifluxClient {
  private apiClient: AxiosInstance;

  constructor(apiUrl: string, apiKey: string) {
    console.debug('MinifluxClient constructor', apiUrl, apiKey);
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

  async getFeeds(afterId?: number) {
    try {
      const response = await this.apiClient.get('/v1/feeds');
      let feeds = response.data;

      if (afterId) {
        feeds = feeds.filter((feed: any) => feed.id > afterId);
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
  }) {
    try {
      console.debug(`getEntries params`, params);
      const url = new URL(`${this.apiClient.defaults.baseURL}/v1/entries`);
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value.toString());
      });
      console.debug(`Fetching entries from Miniflux`, { fullUrl: url.toString() });
      const response = await this.apiClient.get('/v1/entries', { params });
      console.debug('response keys', Object.keys(response.data));
      // console.debug(`Received entries from Miniflux`, { total: response.data.total, entries: response.data.entries });
      return response.data.entries; // Return the 'entries' array from the response
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
