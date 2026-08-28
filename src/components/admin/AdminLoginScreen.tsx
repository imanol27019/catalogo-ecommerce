import { useState } from 'react';
import type { FormEvent } from 'react';
import { verifyAdminPassword } from '../../data/admin';
import { ApiError } from '../../data/apiClient';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import { INPUT_CLASS } from '../ui/formStyles';

interface AdminLoginScreenProps {
  onSuccess: (password: string) => void;
  /** Mensaje de una sesión anterior (por ejemplo, si la contraseña dejó de ser válida). */
  initialError?: string | null;
}

export function AdminLoginScreen({ onSuccess, initialError }: AdminLoginScreenProps) {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [isChecking, setChecking] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const password = input.trim();
    if (!password) {
      setError('Escribí la contraseña para continuar.');
      return;
    }

    setChecking(true);
    setError(null);
    try {
      await verifyAdminPassword(password);
      onSuccess(password);
    } catch (err) {
      setError(err instanceof ApiError ? err.userMessage : 'No se pudo verificar la contraseña.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <h1 className="mb-1 text-center font-heading text-lg font-semibold text-stone-900">Panel de administración</h1>
      <p className="mb-6 text-center text-sm text-stone-600">
        Ingresá la contraseña de administrador para continuar.
      </p>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="sr-only">Contraseña</span>
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Contraseña"
            autoFocus
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
    </div>
  );
}
