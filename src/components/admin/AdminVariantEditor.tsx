import type { Product, ProductVariant, StockStatus } from '../../types/product';
import { STOCK_LABELS } from '../../utils/stock';

interface AdminVariantEditorProps {
  product: Product;
  onChange: (variants: ProductVariant[]) => void;
}

const STOCK_OPTIONS: StockStatus[] = ['in_stock', 'low_stock', 'out_of_stock'];

export function AdminVariantEditor({ product, onChange }: AdminVariantEditorProps) {
  function updateVariant(size: string, color: string, patch: Partial<ProductVariant>) {
    onChange(product.variants.map((v) => (v.size === size && v.color === color ? { ...v, ...patch } : v)));
  }

  if (product.sizes.length === 0 || product.colors.length === 0) {
    return <p className="text-sm text-stone-500">Agregá al menos un talle y un color para definir el stock.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-stone-200 bg-stone-50 px-2 py-1.5 text-left text-xs font-semibold uppercase text-stone-500">
              Talle \ Color
            </th>
            {product.colors.map((color) => (
              <th
                key={color.name}
                className="border border-stone-200 bg-stone-50 px-2 py-1.5 text-xs font-semibold text-stone-700"
              >
                <span
                  className="mr-1 inline-block h-3 w-3 rounded-full align-middle ring-1 ring-inset ring-black/10"
                  style={{ backgroundColor: color.hex }}
                />
                {color.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {product.sizes.map((size) => (
            <tr key={size}>
              <td className="border border-stone-200 px-2 py-1.5 font-semibold text-stone-700">{size}</td>
              {product.colors.map((color) => {
                const variant = product.variants.find((v) => v.size === size && v.color === color.name);
                if (!variant) {
                  return (
                    <td key={color.name} className="border border-stone-200 px-2 py-1.5 text-center text-stone-300">
                      —
                    </td>
                  );
                }
                return (
                  <td key={color.name} className="border border-stone-200 px-2 py-1.5">
                    <select
                      value={variant.stockStatus}
                      onChange={(e) =>
                        updateVariant(size, color.name, { stockStatus: e.target.value as StockStatus })
                      }
                      className="w-full rounded border border-stone-300 px-1.5 py-1 text-xs focus:border-brand-500 focus:outline-none"
                    >
                      {STOCK_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {STOCK_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
