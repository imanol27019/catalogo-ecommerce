import { SHIPPING_METHODS } from '../../config/site.config';

interface ShippingMethodPickerProps {
  selectedId: string;
  onChange: (id: string) => void;
}

export function ShippingMethodPicker({ selectedId, onChange }: ShippingMethodPickerProps) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-stone-800">Método de envío</p>
      <div className="flex flex-col gap-2">
        {SHIPPING_METHODS.map((method) => {
          const isActive = method.id === selectedId;
          return (
            <label
              key={method.id}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                isActive ? 'border-brand-600 bg-brand-50' : 'border-stone-300 bg-white hover:border-stone-400'
              }`}
            >
              <input
                type="radio"
                name="shipping-method"
                className="mt-0.5"
                checked={isActive}
                onChange={() => onChange(method.id)}
              />
              <span>
                <span className="block font-semibold text-stone-900">{method.label}</span>
                {method.description && <span className="block text-xs text-stone-500">{method.description}</span>}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
