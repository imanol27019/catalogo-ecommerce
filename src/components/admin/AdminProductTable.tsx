import type { Product } from '../../types/product';
import { CATEGORY_LABELS } from '../../config/site.config';
import { formatCurrency } from '../../utils/format';

const STATUS_LABELS: Record<Product['status'], string> = {
  active: 'Activo',
  draft: 'Borrador',
  archived: 'Archivado',
};

interface AdminProductTableProps {
  products: Product[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function AdminProductTable({ products, onEdit, onDelete }: AdminProductTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
          <tr>
            <th className="px-3 py-2">Producto</th>
            <th className="px-3 py-2">Categoría</th>
            <th className="px-3 py-2">Precio</th>
            <th className="px-3 py-2">Estado</th>
            <th className="px-3 py-2">Variantes</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {products.map((product) => (
            <tr key={product.id}>
              <td className="px-3 py-2 font-medium text-stone-900">{product.name}</td>
              <td className="px-3 py-2 text-stone-600">{CATEGORY_LABELS[product.category] ?? product.category}</td>
              <td className="px-3 py-2 text-stone-600">{formatCurrency(product.unitPrice)}</td>
              <td className="px-3 py-2 text-stone-600">{STATUS_LABELS[product.status]}</td>
              <td className="px-3 py-2 text-stone-600">{product.variants.length}</td>
              <td className="px-3 py-2 text-right whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => onEdit(product.id)}
                  className="mr-3 font-semibold text-brand-700 hover:text-brand-800"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(product.id)}
                  className="font-semibold text-red-600 hover:text-red-700"
                >
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
