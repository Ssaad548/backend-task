import axios from 'axios'
import type { Agent } from './types'

export const TOKEN_KEY = 'leadflow_token'
export const USER_KEY = 'leadflow_user'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  headers: { 'Content-Type': 'application/json' },
})

export function getAgents() {
  return api.get<Agent[]>('/users/agents')
}

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem(TOKEN_KEY)
      sessionStorage.removeItem(USER_KEY)
      window.dispatchEvent(new Event('leadflow:unauthorized'))
    }
    return Promise.reject(error)
  },
)

export function apiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message
    if (Array.isArray(message)) return message[0] ?? fallback
    if (typeof message === 'string') return message
  }
  return error instanceof Error ? error.message : fallback
}