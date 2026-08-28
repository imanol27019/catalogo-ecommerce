import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from './icons';
import { IconButton } from './IconButton';
import { useFocusTrap } from './useFocusTrap';
import { useScrollLock } from './useScrollLock';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidthClassName?: string;
}

export function Modal({ isOpen, onClose, title, children, maxWidthClassName = 'sm:max-w-lg' }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(dialogRef, isOpen, onClose);
  useScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => previouslyFocused?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    // z-50: capa modal, por encima del header sticky (z-30) y de los flotantes (z-20).
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-stone-900/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative flex max-h-[92dvh] w-full min-w-0 flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl outline-none sm:rounded-2xl ${maxWidthClassName}`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-200 py-3 pl-5 pr-3">
          <h2 className="font-heading text-base font-semibold text-stone-900">{title}</h2>
          <IconButton icon={<CloseIcon className="h-5 w-5" />} label="Cerrar" onClick={onClose} />
        </div>
        <div className="min-w-0 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
