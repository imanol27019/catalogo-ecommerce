import type { Product } from '../../types/product';
import { CATEGORY_LABELS } from '../../config/site.config';
import { formatCurrency } from '../../utils/format';
import { isOnSale } from '../../utils/pricing';
import { Button } from '../ui/Button';

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
    <>
      {/* Celular: tarjetas — una tabla de 6 columnas es inusable en 375px. */}
      <div className="flex flex-col gap-3 sm:hidden">
        {products.map((product) => (
          <div key={product.id} className="rounded-xl border border-stone-200 bg-white p-3">
            <p className="font-heading text-sm font-semibold text-stone-900">{product.name}</p>
            <p className="mt-0.5 text-xs text-stone-600">
              {CATEGORY_LABELS[product.category] ?? product.category} · {STATUS_LABELS[product.status]} ·{' '}
              {product.variants.length} variantes
            </p>
            <p className="mt-1.5 font-heading text-base font-semibold text-brand-600">
              {formatCurrency(isOnSale(product) ? product.salePrice! : product.unitPrice)}
              {isOnSale(product) && (
                <span className="ml-2 text-xs font-normal text-stone-600 line-through">
                  {formatCurrency(product.unitPrice)}
                </span>
              )}
            </p>
            <div className="mt-3 flex gap-2 border-t border-stone-100 pt-3">
              <Button variant="secondary" className="flex-1" onClick={() => onEdit(product.id)}>
                Editar
              </Button>
              <Button variant="danger" onClick={() => onDelete(product.id)}>
                Eliminar
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Escritorio: tabla, más cómoda para comparar de un vistazo. */}
      <div className="hidden overflow-x-auto rounded-lg border border-stone-200 bg-white sm:block">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-600">
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
                <td className="whitespace-nowrap px-3 py-2 text-stone-600">
                  {formatCurrency(isOnSale(product) ? product.salePrice! : product.unitPrice)}
                  {isOnSale(product) && (
                    <span className="ml-1.5 text-xs text-stone-600 line-through">
                      {formatCurrency(product.unitPrice)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-stone-600">{STATUS_LABELS[product.status]}</td>
                <td className="px-3 py-2 text-stone-600">{product.variants.length}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => onEdit(product.id)}
                    className="mr-3 min-h-11 font-semibold text-brand-700 hover:text-brand-800"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(product.id)}
                    className="min-h-11 font-semibold text-red-700 hover:text-red-800"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
