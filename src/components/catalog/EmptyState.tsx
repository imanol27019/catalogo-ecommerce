import { Button } from '../ui/Button';

export function EmptyState({ onClearFilters }: { onClearFilters: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center">
      <p className="text-base font-semibold text-stone-800">No encontramos productos con esos filtros.</p>
      <p className="text-sm text-stone-500">Probá ajustar la búsqueda o quitar algún filtro.</p>
      <Button variant="secondary" onClick={onClearFilters}>
        Limpiar filtros
      </Button>
    </div>
  );
}
