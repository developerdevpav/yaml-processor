import { AlertCircle, CheckVerified02, File02, Play, Plus, XClose } from '@untitledui/icons';
import { Button as AriaButton, Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components';
import { ProcessSelectField } from '../ProcessSelectField';
import { cn, formatJsonSnippet } from '../../utils/ui';

export function Page({ children }) {
  return <div className="min-h-screen bg-[#f8fafc] text-slate-900">{children}</div>;
}

export function PageSection({ children, className = '' }) {
  return <section className={className}>{children}</section>;
}

export function Split({ children, className = '', hasGutter = false }) {
  return <div className={cn('flex', hasGutter && 'gap-6', className)}>{children}</div>;
}

export function SplitItem({ children, className = '', isFilled = false }) {
  return <div className={cn(isFilled ? 'min-w-0 flex-1' : 'shrink-0', className)}>{children}</div>;
}

export function Card({ children, className = '' }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05),0_1px_3px_rgba(16,24,40,0.1)]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '' }) {
  return <div className={cn('px-6 pt-6 text-lg font-semibold tracking-[-0.02em] text-slate-900', className)}>{children}</div>;
}

export function CardBody({ children, className = '' }) {
  return <div className={cn('px-6 pb-6 pt-4', className)}>{children}</div>;
}

export function Form({ children, onSubmit }) {
  return <form onSubmit={onSubmit} className="space-y-5">{children}</form>;
}

export function FormGroup({ label, fieldId, children }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={fieldId} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      {children}
    </div>
  );
}

export function Button({
  children,
  className = '',
  variant = 'primary',
  type = 'button',
  isLoading = false,
  isDisabled = false,
  isBlock = false,
  ...props
}) {
  const variantClassName = {
    primary: 'bg-[#7f56d9] text-white shadow-sm hover:bg-[#6941c6]',
    success: 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700',
    secondary: 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50',
    link: 'bg-transparent px-0 py-0 text-[#6941c6] hover:text-[#53389e]',
    plain: 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700',
  }[variant] ?? 'bg-[#7f56d9] text-white shadow-sm hover:bg-[#6941c6]';

  return (
    <button
      type={type}
      disabled={isDisabled || isLoading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
        isBlock && 'w-full',
        variant !== 'link' && variant !== 'plain' && 'min-h-11',
        variantClassName,
        className,
      )}
      {...props}
    >
      {isLoading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

export function YamlActionsMenu({
  onImport,
  onExport,
  isImporting = false,
  isExporting = false,
  canExport = false,
}) {
  return (
    <MenuTrigger>
      <AriaButton
        className={cn(
          'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-300 transition hover:bg-slate-50',
          (isImporting || isExporting) && 'cursor-not-allowed opacity-60',
        )}
        isDisabled={isImporting || isExporting}
      >
        {isImporting || isExporting ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <File02 aria-hidden size={16} />
        )}
        Экспорт/импорт
      </AriaButton>
      <Popover
        offset={6}
        className="z-[360] min-w-[220px] overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-[0_12px_32px_rgba(16,24,40,0.12)] outline-none"
      >
        <Menu className="outline-none">
          <MenuItem
            onAction={onImport}
            className="cursor-pointer rounded-lg px-3 py-2 text-sm text-slate-700 outline-none transition hover:bg-slate-50"
          >
            Импортировать YAML
          </MenuItem>
          <MenuItem
            onAction={onExport}
            isDisabled={!canExport}
            className="cursor-pointer rounded-lg px-3 py-2 text-sm text-slate-700 outline-none transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Экспортировать YAML
          </MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

export function TopologyPlaygroundMenu({
  onOpenJsonLogicPlayground,
  onOpenProcessPlayground,
}) {
  return (
    <MenuTrigger>
      <AriaButton
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
        aria-label="Playground"
      >
        <Play aria-hidden size={16} />
        Playground
      </AriaButton>
      <Popover
        offset={6}
        className="z-[360] min-w-[180px] overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-[0_12px_32px_rgba(16,24,40,0.12)] outline-none"
      >
        <Menu className="outline-none">
          <MenuItem
            onAction={onOpenJsonLogicPlayground}
            className="cursor-pointer rounded-lg px-3 py-2 text-sm text-slate-700 outline-none transition hover:bg-slate-50"
          >
            JsonLogic
          </MenuItem>
          <MenuItem
            onAction={onOpenProcessPlayground}
            className="cursor-pointer rounded-lg px-3 py-2 text-sm text-slate-700 outline-none transition hover:bg-slate-50"
          >
            Процесс
          </MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

export function Toast({ title, message, onClose, variant = 'success' }) {
  const isError = variant === 'error';
  return (
    <div className={cn('app-toast', isError && 'app-toast-error')} role={isError ? 'alert' : 'status'} aria-live="polite">
      <div className={cn('app-toast__icon', isError && 'app-toast__icon-error')}>
        {isError ? <AlertCircle aria-hidden size={18} /> : <CheckVerified02 aria-hidden size={18} />}
      </div>
      <div className="app-toast__content">
        <div className="app-toast__title">{title}</div>
        {message && <div className="app-toast__message">{message}</div>}
      </div>
      <button type="button" className="app-toast__close" onClick={onClose} aria-label="Закрыть уведомление">
        <XClose aria-hidden size={16} />
      </button>
    </div>
  );
}

export function EmptyState({ children }) {
  return <div className="flex h-full min-h-[24rem] items-center justify-center">{children}</div>;
}

export function EmptyStateBody({ children }) {
  return <p className="mx-auto mt-2 max-w-md text-center text-sm text-slate-500">{children}</p>;
}

export function EmptyStateFooter({ children }) {
  return <div className="mt-6">{children}</div>;
}

export function Spinner({ size = 'xl' }) {
  const dimensions = size === 'xl' ? 'h-10 w-10' : 'h-6 w-6';
  return <div className={cn('animate-spin rounded-full border-4 border-slate-200 border-t-[#7f56d9]', dimensions)} />;
}

export function Text({ children, component = 'p', className = '' }) {
  const Component = component;
  const baseClassName = component === 'small' ? 'text-sm text-slate-500' : 'text-base text-slate-600';
  return <Component className={cn(baseClassName, className)}>{children}</Component>;
}

export function StaticField({ label, value, className = '' }) {
  return (
    <div className={cn('static-field', className)}>
      <div className="static-field__label">{label}</div>
      <div className="static-field__value">{value ?? '—'}</div>
    </div>
  );
}

export function StaticJsonField({ label, value, className = '' }) {
  return (
    <div className={cn('static-field', className)}>
      <div className="static-field__label">{label}</div>
      <pre className="static-field__code">{formatJsonSnippet(value ?? '')}</pre>
    </div>
  );
}

export function Title({ children, headingLevel = 'h2', className = '', ...props }) {
  const Component = headingLevel;
  const levelClassName = {
    h1: 'text-5xl font-semibold tracking-[-0.04em] text-slate-900',
    h3: 'text-2xl font-semibold tracking-[-0.03em] text-slate-900',
    h4: 'text-lg font-semibold tracking-[-0.02em] text-slate-900',
    h5: 'text-base font-semibold tracking-[-0.02em] text-slate-900',
    h6: 'text-sm font-semibold uppercase tracking-[0.04em] text-slate-700',
  }[headingLevel] ?? 'text-3xl font-semibold tracking-[-0.03em] text-slate-900';

  return <Component className={cn(levelClassName, className)} {...props}>{children}</Component>;
}

export function TextInput({ onChange, className = '', ...props }) {
  return (
    <input
      className={cn(
        'block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#9e77ed] focus:ring-4 focus:ring-[#f4ebff]',
        className,
      )}
      onChange={(event) => onChange?.(event, event.target.value)}
      {...props}
    />
  );
}

export function TextArea({ onChange, className = '', ...props }) {
  return (
    <textarea
      className={cn(
        'block min-h-[96px] w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#9e77ed] focus:ring-4 focus:ring-[#f4ebff]',
        className,
      )}
      onChange={(event) => onChange?.(event, event.target.value)}
      {...props}
    />
  );
}

export function Checkbox({ id, isChecked, onChange, label }) {
  return (
    <label htmlFor={id} className="inline-flex items-center gap-3 text-sm font-medium text-slate-700">
      <input
        id={id}
        type="checkbox"
        checked={isChecked}
        onChange={(event) => onChange?.(event, event.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-[#7f56d9] focus:ring-[#9e77ed]"
      />
      <span>{label}</span>
    </label>
  );
}

export function FileTriggerButton({ onClick }) {
  return (
    <Button variant="secondary" onClick={onClick}>
      <Plus aria-hidden size={20} />
      Выбрать файлы
    </Button>
  );
}
