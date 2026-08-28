import { useEffect } from 'react';

/**
 * Bloquea el scroll del fondo mientras hay una capa modal abierta.
 *
 * Usa un contador porque puede haber dos capas abiertas a la vez (el carrito y, encima, el modal
 * de checkout). Antes cada componente escribía `document.body.style.overflow` por su cuenta, así
 * que al cerrar el de arriba se liberaba el scroll aunque el de abajo siguiera abierto. Solo
 * funcionaba de casualidad, porque el efecto del Drawer se re-ejecutaba en cada render y volvía a
 * ponerlo. Con el contador, el scroll se libera recién cuando se cierra la última capa.
 */
let openLayers = 0;
let previousOverflow = '';

export function useScrollLock(isActive: boolean): void {
  useEffect(() => {
    if (!isActive) return;

    if (openLayers === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    openLayers += 1;

    return () => {
      openLayers -= 1;
      if (openLayers === 0) document.body.style.overflow = previousOverflow;
    };
  }, [isActive]);
}
