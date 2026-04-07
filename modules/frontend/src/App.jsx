import { gql, useMutation, useQuery } from '@apollo/client';
import { AlertCircle, BellRinging04, CheckVerified02, Edit01, Eye, File02, Menu04, NotificationBox, Plus, Rows01, Save01, Trash01, XCircle, XClose, ZapCircle } from '@untitledui/icons';
import { useEffect, useRef, useState } from 'react';
import { Button as AriaButton, Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components';
import ReactFlow, {
  Controls,
  Handle,
  Position,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import { ProcessSelectField } from './components/ProcessSelectField';

function cn(...values) {
  return values.filter(Boolean).join(' ');
}

function getFilenameFromContentDisposition(headerValue) {
  if (!headerValue) {
    return '';
  }

  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const quotedMatch = headerValue.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) {
    return quotedMatch[1];
  }

  const plainMatch = headerValue.match(/filename=([^;]+)/i);
  return plainMatch?.[1]?.trim() ?? '';
}

function downloadBlob(blob, filename) {
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
}

function formatAutosaveCountdownLabel(secondsLeft) {
  return `${Math.max(1, Math.ceil(secondsLeft))} c`;
}

function formatDateTime(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function isEmptyJsonValue(value) {
  if (value == null) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (typeof value === 'object') {
    return Object.keys(value).length === 0;
  }

  return false;
}

function Page({ children }) {
  return <div className="min-h-screen bg-[#f8fafc] text-slate-900">{children}</div>;
}

function PageSection({ children, className = '' }) {
  return <section className={className}>{children}</section>;
}

function Split({ children, className = '', hasGutter = false }) {
  return <div className={cn('flex', hasGutter && 'gap-6', className)}>{children}</div>;
}

function SplitItem({ children, className = '', isFilled = false }) {
  return <div className={cn(isFilled ? 'min-w-0 flex-1' : 'shrink-0', className)}>{children}</div>;
}

function Card({ children, className = '' }) {
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

function CardTitle({ children, className = '' }) {
  return <div className={cn('px-6 pt-6 text-lg font-semibold tracking-[-0.02em] text-slate-900', className)}>{children}</div>;
}

function CardBody({ children, className = '' }) {
  return <div className={cn('px-6 pb-6 pt-4', className)}>{children}</div>;
}

function Form({ children, onSubmit }) {
  return <form onSubmit={onSubmit} className="space-y-5">{children}</form>;
}

function FormGroup({ label, fieldId, children }) {
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

function Button({
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

function YamlActionsMenu({
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
        className="min-w-[220px] overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-[0_12px_32px_rgba(16,24,40,0.12)] outline-none"
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

function TopologyActionsMenu({
  onDeleteProcessConfig,
  onImportProcessConfig,
  onExportProcessConfig,
  isDeleting = false,
  isImporting = false,
  isExporting = false,
  canDelete = false,
  canExport = false,
}) {
  const isBusy = isDeleting || isImporting || isExporting;

  return (
    <MenuTrigger>
      <AriaButton
        className={cn(
          'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-300 transition hover:bg-slate-50',
          isBusy && 'cursor-not-allowed opacity-60',
        )}
        isDisabled={isBusy}
        aria-label="Действия с процессом"
      >
        {isBusy ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <Menu04 aria-hidden size={16} />
        )}
        Действия
      </AriaButton>
      <Popover
        offset={6}
        className="min-w-[220px] overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-[0_12px_32px_rgba(16,24,40,0.12)] outline-none"
      >
        <Menu className="outline-none">
          <MenuItem
            onAction={onImportProcessConfig}
            className="cursor-pointer rounded-lg px-3 py-2 text-sm text-slate-700 outline-none transition hover:bg-slate-50"
          >
            Импортировать YAML
          </MenuItem>
          <MenuItem
            onAction={onExportProcessConfig}
            isDisabled={!canExport}
            className="cursor-pointer rounded-lg px-3 py-2 text-sm text-slate-700 outline-none transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Экспортировать YAML
          </MenuItem>
          <MenuItem
            onAction={onDeleteProcessConfig}
            isDisabled={!canDelete}
            className="cursor-pointer rounded-lg px-3 py-2 text-sm text-rose-600 outline-none transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Удалить процесс
          </MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

function Toast({ title, message, onClose, variant = 'success' }) {
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

function FileUploadModal({
  isOpen,
  files,
  scheme,
  isSubmitting,
  errorMessage,
  onClose,
  onSubmit,
  onSchemeChange,
  onFilesSelected,
  onRemoveFile,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleFileChange = (event) => {
    const nextFiles = Array.from(event.target.files ?? []);
    if (nextFiles.length > 0) {
      onFilesSelected(nextFiles);
    }
    event.target.value = '';
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const nextFiles = Array.from(event.dataTransfer?.files ?? []).filter((file) =>
      /\.ya?ml$/i.test(file.name),
    );
    if (nextFiles.length > 0) {
      onFilesSelected(nextFiles);
    }
  };

  return (
    <div className="modal-shell" role="dialog" aria-modal="true" aria-labelledby="yaml-import-title">
      <div className="modal-shell__backdrop" onClick={onClose} />
      <div className="modal-card">
        <div className="modal-card__header">
          <div>
            <Title headingLevel="h4" className="modal-card__title">
              <span id="yaml-import-title">Импортировать YAML</span>
            </Title>
            <Text className="modal-card__subtitle">
              Загрузите один или несколько YAML-файлов. Для каждого файла backend создаст новый процесс.
            </Text>
          </div>
          <button type="button" className="modal-card__close" onClick={onClose} aria-label="Закрыть окно импорта">
            <XClose aria-hidden size={18} />
          </button>
        </div>

        <div
          className="file-uploader"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <div className="file-uploader__icon">
            <Plus aria-hidden size={20} />
          </div>
          <div className="file-uploader__title">Перетащите YAML сюда</div>
          <div className="file-uploader__subtitle">или выберите файлы вручную</div>
          <Button variant="secondary" onClick={() => inputRef.current?.click()}>
            Выбрать файлы
          </Button>
          <input
            ref={inputRef}
            type="file"
            hidden
            multiple
            accept=".yaml,.yml"
            onChange={handleFileChange}
          />
        </div>

        <FormGroup label="Схема импорта" fieldId="yaml-import-scheme">
          <ProcessSelectField
            id="yaml-import-scheme"
            value={scheme}
            onChange={onSchemeChange}
            options={[
              { value: 'NEW', label: 'New schema.json' },
              { value: 'LEGACY', label: 'Legacy schema_legacy.json' },
            ]}
            placeholder="Выберите схему"
            isDisabled={isSubmitting}
          />
        </FormGroup>

        {files.length > 0 && (
          <div className="file-uploader__list">
            {files.map((file, index) => (
              <div key={`${file.name}-${file.size}-${file.lastModified}-${index}`} className="file-uploader__item">
                <div>
                  <div className="file-uploader__filename">{file.name}</div>
                  <div className="file-uploader__meta">{Math.max(1, Math.round(file.size / 1024))} KB</div>
                </div>
                <button
                  type="button"
                  className="file-uploader__remove"
                  onClick={() => onRemoveFile(index)}
                  aria-label={`Удалить ${file.name}`}
                >
                  <XClose aria-hidden size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        {errorMessage && <div className="file-uploader__error">{errorMessage}</div>}

        <div className="modal-card__footer">
          <Button variant="secondary" onClick={onClose} isDisabled={isSubmitting}>
            Отмена
          </Button>
          <Button onClick={onSubmit} isLoading={isSubmitting} isDisabled={files.length === 0}>
            Импортировать
          </Button>
        </div>
      </div>
    </div>
  );
}

function ExportTypeModal({
  isOpen,
  exportType,
  isSubmitting,
  errorMessage,
  onClose,
  onSubmit,
  onExportTypeChange,
}) {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-shell" role="dialog" aria-modal="true" aria-labelledby="yaml-export-title">
      <div className="modal-shell__backdrop" onClick={onClose} />
      <div className="modal-card">
        <div className="modal-card__header">
          <div>
            <Title headingLevel="h4" className="modal-card__title">
              <span id="yaml-export-title">Экспортировать YAML</span>
            </Title>
            <Text className="modal-card__subtitle">
              Выберите тип экспорта процесса перед скачиванием файла.
            </Text>
          </div>
          <button type="button" className="modal-card__close" onClick={onClose} aria-label="Закрыть окно экспорта">
            <XClose aria-hidden size={18} />
          </button>
        </div>

        <FormGroup label="Тип экспорта" fieldId="yaml-export-type">
          <ProcessSelectField
            id="yaml-export-type"
            value={exportType}
            onChange={onExportTypeChange}
            options={[
              { value: 'DEFAULT', label: 'Default' },
              { value: 'LEGACY', label: 'Legacy' },
            ]}
            placeholder="Выберите тип"
            isDisabled={isSubmitting}
          />
        </FormGroup>

        <div className="export-modal__hint">
          {exportType === 'LEGACY'
            ? 'Legacy: без id, node_name и node_comment. Значение node_name переносится в description, null и пустые строки не экспортируются.'
            : 'Default: процесс экспортируется как есть, но null и пустые строки не попадают в YAML.'}
        </div>

        {errorMessage && <div className="file-uploader__error">{errorMessage}</div>}

        <div className="modal-card__footer">
          <Button variant="secondary" onClick={onClose} isDisabled={isSubmitting}>
            Отмена
          </Button>
          <Button onClick={onSubmit} isLoading={isSubmitting}>
            Скачать
          </Button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ children }) {
  return <div className="flex h-full min-h-[24rem] items-center justify-center">{children}</div>;
}

function EmptyStateBody({ children }) {
  return <p className="mt-2 max-w-md text-sm text-slate-500">{children}</p>;
}

function EmptyStateFooter({ children }) {
  return <div className="mt-6">{children}</div>;
}

function Spinner({ size = 'xl' }) {
  const dimensions = size === 'xl' ? 'h-10 w-10' : 'h-6 w-6';
  return <div className={cn('animate-spin rounded-full border-4 border-slate-200 border-t-[#7f56d9]', dimensions)} />;
}

function Text({ children, component = 'p', className = '' }) {
  const Component = component;
  const baseClassName = component === 'small' ? 'text-sm text-slate-500' : 'text-base text-slate-600';
  return <Component className={cn(baseClassName, className)}>{children}</Component>;
}

function StaticField({ label, value, className = '' }) {
  return (
    <div className={cn('static-field', className)}>
      <div className="static-field__label">{label}</div>
      <div className="static-field__value">{value ?? '—'}</div>
    </div>
  );
}

function StaticJsonField({ label, value, className = '' }) {
  return (
    <div className={cn('static-field', className)}>
      <div className="static-field__label">{label}</div>
      <pre className="static-field__code">{formatJsonSnippet(value ?? '')}</pre>
    </div>
  );
}

function Title({ children, headingLevel = 'h2', className = '' }) {
  const Component = headingLevel;
  const levelClassName = {
    h1: 'text-5xl font-semibold tracking-[-0.04em] text-slate-900',
    h3: 'text-2xl font-semibold tracking-[-0.03em] text-slate-900',
    h4: 'text-lg font-semibold tracking-[-0.02em] text-slate-900',
    h5: 'text-base font-semibold tracking-[-0.02em] text-slate-900',
    h6: 'text-sm font-semibold uppercase tracking-[0.04em] text-slate-700',
  }[headingLevel] ?? 'text-3xl font-semibold tracking-[-0.03em] text-slate-900';

  return <Component className={cn(levelClassName, className)}>{children}</Component>;
}

function TextInput({ onChange, className = '', ...props }) {
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

function TextArea({ onChange, className = '', resizeOrientation, ...props }) {
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

function formatJsonSnippet(value) {
  if (!value?.trim()) {
    return '{}';
  }

  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function stringifyJsonForEditor(value) {
  if (value === undefined) {
    return '';
  }

  const serialized = JSON.stringify(value, null, 2);
  return serialized ?? 'null';
}

function JsonSnippetEditor({
  id,
  value,
  onChange,
  error,
  helperText,
  readOnly = false,
  onBeautify,
  onOpenPlayground,
  playgroundLabel = 'Открыть playground JsonLogic',
}) {
  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (document.fullscreenElement === container) {
      await document.exitFullscreen();
      return;
    }

    await container.requestFullscreen();
  };

  return (
    <div ref={containerRef} className={cn('json-snippet', isFullscreen && 'json-snippet-fullscreen')}>
      <div className="json-snippet__toolbar">
        <div className="json-snippet__toolbar-actions">
          {onBeautify && (
            <button
              type="button"
              className="json-snippet__action"
              onClick={onBeautify}
              aria-label="Отформатировать JSON"
              title="Отформатировать JSON"
            >
              Beautify JSON
            </button>
          )}
          {onOpenPlayground && (
            <button
              type="button"
              className="json-snippet__action"
              onClick={onOpenPlayground}
              aria-label={playgroundLabel}
              title={playgroundLabel}
            >
              <ZapCircle aria-hidden size={14} />
              Playground
            </button>
          )}
          <button
            type="button"
            className="json-snippet__action"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Свернуть редактор кода' : 'Развернуть редактор кода на весь экран'}
          >
            {isFullscreen ? 'Свернуть' : 'На весь экран'}
          </button>
        </div>
      </div>
      <textarea
        id={id}
        className="json-snippet__textarea"
        spellCheck={false}
        value={value}
        readOnly={readOnly}
        onChange={(event) => onChange(event.target.value)}
      />
      {helperText && <p className="json-snippet__helper">{helperText}</p>}
      {error && <p className="json-snippet__error">{error}</p>}
    </div>
  );
}

function JsonLogicPlaygroundModal({
  isOpen,
  title,
  inputText,
  ruleText,
  resultText,
  isSubmitting,
  errorMessage,
  onClose,
  onInputChange,
  onEvaluate,
}) {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-shell" role="dialog" aria-modal="true" aria-labelledby="jsonlogic-playground-title">
      <div className="modal-shell__backdrop" onClick={onClose} />
      <div className="modal-card modal-card-playground">
        <div className="modal-card__header">
          <div>
            <Title headingLevel="h4" className="modal-card__title">
              <span id="jsonlogic-playground-title">Playground JsonLogic</span>
            </Title>
          </div>
          <button type="button" className="modal-card__close" onClick={onClose} aria-label="Закрыть playground">
            <XClose aria-hidden size={18} />
          </button>
        </div>

        <div className="jsonlogic-playground">
          <div className="jsonlogic-playground__panel">
            <div className="jsonlogic-playground__panel-header">
              <Title headingLevel="h5">JSON-объект</Title>
            </div>
            <JsonSnippetEditor
              id="jsonlogic-playground-input"
              value={inputText}
              onChange={onInputChange}
              onBeautify={() => onInputChange(formatJsonSnippet(inputText))}
              helperText="Укажите JSON, на котором нужно проверить правило."
            />
          </div>

          <div className="jsonlogic-playground__action">
            <Button onClick={onEvaluate} isLoading={isSubmitting}>
              Проверить
            </Button>
            <div className="jsonlogic-playground__result">
              <div className="jsonlogic-playground__result-label">Результат</div>
              <pre className="jsonlogic-playground__result-code">{resultText || '—'}</pre>
            </div>
            {errorMessage && <p className="jsonlogic-playground__error">{errorMessage}</p>}
          </div>

          <div className="jsonlogic-playground__panel">
            <div className="jsonlogic-playground__panel-header">
              <Title headingLevel="h5">Текущее правило</Title>
              <Text component="small">Содержимое будет передано в backend как `rule`.</Text>
            </div>
            <JsonSnippetEditor
              id="jsonlogic-playground-rule"
              value={ruleText}
              onChange={() => {}}
              onBeautify={() => {}}
              readOnly
              helperText="Правило отображается только для чтения и берется из текущей панели."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Checkbox({ id, isChecked, onChange, label }) {
  return (
    <label htmlFor={id} className="inline-flex items-center gap-3 text-sm font-medium text-slate-700">
      <input
        id={id}
        type="checkbox"
        checked={isChecked}
        className="h-4 w-4 rounded border-slate-300 text-[#7f56d9] focus:ring-[#7f56d9]"
        onChange={(event) => onChange?.(event, event.target.checked)}
      />
      {label}
    </label>
  );
}

const PROCESS_FIELDS = gql`
  fragment ReverseOutputFields on ReverseOutput {
    id
    name
    rule
    phase {
      code
    }
    body {
      type
      eventObject {
        type
      }
      service {
        scenario
        type
        status {
          code
        }
        sla {
          durationValue
          durationUnit {
            code
          }
          status {
            code
          }
        }
      }
    }
    log {
      journalServiceName
      message
    }
  }

  fragment ReverseFields on Reverse {
    id
    status {
      code
    }
    output {
      ...ReverseOutputFields
    }
  }

  fragment ResultFields on Result {
    id
    inputScenarios
    reverse {
      ...ReverseFields
    }
  }

  fragment ConfiguratorFields on Configurator {
    id
    disabled
    interrupted
    multiple
    filterEventRule
    audit {
      enabled
      eventCode
      eventDescription
    }
    result {
      ...ResultFields
    }
  }

  fragment StageFields on Stage {
    id
    nodeName
    nodeComment
    executor
    contextCode {
      code
    }
    log {
      journalServiceName
    }
    configurator {
      ...ConfiguratorFields
    }
  }

  fragment SubprocessFields on Subprocess {
    id
    nodeName
    nodeComment
    disabled
    trigger {
      rule
    }
    stages {
      ...StageFields
    }
  }

  query ProcessConfigList {
    actionPhasesDictionaryList {
      code
    }
    b3StatusDictionaryList {
      code
    }
    slaDurationUnitDictionaryList {
      code
    }
    slaStatusDictionaryList {
      code
    }
    contextCodesDictionaryList {
      code
    }
    processConfigList {
      id
      createdAt
      updatedAt
      process {
        id
        nodeName
        nodeComment
        disabled
        contextCode {
          code
        }
        subprocess {
          ...SubprocessFields
        }
      }
    }
  }
`;

const CREATE_PROCESS = gql`
  mutation CreateProcessConfig($input: ProcessConfigInput!) {
    createProcessConfig(input: $input) {
      id
      process {
        id
        nodeName
        nodeComment
        disabled
        contextCode {
          code
        }
        subprocess {
          id
          nodeName
          nodeComment
          disabled
          trigger {
            rule
          }
          stages {
            id
          }
        }
      }
    }
  }
`;

const UPDATE_PROCESS = gql`
  mutation UpdateProcessConfig($id: ID!, $input: ProcessConfigInput!) {
    updateProcessConfig(id: $id, input: $input) {
      id
    }
  }
`;

const DELETE_PROCESS_CONFIG = gql`
  mutation DeleteProcessConfig($id: ID!) {
    deleteProcessConfig(id: $id)
  }
`;

const UPDATE_STAGE_NODE = gql`
  mutation UpdateStageNode($id: ID!, $input: StageInput!) {
    updateStageNode(id: $id, input: $input) {
      id
    }
  }
`;

const UPDATE_CONFIGURATOR_NODE = gql`
  mutation UpdateConfiguratorNode($id: ID!, $input: ConfiguratorInput!) {
    updateConfiguratorNode(id: $id, input: $input) {
      id
    }
  }
`;

const UPDATE_SUBPROCESS_NODE = gql`
  mutation UpdateSubprocessNode($id: ID!, $input: SubprocessInput!) {
    updateSubprocessNode(id: $id, input: $input) {
      id
    }
  }
`;

const REORDER_SUBPROCESS_STAGES = gql`
  mutation ReorderSubprocessStages($subprocessId: ID!, $stageIds: [ID!]!) {
    reorderSubprocessStages(subprocessId: $subprocessId, stageIds: $stageIds) {
      id
    }
  }
`;

const REORDER_REVERSE_OUTPUTS = gql`
  mutation ReorderReverseOutputs($reverseId: ID!, $outputIds: [ID!]!) {
    reorderReverseOutputs(reverseId: $reverseId, outputIds: $outputIds) {
      id
    }
  }
`;

const UPDATE_PROCESS_NODE = gql`
  mutation UpdateProcessNode($id: ID!, $input: ProcessInput!) {
    updateProcessNode(id: $id, input: $input) {
      id
      nodeName
      nodeComment
      contextCode {
        code
      }
    }
  }
`;

const CREATE_SUBPROCESS_NODE = gql`
  mutation CreateSubprocessNode($processId: ID!, $input: SubprocessInput!) {
    createSubprocessNode(processId: $processId, input: $input) {
      id
    }
  }
`;

const CREATE_RESULT_NODE = gql`
  mutation CreateResultNode($configuratorId: ID!, $input: ResultInput!) {
    createResultNode(configuratorId: $configuratorId, input: $input) {
      id
      inputScenarios
      reverse {
        id
        status {
          code
        }
      }
    }
  }
`;

const CREATE_REVERSE_NODE = gql`
  mutation CreateReverseNode($resultId: ID!, $input: ReverseInput!) {
    createReverseNode(resultId: $resultId, input: $input) {
      id
      status {
        code
      }
    }
  }
`;

const UPDATE_REVERSE_NODE = gql`
  mutation UpdateReverseNode($id: ID!, $input: ReverseInput!) {
    updateReverseNode(id: $id, input: $input) {
      id
    }
  }
`;

const UPDATE_RESULT_NODE = gql`
  mutation UpdateResultNode($id: ID!, $input: ResultInput!) {
    updateResultNode(id: $id, input: $input) {
      id
    }
  }
`;

const CREATE_REVERSE_OUTPUT_NODE = gql`
  mutation CreateReverseOutputNode($reverseId: ID!, $input: ReverseOutputInput!) {
    createReverseOutputNode(reverseId: $reverseId, input: $input) {
      id
      name
      rule
    }
  }
`;

const UPDATE_REVERSE_OUTPUT_NODE = gql`
  mutation UpdateReverseOutputNode($id: ID!, $input: ReverseOutputInput!) {
    updateReverseOutputNode(id: $id, input: $input) {
      id
    }
  }
`;

const DELETE_SUBPROCESS_NODE = gql`
  mutation DeleteSubprocessNode($id: ID!) {
    deleteSubprocessNode(id: $id)
  }
`;

const CREATE_STAGE_NODE = gql`
  mutation CreateStageNode($subprocessId: ID!, $input: StageInput!) {
    createStageNode(subprocessId: $subprocessId, input: $input) {
      id
    }
  }
`;

const DELETE_STAGE_NODE = gql`
  mutation DeleteStageNode($id: ID!) {
    deleteStageNode(id: $id)
  }
`;

const DELETE_CONFIGURATOR_NODE = gql`
  mutation DeleteConfiguratorNode($id: ID!) {
    deleteConfiguratorNode(id: $id)
  }
`;

const DELETE_RESULT_NODE = gql`
  mutation DeleteResultNode($id: ID!) {
    deleteResultNode(id: $id)
  }
`;

const DELETE_REVERSE_NODE = gql`
  mutation DeleteReverseNode($id: ID!) {
    deleteReverseNode(id: $id)
  }
`;

const DELETE_REVERSE_OUTPUT_NODE = gql`
  mutation DeleteReverseOutputNode($id: ID!) {
    deleteReverseOutputNode(id: $id)
  }
`;

function getErrorMessage(error, fallback) {
  if (!error) {
    return '';
  }

  if (Array.isArray(error.graphQLErrors) && error.graphQLErrors.length > 0) {
    return error.graphQLErrors.map((item) => item.message).join('; ');
  }

  return error.message || fallback;
}

function reorderItems(items, fromIndex, toIndex) {
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function updateNestedValue(source, path, value) {
  if (path.length === 0) {
    return value;
  }

  const [key, ...rest] = path;
  const currentValue = source ?? {};

  return {
    ...currentValue,
    [key]: updateNestedValue(currentValue[key], rest, value),
  };
}

function updateItemAt(items, index, updater) {
  return items.map((item, itemIndex) => (itemIndex === index ? updater(item) : item));
}

function sanitizeInputScenarios(items) {
  return (items ?? []).map((item) => item.trim()).filter(Boolean);
}

const NODE_NAME_HELPER_TEXT = 'Название узла нужно для визуальной идентификации на схеме и в редакторе.';
const NODE_COMMENT_HELPER_TEXT = 'Описание узла помогает понять его назначение и отображается в карточке узла.';

function createDefaultStage(index) {
  return {
    executor: `executor_${index}`,
    contextCode: null,
    nodeName: `stage_${index}`,
    nodeComment: 'добавьте комментарий',
    log: {
      journalServiceName: '',
    },
    configurator: {
      disabled: false,
      interrupted: true,
      multiple: false,
      filterEventRule: '',
      audit: {
        enabled: false,
        eventCode: '',
        eventDescription: '',
      },
      result: [],
    },
  };
}

function getDefaultExpandedNodeIds(processConfig) {
  const processId = processConfig?.process?.id;
  if (!processId) {
    return [];
  }

  const expandedNodeIds = [`process:${processId}`];
  (processConfig.process?.subprocess ?? []).forEach((subprocess) => {
    expandedNodeIds.push(`subprocess:${subprocess.id}`);
    (subprocess.stages ?? []).forEach((stage) => {
      expandedNodeIds.push(`stage:${stage.id}`);
      (stage.configurator?.result ?? []).forEach((result, resultIndex) => {
        expandedNodeIds.push(getResultNodeId(stage.id, resultIndex));
        (result.reverse ?? []).forEach((reverse, reverseIndex) => {
          expandedNodeIds.push(getReverseNodeId(stage.id, resultIndex, reverseIndex));
        });
      });
    });
  });

  return expandedNodeIds;
}

function createDefaultSubprocess(index) {
  return {
    nodeName: `subprocess_${index}`,
    nodeComment: 'добавьте комментарий',
    disabled: false,
    trigger: {
      rule: '',
    },
    stages: [],
  };
}

function refInput(value) {
  return value?.code ? { code: value.code } : null;
}

function normalizeReferenceDraft(value) {
  const code = value?.code?.trim();
  return code ? { code } : null;
}

function normalizeNullableInteger(value) {
  if (value == null || value === '') {
    return null;
  }

  const normalized = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(normalized) ? normalized : null;
}

function serializeSlaState(sla) {
  if (!sla) {
    return null;
  }

  const durationValue = normalizeNullableInteger(sla.durationValue);
  const durationUnit = refInput(sla.durationUnit);
  const status = refInput(sla.status);

  if (durationValue == null && !durationUnit && !status) {
    return null;
  }

  return {
    durationValue,
    durationUnit,
    status,
  };
}

function stripTypename(value) {
  if (Array.isArray(value)) {
    return value.map(stripTypename);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((accumulator, [key, nestedValue]) => {
      if (key === '__typename') {
        return accumulator;
      }

      return {
        ...accumulator,
        [key]: stripTypename(nestedValue),
      };
    }, {});
  }

  return value;
}

function getNextProcessDraft(processConfigs, processCodeOptions) {
  const usedCodes = new Set(
    (processConfigs ?? [])
      .map((item) => item?.process?.contextCode?.code?.trim())
      .filter(Boolean),
  );
  const availableCode = processCodeOptions.find((code) => !usedCodes.has(code)) ?? processCodeOptions[0] ?? '';

  return {
    process: {
      disabled: false,
      contextCode: availableCode ? { code: availableCode } : null,
      subprocess: [],
    },
  };
}

function serializeConfigurator(configurator) {
  if (!configurator) {
    return null;
  }

  return {
    id: configurator.id ?? undefined,
    disabled: configurator.disabled ?? false,
    interrupted: configurator.interrupted ?? true,
    multiple: configurator.multiple ?? false,
    filterEventRule: configurator.filterEventRule ?? '',
    audit: configurator.audit
      ? {
          enabled: configurator.audit.enabled ?? false,
          eventCode: configurator.audit.eventCode ?? '',
          eventDescription: configurator.audit.eventDescription ?? '',
        }
      : null,
    result: (configurator.result ?? []).map((result) => ({
      id: result.id ?? undefined,
      inputScenarios: result.inputScenarios ?? [],
      reverse: (result.reverse ?? []).map((reverse) => ({
        id: reverse.id ?? undefined,
        status: refInput(reverse.status),
        output: (reverse.output ?? []).map((output) => ({
          id: output.id ?? undefined,
          phase: refInput(output.phase),
          name: output.name ?? '',
          rule: output.rule ?? '',
          body: output.body
            ? {
                type: output.body.type ?? '',
                eventObject: output.body.eventObject
                  ? {
                      type: output.body.eventObject.type ?? '',
                    }
                  : null,
                service: output.body.service
                  ? {
                      scenario: output.body.service.scenario ?? '',
                      type: output.body.service.type ?? '',
                      status: refInput(output.body.service.status),
                      sla: serializeSlaState(output.body.service.sla),
                    }
                  : null,
              }
            : null,
          log: output.log
            ? {
                journalServiceName: output.log.journalServiceName ?? '',
                message: output.log.message ?? '',
              }
            : null,
        })),
      })),
    })),
  };
}

function serializeStageConfigurator(configurator, filterEventRuleOverride = null) {
  if (!configurator) {
    return null;
  }

  return {
    id: configurator.id ?? undefined,
    disabled: configurator.disabled ?? false,
    interrupted: configurator.interrupted ?? true,
    multiple: configurator.multiple ?? false,
    filterEventRule:
      filterEventRuleOverride === null ? configurator.filterEventRule ?? '' : filterEventRuleOverride,
    audit: configurator.audit
      ? {
          enabled: configurator.audit.enabled ?? false,
          eventCode: configurator.audit.eventCode ?? '',
          eventDescription: configurator.audit.eventDescription ?? '',
        }
      : null,
  };
}

function serializeStage(stage) {
  return {
    id: stage.id ?? undefined,
    executor: stage.executor ?? '',
    contextCode: refInput(stage.contextCode),
    nodeName: stage.nodeName ?? '',
    nodeComment: stage.nodeComment ?? '',
    log: stage.log
      ? {
          journalServiceName: stage.log.journalServiceName ?? '',
        }
      : null,
    configurator: serializeConfigurator(stage.configurator),
  };
}

function serializeReverseOutput(output) {
  return {
    id: output.id ?? undefined,
    phase: refInput(output.phase),
    name: output.name ?? '',
    rule: output.rule ?? '',
    body: output.body
      ? {
          type: output.body.type ?? '',
          eventObject: output.body.eventObject
            ? {
                type: output.body.eventObject.type ?? '',
              }
            : null,
          service: output.body.service
            ? {
                scenario: output.body.service.scenario ?? '',
                type: output.body.service.type ?? '',
                status: refInput(output.body.service.status),
                sla: serializeSlaState(output.body.service.sla),
              }
            : null,
        }
      : null,
    log: output.log
      ? {
          journalServiceName: output.log.journalServiceName ?? '',
          message: output.log.message ?? '',
        }
      : {
          journalServiceName: '',
          message: '',
        },
  };
}

function serializeSubprocess(subprocess) {
  return {
    id: subprocess.id ?? undefined,
    nodeName: subprocess.nodeName ?? '',
    nodeComment: subprocess.nodeComment ?? '',
    disabled: subprocess.disabled ?? false,
    trigger: subprocess.trigger
      ? {
          rule: subprocess.trigger.rule ?? '',
        }
      : {
          rule: '',
        },
    stages: (subprocess.stages ?? []).map(serializeStage),
  };
}

function serializeProcessConfig(processConfig) {
  return {
    process: processConfig.process
      ? {
          id: processConfig.process.id ?? undefined,
          nodeName: processConfig.process.nodeName ?? '',
          nodeComment: processConfig.process.nodeComment ?? '',
          disabled: processConfig.process.disabled ?? false,
          contextCode: refInput(processConfig.process.contextCode),
          subprocess: (processConfig.process.subprocess ?? []).map(serializeSubprocess),
        }
      : null,
  };
}

const TOPOLOGY_NODE_WIDTH = 400;
const TOPOLOGY_NODE_HEIGHT = 286;
const TOPOLOGY_REVERSE_NODE_HEIGHT = 132;
const TOPOLOGY_REVERSE_OUTPUT_NODE_HEIGHT = 358;
const TOPOLOGY_RESULT_NODE_BASE_HEIGHT = 132;
const TOPOLOGY_RESULT_SCENARIO_ITEM_HEIGHT = 58;
const TOPOLOGY_TEXT_LINE_HEIGHT = 20;
const TOPOLOGY_NODE_ACTION_CLEARANCE = 28;
const TOPOLOGY_VERTICAL_GAP = 56;
const TOPOLOGY_HORIZONTAL_GAP = 128;
const NODE_AUTOSAVE_DELAY_MS = 3_000;
const TOPOLOGY_TOP_PADDING = 128;
const TOPOLOGY_LEFT_PADDING = 48;
const TOPOLOGY_TITLE_CHARS_PER_LINE = 20;
const TOPOLOGY_SUBTITLE_CHARS_PER_LINE = 28;
const TOPOLOGY_SUBTITLE_MAX_CHARS = 120;

function getResultNodeId(stageId, resultIndex) {
  return `result:${stageId}:${resultIndex}`;
}

function getReverseNodeId(stageId, resultIndex, reverseIndex) {
  return `reverse:${stageId}:${resultIndex}:${reverseIndex}`;
}

function getReverseOutputNodeId(stageId, resultIndex, reverseIndex, outputIndex) {
  return `reverseOutput:${stageId}:${resultIndex}:${reverseIndex}:${outputIndex}`;
}

function createTopologyEdge(id, source, target, extra = {}) {
  return {
    id,
    source,
    target,
    type: 'default',
    animated: false,
    selectable: false,
    focusable: false,
    deletable: false,
    interactionWidth: 0,
    style: {
      stroke: '#98a2b3',
      strokeWidth: 2,
    },
    ...extra,
  };
}

function estimateNodeHeight({ title, subtitle, isExpandable }) {
  return TOPOLOGY_NODE_HEIGHT;
}

function estimateTextLines(value, charsPerLine = TOPOLOGY_SUBTITLE_CHARS_PER_LINE) {
  const text = String(value ?? '').trim();
  if (!text) {
    return 1;
  }

  return text
    .split('\n')
    .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.trim().length / charsPerLine) || 1), 0);
}

function estimateReverseOutputNodeHeight({ summaryItems }) {
  const summaryHeight = (summaryItems ?? []).reduce(
    (sum, item) => sum + Math.max(20, estimateTextLines(item.value, 34) * 20),
    0,
  );
  return Math.min(
    TOPOLOGY_REVERSE_OUTPUT_NODE_HEIGHT,
    Math.max(56, 20 + summaryHeight + Math.max(0, ((summaryItems?.length ?? 0) - 1) * 4)),
  );
}

function estimateReverseNodeHeight(statusValue, isExpandable) {
  const statusLines = estimateTextLines(statusValue, 24);
  return Math.min(
    TOPOLOGY_NODE_HEIGHT,
    Math.max(110, 92 + statusLines * TOPOLOGY_TEXT_LINE_HEIGHT + (isExpandable ? 28 : 0)),
  );
}

function estimateResultNodeHeight({ scenarios, isExpandable }) {
  const normalizedScenarios = (scenarios?.length ? scenarios : ['']).map((scenario) => estimateTextLines(scenario, 32));
  const contentHeight = normalizedScenarios.reduce(
    (sum, lineCount) => sum + Math.max(40, lineCount * TOPOLOGY_TEXT_LINE_HEIGHT + 8),
    0,
  );
  return Math.min(
    TOPOLOGY_NODE_HEIGHT,
    Math.max(120, 84 + contentHeight + (normalizedScenarios.length - 1) * 8 + (isExpandable ? 28 : 0)),
  );
}

function getNodeFootprintHeight(nodeHeight) {
  return nodeHeight + TOPOLOGY_NODE_ACTION_CLEARANCE;
}

function truncateText(value, maxChars = TOPOLOGY_SUBTITLE_MAX_CHARS) {
  const text = String(value ?? '').trim();
  if (!text || text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

function stackBranchHeight(items) {
  if (items.length === 0) {
    return 0;
  }

  return items.reduce((sum, item, index) => sum + item.branchHeight + (index < items.length - 1 ? TOPOLOGY_VERTICAL_GAP : 0), 0);
}

function formatReverseOutputEventType(phaseCode) {
  const normalizedCode = String(phaseCode ?? '').trim();
  const labels = {
    INITIATED: 'Initiated Activity Event',
    START: 'Started Activity Event',
    CHECK_IN: 'Accepted Activity Event',
    ACTIVITY_COMPLETE: 'Activity Event',
    COMPLETE_FAILURE: 'Failure Activity Event',
    'COMPLETE FAILURE': 'Failure Activity Event',
    CHANGE_BUSINESS_STAGE: 'Running Activity Event',
    BUSINESS_COMPLETE: 'Business Event',
  };

  return labels[normalizedCode] || normalizedCode || 'не задан';
}

function getReverseOutputLayout(stage, resultIndex, reverseIndex, output, outputIndex) {
  const serviceSummary = [output.body?.service?.scenario, output.body?.service?.type, output.body?.service?.status?.code]
    .filter(Boolean)
    .join(' / ');
  const bodySummary = [output.body?.type, output.body?.eventObject?.type].filter(Boolean).join(' / ');
  const hasLogConfiguration = Boolean(output.log?.journalServiceName || output.log?.message);
  const hasSlaConfiguration = Boolean(
    output.body?.service?.sla?.durationValue ||
      output.body?.service?.sla?.durationUnit?.code ||
      output.body?.service?.sla?.status?.code,
  );
  const summaryItems = [
    { value: formatReverseOutputEventType(output.phase?.code), icon: 'send' },
    ...(output.name ? [{ value: output.name }] : []),
    ...(serviceSummary ? [{ value: serviceSummary }] : []),
    ...(bodySummary ? [{ value: bodySummary }] : []),
    ...(hasLogConfiguration ? [{ value: 'Интеграционный журнал настроен', icon: 'check' }] : []),
    ...(hasSlaConfiguration ? [{ value: 'SLA настроен', icon: 'check' }] : []),
  ];
  const nodeHeight = estimateReverseOutputNodeHeight({ summaryItems });

  return {
    nodeId: getReverseOutputNodeId(stage.id, resultIndex, reverseIndex, outputIndex),
    summaryItems,
    nodeHeight,
    branchHeight: getNodeFootprintHeight(nodeHeight),
  };
}

function getReverseLayout(stage, resultIndex, reverse, reverseIndex, expandedSet) {
  const nodeId = getReverseNodeId(stage.id, resultIndex, reverseIndex);
  const expanded = expandedSet.has(nodeId);
  const outputLayouts = expanded
    ? (reverse.output ?? []).map((output, outputIndex) => getReverseOutputLayout(stage, resultIndex, reverseIndex, output, outputIndex))
    : [];
  const statusValue = reverse.status?.code || 'STATUS не задан';
  const summaryItems = [{ value: statusValue, icon: 'notification' }];
  const nodeHeight = estimateReverseNodeHeight(statusValue, (reverse.output?.length ?? 0) > 0);

  return {
    nodeId,
    expanded,
    summaryItems,
    outputCount: (reverse.output ?? []).length,
    nodeHeight,
    outputLayouts,
    branchHeight: Math.max(getNodeFootprintHeight(nodeHeight), stackBranchHeight(outputLayouts)),
  };
}

function getResultLayout(stage, result, resultIndex, expandedSet) {
  const nodeId = getResultNodeId(stage.id, resultIndex);
  const expanded = expandedSet.has(nodeId);
  const reverseLayouts = expanded
    ? (result.reverse ?? []).map((reverse, reverseIndex) => getReverseLayout(stage, resultIndex, reverse, reverseIndex, expandedSet))
    : [];
  const summaryItems = (result.inputScenarios?.length ? result.inputScenarios : ['Сценарии не заданы']).map((scenario) => ({
    value: scenario,
  }));
  const nodeHeight = estimateResultNodeHeight({
    scenarios: summaryItems.map((item) => item.value),
    isExpandable: (result.reverse?.length ?? 0) > 0,
  });

  return {
    nodeId,
    expanded,
    summaryItems,
    reverseCount: (result.reverse ?? []).length,
    nodeHeight,
    reverseLayouts,
    branchHeight: Math.max(getNodeFootprintHeight(nodeHeight), stackBranchHeight(reverseLayouts)),
  };
}

function getStageLayout(stage, expandedSet) {
  const nodeId = `stage:${stage.id}`;
  const expanded = expandedSet.has(nodeId);
  const resultLayouts = expanded
    ? (stage.configurator?.result ?? []).map((result, resultIndex) => getResultLayout(stage, result, resultIndex, expandedSet))
    : [];
  const nodeHeight = estimateNodeHeight({
    title: stage.nodeName || 'stage',
    subtitle: stage.nodeComment || 'добавьте комментарий',
    isExpandable: (stage.configurator?.result?.length ?? 0) > 0,
  });

  return {
    nodeId,
    stage,
    expanded,
    nodeHeight,
    resultLayouts,
    branchHeight: Math.max(getNodeFootprintHeight(nodeHeight), stackBranchHeight(resultLayouts)),
  };
}

function getSubprocessLayout(subprocess, expandedSet) {
  const nodeId = `subprocess:${subprocess.id}`;
  const expanded = expandedSet.has(nodeId);
  const stageLayouts = expanded ? (subprocess.stages ?? []).map((stage) => getStageLayout(stage, expandedSet)) : [];
  const nodeHeight = estimateNodeHeight({
    title: subprocess.nodeName || 'subprocess',
    subtitle: subprocess.nodeComment || 'Подпроцесс',
    isExpandable: (subprocess.stages?.length ?? 0) > 0,
  });

  return {
    nodeId,
    subprocess,
    expanded,
    nodeHeight,
    stageLayouts,
    branchHeight: Math.max(getNodeFootprintHeight(nodeHeight), stackBranchHeight(stageLayouts)),
  };
}

function placeTopologyNode(nodes, nodeId, x, startY, nodeHeight, branchHeight, data) {
  const rawY = startY + Math.max(0, (branchHeight - nodeHeight) / 2);
  nodes.push({
    id: nodeId,
    type: 'processNode',
    position: { x, y: rawY },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data: {
      ...data,
      nodeHeight,
    },
    style: data?.nodeStyle,
  });
}

function buildTopologyModel(processConfig, expandedNodeIds = []) {
  const nodes = [];
  const edges = [];
  const expandedSet = new Set(expandedNodeIds);

  if (!processConfig?.process) {
    return { nodes, edges };
  }

  const processNodeId = `process:${processConfig.process.id}`;
  const processExpanded = expandedSet.has(processNodeId);
  const subprocessLayouts = processExpanded ? (processConfig.process.subprocess ?? []).map((subprocess) => getSubprocessLayout(subprocess, expandedSet)) : [];
  const processHeight = estimateNodeHeight({
    title: processConfig.process.nodeName || processConfig.process.contextCode?.code || 'process',
    subtitle: processConfig.process.nodeComment || 'Корневой процесс',
    isExpandable: (processConfig.process.subprocess?.length ?? 0) > 0,
  });
  const processBranchHeight = Math.max(getNodeFootprintHeight(processHeight), stackBranchHeight(subprocessLayouts));
  const columnStep = TOPOLOGY_NODE_WIDTH + TOPOLOGY_HORIZONTAL_GAP;
  const processX = TOPOLOGY_LEFT_PADDING;

  placeTopologyNode(nodes, processNodeId, processX, TOPOLOGY_TOP_PADDING, processHeight, processBranchHeight, {
    title: processConfig.process.nodeName || processConfig.process.contextCode?.code || 'process',
    kind: 'process',
    secondaryLabel: processConfig.process.nodeComment || 'Корневой процесс',
    childCount: (processConfig.process.subprocess ?? []).length,
    isExpandable: (processConfig.process.subprocess?.length ?? 0) > 0,
    isExpanded: expandedSet.has(processNodeId),
  });

  if (!processExpanded) {
    return { nodes, edges };
  }

  let currentSubprocessY = TOPOLOGY_TOP_PADDING;
  subprocessLayouts.forEach((subprocessLayout, subprocessIndex) => {
    const subprocessX = processX + columnStep;
    placeTopologyNode(
      nodes,
      subprocessLayout.nodeId,
      subprocessX,
      currentSubprocessY,
      subprocessLayout.nodeHeight,
      subprocessLayout.branchHeight,
      {
        title: subprocessLayout.subprocess.nodeName || 'subprocess',
        kind: 'subprocess',
        secondaryLabel: subprocessLayout.subprocess.nodeComment || 'добавьте комментарий',
        childCount: (subprocessLayout.subprocess.stages ?? []).length,
        isExpandable: (subprocessLayout.subprocess.stages?.length ?? 0) > 0,
        isExpanded: subprocessLayout.expanded,
      },
    );
    edges.push(createTopologyEdge(`${processNodeId}->${subprocessLayout.nodeId}`, processNodeId, subprocessLayout.nodeId));

    if (subprocessLayout.expanded) {
      let currentStageY = currentSubprocessY;
      subprocessLayout.stageLayouts.forEach((stageLayout, stageIndex) => {
        const stageX = subprocessX + columnStep;
        placeTopologyNode(nodes, stageLayout.nodeId, stageX, currentStageY, stageLayout.nodeHeight, stageLayout.branchHeight, {
          title: stageLayout.stage.nodeName || 'stage',
          kind: 'stage',
          secondaryLabel: stageLayout.stage.nodeComment || 'добавьте комментарий',
          childCount: (stageLayout.stage.configurator?.result ?? []).length,
          isExpandable: (stageLayout.stage.configurator?.result?.length ?? 0) > 0,
          isExpanded: stageLayout.expanded,
        });
        edges.push(createTopologyEdge(`${subprocessLayout.nodeId}->${stageLayout.nodeId}`, subprocessLayout.nodeId, stageLayout.nodeId));

        if (stageLayout.expanded) {
          let currentResultY = currentStageY;
          stageLayout.resultLayouts.forEach((resultLayout, resultIndex) => {
              const resultX = stageX + columnStep;
              placeTopologyNode(nodes, resultLayout.nodeId, resultX, currentResultY, resultLayout.nodeHeight, resultLayout.branchHeight, {
                kind: 'result',
                summaryItems: resultLayout.summaryItems,
                childCount: resultLayout.reverseCount,
                isExpandable: resultLayout.reverseCount > 0,
                isExpanded: resultLayout.expanded,
                nodeClassName: 'process-node--result',
              });
              edges.push(createTopologyEdge(`${stageLayout.nodeId}->${resultLayout.nodeId}`, stageLayout.nodeId, resultLayout.nodeId));

              if (resultLayout.expanded) {
                let currentReverseY = currentResultY;
                resultLayout.reverseLayouts.forEach((reverseLayout, reverseIndex) => {
                  const reverseX = resultX + columnStep;
                  placeTopologyNode(nodes, reverseLayout.nodeId, reverseX, currentReverseY, reverseLayout.nodeHeight, reverseLayout.branchHeight, {
                    kind: 'reverse',
                    summaryItems: reverseLayout.summaryItems,
                    childCount: reverseLayout.outputCount,
                    isExpandable: reverseLayout.outputCount > 0,
                    isExpanded: reverseLayout.expanded,
                    nodeClassName: 'process-node--reverse',
                  });
                  edges.push(createTopologyEdge(`${resultLayout.nodeId}->${reverseLayout.nodeId}`, resultLayout.nodeId, reverseLayout.nodeId));

                  if (reverseLayout.expanded) {
                    let currentOutputY = currentReverseY;
                    reverseLayout.outputLayouts.forEach((outputLayout, outputIndex) => {
                      const outputX = reverseX + columnStep;
                      placeTopologyNode(nodes, outputLayout.nodeId, outputX, currentOutputY, outputLayout.nodeHeight, outputLayout.branchHeight, {
                        kind: 'reverseOutput',
                        summaryItems: outputLayout.summaryItems,
                        childCount: undefined,
                        nodeClassName: 'process-node--reverse-output',
                        nodeStyle: { width: 460 },
                        isExpandable: false,
                        isExpanded: false,
                      });
                      edges.push(createTopologyEdge(`${reverseLayout.nodeId}->${outputLayout.nodeId}`, reverseLayout.nodeId, outputLayout.nodeId));
                      currentOutputY += outputLayout.branchHeight + (outputIndex < reverseLayout.outputLayouts.length - 1 ? TOPOLOGY_VERTICAL_GAP : 0);
                    });
                  }

                  currentReverseY += reverseLayout.branchHeight + (reverseIndex < resultLayout.reverseLayouts.length - 1 ? TOPOLOGY_VERTICAL_GAP : 0);
                });
              }

              currentResultY += resultLayout.branchHeight + (resultIndex < stageLayout.resultLayouts.length - 1 ? TOPOLOGY_VERTICAL_GAP : 0);
            });
        }

        currentStageY += stageLayout.branchHeight + (stageIndex < subprocessLayout.stageLayouts.length - 1 ? TOPOLOGY_VERTICAL_GAP : 0);
      });
    }

    currentSubprocessY += subprocessLayout.branchHeight + (subprocessIndex < subprocessLayouts.length - 1 ? TOPOLOGY_VERTICAL_GAP : 0);
  });

  return { nodes, edges };
}

function updateSelectedNode(processConfig, selectedNodeId, values) {
  if (!processConfig?.process || !selectedNodeId) {
    return processConfig;
  }

  const [kind, rawId] = selectedNodeId.split(':');
  const targetId = rawId;

  if (kind === 'process') {
    return {
      ...processConfig,
      process: {
        ...processConfig.process,
        ...values,
      },
    };
  }

  if (kind === 'subprocess') {
    return {
      ...processConfig,
      process: {
        ...processConfig.process,
        subprocess: (processConfig.process.subprocess ?? []).map((subprocess) =>
          String(subprocess.id) === targetId ? { ...subprocess, ...values } : subprocess,
        ),
      },
    };
  }

  if (kind === 'stage') {
    return {
      ...processConfig,
      process: {
        ...processConfig.process,
        subprocess: (processConfig.process.subprocess ?? []).map((subprocess) => ({
          ...subprocess,
          stages: (subprocess.stages ?? []).map((stage) =>
            String(stage.id) === targetId
              ? {
                  ...stage,
                  ...Object.fromEntries(Object.entries(values).filter(([key]) => key !== 'configurator')),
                  configurator: values.configurator
                    ? {
                        ...(stage.configurator ?? {}),
                        ...values.configurator,
                      }
                    : stage.configurator,
                }
              : stage,
          ),
        })),
      },
    };
  }

  if (kind === 'configurator') {
    return {
      ...processConfig,
      process: {
        ...processConfig.process,
        subprocess: (processConfig.process.subprocess ?? []).map((subprocess) => ({
          ...subprocess,
          stages: (subprocess.stages ?? []).map((stage) =>
            String(stage.id) === targetId
              ? {
                  ...stage,
                  configurator: {
                    ...(stage.configurator ?? {}),
                    ...values,
                  },
                }
              : stage,
          ),
        })),
      },
    };
  }

  if (kind === 'result') {
    const [stageId, resultIndexRaw] = selectedNodeId.split(':').slice(1);
    const resultIndex = Number(resultIndexRaw);
    return {
      ...processConfig,
      process: {
        ...processConfig.process,
        subprocess: (processConfig.process.subprocess ?? []).map((subprocess) => ({
          ...subprocess,
          stages: (subprocess.stages ?? []).map((stage) =>
            String(stage.id) === stageId
              ? {
                  ...stage,
                  configurator: {
                    ...(stage.configurator ?? {}),
                    result: updateItemAt(stage.configurator?.result ?? [], resultIndex, () => values),
                  },
                }
              : stage,
          ),
        })),
      },
    };
  }

  if (kind === 'reverse') {
    const [stageId, resultIndexRaw, reverseIndexRaw] = selectedNodeId.split(':').slice(1);
    const resultIndex = Number(resultIndexRaw);
    const reverseIndex = Number(reverseIndexRaw);
    return {
      ...processConfig,
      process: {
        ...processConfig.process,
        subprocess: (processConfig.process.subprocess ?? []).map((subprocess) => ({
          ...subprocess,
          stages: (subprocess.stages ?? []).map((stage) =>
            String(stage.id) === stageId
              ? {
                  ...stage,
                  configurator: {
                    ...(stage.configurator ?? {}),
                    result: updateItemAt(stage.configurator?.result ?? [], resultIndex, (currentResult) => ({
                      ...currentResult,
                      reverse: updateItemAt(currentResult.reverse ?? [], reverseIndex, () => values),
                    })),
                  },
                }
              : stage,
          ),
        })),
      },
    };
  }

  if (kind === 'reverseOutput') {
    const [stageId, resultIndexRaw, reverseIndexRaw, outputIndexRaw] = selectedNodeId.split(':').slice(1);
    const resultIndex = Number(resultIndexRaw);
    const reverseIndex = Number(reverseIndexRaw);
    const outputIndex = Number(outputIndexRaw);
    return {
      ...processConfig,
      process: {
        ...processConfig.process,
        subprocess: (processConfig.process.subprocess ?? []).map((subprocess) => ({
          ...subprocess,
          stages: (subprocess.stages ?? []).map((stage) =>
            String(stage.id) === stageId
              ? {
                  ...stage,
                  configurator: {
                    ...(stage.configurator ?? {}),
                    result: updateItemAt(stage.configurator?.result ?? [], resultIndex, (currentResult) => ({
                      ...currentResult,
                      reverse: updateItemAt(currentResult.reverse ?? [], reverseIndex, (currentReverse) => ({
                        ...currentReverse,
                        output: updateItemAt(currentReverse.output ?? [], outputIndex, () => values),
                      })),
                    })),
                  },
                }
              : stage,
          ),
        })),
      },
    };
  }

  return processConfig;
}

function findSelectedNode(processConfig, selectedNodeId) {
  if (!processConfig?.process || !selectedNodeId) {
    return null;
  }

  const [kind, rawId] = selectedNodeId.split(':');
  const targetId = rawId;

  if (kind === 'process') {
    return { kind, node: processConfig.process };
  }

  if (kind === 'subprocess') {
    const subprocess = (processConfig.process.subprocess ?? []).find((item) => String(item.id) === targetId);
    return subprocess ? { kind, node: subprocess } : null;
  }

  if (kind === 'stage') {
    for (const subprocess of processConfig.process.subprocess ?? []) {
      const stage = (subprocess.stages ?? []).find((item) => String(item.id) === targetId);
      if (stage) {
        return { kind, node: stage, parent: subprocess };
      }
    }
  }

  if (kind === 'configurator') {
    for (const subprocess of processConfig.process.subprocess ?? []) {
      const stage = (subprocess.stages ?? []).find((item) => String(item.id) === targetId);
      if (stage) {
        return {
          kind,
          node: stage.configurator ?? {},
          parent: stage,
          subprocess,
        };
      }
    }
  }

  if (kind === 'result') {
    const [stageId, resultIndexRaw] = selectedNodeId.split(':').slice(1);
    const resultIndex = Number(resultIndexRaw);
    for (const subprocess of processConfig.process.subprocess ?? []) {
      const stage = (subprocess.stages ?? []).find((item) => String(item.id) === stageId);
      const result = stage?.configurator?.result?.[resultIndex];
      if (stage && result) {
        return { kind, node: result, parent: stage.configurator, stage, subprocess, resultIndex };
      }
    }
  }

  if (kind === 'reverse') {
    const [stageId, resultIndexRaw, reverseIndexRaw] = selectedNodeId.split(':').slice(1);
    const resultIndex = Number(resultIndexRaw);
    const reverseIndex = Number(reverseIndexRaw);
    for (const subprocess of processConfig.process.subprocess ?? []) {
      const stage = (subprocess.stages ?? []).find((item) => String(item.id) === stageId);
      const reverse = stage?.configurator?.result?.[resultIndex]?.reverse?.[reverseIndex];
      if (stage && reverse) {
        return { kind, node: reverse, stage, subprocess, resultIndex, reverseIndex };
      }
    }
  }

  if (kind === 'reverseOutput') {
    const [stageId, resultIndexRaw, reverseIndexRaw, outputIndexRaw] = selectedNodeId.split(':').slice(1);
    const resultIndex = Number(resultIndexRaw);
    const reverseIndex = Number(reverseIndexRaw);
    const outputIndex = Number(outputIndexRaw);
    for (const subprocess of processConfig.process.subprocess ?? []) {
      const stage = (subprocess.stages ?? []).find((item) => String(item.id) === stageId);
      const output = stage?.configurator?.result?.[resultIndex]?.reverse?.[reverseIndex]?.output?.[outputIndex];
      if (stage && output) {
        return { kind, node: output, stage, subprocess, resultIndex, reverseIndex, outputIndex };
      }
    }
  }

  return null;
}

function getNodeSavePayload(kind, draft, subprocessTriggerText = '', filterEventRuleText = '', reverseOutputRuleText = '') {
  if (!kind) {
    return null;
  }

  if (kind === 'process') {
    return {
      nodeName: draft.nodeName ?? '',
      nodeComment: draft.nodeComment ?? '',
      disabled: draft.disabled ?? false,
      contextCode: normalizeReferenceDraft(draft.contextCode),
    };
  }

  if (kind === 'subprocess') {
    const rawTrigger = subprocessTriggerText.trim();
    return {
      nodeName: draft.nodeName ?? '',
      nodeComment: draft.nodeComment ?? '',
      disabled: draft.disabled ?? false,
      trigger: {
        ...(draft.trigger ?? {}),
        rule: JSON.stringify(rawTrigger ? JSON.parse(rawTrigger) : {}, null, 2),
      },
    };
  }

  if (kind === 'stage') {
    const rawFilterEventRule = filterEventRuleText.trim();
    return {
      executor: draft.executor ?? '',
      contextCode: normalizeReferenceDraft(draft.contextCode),
      nodeName: draft.nodeName ?? '',
      nodeComment: draft.nodeComment ?? '',
      log: draft.log ?? { journalServiceName: '' },
      configurator: serializeStageConfigurator(
        draft.configurator,
        JSON.stringify(rawFilterEventRule ? JSON.parse(rawFilterEventRule) : {}, null, 2),
      ),
    };
  }

  if (kind === 'reverseOutput') {
    const rawRule = reverseOutputRuleText.trim();
    const parsedRule = rawRule ? JSON.parse(rawRule) : {};
    return {
      ...serializeReverseOutput(draft),
      rule: isEmptyJsonValue(parsedRule) ? null : JSON.stringify(parsedRule, null, 2),
    };
  }

  if (kind === 'configurator') {
    return {
      disabled: draft.disabled ?? false,
      interrupted: draft.interrupted ?? true,
      multiple: draft.multiple ?? false,
      filterEventRule: draft.filterEventRule ?? '',
      audit: draft.audit ?? null,
      result: draft.result ?? [],
    };
  }

  if (kind === 'result') {
    return {
      id: draft.id ?? undefined,
      inputScenarios: sanitizeInputScenarios(draft.inputScenarios),
      reverse: draft.reverse ?? [],
    };
  }

  return draft;
}

function getNodePreviewPayload(kind, draft, subprocessTriggerText = '', filterEventRuleText = '', reverseOutputRuleText = '') {
  if (!kind) {
    return null;
  }

  if (kind === 'subprocess') {
    return {
      nodeName: draft.nodeName ?? '',
      nodeComment: draft.nodeComment ?? '',
      disabled: draft.disabled ?? false,
      trigger: {
        ...(draft.trigger ?? {}),
        rule: subprocessTriggerText,
      },
    };
  }

  if (kind === 'stage') {
    return {
      executor: draft.executor ?? '',
      nodeName: draft.nodeName ?? '',
      nodeComment: draft.nodeComment ?? '',
      log: draft.log ?? { journalServiceName: '' },
      configurator: serializeStageConfigurator(draft.configurator, filterEventRuleText),
    };
  }

  if (kind === 'reverseOutput') {
    return {
      ...serializeReverseOutput(draft),
      rule: reverseOutputRuleText,
    };
  }

  if (kind === 'result') {
    return {
      id: draft.id ?? undefined,
      inputScenarios: sanitizeInputScenarios(draft.inputScenarios),
      reverse: draft.reverse ?? [],
    };
  }

  return getNodeSavePayload(kind, draft, subprocessTriggerText, filterEventRuleText, reverseOutputRuleText);
}

function ProcessNode({ data, selected }) {
  const title = data?.title ?? 'node';
  const subtitle = truncateText(data?.secondaryLabel ?? '');
  const kind = data?.kind ?? 'node';
  const summaryItems = data?.summaryItems ?? [];
  const childCount = data?.childCount;
  const isExpandable = Boolean(data?.isExpandable);
  const isExpanded = Boolean(data?.isExpanded);
  const nodeStyle = data?.nodeHeight
    ? kind === 'reverseOutput'
      ? { minHeight: `${data.nodeHeight}px` }
      : { height: `${data.nodeHeight}px`, minHeight: `${data.nodeHeight}px` }
    : undefined;
  const editNode = (event) => {
    event.stopPropagation();
    data?.onEdit?.();
  };
  const viewNode = (event) => {
    event.stopPropagation();
    data?.onView?.();
  };
  const reorderStages = (event) => {
    event.stopPropagation();
    data?.onReorder?.();
  };
  const deleteNode = (event) => {
    event.stopPropagation();
    data?.onDelete?.();
  };
  const addChildNode = (event) => {
    event.stopPropagation();
    data?.onAddChild?.();
  };
  const showTitle = kind !== 'result' && kind !== 'reverse' && kind !== 'reverseOutput';
  const showSubtitle = kind !== 'result' && kind !== 'reverse' && kind !== 'reverseOutput';

  return (
    <div
      className={cn('process-node', data?.nodeClassName, selected && 'selected')}
      style={nodeStyle}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="process-node__actions">
        <button type="button" className="process-node__action process-node__action-view" onClick={viewNode} aria-label="View node" title="View">
          <Eye aria-hidden className="process-node__edit-icon" size={18} />
        </button>
        <button type="button" className="process-node__edit" onClick={editNode} aria-label="Edit node" title="Edit">
          <Edit01 aria-hidden className="process-node__edit-icon" size={18} />
        </button>
        {(kind === 'subprocess' || kind === 'reverse') && (
          <button
            type="button"
            className="process-node__action process-node__action-order"
            onClick={reorderStages}
            aria-label={kind === 'reverse' ? 'Change reverse output order' : 'Change stage order'}
            title={kind === 'reverse' ? 'Change reverse output order' : 'Change stage order'}
          >
            <Rows01 aria-hidden className="process-node__edit-icon" size={18} />
          </button>
        )}
        {(kind === 'process' || kind === 'subprocess' || kind === 'stage' || kind === 'result' || kind === 'reverse') && (
          <button
            type="button"
            className="process-node__action process-node__action-add"
            onClick={addChildNode}
            aria-label={
              kind === 'process'
                ? 'Add subprocess'
                : kind === 'subprocess'
                  ? 'Add stage'
                : kind === 'stage'
                  ? 'Add result'
                  : kind === 'result'
                    ? 'Add reverse'
                    : 'Add reverse output'
            }
            title={
              kind === 'process'
                ? 'Add subprocess'
                : kind === 'subprocess'
                  ? 'Add stage'
                : kind === 'stage'
                  ? 'Add result'
                  : kind === 'result'
                    ? 'Add reverse'
                    : 'Add reverse output'
            }
          >
            <Plus aria-hidden className="process-node__edit-icon" size={18} />
          </button>
        )}
        {data?.canDelete && (
          <button
            type="button"
            className="process-node__action process-node__action-delete"
            onClick={deleteNode}
            aria-label="Delete node"
            title="Delete node"
          >
            <Trash01 aria-hidden className="process-node__edit-icon" size={18} />
          </button>
        )}
      </div>
      <div className="process-node__meta">
        {typeof childCount === 'number' && <div className="process-node__counter">{childCount}</div>}
      </div>
      {showTitle && <div className="process-node__title">{title}</div>}
      {showSubtitle && <div className="process-node__subtitle">{subtitle || 'Без описания'}</div>}
      {summaryItems.length > 0 && (
        <div
          className={cn(
            'process-node__summary',
            (kind === 'result' || kind === 'reverseOutput') && 'process-node__summary--plain-list',
          )}
        >
          {summaryItems.map((item, index) => (
            <div
              key={`${kind}-${index}-${item.value}`}
              className={cn(
                'process-node__summary-item',
                (kind === 'result' || kind === 'reverseOutput') && 'process-node__summary-item--plain',
              )}
            >
              {kind === 'result' || kind === 'reverseOutput' ? (
                <div className="process-node__summary-list-item">
                  {kind === 'result' && <BellRinging04 aria-hidden className="process-node__summary-icon" size={16} />}
                  {kind === 'reverse' && item.icon === 'notification' && (
                    <NotificationBox aria-hidden className="process-node__summary-icon" size={16} />
                  )}
                  {kind === 'reverseOutput' && item.icon === 'send' && (
                    <ZapCircle aria-hidden className="process-node__summary-icon" size={16} />
                  )}
                  {kind === 'reverseOutput' && item.icon === 'check' && (
                    <CheckVerified02
                      aria-hidden
                      className="process-node__summary-icon process-node__summary-icon--success"
                      size={16}
                    />
                  )}
                  <div className="process-node__summary-value">{item.value}</div>
                </div>
              ) : (
                <>
                  <div className="process-node__summary-label">{item.label}</div>
                  <div className="process-node__summary-value">{item.value}</div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      {isExpandable && <div className="process-node__hint">{isExpanded ? 'Скрыть дочерние' : 'Показать дочерние'}</div>}
    </div>
  );
}

function AutoFitView({
  processConfig,
  expandedNodeIds,
}) {
  const reactFlow = useReactFlow();

  useEffect(() => {
    if (!processConfig?.id) {
      return;
    }

    window.requestAnimationFrame(() => {
      reactFlow.fitView({
        padding: 0.35,
        minZoom: 0.15,
        duration: 250,
      });
    });
  }, [expandedNodeIds, processConfig?.id, reactFlow]);

  return null;
}

function ProcessTopology({
  processConfig,
  processConfigOptions,
  selectedProcessConfigId,
  selectedNodeId,
  expandedNodeIds,
  onToggleNode,
  onEditNode,
  onViewNode,
  onReorderSubprocessNode,
  onReorderReverseNode,
  onDeleteNode,
  onAddChildNode,
  onAddSubprocess,
  onCreateProcess,
  onDeleteProcessConfig,
  onImportProcessConfig,
  onExportProcessConfig,
  onSelectProcessConfig,
  onToggleFullscreen,
  isFullscreen,
  isCreateDisabled,
  isCreating,
  isDeleting,
  isImporting,
  isExporting,
}) {
  const [graph, setGraph] = useState({ nodes: [], edges: [] });

  useEffect(() => {
    setGraph(buildTopologyModel(processConfig, expandedNodeIds));
  }, [expandedNodeIds, processConfig]);

  return (
    <ReactFlowProvider>
      <div className="topology-canvas">
        <div className="topology-toolbar">
          <div className="topology-toolbar__group">
            <Button onClick={onCreateProcess} isLoading={isCreating} isDisabled={isCreateDisabled}>
              Создать процесс
            </Button>
            <TopologyActionsMenu
              onDeleteProcessConfig={onDeleteProcessConfig}
              onImportProcessConfig={onImportProcessConfig}
              onExportProcessConfig={onExportProcessConfig}
              isDeleting={isDeleting}
              isImporting={isImporting}
              isExporting={isExporting}
              canDelete={Boolean(selectedProcessConfigId)}
              canExport={Boolean(selectedProcessConfigId)}
            />
            <ProcessSelectField
              id="topology-process-select"
              className="topology-toolbar__select"
              value={selectedProcessConfigId}
              onChange={onSelectProcessConfig}
              options={processConfigOptions}
              placeholder="Выберите процесс"
              isDisabled={processConfigOptions.length === 0}
            />
          </div>
        </div>
        <div className="topology-canvas__fullscreen">
          <Button variant="secondary" onClick={onToggleFullscreen}>
            {isFullscreen ? 'Свернуть экран' : 'На весь экран'}
          </Button>
        </div>
        <ReactFlow
          nodes={graph.nodes.map((node) => ({
            ...node,
            selected: node.id === selectedNodeId,
            data: {
              ...node.data,
              onEdit: () => onEditNode(node.id),
              onView: () => onViewNode(node.id),
              onReorder:
                node.data.kind === 'subprocess'
                  ? () => onReorderSubprocessNode(node.id)
                  : node.data.kind === 'reverse'
                    ? () => onReorderReverseNode(node.id)
                    : undefined,
              onDelete: () => onDeleteNode(node.id),
              onAddChild:
                node.data.kind === 'process'
                  ? () => onAddSubprocess()
                  : node.data.kind === 'subprocess' || node.data.kind === 'stage' || node.data.kind === 'result' || node.data.kind === 'reverse'
                    ? () => onAddChildNode(node.id)
                  : undefined,
              canDelete: node.data.kind !== 'process',
            },
          }))}
          edges={graph.edges}
          nodeTypes={{ processNode: ProcessNode }}
          fitView
          fitViewOptions={{ padding: 0.35, minZoom: 0.15 }}
          minZoom={0.15}
          maxZoom={2}
          nodesDraggable={false}
          onNodeClick={(_, node) => onToggleNode(node.id)}
          proOptions={{ hideAttribution: true }}
        >
          <AutoFitView processConfig={processConfig} expandedNodeIds={expandedNodeIds} />
          <Controls position="top-right" showInteractive={false} />
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  );
}

function NodeEditor({
  processConfig,
  selectedNodeId,
  onSave,
  onDraftChange,
  onAutosaveStatusChange,
  onOpenJsonLogicPlayground,
  onAddSubprocess,
  onBulkCreateResults,
  contextCodeOptions,
  phaseOptions,
  b3StatusOptions,
  slaDurationUnitOptions,
  slaStatusOptions,
  isSaving,
}) {
  const selected = findSelectedNode(processConfig, selectedNodeId);
  const [draft, setDraft] = useState({});
  const [bulkResultInput, setBulkResultInput] = useState('');
  const [subprocessTriggerText, setSubprocessTriggerText] = useState('');
  const [subprocessTriggerError, setSubprocessTriggerError] = useState('');
  const [subprocessTriggerStatus, setSubprocessTriggerStatus] = useState('valid');
  const [filterEventRuleText, setFilterEventRuleText] = useState('');
  const [filterEventRuleError, setFilterEventRuleError] = useState('');
  const [filterEventRuleStatus, setFilterEventRuleStatus] = useState('valid');
  const [reverseOutputRuleText, setReverseOutputRuleText] = useState('');
  const [reverseOutputRuleError, setReverseOutputRuleError] = useState('');
  const [reverseOutputRuleStatus, setReverseOutputRuleStatus] = useState('valid');
  const draftRef = useRef({});
  const autosaveTimeoutRef = useRef(null);
  const autosaveIntervalRef = useRef(null);
  const autosaveDeadlineRef = useRef(null);
  const lastSavedPayloadRef = useRef('');
  const onSaveRef = useRef(onSave);
  const onDraftChangeRef = useRef(onDraftChange);
  const onAutosaveStatusChangeRef = useRef(onAutosaveStatusChange);
  const selectedKind = selected?.kind ?? null;
  const selectedNodeSnapshot = selected?.node ? JSON.stringify(selected.node) : '';

  const publishAutosaveStatus = (remainingMs) => {
    if (remainingMs == null || remainingMs <= 0) {
      onAutosaveStatusChangeRef.current?.(null);
      return;
    }

    onAutosaveStatusChangeRef.current?.({
      secondsLeft: Math.ceil(remainingMs / 1000),
    });
  };

  const clearAutosaveScheduling = () => {
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
      autosaveTimeoutRef.current = null;
    }
    if (autosaveIntervalRef.current) {
      clearInterval(autosaveIntervalRef.current);
      autosaveIntervalRef.current = null;
    }
    autosaveDeadlineRef.current = null;
    publishAutosaveStatus(null);
  };

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    onDraftChangeRef.current = onDraftChange;
  }, [onDraftChange]);

  useEffect(() => {
    onAutosaveStatusChangeRef.current = onAutosaveStatusChange;
  }, [onAutosaveStatusChange]);

  useEffect(() => {
    setDraft(selected?.node ?? {});
    draftRef.current = selected?.node ?? {};
    try {
      const payload = getNodeSavePayload(
        selected?.kind,
        selected?.node ?? {},
        selected?.node?.trigger?.rule ?? '',
        selected?.kind === 'stage' ? selected?.node?.configurator?.filterEventRule ?? '' : '',
        selected?.kind === 'reverseOutput' ? selected?.node?.rule ?? '' : '',
      );
      lastSavedPayloadRef.current = payload ? JSON.stringify(payload) : '';
    } catch {
      lastSavedPayloadRef.current = '';
    }
  }, [selectedNodeId, selectedNodeSnapshot]);

  useEffect(() => {
    setBulkResultInput('');
    clearAutosaveScheduling();
  }, [selectedNodeId]);

  useEffect(() => {
    return () => {
      clearAutosaveScheduling();
    };
  }, []);

  useEffect(() => {
    if (selected?.kind !== 'subprocess') {
      setSubprocessTriggerText('');
      setSubprocessTriggerError('');
      setSubprocessTriggerStatus('valid');
      return;
    }

    setSubprocessTriggerText(formatJsonSnippet(selected.node?.trigger?.rule ?? ''));
    setSubprocessTriggerError('');
    setSubprocessTriggerStatus('valid');
  }, [selectedNodeId, selected?.kind, selected?.node?.trigger?.rule]);

  useEffect(() => {
    if (selected?.kind !== 'subprocess') {
      return;
    }
    try {
      const rawTrigger = subprocessTriggerText.trim();
      JSON.parse(rawTrigger || '{}');
      setSubprocessTriggerError('');
      setSubprocessTriggerStatus('valid');
    } catch {
      setSubprocessTriggerError('Невалидный JSON.');
      setSubprocessTriggerStatus('invalid');
    }
  }, [selected?.kind, subprocessTriggerText]);

  useEffect(() => {
    if (selected?.kind !== 'stage') {
      setFilterEventRuleText('');
      setFilterEventRuleError('');
      setFilterEventRuleStatus('valid');
      return;
    }

    setFilterEventRuleText(formatJsonSnippet(selected.node?.configurator?.filterEventRule ?? ''));
    setFilterEventRuleError('');
    setFilterEventRuleStatus('valid');
  }, [selectedNodeId, selected?.kind, selected?.node?.configurator?.filterEventRule]);

  useEffect(() => {
    if (selected?.kind !== 'stage') {
      return;
    }
    try {
      const rawFilterEventRule = filterEventRuleText.trim();
      JSON.parse(rawFilterEventRule || '{}');
      setFilterEventRuleError('');
      setFilterEventRuleStatus('valid');
    } catch {
      setFilterEventRuleError('Невалидный JSON.');
      setFilterEventRuleStatus('invalid');
    }
  }, [selected?.kind, filterEventRuleText]);

  useEffect(() => {
    if (selected?.kind !== 'reverseOutput') {
      setReverseOutputRuleText('');
      setReverseOutputRuleError('');
      setReverseOutputRuleStatus('valid');
      return;
    }

    setReverseOutputRuleText(formatJsonSnippet(selected.node?.rule ?? ''));
    setReverseOutputRuleError('');
    setReverseOutputRuleStatus('valid');
  }, [selectedNodeId, selected?.kind, selected?.node?.rule]);

  useEffect(() => {
    if (selected?.kind !== 'reverseOutput') {
      return;
    }
    try {
      const rawRule = reverseOutputRuleText.trim();
      JSON.parse(rawRule || '{}');
      setReverseOutputRuleError('');
      setReverseOutputRuleStatus('valid');
    } catch {
      setReverseOutputRuleError('Невалидный JSON.');
      setReverseOutputRuleStatus('invalid');
    }
  }, [selected?.kind, reverseOutputRuleText]);

  useEffect(() => {
    if (!selected) {
      return undefined;
    }

    const previewPayload = getNodePreviewPayload(
      selectedKind,
      draft,
      subprocessTriggerText,
      filterEventRuleText,
      reverseOutputRuleText,
    );
    onDraftChangeRef.current(previewPayload);

    let nextPayload;
    try {
      nextPayload = getNodeSavePayload(
        selectedKind,
        draft,
        subprocessTriggerText,
        filterEventRuleText,
        reverseOutputRuleText,
      );
    } catch {
      return undefined;
    }

    const nextPayloadSnapshot = JSON.stringify(nextPayload);
    if (nextPayloadSnapshot === lastSavedPayloadRef.current) {
      clearAutosaveScheduling();
      return undefined;
    }

    clearAutosaveScheduling();
    autosaveDeadlineRef.current = Date.now() + NODE_AUTOSAVE_DELAY_MS;
    publishAutosaveStatus(NODE_AUTOSAVE_DELAY_MS);
    autosaveIntervalRef.current = window.setInterval(() => {
      const remainingMs = (autosaveDeadlineRef.current ?? 0) - Date.now();
      if (remainingMs <= 0) {
        if (autosaveIntervalRef.current) {
          clearInterval(autosaveIntervalRef.current);
          autosaveIntervalRef.current = null;
        }
        publishAutosaveStatus(null);
        return;
      }

      publishAutosaveStatus(remainingMs);
    }, 250);

    autosaveTimeoutRef.current = window.setTimeout(() => {
      if (autosaveIntervalRef.current) {
        clearInterval(autosaveIntervalRef.current);
        autosaveIntervalRef.current = null;
      }
      autosaveTimeoutRef.current = null;
      autosaveDeadlineRef.current = null;
      publishAutosaveStatus(null);
      Promise.resolve(onSaveRef.current(nextPayload))
        .then((saved) => {
          if (saved) {
            lastSavedPayloadRef.current = nextPayloadSnapshot;
          }
        })
        .catch(() => {});
    }, NODE_AUTOSAVE_DELAY_MS);

    return () => {
      clearAutosaveScheduling();
    };
  }, [draft, selectedKind, selectedNodeId, subprocessTriggerText, filterEventRuleText, reverseOutputRuleText]);

  const handleFormatSubprocessTrigger = () => {
    try {
      const rawTrigger = subprocessTriggerText.trim();
      const parsedTrigger = rawTrigger ? JSON.parse(rawTrigger) : {};
      setSubprocessTriggerText(JSON.stringify(parsedTrigger, null, 2));
      setSubprocessTriggerError('');
      setSubprocessTriggerStatus('valid');
    } catch {
      setSubprocessTriggerError('Trigger rule должен быть валидным JSON, чтобы его можно было форматировать.');
      setSubprocessTriggerStatus('invalid');
    }
  };

  const handleFormatFilterEventRule = () => {
    try {
      const rawFilterEventRule = filterEventRuleText.trim();
      const parsedFilterEventRule = rawFilterEventRule ? JSON.parse(rawFilterEventRule) : {};
      setFilterEventRuleText(JSON.stringify(parsedFilterEventRule, null, 2));
      setFilterEventRuleError('');
      setFilterEventRuleStatus('valid');
    } catch {
      setFilterEventRuleError('Filter event rule должен быть валидным JSON, чтобы его можно было форматировать.');
      setFilterEventRuleStatus('invalid');
    }
  };

  const handleFormatReverseOutputRule = () => {
    try {
      const rawRule = reverseOutputRuleText.trim();
      const parsedRule = rawRule ? JSON.parse(rawRule) : {};
      setReverseOutputRuleText(JSON.stringify(parsedRule, null, 2));
      setReverseOutputRuleError('');
      setReverseOutputRuleStatus('valid');
    } catch {
      setReverseOutputRuleError('Правило должно быть валидным JSON, чтобы его можно было форматировать.');
      setReverseOutputRuleStatus('invalid');
    }
  };

  if (!selected) {
    return null;
  }

  const updateDraftPath = (path, value) => {
    setDraft((current) => updateNestedValue(current, path, value));
  };

  const updateReverseOutputDraft = (updater) => {
    const nextDraft = updater(draftRef.current);
    draftRef.current = nextDraft;
    setDraft(nextDraft);
  };

  const updateDraftArrayItem = (path, index, updater) => {
    setDraft((current) => {
      const targetArray = path.reduce((acc, key) => acc?.[key], current) ?? [];
      return updateNestedValue(current, path, updateItemAt(targetArray, index, updater));
    });
  };

  const addDraftArrayItem = (path, item) => {
    setDraft((current) => {
      const targetArray = path.reduce((acc, key) => acc?.[key], current) ?? [];
      return updateNestedValue(current, path, [...targetArray, item]);
    });
  };

  const removeDraftArrayItem = (path, index) => {
    setDraft((current) => {
      const targetArray = path.reduce((acc, key) => acc?.[key], current) ?? [];
      return updateNestedValue(
        current,
        path,
        targetArray.filter((_, itemIndex) => itemIndex !== index),
      );
    });
  };

  const updateResultInputScenario = (index, value) => {
    setDraft((current) => {
      const targetArray = current.inputScenarios?.length ? [...current.inputScenarios] : [''];
      targetArray[index] = value;
      return {
        ...current,
        inputScenarios: targetArray,
      };
    });
  };

  const createDefaultResult = () => ({
    inputScenarios: [],
    reverse: [],
  });

  const createDefaultReverse = () => ({
    status: { code: '' },
    output: [],
  });

  const createDefaultOutput = () => ({
    phase: { code: '' },
    name: '',
    rule: '',
    body: {
      type: '',
      eventObject: {
        type: '',
      },
      service: {
        scenario: '',
        type: '',
        status: '',
        sla: {
          durationValue: '',
          durationUnit: { code: '' },
          status: { code: '' },
        },
      },
    },
    log: {
      journalServiceName: '',
      message: '',
    },
  });

  return (
    <Card className="editor-card">
      <CardBody>
        <Form>
          {(selected.kind === 'process' || selected.kind === 'subprocess') && (
            <>
              {(selected.kind === 'process' || selected.kind === 'subprocess') && (
                <>
                  <FormGroup
                    label={
                      selected.kind === 'process'
                        ? 'Название процесса'
                        : selected.kind === 'subprocess'
                          ? 'Название подпроцесса'
                          : 'Название'
                    }
                    fieldId="process-node-name"
                  >
                    <TextInput
                      id="process-node-name"
                      value={draft.nodeName ?? ''}
                      onChange={(_, value) => setDraft((current) => ({ ...current, nodeName: value }))}
                    />
                    {selected.kind === 'process' && (
                      <Text component="small">Название процесса необходимо для визуальной идентификации.</Text>
                    )}
                    {selected.kind === 'subprocess' && (
                      <Text component="small">Название подпроцесса необходимо для визуальной идентификации.</Text>
                    )}
                  </FormGroup>
                  <FormGroup
                    label={
                      selected.kind === 'process'
                        ? 'Описание процесса'
                        : selected.kind === 'subprocess'
                          ? 'Описание подпроцесса'
                          : 'Описание'
                    }
                    fieldId="process-node-comment"
                  >
                    <TextArea
                      id="process-node-comment"
                      value={draft.nodeComment ?? ''}
                      onChange={(_, value) => setDraft((current) => ({ ...current, nodeComment: value }))}
                      resizeOrientation="vertical"
                    />
                    {selected.kind === 'process' && (
                      <Text component="small">Описание процесса необходимо для описания назначения процесса.</Text>
                    )}
                    {selected.kind === 'subprocess' && (
                      <Text component="small">Описание подпроцесса необходимо для описания назначения подпроцесса.</Text>
                    )}
                  </FormGroup>
                </>
              )}
              {selected.kind === 'process' && (
                <FormGroup label="Код процесса" fieldId="node-context-code">
                  <ProcessSelectField
                    id="node-context-code"
                    value={draft.contextCode?.code ?? ''}
                    onChange={(next) => updateDraftPath(['contextCode', 'code'], next)}
                    options={contextCodeOptions}
                    placeholder="Выберите context code"
                  />
                  <Text component="small">
                    Код процесса необязателен. Установить в случае необходимости использования в конкретной реализации
                    информации о коде процесса
                  </Text>
                </FormGroup>
              )}
            </>
          )}

          {selected.kind === 'stage' && (
            <>
              <FormGroup label="Исполнитель" fieldId="stage-executor">
                <TextInput
                  id="stage-executor"
                  value={draft.executor ?? ''}
                  onChange={(_, value) => setDraft((current) => ({ ...current, executor: value }))}
                />
              </FormGroup>
              <FormGroup label="Context code" fieldId="stage-context-code">
                <ProcessSelectField
                  id="stage-context-code"
                  value={draft.contextCode?.code ?? ''}
                  onChange={(next) => updateDraftPath(['contextCode', 'code'], next)}
                  options={contextCodeOptions}
                  placeholder="Выберите context code"
                />
                <Text component="small">Context code стадии необязателен.</Text>
              </FormGroup>
              <FormGroup label="Название" fieldId="stage-node-name">
                <TextInput
                  id="stage-node-name"
                  value={draft.nodeName ?? ''}
                  onChange={(_, value) => setDraft((current) => ({ ...current, nodeName: value }))}
                />
                <Text component="small">{NODE_NAME_HELPER_TEXT}</Text>
              </FormGroup>
              <FormGroup label="Описание" fieldId="stage-node-comment">
                <TextArea
                  id="stage-node-comment"
                  value={draft.nodeComment ?? ''}
                  onChange={(_, value) => setDraft((current) => ({ ...current, nodeComment: value }))}
                  resizeOrientation="vertical"
                />
                <Text component="small">{NODE_COMMENT_HELPER_TEXT}</Text>
              </FormGroup>
              <div className="stage-editor-section">
                <div className="stage-editor-inline-header">
                  <Title headingLevel="h4">Правило JsonLogic</Title>
                  <span
                    className={
                      filterEventRuleStatus === 'valid'
                        ? 'json-status json-status-valid'
                        : 'json-status json-status-invalid'
                    }
                  >
                    {filterEventRuleStatus === 'valid' ? (
                      <CheckVerified02 aria-hidden size={16} />
                    ) : (
                      <XCircle aria-hidden size={16} />
                    )}
                    {filterEventRuleStatus === 'valid' ? 'JSON валиден' : 'JSON невалиден'}
                  </span>
                </div>
                <JsonSnippetEditor
                  id="stage-filter-event-rule"
                  value={filterEventRuleText}
                  onChange={(value) => {
                    setFilterEventRuleText(value);
                  }}
                  onBeautify={handleFormatFilterEventRule}
                  onOpenPlayground={() =>
                    onOpenJsonLogicPlayground?.('Playground для Filter event rule', filterEventRuleText)
                  }
                  helperText="Редактируйте Filter event rule как JSON. Для выравнивания отступов используйте кнопку форматирования."
                  error={filterEventRuleError}
                />
                <Text component="small">
                  Каждое событие, необходимое для фильтрации, будет проверено данным правилом. Если событие будет
                  проходить по данному правилу, то оно будет обработано, в ином случае стадия будет проигнорирована.
                </Text>
              </div>
              <div className="stage-editor-section">
                <Title headingLevel="h4">Настройка состояния стадии</Title>
                <div className="stage-editor-grid">
                  <div className="stage-toggle-option">
                    <Checkbox
                      id="stage-configurator-disabled"
                      isChecked={Boolean(draft.configurator?.disabled)}
                      onChange={(_, checked) => updateDraftPath(['configurator', 'disabled'], checked)}
                      label="Выключить"
                    />
                    <Text component="small" className="stage-toggle-option__hint">
                      При выключении стадия не будет обрабатывать поступающие события.
                    </Text>
                  </div>
                  <div className="stage-toggle-option">
                    <Checkbox
                      id="stage-configurator-interrupted"
                      isChecked={Boolean(draft.configurator?.interrupted)}
                      onChange={(_, checked) => updateDraftPath(['configurator', 'interrupted'], checked)}
                      label="Прерываемая"
                    />
                    <Text component="small" className="stage-toggle-option__hint">
                      Прерываемая стадия будет завершать весь подпроцесс при возникновении исключения, в ином случае
                      исключение будет проигнорировано и выполнение стадии с исключением не приведет к остановке
                      исполнения.
                    </Text>
                  </div>
                  <div className="stage-toggle-option">
                    <Checkbox
                      id="stage-configurator-multiple"
                      isChecked={Boolean(draft.configurator?.multiple)}
                      onChange={(_, checked) => updateDraftPath(['configurator', 'multiple'], checked)}
                      label="Множественная обработка"
                    />
                    <Text component="small" className="stage-toggle-option__hint">
                      Может применять множество событий, подходящих под фильтр.
                    </Text>
                  </div>
                </div>
                <div className="stage-editor-subsection">
                  <Title headingLevel="h5">Настройка аудита</Title>
                  <div className="stage-editor-grid">
                    <div className="stage-toggle-option">
                      <Checkbox
                        id="stage-audit-enabled"
                        isChecked={Boolean(draft.configurator?.audit?.enabled)}
                        onChange={(_, checked) => updateDraftPath(['configurator', 'audit', 'enabled'], checked)}
                        label="Включить"
                      />
                      <Text component="small" className="stage-toggle-option__hint">
                        При включении аудит будет записывать информацию по обработке событий для данной стадии.
                      </Text>
                    </div>
                  </div>
                  <FormGroup label="Код события" fieldId="stage-audit-event-code">
                    <TextInput
                      id="stage-audit-event-code"
                      value={draft.configurator?.audit?.eventCode ?? ''}
                      onChange={(_, value) => updateDraftPath(['configurator', 'audit', 'eventCode'], value)}
                    />
                  </FormGroup>
                  <FormGroup label="Описание события" fieldId="stage-audit-event-description">
                    <TextInput
                      id="stage-audit-event-description"
                      value={draft.configurator?.audit?.eventDescription ?? ''}
                      onChange={(_, value) => updateDraftPath(['configurator', 'audit', 'eventDescription'], value)}
                    />
                  </FormGroup>
                </div>
              </div>
              <div className="stage-editor-section">
                <Title headingLevel="h4">Настройки логирования</Title>
                <FormGroup label="Название в интеграционном журнале" fieldId="stage-log-journal">
                  <TextInput
                    id="stage-log-journal"
                    value={draft.log?.journalServiceName ?? ''}
                    onChange={(_, value) => updateDraftPath(['log', 'journalServiceName'], value)}
                  />
                </FormGroup>
              </div>
            </>
          )}

          {selected.kind === 'subprocess' && (
            <div className="stage-editor-section">
              <div className="stage-editor-inline-header">
                <Title headingLevel="h5">JsonLogic правило запуска</Title>
                <span
                  className={
                    subprocessTriggerStatus === 'valid'
                      ? 'json-status json-status-valid'
                      : 'json-status json-status-invalid'
                  }
                >
                  {subprocessTriggerStatus === 'valid' ? (
                    <CheckVerified02 aria-hidden size={16} />
                  ) : (
                    <XCircle aria-hidden size={16} />
                  )}
                  {subprocessTriggerStatus === 'valid' ? 'JSON валиден' : 'JSON невалиден'}
                </span>
              </div>
              <JsonSnippetEditor
                id="subprocess-trigger"
                value={subprocessTriggerText}
                onChange={(value) => {
                  setSubprocessTriggerText(value);
                }}
                onBeautify={handleFormatSubprocessTrigger}
                onOpenPlayground={() =>
                  onOpenJsonLogicPlayground?.('Playground для JsonLogic правила запуска', subprocessTriggerText)
                }
                helperText="Редактируйте JsonLogic правило запуска как JSON. Для выравнивания отступов используйте кнопку форматирования."
                error={subprocessTriggerError}
              />
            </div>
          )}

          {selected.kind === 'result' && (
            <div className="stage-editor-section reverse-output-editor-section">
              <FormGroup label="Обрабатываемые входящие сценарии" fieldId="result-input-scenarios-0">
                <div className="space-y-3">
                  {(draft.inputScenarios?.length ? draft.inputScenarios : ['']).map((scenario, index) => (
                    <div key={`result-input-scenario-${index}`} className="flex items-center gap-3">
                      <TextInput
                        id={`result-input-scenarios-${index}`}
                        value={scenario}
                        placeholder="Введите сценарий"
                        onChange={(_, value) => updateResultInputScenario(index, value)}
                      />
                      <Button
                        variant="plain"
                        aria-label={`Удалить сценарий ${index + 1}`}
                        onClick={() => removeDraftArrayItem(['inputScenarios'], index)}
                      >
                        <Trash01 aria-hidden size={18} />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="secondary"
                    onClick={() => addDraftArrayItem(['inputScenarios'], '')}
                    className="w-full sm:w-auto"
                  >
                    <Plus aria-hidden size={18} />
                    Добавить сценарий
                  </Button>
                </div>
                <Text component="small">
                  Укажите сценарии, на которые система должна отвечать. Если во входящем событии значение
                  `b3event.body.service.scenario` совпадет с одним из этих сценариев или подходящим паттерном,
                  событие будет принято в обработку для формирования ответного события.
                </Text>
              </FormGroup>
            </div>
          )}

          {selected.kind === 'reverse' && (
            <div className="stage-editor-section">
              <Title headingLevel="h4">Reverse</Title>
              <FormGroup label="STATUS" fieldId="reverse-status-code">
                <ProcessSelectField
                  id="reverse-status-code"
                  value={draft.status?.code ?? ''}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      status: {
                        ...(current.status ?? {}),
                        code: value,
                      },
                    }))
                  }
                  options={b3StatusOptions}
                  placeholder="Выберите STATUS"
                />
              </FormGroup>
            </div>
          )}

          {selected.kind === 'reverseOutput' && (
            <div className="stage-editor-section reverse-output-editor-section">
              <FormGroup label="Тип события" fieldId="reverse-output-phase">
                <ProcessSelectField
                  id="reverse-output-phase"
                  value={draft.phase?.code ?? ''}
                  onChange={(code) =>
                    updateReverseOutputDraft((current) => ({
                      ...current,
                      phase: {
                        ...(current.phase ?? {}),
                        code,
                      },
                    }))
                  }
                  options={phaseOptions}
                  placeholder="Выберите тип события"
                />
                <Text component="small">
                  Определяет, какой тип события будет отправлен в B3 Adapter.
                </Text>
              </FormGroup>
              <FormGroup label="Идентификационное имя" fieldId="reverse-output-name">
                <TextInput
                  id="reverse-output-name"
                  value={draft.name ?? ''}
                  onChange={(_, value) => updateReverseOutputDraft((current) => ({ ...current, name: value }))}
                />
                <Text component="small">
                  Позволяет определить строковой идентификатор события. Это имя можно использовать в коде при
                  отправке события для выбора нужной конфигурации.
                </Text>
              </FormGroup>
              <div className="stage-editor-subsection">
                <div className="stage-editor-inline-header">
                  <Title headingLevel="h5">Правило JsonLogic</Title>
                  <span
                    className={
                      reverseOutputRuleStatus === 'valid'
                        ? 'json-status json-status-valid'
                        : 'json-status json-status-invalid'
                    }
                  >
                    {reverseOutputRuleStatus === 'valid' ? (
                      <CheckVerified02 aria-hidden size={16} />
                    ) : (
                      <XCircle aria-hidden size={16} />
                    )}
                    {reverseOutputRuleStatus === 'valid' ? 'JSON валиден' : 'JSON невалиден'}
                  </span>
                </div>
                <JsonSnippetEditor
                  id="reverse-output-rule"
                  value={reverseOutputRuleText}
                  onChange={(value) => {
                    setReverseOutputRuleText(value);
                  }}
                  onBeautify={handleFormatReverseOutputRule}
                  onOpenPlayground={() =>
                    onOpenJsonLogicPlayground?.('Playground для правила JsonLogic отправки', reverseOutputRuleText)
                  }
                  helperText="Редактируйте правило для отправляемого события как JSON. Для выравнивания отступов используйте кнопку форматирования."
                  error={reverseOutputRuleError}
                />
              </div>
              <div className="stage-editor-subsection">
                <Title headingLevel="h5">B3Event Body</Title>
                <FormGroup label="B3Event.body.type" fieldId="reverse-output-body-type">
                  <TextInput
                    id="reverse-output-body-type"
                    value={draft.body?.type ?? ''}
                    onChange={(_, value) =>
                      updateReverseOutputDraft((current) => ({
                        ...current,
                        body: {
                          ...(current.body ?? {}),
                          type: value,
                        },
                      }))
                    }
                  />
                </FormGroup>
                <FormGroup label="B3Event.body.status" fieldId="reverse-output-event-object-type">
                  <TextInput
                    id="reverse-output-event-object-type"
                    value={draft.body?.eventObject?.type ?? ''}
                    onChange={(_, value) =>
                      updateReverseOutputDraft((current) => ({
                        ...current,
                        body: {
                          ...(current.body ?? {}),
                          eventObject: {
                            ...(current.body?.eventObject ?? {}),
                            type: value,
                          },
                        },
                      }))
                    }
                  />
                </FormGroup>
              </div>
              <div className="stage-editor-subsection">
                <Title headingLevel="h5">B3Event Service</Title>
                <FormGroup label="B3Event.body.service.scenario" fieldId="reverse-output-service-scenario">
                  <TextInput
                    id="reverse-output-service-scenario"
                    value={draft.body?.service?.scenario ?? ''}
                    onChange={(_, value) =>
                      updateReverseOutputDraft((current) => ({
                        ...current,
                        body: {
                          ...(current.body ?? {}),
                          service: {
                            ...(current.body?.service ?? {}),
                            scenario: value,
                          },
                        },
                      }))
                    }
                  />
                </FormGroup>
                <FormGroup label="B3Event.body.service.type" fieldId="reverse-output-service-type">
                  <TextInput
                    id="reverse-output-service-type"
                    value={draft.body?.service?.type ?? ''}
                    onChange={(_, value) =>
                      updateReverseOutputDraft((current) => ({
                        ...current,
                        body: {
                          ...(current.body ?? {}),
                          service: {
                            ...(current.body?.service ?? {}),
                            type: value,
                          },
                        },
                      }))
                    }
                  />
                </FormGroup>
                <FormGroup label="B3Event.body.service.status" fieldId="reverse-output-service-status">
                  <ProcessSelectField
                    id="reverse-output-service-status"
                    value={draft.body?.service?.status?.code ?? ''}
                    onChange={(code) =>
                      updateReverseOutputDraft((current) => ({
                        ...current,
                        body: {
                          ...(current.body ?? {}),
                          service: {
                            ...(current.body?.service ?? {}),
                            status: {
                              ...(current.body?.service?.status ?? {}),
                              code,
                            },
                          },
                        },
                      }))
                    }
                    options={b3StatusOptions}
                    placeholder="Выберите статус B3"
                  />
                </FormGroup>
              </div>
              <div className="stage-editor-subsection">
                <Title headingLevel="h5">SLA</Title>
                <FormGroup label="B3Event.body.service.slaState.durationValue" fieldId="reverse-output-sla-duration-value">
                  <TextInput
                    id="reverse-output-sla-duration-value"
                    value={draft.body?.service?.sla?.durationValue ?? ''}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    onChange={(_, value) =>
                      updateReverseOutputDraft((current) => ({
                        ...current,
                        body: {
                          ...(current.body ?? {}),
                          service: {
                            ...(current.body?.service ?? {}),
                            sla: {
                              ...(current.body?.service?.sla ?? {}),
                              durationValue: value.replace(/\D/g, ''),
                            },
                          },
                        },
                      }))
                    }
                  />
                  <Text component="small">Это значение длительности SLA.</Text>
                </FormGroup>
                <FormGroup label="B3Event.body.service.slaState.durationUnit" fieldId="reverse-output-sla-duration-unit">
                  <ProcessSelectField
                    id="reverse-output-sla-duration-unit"
                    value={draft.body?.service?.sla?.durationUnit?.code ?? ''}
                    onChange={(value) =>
                      updateReverseOutputDraft((current) => ({
                        ...current,
                        body: {
                          ...(current.body ?? {}),
                          service: {
                            ...(current.body?.service ?? {}),
                            sla: {
                              ...(current.body?.service?.sla ?? {}),
                              durationUnit: {
                                ...(current.body?.service?.sla?.durationUnit ?? {}),
                                code: value,
                              },
                            },
                          },
                        },
                      }))
                    }
                    options={slaDurationUnitOptions}
                    placeholder="Выберите единицу длительности SLA"
                  />
                  <Text component="small">Это единица длительности SLA.</Text>
                </FormGroup>
                <FormGroup label="B3Event.body.service.slaState.status" fieldId="reverse-output-sla-status">
                  <ProcessSelectField
                    id="reverse-output-sla-status"
                    value={draft.body?.service?.sla?.status?.code ?? ''}
                    onChange={(code) =>
                      updateReverseOutputDraft((current) => ({
                        ...current,
                        body: {
                          ...(current.body ?? {}),
                          service: {
                            ...(current.body?.service ?? {}),
                            sla: {
                              ...(current.body?.service?.sla ?? {}),
                              status: {
                                ...(current.body?.service?.sla?.status ?? {}),
                                code,
                              },
                            },
                          },
                        },
                      }))
                    }
                    options={slaStatusOptions}
                    placeholder="Выберите статус SLA"
                  />
                  <Text component="small">Это статус SLA.</Text>
                </FormGroup>
              </div>
              <div className="stage-editor-subsection">
                <Title headingLevel="h5">Настройки интеграционного журналирования</Title>
                <FormGroup label="Название сервиса" fieldId="reverse-output-log-journal">
                  <TextInput
                    id="reverse-output-log-journal"
                    value={draft.log?.journalServiceName ?? ''}
                    onChange={(_, value) =>
                      updateReverseOutputDraft((current) => ({
                        ...current,
                        log: {
                          ...(current.log ?? {}),
                          journalServiceName: value,
                        },
                      }))
                    }
                  />
                  <Text component="small">
                    С данным названием сервиса в интеграционном журнале будет добавлена запись отправленного события.
                  </Text>
                </FormGroup>
                <FormGroup label="Сообщение" fieldId="reverse-output-log-message">
                  <TextArea
                    id="reverse-output-log-message"
                    value={draft.log?.message ?? ''}
                    onChange={(_, value) =>
                      updateReverseOutputDraft((current) => ({
                        ...current,
                        log: {
                          ...(current.log ?? {}),
                          message: value,
                        },
                      }))
                    }
                    resizeOrientation="vertical"
                  />
                  <Text component="small">
                    Данное сообщение будет добавлено к записи отправленного события в интеграционном журнале.
                  </Text>
                </FormGroup>
              </div>
            </div>
          )}

          <div className="editor-actions">
          </div>
        </Form>
      </CardBody>
    </Card>
  );
}

function NodeOrderEditor({ processConfig, selectedNodeId, onReorderStages, onReorderReverseOutputs, isSaving }) {
  const selected = findSelectedNode(processConfig, selectedNodeId);
  const [itemOrder, setItemOrder] = useState([]);
  const [draggedItemId, setDraggedItemId] = useState(null);
  const itemOrderRef = useRef([]);
  const selectedItemIds =
    selected?.kind === 'subprocess'
      ? (selected.node?.stages ?? []).map((stage) => String(stage.id)).join('|')
      : selected?.kind === 'reverse'
        ? (selected.node?.output ?? []).map((output) => String(output.id)).join('|')
        : '';

  useEffect(() => {
    if (selected?.kind !== 'subprocess' && selected?.kind !== 'reverse') {
      setItemOrder([]);
      itemOrderRef.current = [];
      setDraggedItemId(null);
      return;
    }

    const nextItemOrder =
      selected.kind === 'subprocess'
        ? (selected.node?.stages ?? []).map((stage) => String(stage.id))
        : (selected.node?.output ?? []).map((output) => String(output.id));
    setItemOrder(nextItemOrder);
    itemOrderRef.current = nextItemOrder;
    setDraggedItemId(null);
  }, [selectedNodeId, selected?.kind, selectedItemIds]);

  const orderedItems =
    selected?.kind === 'subprocess'
      ? itemOrder
          .map((stageId) => (selected.node?.stages ?? []).find((stage) => String(stage.id) === stageId))
          .filter(Boolean)
      : selected?.kind === 'reverse'
        ? itemOrder
            .map((outputId) => (selected.node?.output ?? []).find((output) => String(output.id) === outputId))
            .filter(Boolean)
      : [];

  const handlePointerDown = (itemId) => {
    setDraggedItemId(itemId);
  };

  const handlePointerEnter = (targetItemId) => {
    if (!draggedItemId || draggedItemId === targetItemId) {
      return;
    }

    const currentOrder = itemOrderRef.current;
    const fromIndex = currentOrder.indexOf(draggedItemId);
    const toIndex = currentOrder.indexOf(targetItemId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
      return;
    }

    const nextOrder = reorderItems(currentOrder, fromIndex, toIndex);
    itemOrderRef.current = nextOrder;
    setItemOrder(nextOrder);
  };

  const handlePointerUp = async () => {
    const nextItemOrder = [...itemOrderRef.current];
    setDraggedItemId(null);

    if ((selected?.kind !== 'subprocess' && selected?.kind !== 'reverse') || !selected.node?.id) {
      return;
    }

    if (nextItemOrder.join('|') === selectedItemIds) {
      return;
    }

    if (selected.kind === 'subprocess') {
      await onReorderStages(String(selected.node.id), nextItemOrder);
      return;
    }

    await onReorderReverseOutputs(String(selected.node.id), nextItemOrder);
  };

  if (selected?.kind !== 'subprocess' && selected?.kind !== 'reverse') {
    return null;
  }

  return (
    <Card className="editor-card">
      <CardBody>
        <div className="stage-order-panel stage-order-panel-standalone">
          <div className="stage-order-list">
            {orderedItems.map((item, index) => {
              const itemId = String(item.id);
              const isStage = selected.kind === 'subprocess';
              return (
                <button
                  key={itemId}
                  type="button"
                  disabled={isSaving}
                  className={draggedItemId === itemId ? 'stage-order-item dragging' : 'stage-order-item'}
                  onPointerDown={() => handlePointerDown(itemId)}
                  onPointerEnter={() => handlePointerEnter(itemId)}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={(event) => {
                    if (event.buttons === 0 && draggedItemId) {
                      handlePointerUp();
                    }
                  }}
                >
                  <span className="stage-order-item__index">{index + 1}</span>
                  <span className="stage-order-item__content">
                    <strong>
                      {isStage
                        ? item.nodeName || 'stage'
                        : item.phase?.code
                          ? formatReverseOutputEventType(item.phase.code)
                          : item.name || 'reverse output'}
                    </strong>
                    <small>
                      {isStage
                        ? item.nodeComment || 'Без описания'
                        : item.body?.service?.scenario || item.body?.type || 'Без описания'}
                    </small>
                  </span>
                  <span className="stage-order-item__handle">::</span>
                </button>
              );
            })}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function NodeViewer({ processConfig, selectedNodeId }) {
  const selected = findSelectedNode(processConfig, selectedNodeId);

  if (!selected) {
    return null;
  }

  const node = selected.node;

  return (
    <Card className="editor-card">
      <CardBody className="space-y-4">
        {selected.kind === 'process' && (
          <>
            <StaticField label="Название процесса" value={node.nodeName || '—'} />
            <StaticField label="Описание процесса" value={node.nodeComment || '—'} />
            <StaticField label="Код процесса" value={node.contextCode?.code || '—'} />
          </>
        )}

        {selected.kind === 'subprocess' && (
          <>
            <StaticField label="Название подпроцесса" value={node.nodeName || '—'} />
            <StaticField label="Описание подпроцесса" value={node.nodeComment || '—'} />
            <StaticJsonField label="JsonLogic правило запуска" value={node.trigger?.rule ?? ''} />
          </>
        )}

        {selected.kind === 'stage' && (
          <>
            <StaticField label="Исполнитель" value={node.executor || '—'} />
            <StaticField label="Context code" value={node.contextCode?.code || '—'} />
            <StaticField label="Название" value={node.nodeName || '—'} />
            <StaticField label="Описание" value={node.nodeComment || '—'} />
            <StaticJsonField label="Правило JsonLogic" value={node.configurator?.filterEventRule ?? ''} />
            <div className="viewer-section">
              <Title headingLevel="h5">Настройка состояния стадии</Title>
              <StaticField label="Выключить" value={node.configurator?.disabled ? 'Да' : 'Нет'} />
              <StaticField label="Прервать обработку" value={node.configurator?.interrupted ? 'Да' : 'Нет'} />
              <StaticField label="Множественная обработка" value={node.configurator?.multiple ? 'Да' : 'Нет'} />
            </div>
            <div className="viewer-section">
              <Title headingLevel="h5">Настройка аудита</Title>
              <StaticField label="Включить" value={node.configurator?.audit?.enabled ? 'Да' : 'Нет'} />
              <StaticField label="Код события" value={node.configurator?.audit?.eventCode || '—'} />
              <StaticField label="Описание события" value={node.configurator?.audit?.eventDescription || '—'} />
            </div>
            <div className="viewer-section">
              <Title headingLevel="h5">Настройки логирования</Title>
              <StaticField label="Название в интеграционном журнале" value={node.log?.journalServiceName || '—'} />
            </div>
          </>
        )}

        {selected.kind === 'result' && (
          <div className="viewer-section">
            <Title headingLevel="h5">Обрабатываемые входящие сценарии</Title>
            <div className="viewer-list">
              {(node.inputScenarios?.length ? node.inputScenarios : ['—']).map((scenario, index) => (
                <div key={`${scenario}-${index}`} className="viewer-list__item">{scenario}</div>
              ))}
            </div>
          </div>
        )}

        {selected.kind === 'reverse' && (
          <StaticField label="STATUS" value={node.status?.code ? formatReverseOutputEventType(node.status.code) : '—'} />
        )}

        {selected.kind === 'reverseOutput' && (
          <>
            <StaticField label="Тип события" value={node.phase?.code || '—'} />
            <StaticField label="Идентификационное имя" value={node.name || '—'} />
            <StaticJsonField label="Правило JsonLogic" value={node.rule ?? ''} />
            <div className="viewer-section">
              <Title headingLevel="h5">B3Event Body</Title>
              <StaticField label="B3Event.body.type" value={node.body?.type || '—'} />
              <StaticField label="B3Event.body.status" value={node.body?.eventObject?.type || '—'} />
            </div>
            <div className="viewer-section">
              <Title headingLevel="h5">B3Event Service</Title>
              <StaticField label="B3Event.body.service.scenario" value={node.body?.service?.scenario || '—'} />
              <StaticField label="B3Event.body.service.type" value={node.body?.service?.type || '—'} />
              <StaticField label="B3Event.body.service.status" value={node.body?.service?.status?.code || '—'} />
            </div>
            <div className="viewer-section">
              <Title headingLevel="h5">SLA</Title>
              <StaticField label="B3Event.body.service.slaState.durationValue" value={node.body?.service?.sla?.durationValue ?? '—'} />
              <StaticField label="B3Event.body.service.slaState.durationUnit" value={node.body?.service?.sla?.durationUnit?.code || '—'} />
              <StaticField label="B3Event.body.service.slaState.status" value={node.body?.service?.sla?.status?.code || '—'} />
            </div>
            <div className="viewer-section">
              <Title headingLevel="h5">Настройки интеграционного журналирования</Title>
              <StaticField label="Название сервиса" value={node.log?.journalServiceName || '—'} />
              <StaticField label="Сообщение" value={node.log?.message || '—'} />
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

export function App() {
  const { data, loading, error, refetch } = useQuery(PROCESS_FIELDS);
  const [createProcess, createState] = useMutation(CREATE_PROCESS, {
    fetchPolicy: 'no-cache',
  });
  const [deleteProcessConfig, deleteProcessConfigState] = useMutation(DELETE_PROCESS_CONFIG, {
    fetchPolicy: 'no-cache',
  });
  const [updateProcess, updateState] = useMutation(UPDATE_PROCESS, {
    fetchPolicy: 'no-cache',
  });
  const [updateStageNode, updateStageState] = useMutation(UPDATE_STAGE_NODE, {
    fetchPolicy: 'no-cache',
  });
  const [updateConfiguratorNode, updateConfiguratorState] = useMutation(UPDATE_CONFIGURATOR_NODE, {
    fetchPolicy: 'no-cache',
  });
  const [updateSubprocessNode, updateSubprocessState] = useMutation(UPDATE_SUBPROCESS_NODE, {
    fetchPolicy: 'no-cache',
  });
  const [reorderSubprocessStages, reorderSubprocessStagesState] = useMutation(REORDER_SUBPROCESS_STAGES, {
    fetchPolicy: 'no-cache',
  });
  const [reorderReverseOutputs, reorderReverseOutputsState] = useMutation(REORDER_REVERSE_OUTPUTS, {
    fetchPolicy: 'no-cache',
  });
  const [updateProcessNode, updateProcessNodeState] = useMutation(UPDATE_PROCESS_NODE, {
    fetchPolicy: 'no-cache',
  });
  const [createSubprocessNode, createSubprocessState] = useMutation(CREATE_SUBPROCESS_NODE, {
    fetchPolicy: 'no-cache',
  });
  const [createStageNode, createStageState] = useMutation(CREATE_STAGE_NODE, {
    fetchPolicy: 'no-cache',
  });
  const [createResultNode, createResultState] = useMutation(CREATE_RESULT_NODE, {
    fetchPolicy: 'no-cache',
  });
  const [createReverseNode, createReverseState] = useMutation(CREATE_REVERSE_NODE, {
    fetchPolicy: 'no-cache',
  });
  const [updateReverseNode, updateReverseState] = useMutation(UPDATE_REVERSE_NODE, {
    fetchPolicy: 'no-cache',
  });
  const [updateResultNode, updateResultState] = useMutation(UPDATE_RESULT_NODE, {
    fetchPolicy: 'no-cache',
  });
  const [createReverseOutputNode, createReverseOutputState] = useMutation(CREATE_REVERSE_OUTPUT_NODE, {
    fetchPolicy: 'no-cache',
  });
  const [updateReverseOutputNode, updateReverseOutputState] = useMutation(UPDATE_REVERSE_OUTPUT_NODE, {
    fetchPolicy: 'no-cache',
  });
  const [deleteSubprocessNode, deleteSubprocessState] = useMutation(DELETE_SUBPROCESS_NODE, {
    fetchPolicy: 'no-cache',
  });
  const [deleteStageNode, deleteStageState] = useMutation(DELETE_STAGE_NODE, {
    fetchPolicy: 'no-cache',
  });
  const [deleteConfiguratorNode, deleteConfiguratorState] = useMutation(DELETE_CONFIGURATOR_NODE, {
    fetchPolicy: 'no-cache',
  });
  const [deleteResultNode, deleteResultState] = useMutation(DELETE_RESULT_NODE, {
    fetchPolicy: 'no-cache',
  });
  const [deleteReverseNode, deleteReverseState] = useMutation(DELETE_REVERSE_NODE, {
    fetchPolicy: 'no-cache',
  });
  const [deleteReverseOutputNode, deleteReverseOutputState] = useMutation(DELETE_REVERSE_OUTPUT_NODE, {
    fetchPolicy: 'no-cache',
  });
  const [selectedConfigId, setSelectedConfigId] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [editorNodeId, setEditorNodeId] = useState(null);
  const [viewerNodeId, setViewerNodeId] = useState(null);
  const [orderNodeId, setOrderNodeId] = useState(null);
  const [expandedNodeIds, setExpandedNodeIds] = useState([]);
  const [createErrorMessage, setCreateErrorMessage] = useState('');
  const [updateErrorMessage, setUpdateErrorMessage] = useState('');
  const [exportErrorMessage, setExportErrorMessage] = useState('');
  const [importErrorMessage, setImportErrorMessage] = useState('');
  const [isTopologyFullscreen, setIsTopologyFullscreen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [localProcessConfig, setLocalProcessConfig] = useState(null);
  const [editorPreview, setEditorPreview] = useState(null);
  const [toast, setToast] = useState(null);
  const [isExportingProcessConfig, setIsExportingProcessConfig] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImportingProcessConfig, setIsImportingProcessConfig] = useState(false);
  const [importFiles, setImportFiles] = useState([]);
  const [importScheme, setImportScheme] = useState('NEW');
  const [exportType, setExportType] = useState('DEFAULT');
  const [isJsonLogicPlaygroundOpen, setIsJsonLogicPlaygroundOpen] = useState(false);
  const [jsonLogicPlaygroundTitle, setJsonLogicPlaygroundTitle] = useState('');
  const [jsonLogicPlaygroundInput, setJsonLogicPlaygroundInput] = useState('{}');
  const [jsonLogicPlaygroundRule, setJsonLogicPlaygroundRule] = useState('{}');
  const [jsonLogicPlaygroundResult, setJsonLogicPlaygroundResult] = useState('');
  const [jsonLogicPlaygroundError, setJsonLogicPlaygroundError] = useState('');
  const [isEvaluatingJsonLogic, setIsEvaluatingJsonLogic] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState(null);
  const topologyContainerRef = useRef(null);

  const processConfigs = data?.processConfigList ?? [];
  const isInitialLoading = loading && processConfigs.length === 0;
  const phaseOptions = (data?.actionPhasesDictionaryList ?? []).map((item) => item.code).filter(Boolean);
  const b3StatusOptions = (data?.b3StatusDictionaryList ?? []).map((item) => item.code).filter(Boolean);
  const slaDurationUnitOptions = (data?.slaDurationUnitDictionaryList ?? []).map((item) => item.code).filter(Boolean);
  const slaStatusOptions = (data?.slaStatusDictionaryList ?? []).map((item) => item.code).filter(Boolean);
  const processCodeOptions = (data?.contextCodesDictionaryList ?? []).map((item) => item.code).filter(Boolean);
  const processConfigOptions = processConfigs.map((item) => {
    const processName = item.process?.nodeName?.trim() || item.process?.contextCode?.code?.trim() || 'Process';

    return {
      value: item.id,
      label: `${processName} - ${item.id}`,
      description: `ID: ${item.id} | Создан: ${formatDateTime(item.createdAt)} | Обновлен: ${formatDateTime(item.updatedAt)}`,
    };
  });
  const editorIsSaving =
    createSubprocessState.loading ||
    createStageState.loading ||
    reorderSubprocessStagesState.loading ||
    reorderReverseOutputsState.loading ||
    updateState.loading ||
    updateStageState.loading ||
    updateConfiguratorState.loading ||
    updateSubprocessState.loading ||
    updateProcessNodeState.loading ||
    createResultState.loading ||
    createReverseState.loading ||
    updateReverseState.loading ||
    updateResultState.loading ||
    createReverseOutputState.loading ||
    updateReverseOutputState.loading ||
    deleteSubprocessState.loading ||
    deleteStageState.loading ||
    deleteConfiguratorState.loading ||
    deleteResultState.loading ||
    deleteReverseState.loading ||
    deleteReverseOutputState.loading;
  const serverActiveProcessConfig =
    processConfigs.find((item) => item.id === selectedConfigId) ?? processConfigs[0] ?? null;
  const activeProcessConfig =
    localProcessConfig?.id && localProcessConfig.id === serverActiveProcessConfig?.id
      ? localProcessConfig
      : serverActiveProcessConfig;
  const workingProcessConfig =
    activeProcessConfig && editorNodeId && editorPreview?.nodeId === editorNodeId
      ? updateSelectedNode(activeProcessConfig, editorNodeId, editorPreview.values)
      : activeProcessConfig;

  useEffect(() => {
    if (!serverActiveProcessConfig) {
      setLocalProcessConfig(null);
      return;
    }

    setLocalProcessConfig((current) =>
      current?.id === serverActiveProcessConfig.id ? serverActiveProcessConfig : current
    );
  }, [serverActiveProcessConfig]);

  useEffect(() => {
    if (activeProcessConfig && activeProcessConfig.id !== selectedConfigId) {
      setSelectedConfigId(activeProcessConfig.id);
      setSelectedNodeId(activeProcessConfig.process?.id ? `process:${activeProcessConfig.process.id}` : null);
      setEditorNodeId(null);
      setViewerNodeId(null);
      setOrderNodeId(null);
      setEditorPreview(null);
      setAutosaveStatus(null);
      setExpandedNodeIds(getDefaultExpandedNodeIds(activeProcessConfig));
    }
  }, [activeProcessConfig, selectedConfigId]);

  useEffect(() => {
    if (!activeProcessConfig) {
      setExpandedNodeIds([]);
      return;
    }

    setExpandedNodeIds((current) => {
      const currentSet = new Set(current);
      const processNodeId = activeProcessConfig.process?.id ? `process:${activeProcessConfig.process.id}` : null;

      if (processNodeId && currentSet.size === 0) {
        return [processNodeId];
      }

      const validNodeIds = new Set();
      if (processNodeId) {
        validNodeIds.add(processNodeId);
      }
      (activeProcessConfig.process?.subprocess ?? []).forEach((subprocess) => {
        validNodeIds.add(`subprocess:${subprocess.id}`);
        (subprocess.stages ?? []).forEach((stage) => {
          validNodeIds.add(`stage:${stage.id}`);
          (stage.configurator?.result ?? []).forEach((result, resultIndex) => {
            validNodeIds.add(getResultNodeId(stage.id, resultIndex));
            (result.reverse ?? []).forEach((reverse, reverseIndex) => {
              validNodeIds.add(getReverseNodeId(stage.id, resultIndex, reverseIndex));
              (reverse.output ?? []).forEach((_, outputIndex) => {
                validNodeIds.add(getReverseOutputNodeId(stage.id, resultIndex, reverseIndex, outputIndex));
              });
            });
          });
        });
      });

      const next = current.filter((nodeId) => validNodeIds.has(nodeId));
      return next.length === current.length ? current : next;
    });
  }, [activeProcessConfig]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsTopologyFullscreen(document.fullscreenElement === topologyContainerRef.current);
      window.dispatchEvent(new Event('resize'));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    setIsEditorOpen(Boolean(findSelectedNode(activeProcessConfig, editorNodeId)));
  }, [activeProcessConfig, editorNodeId]);

  useEffect(() => {
    setEditorPreview(null);
  }, [editorNodeId]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setToast(null);
    }, 4000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [toast]);

  const showSuccessToast = (title, message) => {
    setToast({
      id: Date.now(),
      variant: 'success',
      title,
      message,
    });
  };

  const showSaveSuccessToast = () => {
    showSuccessToast('Изменения сохранены', 'Информация по node успешно обновлена.');
  };

  const showErrorToast = (message) => {
    if (!message) {
      return;
    }

    setToast({
      id: Date.now(),
      variant: 'error',
      title: 'Ошибка',
      message,
    });
  };

  useEffect(() => {
    if (createErrorMessage) {
      showErrorToast(createErrorMessage);
    }
  }, [createErrorMessage]);

  useEffect(() => {
    if (updateErrorMessage) {
      showErrorToast(updateErrorMessage);
    }
  }, [updateErrorMessage]);

  useEffect(() => {
    if (exportErrorMessage) {
      showErrorToast(exportErrorMessage);
    }
  }, [exportErrorMessage]);

  useEffect(() => {
    if (importErrorMessage) {
      showErrorToast(importErrorMessage);
    }
  }, [importErrorMessage]);

  const saveProcessConfig = async (nextConfig) => {
    try {
      setUpdateErrorMessage('');
      setLocalProcessConfig(nextConfig);
      await updateProcess({
        variables: {
          id: nextConfig.id,
          input: stripTypename(serializeProcessConfig(nextConfig)),
        },
      });
      refetch();
      return true;
    } catch (mutationError) {
      setLocalProcessConfig(serverActiveProcessConfig);
      setUpdateErrorMessage(getErrorMessage(mutationError, 'Не удалось сохранить изменения процесса.'));
      return false;
    }
  };

  const saveStageNode = async (nextConfig) => {
    if (!editorNodeId?.startsWith('stage:')) {
      return false;
    }

    const stageId = editorNodeId.split(':')[1];
    const selectedStage = findSelectedNode(nextConfig, editorNodeId)?.node;
    if (!selectedStage) {
      return false;
    }

    try {
      setUpdateErrorMessage('');
      setLocalProcessConfig(nextConfig);
      await updateStageNode({
        variables: {
          id: stageId,
          input: stripTypename({
            executor: selectedStage.executor ?? '',
            nodeName: selectedStage.nodeName ?? '',
            nodeComment: selectedStage.nodeComment ?? '',
            log: selectedStage.log
              ? {
                  journalServiceName: selectedStage.log.journalServiceName ?? '',
                }
              : null,
          }),
        },
      });
      if (selectedStage.configurator?.id) {
        await updateConfiguratorNode({
          variables: {
            id: selectedStage.configurator.id,
            input: stripTypename(serializeStageConfigurator(selectedStage.configurator)),
          },
        });
      }
      refetch();
      return true;
    } catch (mutationError) {
      setLocalProcessConfig(serverActiveProcessConfig);
      setUpdateErrorMessage(getErrorMessage(mutationError, 'Не удалось сохранить изменения stage.'));
      return false;
    }
  };

  const saveSubprocessNode = async (nextConfig) => {
    if (!editorNodeId?.startsWith('subprocess:')) {
      return false;
    }

    const subprocessId = editorNodeId.split(':')[1];
    const selectedSubprocess = findSelectedNode(nextConfig, editorNodeId)?.node;
    if (!selectedSubprocess) {
      return false;
    }

    try {
      setUpdateErrorMessage('');
      setLocalProcessConfig(nextConfig);
      await updateSubprocessNode({
        variables: {
          id: subprocessId,
          input: stripTypename(serializeSubprocess(selectedSubprocess)),
        },
      });
      await refetch();
      return true;
    } catch (mutationError) {
      setLocalProcessConfig(serverActiveProcessConfig);
      setUpdateErrorMessage(getErrorMessage(mutationError, 'Не удалось сохранить изменения subprocess.'));
      return false;
    }
  };

  const saveReverseNode = async (nextConfig) => {
    if (!editorNodeId?.startsWith('reverse:')) {
      return false;
    }

    const selectedReverse = findSelectedNode(nextConfig, editorNodeId)?.node;
    if (!selectedReverse?.id) {
      return false;
    }

    try {
      setUpdateErrorMessage('');
      setLocalProcessConfig(nextConfig);
      await updateReverseNode({
        variables: {
          id: selectedReverse.id,
          input: stripTypename({
            status: normalizeReferenceDraft(selectedReverse.status),
            output: (selectedReverse.output ?? []).map(serializeReverseOutput),
          }),
        },
      });
      await refetch();
      return true;
    } catch (mutationError) {
      setLocalProcessConfig(serverActiveProcessConfig);
      setUpdateErrorMessage(getErrorMessage(mutationError, 'Не удалось сохранить reverse.'));
      return false;
    }
  };

  const saveReverseOutputNode = async (nextConfig) => {
    if (!editorNodeId?.startsWith('reverseOutput:')) {
      return false;
    }

    const selectedOutput = findSelectedNode(nextConfig, editorNodeId)?.node;
    if (!selectedOutput?.id) {
      return false;
    }

    try {
      setUpdateErrorMessage('');
      setLocalProcessConfig(nextConfig);
      await updateReverseOutputNode({
        variables: {
          id: selectedOutput.id,
          input: stripTypename(serializeReverseOutput(selectedOutput)),
        },
      });
      await refetch();
      return true;
    } catch (mutationError) {
      setLocalProcessConfig(serverActiveProcessConfig);
      setUpdateErrorMessage(getErrorMessage(mutationError, 'Не удалось сохранить reverse output.'));
      return false;
    }
  };

  const saveResultNode = async (nextConfig) => {
    if (!editorNodeId?.startsWith('result:')) {
      return false;
    }

    const selectedResult = findSelectedNode(nextConfig, editorNodeId)?.node;
    if (!selectedResult?.id) {
      return false;
    }

    try {
      setUpdateErrorMessage('');
      setLocalProcessConfig(nextConfig);
      await updateResultNode({
        variables: {
          id: selectedResult.id,
          input: stripTypename({
            inputScenarios: sanitizeInputScenarios(selectedResult.inputScenarios),
            reverse: (selectedResult.reverse ?? []).map((reverse) => ({
              id: reverse.id ?? undefined,
              status: normalizeReferenceDraft(reverse.status),
              output: (reverse.output ?? []).map(serializeReverseOutput),
            })),
          }),
        },
      });
      await refetch();
      return true;
    } catch (mutationError) {
      setLocalProcessConfig(serverActiveProcessConfig);
      setUpdateErrorMessage(getErrorMessage(mutationError, 'Не удалось сохранить result.'));
      return false;
    }
  };

  const saveProcessNode = async (nextConfig) => {
    if (!editorNodeId?.startsWith('process:')) {
      return false;
    }

    const processId = editorNodeId.split(':')[1];
    const selectedProcess = findSelectedNode(nextConfig, editorNodeId)?.node;
    if (!selectedProcess) {
      return false;
    }

    try {
      setUpdateErrorMessage('');
      setLocalProcessConfig(nextConfig);
      await updateProcessNode({
        variables: {
          id: processId,
          input: stripTypename({
            nodeName: selectedProcess.nodeName ?? '',
            nodeComment: selectedProcess.nodeComment ?? '',
            contextCode: normalizeReferenceDraft(selectedProcess.contextCode),
          }),
        },
      });
      refetch();
      return true;
    } catch (mutationError) {
      setLocalProcessConfig(serverActiveProcessConfig);
      setUpdateErrorMessage(getErrorMessage(mutationError, 'Не удалось сохранить изменения process.'));
      return false;
    }
  };

  const handleCreateProcess = async () => {
    setCreateErrorMessage('');
    const input = getNextProcessDraft(processConfigs, processCodeOptions);

    try {
      const response = await createProcess({
        variables: { input },
      });

      const created = response.data?.createProcessConfig;
      if (!created?.id) {
        setCreateErrorMessage('GraphQL не вернул созданный процесс. Проверьте backend-логи и схему мутации.');
        return;
      }

      await refetch();

      setSelectedConfigId(created.id);
      if (created.process?.id) {
        setSelectedNodeId(`process:${created.process.id}`);
        setEditorNodeId(`process:${created.process.id}`);
        setIsEditorOpen(true);
        setExpandedNodeIds(getDefaultExpandedNodeIds(created));
      }
    } catch (mutationError) {
      setCreateErrorMessage(getErrorMessage(mutationError, 'Не удалось создать процесс.'));
    }
  };

  const handleSaveNode = async (values) => {
    if (!activeProcessConfig || !editorNodeId) {
      return false;
    }

    const nextConfig = updateSelectedNode(activeProcessConfig, editorNodeId, values);
    let saved = false;
    if (editorNodeId.startsWith('process:')) {
      saved = await saveProcessNode(nextConfig);
    } else if (editorNodeId.startsWith('subprocess:')) {
      saved = await saveSubprocessNode(nextConfig);
    } else if (editorNodeId.startsWith('result:')) {
      saved = await saveResultNode(nextConfig);
    } else if (editorNodeId.startsWith('reverseOutput:')) {
      saved = await saveReverseOutputNode(nextConfig);
    } else if (editorNodeId.startsWith('reverse:')) {
      saved = await saveReverseNode(nextConfig);
    } else if (editorNodeId.startsWith('stage:')) {
      saved = await saveStageNode(nextConfig);
    } else {
      saved = await saveProcessConfig(nextConfig);
    }

    if (saved) {
      showSaveSuccessToast();
    }

    return saved;
  };

  const handleAddSubprocess = async () => {
    const processId = workingProcessConfig?.process?.id;
    if (!processId) {
      return;
    }

    await createSubprocessNode({
      variables: {
        processId,
        input: stripTypename(
          serializeSubprocess(createDefaultSubprocess((workingProcessConfig.process.subprocess ?? []).length + 1)),
        ),
      },
    });
    await refetch();
    setExpandedNodeIds((current) => {
      const processNodeId = workingProcessConfig.process?.id ? `process:${workingProcessConfig.process.id}` : null;
      return processNodeId && !current.includes(processNodeId) ? [...current, processNodeId] : current;
    });
  };

  const handleAddStage = async () => {
    if (!workingProcessConfig?.process || !editorNodeId?.startsWith('subprocess:')) {
      return;
    }

    const subprocessId = editorNodeId.split(':')[1];
    const subprocess = findSelectedNode(workingProcessConfig, editorNodeId)?.node;
    if (!subprocessId || !subprocess) {
      return;
    }

    await createStageNode({
      variables: {
        subprocessId,
        input: stripTypename(serializeStage(createDefaultStage((subprocess.stages ?? []).length + 1))),
      },
    });
    await refetch();
    setExpandedNodeIds((current) => (current.includes(editorNodeId) ? current : [...current, editorNodeId]));
  };

  const handleToggleNode = (nodeId) => {
    setExpandedNodeIds((current) =>
      current.includes(nodeId) ? current.filter((item) => item !== nodeId) : [...current, nodeId],
    );
  };

  const handleEditNode = (nodeId) => {
    setSelectedNodeId(nodeId);
    setEditorNodeId(nodeId);
    setViewerNodeId(null);
    setOrderNodeId(null);
    setIsEditorOpen(true);
  };

  const handleViewNode = (nodeId) => {
    setSelectedNodeId(nodeId);
    setViewerNodeId(nodeId);
    setEditorNodeId(null);
    setOrderNodeId(null);
    setIsEditorOpen(false);
  };

  const handleReorderSubprocessNode = (nodeId) => {
    setSelectedNodeId(nodeId);
    setViewerNodeId(null);
    setEditorNodeId(null);
    setOrderNodeId(nodeId);
    setIsEditorOpen(false);
  };

  const handleReorderReverseNode = (nodeId) => {
    setSelectedNodeId(nodeId);
    setViewerNodeId(null);
    setEditorNodeId(null);
    setOrderNodeId(nodeId);
    setIsEditorOpen(false);
  };

  const handleAddChildNode = async (nodeId) => {
    const [kind, rawId] = nodeId.split(':');
    try {
      setUpdateErrorMessage('');

      if (kind === 'subprocess') {
        const subprocess = findSelectedNode(workingProcessConfig, nodeId)?.node;
        if (!subprocess?.id) {
          setUpdateErrorMessage('Не удалось определить subprocess для создания stage.');
          return;
        }

        await createStageNode({
          variables: {
            subprocessId: subprocess.id,
            input: stripTypename(serializeStage(createDefaultStage((subprocess.stages ?? []).length + 1))),
          },
        });
        await refetch();
      } else if (kind === 'stage') {
        const selectedStage = findSelectedNode(workingProcessConfig, nodeId);
        const configuratorId = selectedStage?.node?.configurator?.id;
        if (!configuratorId) {
          setUpdateErrorMessage('Не удалось определить configurator stage для создания result.');
          return;
        }

        await createResultNode({
          variables: {
            configuratorId,
            input: stripTypename({
              inputScenarios: [],
              reverse: [],
            }),
          },
        });
      } else if (kind === 'result') {
        const selectedResult = findSelectedNode(workingProcessConfig, nodeId);
        const resultId = selectedResult?.node?.id;
        if (!resultId) {
          setUpdateErrorMessage('Не удалось определить result для создания reverse.');
          return;
        }

        await createReverseNode({
          variables: {
            resultId,
            input: stripTypename({
              status: { code: 'INITIATED' },
              output: [],
            }),
          },
        });
      } else if (kind === 'reverse') {
        const selectedReverse = findSelectedNode(workingProcessConfig, nodeId);
        const reverseId = selectedReverse?.node?.id;
        if (!reverseId) {
          setUpdateErrorMessage('Не удалось определить reverse для создания reverse output.');
          return;
        }

        await createReverseOutputNode({
          variables: {
            reverseId,
            input: stripTypename({
              phase: { code: 'START' },
              name: '',
              rule: '',
              body: null,
              log: null,
            }),
          },
        });
      } else {
        return;
      }

      setExpandedNodeIds((current) => (current.includes(nodeId) ? current : [...current, nodeId]));
      await refetch();
    } catch (mutationError) {
      setUpdateErrorMessage(
        getErrorMessage(
          mutationError,
          kind === 'subprocess'
            ? 'Не удалось создать stage.'
            : kind === 'stage'
            ? 'Не удалось создать result.'
            : kind === 'result'
              ? 'Не удалось создать reverse.'
              : 'Не удалось создать reverse output.',
        ),
      );
    }
  };

  const handleBulkCreateResults = async (nodeId, resultGroups) => {
    const [kind, rawId] = nodeId.split(':');
    if (kind !== 'stage' || resultGroups.length === 0) {
      return;
    }

    const selectedStage = findSelectedNode(workingProcessConfig, nodeId);
    const configuratorId = selectedStage?.node?.configurator?.id;
    if (!configuratorId) {
      setUpdateErrorMessage('Не удалось определить configurator stage для массового создания results.');
      return;
    }

    try {
      setUpdateErrorMessage('');
      await Promise.all(
        resultGroups.map((inputScenarios, index) =>
          createResultNode({
            variables: {
              configuratorId,
              input: stripTypename({
                inputScenarios,
                reverse: [],
              }),
            },
          }),
        ),
      );
      setExpandedNodeIds((current) => (current.includes(nodeId) ? current : [...current, nodeId]));
      await refetch();
    } catch (mutationError) {
      setUpdateErrorMessage(getErrorMessage(mutationError, 'Не удалось массово создать results.'));
    }
  };

  const handleDeleteNode = async (nodeId) => {
    const [kind, rawId, extraId] = nodeId.split(':');
    if (kind === 'process') {
      return;
    }

    try {
      setUpdateErrorMessage('');

      if (kind === 'subprocess') {
        await deleteSubprocessNode({ variables: { id: rawId } });
      } else if (kind === 'stage') {
        await deleteStageNode({ variables: { id: rawId } });
      } else if (kind === 'configurator') {
        await deleteConfiguratorNode({ variables: { id: rawId } });
      } else if (kind === 'result') {
        const selectedResult = findSelectedNode(workingProcessConfig, nodeId);
        const resultId = selectedResult?.node?.id ?? extraId;
        if (!resultId) {
          throw new Error('Result id not found');
        }
        await deleteResultNode({ variables: { id: resultId } });
      } else if (kind === 'reverse') {
        const reverseId = findSelectedNode(workingProcessConfig, nodeId)?.node?.id;
        if (!reverseId) {
          throw new Error('Reverse id not found');
        }
        await deleteReverseNode({ variables: { id: reverseId } });
      } else if (kind === 'reverseOutput') {
        const reverseOutputId = findSelectedNode(workingProcessConfig, nodeId)?.node?.id;
        if (!reverseOutputId) {
          throw new Error('ReverseOutput id not found');
        }
        await deleteReverseOutputNode({ variables: { id: reverseOutputId } });
      } else {
        return;
      }

      if (editorNodeId === nodeId) {
        setEditorNodeId(null);
        setIsEditorOpen(false);
      }
      if (viewerNodeId === nodeId) {
        setViewerNodeId(null);
      }
      if (orderNodeId === nodeId) {
        setOrderNodeId(null);
      }
      setSelectedNodeId(null);
      await refetch();
    } catch (mutationError) {
      setUpdateErrorMessage(getErrorMessage(mutationError, 'Не удалось удалить узел.'));
    }
  };

  const handleCloseEditor = () => {
    setIsEditorOpen(false);
    setEditorNodeId(null);
    setEditorPreview(null);
    setAutosaveStatus(null);
  };

  const handleCloseViewer = () => {
    setViewerNodeId(null);
  };

  const handleCloseOrderPanel = () => {
    setOrderNodeId(null);
  };

  const handleToggleTopologyFullscreen = async () => {
    const container = topologyContainerRef.current;
    if (!container) {
      return;
    }

    if (document.fullscreenElement === container) {
      await document.exitFullscreen();
      return;
    }

    await container.requestFullscreen();
  };

  const handleSelectProcessConfig = (configId) => {
    setSelectedConfigId(configId || null);
    setLocalProcessConfig(null);
    setEditorNodeId(null);
    setViewerNodeId(null);
    setOrderNodeId(null);
    setEditorPreview(null);
    setIsEditorOpen(false);
    setAutosaveStatus(null);
    setUpdateErrorMessage('');
    setExportErrorMessage('');
    setImportErrorMessage('');
    setIsExportModalOpen(false);
    setExportType('DEFAULT');
  };

  const handleOpenExportModal = () => {
    if (!activeProcessConfig?.id || isExportingProcessConfig) {
      return;
    }

    setExportErrorMessage('');
    setExportType('DEFAULT');
    setIsExportModalOpen(true);
  };

  const handleCloseExportModal = () => {
    if (isExportingProcessConfig) {
      return;
    }

    setIsExportModalOpen(false);
    setExportErrorMessage('');
    setExportType('DEFAULT');
  };

  const handleExportProcessConfig = async () => {
    if (!activeProcessConfig?.id || isExportingProcessConfig) {
      return;
    }

    try {
      setExportErrorMessage('');
      setIsExportingProcessConfig(true);

      const response = await fetch(
        `/api/process-configs/${activeProcessConfig.id}/export?type=${encodeURIComponent(exportType)}`,
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const filename =
        getFilenameFromContentDisposition(response.headers.get('content-disposition')) ||
        `${activeProcessConfig.process?.contextCode?.code || 'process'}.yaml`;
      const blob = await response.blob();
      downloadBlob(blob, filename);
      handleCloseExportModal();
    } catch (requestError) {
      setExportErrorMessage(getErrorMessage(requestError, 'Не удалось скачать YAML-конфигурацию процесса.'));
    } finally {
      setIsExportingProcessConfig(false);
    }
  };

  const handleDeleteProcessConfig = async () => {
    if (!activeProcessConfig?.id || deleteProcessConfigState.loading) {
      return;
    }

    const processLabel =
      activeProcessConfig.process?.contextCode?.code ||
      activeProcessConfig.process?.nodeName ||
      activeProcessConfig.id;
    const shouldDelete = window.confirm(
      `Удалить процесс "${processLabel}"?\nБудет удален весь process config со всеми subprocess, stage, configurator, result, reverse и output.`,
    );
    if (!shouldDelete) {
      return;
    }

    try {
      setUpdateErrorMessage('');
      await deleteProcessConfig({
        variables: {
          id: activeProcessConfig.id,
        },
      });
      setSelectedConfigId(null);
      setSelectedNodeId(null);
      setEditorNodeId(null);
      setViewerNodeId(null);
      setOrderNodeId(null);
      setLocalProcessConfig(null);
      setEditorPreview(null);
      setIsEditorOpen(false);
      setExpandedNodeIds([]);
      await refetch();
      showSuccessToast('Процесс удален', `Процесс "${processLabel}" удален вместе со всей вложенной конфигурацией.`);
    } catch (mutationError) {
      setUpdateErrorMessage(getErrorMessage(mutationError, 'Не удалось удалить процесс.'));
    }
  };

  const handleOpenImportModal = () => {
    setImportErrorMessage('');
    setImportFiles([]);
    setImportScheme('NEW');
    setIsImportModalOpen(true);
  };

  const handleCloseImportModal = (force = false) => {
    if (isImportingProcessConfig && !force) {
      return;
    }

    setIsImportModalOpen(false);
    setImportFiles([]);
    setImportScheme('NEW');
    setImportErrorMessage('');
  };

  const handleOpenJsonLogicPlayground = (title, ruleText) => {
    setJsonLogicPlaygroundTitle(title);
    setJsonLogicPlaygroundInput('{}');
    setJsonLogicPlaygroundRule(formatJsonSnippet(ruleText || '{}'));
    setJsonLogicPlaygroundResult('');
    setJsonLogicPlaygroundError('');
    setIsJsonLogicPlaygroundOpen(true);
  };

  const handleCloseJsonLogicPlayground = () => {
    if (isEvaluatingJsonLogic) {
      return;
    }

    setIsJsonLogicPlaygroundOpen(false);
    setJsonLogicPlaygroundError('');
  };

  const handleImportFilesSelected = (files) => {
    setImportErrorMessage('');
    setImportFiles((current) => {
      const nextByKey = new Map(
        current.map((file) => [`${file.name}:${file.size}:${file.lastModified}`, file]),
      );
      files
        .filter((file) => /\.ya?ml$/i.test(file.name))
        .forEach((file) => nextByKey.set(`${file.name}:${file.size}:${file.lastModified}`, file));
      return Array.from(nextByKey.values());
    });
  };

  const handleRemoveImportFile = (index) => {
    setImportFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
  };

  const handleEvaluateJsonLogic = async () => {
    try {
      setJsonLogicPlaygroundError('');
      setIsEvaluatingJsonLogic(true);

      const parsedData = JSON.parse(jsonLogicPlaygroundInput || '{}');
      const parsedRule = JSON.parse(jsonLogicPlaygroundRule || '{}');

      const response = await fetch('/api/json-logic/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: parsedData,
          rule: parsedRule,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      const payload = await response.json();
      setJsonLogicPlaygroundResult(stringifyJsonForEditor(payload?.result));
    } catch (requestError) {
      setJsonLogicPlaygroundError(
        getErrorMessage(requestError, 'Не удалось проверить JsonLogic правило.'),
      );
      setJsonLogicPlaygroundResult('');
    } finally {
      setIsEvaluatingJsonLogic(false);
    }
  };

  const handleImportProcessConfigs = async () => {
    if (importFiles.length === 0 || isImportingProcessConfig) {
      return;
    }

    try {
      setImportErrorMessage('');
      setIsImportingProcessConfig(true);

      const formData = new FormData();
      importFiles.forEach((file) => {
        formData.append('files', file);
      });

      const response = await fetch(`/api/process-configs/import?scheme=${encodeURIComponent(importScheme)}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      const payload = await response.json();
      const imported = Array.isArray(payload?.imported) ? payload.imported : [];
      const lastImported = imported[imported.length - 1] ?? null;

      await refetch();

      if (lastImported?.processConfigId) {
        setSelectedConfigId(lastImported.processConfigId);
        setSelectedNodeId(lastImported.processId ? `process:${lastImported.processId}` : null);
        setEditorNodeId(lastImported.processId ? `process:${lastImported.processId}` : null);
        setViewerNodeId(null);
        setOrderNodeId(null);
        setIsEditorOpen(Boolean(lastImported.processId));
      }

      showSuccessToast(
        'Импорт завершён',
        imported.length > 1
          ? `Создано процессов: ${imported.length}.`
          : `Файл ${imported[0]?.filename ?? 'YAML'} успешно импортирован.`,
      );
      handleCloseImportModal(true);
    } catch (requestError) {
      setImportErrorMessage(getErrorMessage(requestError, 'Не удалось импортировать YAML-файлы.'));
    } finally {
      setIsImportingProcessConfig(false);
    }
  };

  const handleReorderStages = async (subprocessId, nextStageOrder) => {
    if (!activeProcessConfig?.process) {
      return;
    }

    const nextConfig = {
      ...activeProcessConfig,
      process: {
        ...activeProcessConfig.process,
        subprocess: (activeProcessConfig.process.subprocess ?? []).map((subprocess) => {
          if (String(subprocess.id) !== subprocessId) {
            return subprocess;
          }

          const reorderedStages = nextStageOrder
            .map((stageId) => (subprocess.stages ?? []).find((stage) => String(stage.id) === stageId))
            .filter(Boolean);

          return {
            ...subprocess,
            stages: reorderedStages,
          };
        }),
      },
    };

    try {
      setUpdateErrorMessage('');
      setLocalProcessConfig(nextConfig);
      await reorderSubprocessStages({
        variables: {
          subprocessId,
          stageIds: nextStageOrder,
        },
      });
      await refetch();
    } catch (mutationError) {
      setLocalProcessConfig(serverActiveProcessConfig);
      setUpdateErrorMessage(getErrorMessage(mutationError, 'Не удалось изменить порядок stage.'));
    }
  };

  const handleReorderReverseOutputs = async (reverseId, nextOutputOrder) => {
    if (!activeProcessConfig?.process) {
      return;
    }

    const nextConfig = {
      ...activeProcessConfig,
      process: {
        ...activeProcessConfig.process,
        subprocess: (activeProcessConfig.process.subprocess ?? []).map((subprocess) => ({
          ...subprocess,
          stages: (subprocess.stages ?? []).map((stage) => ({
            ...stage,
            configurator: stage.configurator
              ? {
                  ...stage.configurator,
                  result: (stage.configurator.result ?? []).map((result) => ({
                    ...result,
                    reverse: (result.reverse ?? []).map((reverse) => {
                      if (String(reverse.id) !== reverseId) {
                        return reverse;
                      }

                      const reorderedOutputs = nextOutputOrder
                        .map((outputId) => (reverse.output ?? []).find((output) => String(output.id) === outputId))
                        .filter(Boolean);

                      return {
                        ...reverse,
                        output: reorderedOutputs,
                      };
                    }),
                  })),
                }
              : stage.configurator,
          })),
        })),
      },
    };

    try {
      setUpdateErrorMessage('');
      setLocalProcessConfig(nextConfig);
      await reorderReverseOutputs({
        variables: {
          reverseId,
          outputIds: nextOutputOrder,
        },
      });
      await refetch();
    } catch (mutationError) {
      setLocalProcessConfig(serverActiveProcessConfig);
      setUpdateErrorMessage(getErrorMessage(mutationError, 'Не удалось изменить порядок reverse output.'));
    }
  };

  return (
    <Page>
      <div className="topology-workspace">
        <div
          ref={topologyContainerRef}
          className={isTopologyFullscreen ? 'topology-stage topology-stage-fullscreen' : 'topology-stage'}
        >
          {isInitialLoading && (
            <div className="loading-state">
              <Spinner size="xl" />
            </div>
          )}

          {error && !isInitialLoading && (
            <EmptyState>
              <div className="topology-empty-state">
                <Title headingLevel="h4">GraphQL недоступен</Title>
                <EmptyStateBody>{error.message}</EmptyStateBody>
                <EmptyStateFooter>
                  <Button onClick={() => refetch()}>Повторить запрос</Button>
                </EmptyStateFooter>
              </div>
            </EmptyState>
          )}

          {!isInitialLoading && !error && !activeProcessConfig && (
            <EmptyState>
              <div className="topology-empty-state">
                <Title headingLevel="h4">Проект пока не имеет ни одного процесса</Title>
                <EmptyStateBody>Нажмите «Создать процесс»</EmptyStateBody>
                <EmptyStateFooter>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Button
                      onClick={handleCreateProcess}
                      isLoading={createState.loading}
                      isDisabled={processCodeOptions.length === 0}
                    >
                      Создать процесс
                    </Button>
                    <YamlActionsMenu
                      onImport={handleOpenImportModal}
                      onExport={handleOpenExportModal}
                      isImporting={isImportingProcessConfig}
                      isExporting={isExportingProcessConfig}
                      canExport={false}
                    />
                  </div>
                </EmptyStateFooter>
                {processCodeOptions.length === 0 && (
                  <EmptyStateBody>Нет доступных кодов процесса в справочнике `contextCodesDictionaryList`.</EmptyStateBody>
                )}
              </div>
            </EmptyState>
          )}

          {!isInitialLoading && !error && activeProcessConfig && (
            <ProcessTopology
              processConfig={workingProcessConfig}
              processConfigOptions={processConfigOptions}
              selectedProcessConfigId={activeProcessConfig?.id ?? ''}
              selectedNodeId={selectedNodeId}
              expandedNodeIds={expandedNodeIds}
              onToggleNode={handleToggleNode}
              onEditNode={handleEditNode}
              onViewNode={handleViewNode}
              onReorderSubprocessNode={handleReorderSubprocessNode}
              onReorderReverseNode={handleReorderReverseNode}
              onDeleteNode={handleDeleteNode}
              onAddChildNode={handleAddChildNode}
              onAddSubprocess={handleAddSubprocess}
              onCreateProcess={handleCreateProcess}
              onDeleteProcessConfig={handleDeleteProcessConfig}
              onImportProcessConfig={handleOpenImportModal}
              onExportProcessConfig={handleOpenExportModal}
              onSelectProcessConfig={handleSelectProcessConfig}
              onToggleFullscreen={handleToggleTopologyFullscreen}
              isFullscreen={isTopologyFullscreen}
              isCreateDisabled={processCodeOptions.length === 0}
              isCreating={createState.loading}
              isDeleting={deleteProcessConfigState.loading}
              isImporting={isImportingProcessConfig}
              isExporting={isExportingProcessConfig}
            />
          )}

          <div
            className={isEditorOpen ? 'editor-drawer-backdrop editor-drawer-backdrop-open' : 'editor-drawer-backdrop'}
            onClick={handleCloseEditor}
            aria-hidden={!isEditorOpen}
          />
          <aside
            className={isEditorOpen ? 'editor-drawer editor-drawer-open' : 'editor-drawer'}
            aria-hidden={!isEditorOpen}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="editor-drawer__header">
              <div className="editor-drawer__header-main">
                {/*
                  Idle: green bell only.
                  Countdown: bell + seconds.
                  Saving: bell + ellipsis.
                */}
                <div
                  className={cn(
                    'editor-drawer__status flex items-center gap-2',
                    !editorIsSaving && !autosaveStatus?.secondsLeft && 'text-emerald-600',
                  )}
                >
                  <Save01 aria-hidden size={16} className={cn(!editorIsSaving && !autosaveStatus?.secondsLeft && 'text-emerald-600')} />
                  {(editorIsSaving || autosaveStatus?.secondsLeft) && (
                    <span className={cn(!editorIsSaving && !autosaveStatus?.secondsLeft && 'text-emerald-600')}>
                      {editorIsSaving ? '...' : formatAutosaveCountdownLabel(autosaveStatus.secondsLeft)}
                    </span>
                  )}
                </div>
              </div>
              <Button variant="plain" onClick={handleCloseEditor} aria-label="Закрыть панель свойств">
                <XClose aria-hidden className="editor-drawer__close-icon" size={16} />
              </Button>
            </div>
            <div className="editor-drawer__body">
              <NodeEditor
                processConfig={activeProcessConfig}
                selectedNodeId={editorNodeId}
                onSave={handleSaveNode}
                onDraftChange={(values) => setEditorPreview(values ? { nodeId: editorNodeId, values } : null)}
                onAutosaveStatusChange={setAutosaveStatus}
                onOpenJsonLogicPlayground={handleOpenJsonLogicPlayground}
                onAddSubprocess={handleAddSubprocess}
                onBulkCreateResults={handleBulkCreateResults}
                contextCodeOptions={processCodeOptions}
                phaseOptions={phaseOptions}
                b3StatusOptions={b3StatusOptions}
                slaDurationUnitOptions={slaDurationUnitOptions}
                slaStatusOptions={slaStatusOptions}
                isSaving={editorIsSaving}
              />
            </div>
          </aside>
          <div
            className={viewerNodeId ? 'editor-drawer-backdrop editor-drawer-backdrop-open' : 'editor-drawer-backdrop'}
            onClick={handleCloseViewer}
            aria-hidden={!viewerNodeId}
          />
          <aside
            className={viewerNodeId ? 'editor-drawer editor-drawer-open' : 'editor-drawer'}
            aria-hidden={!viewerNodeId}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="editor-drawer__header">
              <Button variant="plain" onClick={handleCloseViewer} aria-label="Закрыть панель просмотра">
                <XClose aria-hidden className="editor-drawer__close-icon" size={16} />
              </Button>
            </div>
            <div className="editor-drawer__body">
              <NodeViewer processConfig={activeProcessConfig} selectedNodeId={viewerNodeId} />
            </div>
          </aside>
          <div
            className={orderNodeId ? 'editor-drawer-backdrop editor-drawer-backdrop-open' : 'editor-drawer-backdrop'}
            onClick={handleCloseOrderPanel}
            aria-hidden={!orderNodeId}
          />
          <aside
            className={orderNodeId ? 'editor-drawer editor-drawer-open' : 'editor-drawer'}
            aria-hidden={!orderNodeId}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="editor-drawer__header">
              <div className="editor-drawer__header-main">
                <Title headingLevel="h3">
                  {orderNodeId?.startsWith('reverse:') ? 'Порядок reverse output' : 'Порядок исполнения стадий'}
                </Title>
                <div className="editor-drawer__status">
                  {orderNodeId?.startsWith('reverse:')
                    ? 'Перетащите reverse output. После отпускания порядок сохранится сразу.'
                    : 'Перетащите stage. После отпускания порядок сохранится сразу.'}
                </div>
              </div>
              <Button variant="plain" onClick={handleCloseOrderPanel} aria-label="Закрыть панель порядка">
                <XClose aria-hidden className="editor-drawer__close-icon" size={16} />
              </Button>
            </div>
            <div className="editor-drawer__body">
              <NodeOrderEditor
                processConfig={activeProcessConfig}
                selectedNodeId={orderNodeId}
                onReorderStages={handleReorderStages}
                onReorderReverseOutputs={handleReorderReverseOutputs}
                isSaving={editorIsSaving}
              />
            </div>
          </aside>
          <FileUploadModal
            isOpen={isImportModalOpen}
            files={importFiles}
            scheme={importScheme}
            isSubmitting={isImportingProcessConfig}
            errorMessage={importErrorMessage}
            onClose={handleCloseImportModal}
            onSubmit={handleImportProcessConfigs}
            onSchemeChange={setImportScheme}
            onFilesSelected={handleImportFilesSelected}
            onRemoveFile={handleRemoveImportFile}
          />
          <ExportTypeModal
            isOpen={isExportModalOpen}
            exportType={exportType}
            isSubmitting={isExportingProcessConfig}
            errorMessage={exportErrorMessage}
            onClose={handleCloseExportModal}
            onSubmit={handleExportProcessConfig}
            onExportTypeChange={setExportType}
          />
          <JsonLogicPlaygroundModal
            isOpen={isJsonLogicPlaygroundOpen}
            title={jsonLogicPlaygroundTitle}
            inputText={jsonLogicPlaygroundInput}
            ruleText={jsonLogicPlaygroundRule}
            resultText={jsonLogicPlaygroundResult}
            isSubmitting={isEvaluatingJsonLogic}
            errorMessage={jsonLogicPlaygroundError}
            onClose={handleCloseJsonLogicPlayground}
            onInputChange={setJsonLogicPlaygroundInput}
            onEvaluate={handleEvaluateJsonLogic}
          />
          {toast && <Toast title={toast.title} message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />}
        </div>
      </div>
    </Page>
  );
}
