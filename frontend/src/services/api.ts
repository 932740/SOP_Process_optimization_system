import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Initialize anonymous id
let anonymousId = localStorage.getItem('anonymous_id')
if (!anonymousId) {
  anonymousId = uuidv4()
  localStorage.setItem('anonymous_id', anonymousId)
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  } else if (anonymousId) {
    config.headers['X-Anonymous-ID'] = anonymousId
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      // Do not redirect to login for anonymous users
    }
    return Promise.reject(err)
  }
)

export default api

export const authApi = {
  login: (data: { username: string; password: string }) => api.post('/auth/login', data),
}

export const documentApi = {
  list: (status?: string) => api.get('/sop-documents', { params: { status } }),
  get: (id: number) => api.get(`/sop-documents/${id}`),
  create: (data: any) => api.post('/sop-documents', data),
  update: (id: number, data: any) => api.put(`/sop-documents/${id}`, data),
  remove: (id: number) => api.delete(`/sop-documents/${id}`),
  submit: (id: number) => api.post(`/sop-documents/${id}/submit`),
}

export const stepApi = {
  create: (docId: number, data: any) => api.post(`/sop-documents/${docId}/steps`, data),
  update: (stepId: number, data: any) => api.put(`/sop-documents/steps/${stepId}`, data),
  remove: (stepId: number) => api.delete(`/sop-documents/steps/${stepId}`),
  aiOptimize: (stepId: number, data: any) => api.post(`/steps/${stepId}/ai-optimize`, data),
}

export const exportApi = {
  createTask: (data: any) => api.post('/exports', data),
  getStatus: (taskId: number) => api.get(`/exports/${taskId}/status`),
}

export const adminApi = {
  getUsers: () => api.get('/admin/users'),
  createUser: (data: any) => api.post('/admin/users', data),
  updateUserRole: (id: number, data: any) => api.put(`/admin/users/${id}/role`, data),
  getDepartmentFormats: () => api.get('/admin/department-formats'),
  updateDepartmentFormat: (id: number, data: any) => api.put(`/admin/department-formats/${id}`, data),
  getAiModels: () => api.get('/admin/ai-models'),
  createAiModel: (data: any) => api.post('/admin/ai-models', data),
  updateAiModel: (id: number, data: any) => api.put(`/admin/ai-models/${id}`, data),
  deleteAiModel: (id: number) => api.delete(`/admin/ai-models/${id}`),
  getLogs: (params?: any) => api.get('/admin/operation-logs', { params }),
}

export const setupApi = {
  getStatus: () => api.get('/setup/status'),
  initialize: (data: any) => api.post('/setup/init', data),
}
