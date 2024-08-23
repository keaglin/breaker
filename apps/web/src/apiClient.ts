import { hc } from 'hono/client'
import type { AppType } from '../../api/src/index' // Adjust the path as needed

export const apiClient = hc<AppType>('http://localhost:3000')
