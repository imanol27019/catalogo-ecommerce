import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../ui/Button';

interface AdminLoginScreenProps {
  onSubmit: (password: string) => void;
  error?: string | null;
}

export function AdminLoginScreen({ onSubmit, error }: AdminLoginScreenProps) {
  const [input, setInput] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!input.trim()) return;
    onSubmit(input.trim());
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-1 text-center font-heading text-lg font-semibold text-stone-900">Panel de administración</h1>
      <p className="mb-6 text-center text-sm text-stone-500">Ingresá la contraseña de administrador para continuar.</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Contraseña"
          autoFocus
          className="rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full">
          Entrar
        </Button>
      </form>
    </div>
  );
}
