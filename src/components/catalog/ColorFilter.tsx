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
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Color</p>
      <div className="flex flex-wrap gap-3">
        {colors.map((color) => {
          const isActive = selected.includes(color.name);
          return (
            <button
              key={color.name}
              type="button"
              onClick={() => toggle(color.name)}
              title={color.name}
              aria-pressed={isActive}
              aria-label={color.name}
              className={`h-9 w-9 rounded-full ring-1 ring-inset ring-black/10 transition-transform ${
                isActive ? 'scale-110 outline outline-2 outline-offset-2 outline-brand-600' : ''
              }`}
              style={{ backgroundColor: color.hex }}
            />
          );
        })}
      </div>
    </div>
  );
}
