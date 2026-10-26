import { useState } from 'react';
import type { FormEvent } from 'react';
import { verifyStaffLogin } from '../../data/admin';
import { ApiError } from '../../data/apiClient';
import type { StaffRole } from '../../types/sales';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import { INPUT_CLASS } from '../ui/formStyles';

export interface StaffLogin {
  password: string;
  /** Usuario de la vendedora; `null` si entró la administradora. */
  user: string | null;
  role: StaffRole;
  sellerName?: string;
}

interface AdminLoginScreenProps {
  onSuccess: (login: StaffLogin) => void;
  /** Mensaje de una sesión anterior (por ejemplo, si la contraseña dejó de ser válida). */
  initialError?: string | null;
}

/**
 * La dueña entra solo con su contraseña, como siempre. Cada vendedora entra con el usuario y la
 * contraseña que le creó la dueña en Configuración → Ventas.
 */
export function AdminLoginScreen({ onSuccess, initialError }: AdminLoginScreenProps) {
  const [isSeller, setSeller] = useState(false);
  const [user, setUser] = useState('');
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [isChecking, setChecking] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const password = input.trim();
    const username = isSeller ? user.trim().toLowerCase() : null;
    if (isSeller && !username) {
      setError('Escribí tu usuario.');
      return;
    }
    if (!password) {
      setError('Escribí la contraseña para continuar.');
      return;
    }

    setChecking(true);
    setError(null);
    try {
      const { role, sellerName } = await verifyStaffLogin(password, username);
      onSuccess({ password, user: username, role, ...(sellerName ? { sellerName } : {}) });
    } catch (err) {
      setError(err instanceof ApiError ? err.userMessage : 'No se pudo verificar la contraseña.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <h1 className="mb-1 text-center font-heading text-lg font-semibold text-stone-900">
        {isSeller ? 'Panel de ventas' : 'Panel de administración'}
      </h1>
      <p className="mb-6 text-center text-sm text-stone-600">
        {isSeller ? 'Entrá con el usuario y la contraseña que te dieron.' : 'Ingresá la contraseña de administradora.'}
      </p>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
        {isSeller && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="sr-only">Usuario</span>
            <input
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder="Usuario"
              autoFocus
              autoCapitalize="none"
              autoComplete="username"
              className={INPUT_CLASS}
            />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm">
          <span className="sr-only">Contraseña</span>
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Contraseña"
            autoFocus={!isSeller}
            autoComplete="current-password"
            aria-invalid={error ? true : undefined}
            className={INPUT_CLASS}
          />
        </label>

        {error && <Alert tone="error">{error}</Alert>}

        <Button type="submit" disabled={isChecking} className="w-full">
          {isChecking ? 'Verificando…' : 'Entrar'}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => {
          setSeller((v) => !v);
          setError(null);
        }}
        className="mt-4 inline-flex min-h-11 items-center justify-center self-center text-sm font-semibold text-brand-700 hover:text-brand-800"
      >
        {isSeller ? 'Soy la administradora' : 'Soy vendedora'}
      </button>
    </div>
  );
}
