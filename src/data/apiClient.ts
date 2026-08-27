const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new ApiError(res.status, `GET ${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiPut<T>(path: string, body: unknown, adminPassword: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Password': adminPassword },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, data.error ?? `PUT ${path} -> ${res.status}`);
  }
  return res.json() as Promise<T>;
}
