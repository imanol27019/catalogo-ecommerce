import { useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from './icons';
import { IconButton } from './IconButton';
import { useFocusTrap } from './useFocusTrap';
import { useScrollLock } from './useScrollLock';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Drawer({ isOpen, onClose, title, children, footer }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useFocusTrap(panelRef, isOpen, onClose);
  useScrollLock(isOpen);

  if (!isOpen) return null;

  return createPortal(
    // z-50: misma capa que Modal. El checkout se abre encima de este drawer y el bloqueo de
    // scroll lo coordina useScrollLock con un contador.
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-stone-900/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex h-full w-full min-w-0 max-w-md flex-col bg-stone-50 shadow-xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-200 bg-white py-3 pl-5 pr-3">
          <h2 className="font-heading text-base font-semibold text-stone-900">{title}</h2>
          <IconButton icon={<CloseIcon className="h-5 w-5" />} label="Cerrar" onClick={onClose} />
        </div>
        <div className="min-w-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="shrink-0 border-t border-stone-200 bg-white px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
