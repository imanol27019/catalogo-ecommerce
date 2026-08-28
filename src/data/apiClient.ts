const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  status: number;
  /** true cuando ni siquiera se pudo llegar al servidor (sin internet, servidor apagado). */
  isNetwork: boolean;

  constructor(status: number, message: string, isNetwork = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.isNetwork = isNetwork;
  }

  /** Mensaje listo para mostrarle a una persona, sin jerga técnica. */
  get userMessage(): string {
    if (this.isNetwork) return 'No pudimos conectarnos con el servidor. Revisá tu conexión.';
    if (this.status === 401) return 'La contraseña de administrador no es correcta.';
    if (this.status === 413) return 'El archivo es demasiado grande.';
    if (this.status >= 500) return 'El servidor tuvo un problema. Volvé a intentar en un momento.';
    return this.message;
  }
}

async function toApiError(res: Response, method: string, path: string): Promise<ApiError> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return new ApiError(res.status, data.error ?? `${method} ${path} respondió ${res.status}`);
}

async function request<T>(method: string, path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { method, ...init });
  } catch {
    // fetch solo rechaza cuando no hubo respuesta: sin red, DNS caído o servidor apagado.
    throw new ApiError(0, `No se pudo conectar con el servidor (${method} ${path}).`, true);
  }
  if (!res.ok) throw await toApiError(res, method, path);
  return res.json() as Promise<T>;
}

function jsonHeaders(adminPassword?: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(adminPassword ? { 'X-Admin-Password': adminPassword } : {}),
  };
}

export function apiGet<T>(path: string, adminPassword?: string): Promise<T> {
  return request<T>('GET', path, {
    headers: adminPassword ? { 'X-Admin-Password': adminPassword } : undefined,
  });
}

export function apiPost<T>(path: string, body: unknown, adminPassword?: string): Promise<T> {
  return request<T>('POST', path, { headers: jsonHeaders(adminPassword), body: JSON.stringify(body) });
}

export function apiPatch<T>(path: string, body: unknown, adminPassword: string): Promise<T> {
  return request<T>('PATCH', path, { headers: jsonHeaders(adminPassword), body: JSON.stringify(body) });
}

export function apiPut<T>(path: string, body: unknown, adminPassword: string): Promise<T> {
  return request<T>('PUT', path, { headers: jsonHeaders(adminPassword), body: JSON.stringify(body) });
}

/** Sube el archivo tal cual, sin recomprimir, para no perder calidad de la foto. */
export function apiUploadImage(
  file: File,
  adminPassword: string,
): Promise<{ id: string; url: string; size: number }> {
  return request('POST', '/api/images', {
    headers: { 'Content-Type': file.type, 'X-Admin-Password': adminPassword },
    body: file,
  });
}

/** Las imágenes guardadas en el servidor vienen como ruta relativa; el resto son URLs completas. */
export function resolveImageUrl(src: string): string {
  if (!src) return '';
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) return src;
  if (src.startsWith('/api/')) return `${API_URL}${src}`;
  return src;
}
