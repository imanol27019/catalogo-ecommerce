import type {
  CashSummary,
  Client,
  ClientPayload,
  ClientWithStats,
  SalesConfig,
  SalesConfigPayload,
  SalesReport,
} from '../types/sales';
import { apiDelete, apiGet, apiPost, apiPut } from './apiClient';

export async function fetchSalesConfig(password: string): Promise<SalesConfig> {
  return apiGet<SalesConfig>('/api/sales-config', password);
}

export async function saveSalesConfig(payload: SalesConfigPayload, password: string): Promise<SalesConfig> {
  return apiPut<SalesConfig>('/api/sales-config', payload, password);
}

export async function fetchClients(password: string): Promise<ClientWithStats[]> {
  return apiGet<ClientWithStats[]>('/api/clients', password);
}

export async function createClient(payload: ClientPayload, password: string): Promise<Client> {
  return apiPost<Client>('/api/clients', payload, password);
}

export async function updateClient(id: string, payload: ClientPayload, password: string): Promise<Client> {
  return apiPut<Client>(`/api/clients/${id}`, payload, password);
}

export async function deleteClient(id: string, password: string): Promise<void> {
  await apiDelete<{ ok: true }>(`/api/clients/${id}`, password);
}

export async function fetchCashSummary(date: string, password: string): Promise<CashSummary> {
  return apiGet<CashSummary>(`/api/cash?${new URLSearchParams({ date }).toString()}`, password);
}

export async function fetchSalesReport(from: string, to: string, password: string): Promise<SalesReport> {
  return apiGet<SalesReport>(`/api/reports?${new URLSearchParams({ from, to }).toString()}`, password);
}
