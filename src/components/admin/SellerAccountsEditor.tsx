import { nextSellerKey, usernameFrom, type SellerDraft } from '../../utils/sellerDrafts';
import { Button } from '../ui/Button';
import { INPUT_COMPACT_CLASS, LABEL_CLASS, LABEL_TEXT_CLASS } from '../ui/formStyles';

/**
 * Las vendedoras y su acceso al panel. Cada una entra con su usuario y contraseña ("Soy
 * vendedora" en la pantalla de ingreso), ve solo Ventas y Clientas, y sus ventas quedan a su nombre.
 */
export function SellerAccountsEditor({ drafts, onChange }: { drafts: SellerDraft[]; onChange: (drafts: SellerDraft[]) => void }) {
  function update(key: string, patch: Partial<SellerDraft>) {
    onChange(drafts.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  function add() {
    onChange([
      ...drafts,
      { key: nextSellerKey(), name: '', username: '', hasAccess: false, password: '', removeAccess: false, usernameEdited: false },
    ]);
  }

  function remove(draft: SellerDraft) {
    if (draft.id && !window.confirm(`¿Quitar a ${draft.name || 'esta vendedora'}? Sus ventas viejas siguen a su nombre.`)) return;
    onChange(drafts.filter((d) => d.key !== draft.key));
  }

  const panelUrl = `${window.location.origin}/#/admin`;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-stone-600">
        Para entrar, la vendedora abre <strong className="font-semibold">{panelUrl}</strong>, toca “Soy vendedora” y pone su
        usuario y contraseña. Solo ve Ventas y Clientas: no ve costos, ganancias ni reportes, y no puede tocar productos ni
        configuración. Sin contraseña igual se le pueden atribuir ventas, pero no puede entrar.
      </p>

      {drafts.map((draft) => (
        <div key={draft.key} className="flex flex-col gap-2 rounded-lg border border-stone-200 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className={LABEL_CLASS}>
              <span className={LABEL_TEXT_CLASS}>Nombre</span>
              <input
                value={draft.name}
                onChange={(e) =>
                  update(draft.key, {
                    name: e.target.value,
                    ...(draft.usernameEdited ? {} : { username: usernameFrom(e.target.value) }),
                  })
                }
                className={INPUT_COMPACT_CLASS}
              />
            </label>
            <label className={LABEL_CLASS}>
              <span className={LABEL_TEXT_CLASS}>Usuario</span>
              <input
                value={draft.username}
                onChange={(e) => update(draft.key, { username: e.target.value.toLowerCase().replace(/\s+/g, ''), usernameEdited: true })}
                autoCapitalize="none"
                autoComplete="off"
                className={INPUT_COMPACT_CLASS}
              />
            </label>
          </div>

          <p className={`text-xs font-semibold ${draft.hasAccess && !draft.removeAccess ? 'text-stock-in' : 'text-stone-600'}`}>
            {draft.hasAccess && !draft.removeAccess ? '✓ Puede entrar al panel' : 'Sin acceso al panel'}
          </p>

          {!draft.removeAccess && (
            <label className={LABEL_CLASS}>
              <span className={LABEL_TEXT_CLASS}>{draft.hasAccess ? 'Cambiar contraseña' : 'Contraseña para entrar'}</span>
              <input
                type="text"
                value={draft.password}
                onChange={(e) => update(draft.key, { password: e.target.value })}
                placeholder={draft.hasAccess ? 'Dejala vacía para no cambiarla' : 'Mínimo 6 caracteres'}
                autoComplete="new-password"
                className={`${INPUT_COMPACT_CLASS} sm:max-w-xs`}
              />
            </label>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            {draft.hasAccess ? (
              <label className="flex min-h-11 items-center gap-2 text-sm text-stone-700">
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={draft.removeAccess}
                  onChange={(e) => update(draft.key, { removeAccess: e.target.checked, password: '' })}
                />
                Quitarle el acceso
              </label>
            ) : (
              <span />
            )}
            <Button type="button" variant="danger" onClick={() => remove(draft)}>
              Quitar vendedora
            </Button>
          </div>
        </div>
      ))}

      <Button type="button" variant="secondary" className="self-start" onClick={add}>
        + Agregar vendedora
      </Button>
    </div>
  );
}
