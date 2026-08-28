import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { ApiError, apiUploadImage, resolveImageUrl } from '../../data/apiClient';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { CloseIcon } from '../ui/icons';

interface AdminImagesEditorProps {
  images: string[];
  adminPassword: string;
  onChange: (images: string[]) => void;
}

/**
 * Las fotos se suben tal cual: no se redimensionan ni se recomprimen en el navegador, así la
 * calidad que ve la clienta es la misma del archivo original. La primera de la lista es la que
 * aparece en la grilla del catálogo.
 */
export function AdminImagesEditor({ images, adminPassword, onChange }: AdminImagesEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlDraft, setUrlDraft] = useState('');

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    setUploading(true);
    setError(null);
    const subidas: string[] = [];
    try {
      for (const file of files) {
        const { url } = await apiUploadImage(file, adminPassword);
        subidas.push(url);
      }
      onChange([...images, ...subidas]);
    } catch (err) {
      const base = err instanceof ApiError ? err.userMessage : 'No se pudo subir la imagen.';
      // Si falló a mitad de camino, igual se conservan las que sí entraron.
      if (subidas.length > 0) onChange([...images, ...subidas]);
      setError(subidas.length > 0 ? `${base} Se subieron ${subidas.length} de ${files.length}.` : base);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function addUrl() {
    const url = urlDraft.trim();
    if (!url) return;
    onChange([...images, url]);
    setUrlDraft('');
  }

  function remove(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-600">
        Fotos {images.length > 0 && <span className="font-normal normal-case">· la primera es la de portada</span>}
      </p>

      {images.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-3">
          {images.map((src, index) => (
            <li key={`${src}-${index}`} className="relative">
              <img
                src={resolveImageUrl(src)}
                alt={`Foto ${index + 1}`}
                className="h-24 w-20 rounded-lg object-cover ring-1 ring-stone-200"
              />
              {index === 0 && (
                <span className="absolute left-1 top-1 rounded bg-stone-900/80 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                  Portada
                </span>
              )}
              <div className="absolute -right-2 -top-2">
                <IconButton
                  icon={<CloseIcon className="h-4 w-4" />}
                  label={`Quitar foto ${index + 1}`}
                  onClick={() => remove(index)}
                  className="h-8 w-8 bg-white text-stone-700 shadow ring-1 ring-stone-200 hover:bg-stone-100"
                />
              </div>
              <div className="mt-1 flex justify-center gap-1">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={`Mover foto ${index + 1} hacia la izquierda`}
                  className="min-h-9 rounded border border-stone-300 px-2 text-xs text-stone-700 disabled:opacity-40"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === images.length - 1}
                  aria-label={`Mover foto ${index + 1} hacia la derecha`}
                  className="min-h-9 rounded border border-stone-300 px-2 text-xs text-stone-700 disabled:opacity-40"
                >
                  →
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        onChange={handleFiles}
        className="hidden"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? 'Subiendo…' : '+ Subir fotos'}
        </Button>
        <span className="text-xs text-stone-600">JPG, PNG o WebP · hasta 8 MB · se guardan sin recomprimir</span>
      </div>

      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-stone-600">o pegar la dirección de una foto</summary>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addUrl();
              }
            }}
            placeholder="https://..."
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500"
          />
          <Button type="button" variant="secondary" onClick={addUrl}>
            Agregar
          </Button>
        </div>
      </details>

      {error && (
        <Alert tone="error" className="mt-2">
          {error}
        </Alert>
      )}
    </div>
  );
}
