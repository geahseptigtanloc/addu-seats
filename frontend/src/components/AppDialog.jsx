import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, Info, WarningCircle, X } from '@phosphor-icons/react';

const TONES = {
  info: {
    icon: Info,
    iconClasses: 'bg-blue-100 text-[#063a64]',
    confirmClasses: 'ui-button-primary',
  },
  success: {
    icon: CheckCircle,
    iconClasses: 'bg-emerald-100 text-emerald-800',
    confirmClasses: 'ui-button-primary bg-emerald-700 hover:bg-emerald-800',
  },
  warning: {
    icon: WarningCircle,
    iconClasses: 'bg-amber-100 text-amber-800',
    confirmClasses: 'ui-button-primary',
  },
  danger: {
    icon: WarningCircle,
    iconClasses: 'bg-red-100 text-red-800',
    confirmClasses: 'ui-button-danger bg-red-700 text-white hover:bg-red-800',
  },
};

export default function AppDialog({
  open,
  title,
  description,
  tone = 'info',
  confirmLabel = 'OK',
  cancelLabel,
  busy = false,
  dismissible = true,
  onConfirm,
  onClose,
  children,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef(null);
  const confirmRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  const dismissibleRef = useRef(dismissible);
  const toneConfig = TONES[tone] || TONES.info;
  const Icon = toneConfig.icon;

  onCloseRef.current = onClose;
  busyRef.current = busy;
  dismissibleRef.current = dismissible;

  useEffect(() => {
    if (!open) return undefined;

    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => confirmRef.current?.focus(), 0);

    function handleKeyDown(event) {
      if (event.key === 'Escape' && dismissibleRef.current && !busyRef.current) {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }

      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] grid place-items-end bg-slate-950/55 p-0 sm:place-items-center sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && dismissible && !busy) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        className="w-full rounded-t-[8px] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.32)] sm:max-w-md sm:rounded-[8px]"
        role={tone === 'danger' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <div className="flex items-start gap-4 border-b border-slate-200 p-5">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[8px] ${toneConfig.iconClasses}`}>
            <Icon size={24} weight="duotone" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-semibold text-slate-950">{title}</h2>
            {description && <p id={descriptionId} className="mt-1 text-sm leading-6 text-slate-600">{description}</p>}
          </div>
          {dismissible && (
            <button type="button" onClick={onClose} disabled={busy} className="ui-icon-button shrink-0 border-transparent" aria-label="Close dialog">
              <X size={19} weight="bold" />
            </button>
          )}
        </div>

        {children && <div className="px-5 pt-5">{children}</div>}

        <div className="flex flex-col-reverse gap-2 p-5 sm:flex-row sm:justify-end">
          {cancelLabel && (
            <button type="button" onClick={onClose} disabled={busy} className="ui-button-secondary">
              {cancelLabel}
            </button>
          )}
          <button ref={confirmRef} type="button" onClick={onConfirm || onClose} disabled={busy} className={toneConfig.confirmClasses}>
            {busy ? 'Please wait...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
