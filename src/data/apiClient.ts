const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function parseError(res: Response, method: string, path: string): Promise<ApiError> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return new ApiError(res.status, data.error ?? `${method} ${path} -> ${res.status}`);
}

export async function apiGet<T>(path: string, adminPassword?: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: adminPassword ? { 'X-Admin-Password': adminPassword } : undefined,
  });
  if (!res.ok) throw await parseError(res, 'GET', path);
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown, adminPassword?: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(adminPassword ? { 'X-Admin-Password': adminPassword } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await parseError(res, 'POST', path);
  return res.json() as Promise<T>;
}

export async function apiPatch<T>(path: string, body: unknown, adminPassword: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Password': adminPassword },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await parseError(res, 'PATCH', path);
  return res.json() as Promise<T>;
}

export async function apiPut<T>(path: string, body: unknown, adminPassword: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Password': adminPassword },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await parseError(res, 'PUT', path);
  return res.json() as Promise<T>;
}
