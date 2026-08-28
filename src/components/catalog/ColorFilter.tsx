interface ColorFilterProps {
  colors: { name: string; hex: string }[];
  selected: string[];
  onChange: (colors: string[]) => void;
}

export function ColorFilter({ colors, selected, onChange }: ColorFilterProps) {
  function toggle(name: string) {
    onChange(selected.includes(name) ? selected.filter((c) => c !== name) : [...selected, name]);
  }

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-600">Color</p>
      <div className="flex flex-wrap gap-2">
        {colors.map((color) => {
          const isActive = selected.includes(color.name);
          return (
            // El botón mide 44px para poder tocarlo cómodo; la muestra de color va adentro y más
            // chica, así el área táctil no depende del tamaño del círculo.
            <button
              key={color.name}
              type="button"
              onClick={() => toggle(color.name)}
              title={color.name}
              aria-pressed={isActive}
              aria-label={color.name}
              className="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-stone-100"
            >
              <span
                aria-hidden="true"
                className={`block h-8 w-8 rounded-full ring-1 ring-inset ring-black/10 transition-transform ${
                  isActive ? 'scale-110 outline outline-2 outline-offset-2 outline-brand-600' : ''
                }`}
                /* Color del producto: dato del catálogo, no un token del sistema de diseño. */
                style={{ backgroundColor: color.hex }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
