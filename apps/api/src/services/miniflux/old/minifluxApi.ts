import axios from 'axios';

const MINIFLUX_API_URL = process.env.MINIFLUX_API_URL;
const MINIFLUX_API_KEY = process.env.MINIFLUX_API_KEY;

const apiClient = axios.create({
  baseURL: MINIFLUX_API_URL,
  headers: {
    'X-Auth-Token': MINIFLUX_API_KEY,
  },
});

export const minifluxApi = {
  async getUsers() {
    const response = await apiClient.get('/users');
    return response.data;
  },

  async getFeeds() {
    const response = await apiClient.get('/feeds');
    return response.data;
  },

  async getEntries(params: { feed_id?: number; status?: string; limit?: number; offset?: number }) {
    const queryParams = new URLSearchParams(params as Record<string, string>).toString();
    const response = await apiClient.get(`/entries?${queryParams}`);
    return response.data;
  },
};
