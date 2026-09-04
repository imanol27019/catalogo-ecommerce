import { useEffect, useState } from 'react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { SearchIcon, CloseIcon } from '../ui/icons';

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBox({ value, onChange }: SearchBoxProps) {
  const [inputValue, setInputValue] = useState(value);
  const debounced = useDebouncedValue(inputValue, 200);

  useEffect(() => {
    onChange(debounced);
    // Se dispara solo cuando cambia el valor debounced — `onChange` no es una dependencia estable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  return (
    <div className="relative">
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-600" />
      <input
        type="search"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="Buscar por nombre, categoría..."
        className="min-h-11 w-full rounded-lg border border-stone-300 bg-white py-2 pl-9 pr-11 text-sm text-stone-900 placeholder:text-stone-600 focus:border-brand-500"
      />
      {inputValue && (
        <button
          type="button"
          onClick={() => setInputValue('')}
          aria-label="Limpiar búsqueda"
          className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-stone-600 hover:bg-stone-100 hover:text-stone-700"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
