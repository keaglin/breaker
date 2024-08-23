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
    const response = await apiClient.get('/v1/users');
    return response.data;
  },

  async getFeeds() {
    const response = await apiClient.get('/v1/feeds');
    return response.data;
  },

  async getEntries(status = 'unread', limit = 100) {
    const response = await apiClient.get(`/v1/entries?status=${status}&limit=${limit}`);
    return response.data;
  },
};
