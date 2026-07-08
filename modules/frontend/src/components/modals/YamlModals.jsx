import { Plus, XClose, ZapCircle } from '@untitledui/icons';
import { useEffect, useRef, useState } from 'react';
import { Button, Text, Title } from '../ui/AppPrimitives';
import { cn, formatJsonSnippet } from '../../utils/ui';

function useEscapeKey(isOpen, onClose) {
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
}

export function JsonSnippetEditor({
  id,
  value,
  onChange,
  error,
  helperText,
  readOnly = false,
  onBeautify,
  onOpenPlayground,
  playgroundLabel = 'Открыть playground JsonLogic',
  showLineNumbers = false,
}) {
  const containerRef = useRef(null);
  const lineNumberGutterRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const editorValue = value ?? '';
  const lineNumbers = showLineNumbers ? Array.from({ length: Math.max(editorValue.split('\n').length, 1) }, (_, index) => index + 1) : [];

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

  const handleTextareaScroll = (event) => {
    if (lineNumberGutterRef.current) {
      lineNumberGutterRef.current.scrollTop = event.currentTarget.scrollTop;
    }
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
      <div className={cn('json-snippet__editor', showLineNumbers && 'json-snippet__editor-with-lines')}>
        {showLineNumbers && (
          <div ref={lineNumberGutterRef} className="json-snippet__line-numbers" aria-hidden="true">
            {lineNumbers.map((lineNumber) => (
              <div key={lineNumber} className="json-snippet__line-number">
                {lineNumber}
              </div>
            ))}
          </div>
        )}
        <textarea
          id={id}
          className="json-snippet__textarea"
          spellCheck={false}
          value={editorValue}
          readOnly={readOnly}
          onChange={(event) => onChange(event.target.value)}
          onScroll={handleTextareaScroll}
        />
      </div>
      {helperText && <p className="json-snippet__helper">{helperText}</p>}
      {error && <p className="json-snippet__error">{error}</p>}
    </div>
  );
}

export function FileUploadModal({
  isOpen,
  files,
  isSubmitting,
  errorMessage,
  onClose,
  onSubmit,
  onFilesSelected,
  onRemoveFile,
}) {
  const inputRef = useRef(null);
  useEscapeKey(isOpen, onClose);

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
    const nextFiles = Array.from(event.dataTransfer?.files ?? []).filter((file) => /\.ya?ml$/i.test(file.name));
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

        <div className="file-uploader" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
          <div className="file-uploader__icon">
            <Plus aria-hidden size={20} />
          </div>
          <div className="file-uploader__title">Перетащите YAML сюда</div>
          <div className="file-uploader__subtitle">или выберите файлы вручную</div>
          <Button variant="secondary" onClick={() => inputRef.current?.click()}>
            Выбрать файлы
          </Button>
          <input ref={inputRef} type="file" hidden multiple accept=".yaml,.yml" onChange={handleFileChange} />
        </div>

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

export function ExportTypeModal({
  isOpen,
  isSubmitting,
  errorMessage,
  onClose,
  onSubmit,
}) {
  useEscapeKey(isOpen, onClose);

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
            <Text className="modal-card__subtitle">Процесс будет скачан в актуальной YAML-схеме.</Text>
          </div>
          <button type="button" className="modal-card__close" onClick={onClose} aria-label="Закрыть окно экспорта">
            <XClose aria-hidden size={18} />
          </button>
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

export function JsonLogicPlaygroundModal({
  isOpen,
  title,
  inputText,
  ruleText,
  resultText,
  isSubmitting,
  errorMessage,
  onClose,
  onInputChange,
  onRuleChange,
  onEvaluate,
}) {
  useEscapeKey(isOpen, onClose);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-shell modal-shell-playground" role="dialog" aria-modal="true" aria-labelledby="jsonlogic-playground-title">
      <div className="modal-shell__backdrop" onClick={onClose} />
      <div className="modal-card modal-card-playground">
        <div className="modal-card__header">
          <div>
            <Title headingLevel="h4" className="modal-card__title">
              <span id="jsonlogic-playground-title">{title || 'Playground JsonLogic'}</span>
            </Title>
          </div>
          <button type="button" className="modal-card__close" onClick={onClose} aria-label="Закрыть playground">
            <XClose aria-hidden size={18} />
          </button>
        </div>

        <div className="jsonlogic-playground">
          <div className="jsonlogic-playground__panel">
            <div className="jsonlogic-playground__panel-header">
              <Title headingLevel="h5">Json Object</Title>
            </div>
            <JsonSnippetEditor
              id="jsonlogic-playground-input"
              value={inputText}
              onChange={onInputChange}
              onBeautify={() => onInputChange(formatJsonSnippet(inputText))}
              helperText="Укажите JSON, на котором нужно проверить правило."
              showLineNumbers
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
              <Title headingLevel="h5">JsonLogic Rule</Title>
            </div>
            <JsonSnippetEditor
              id="jsonlogic-playground-rule"
              value={ruleText}
              onChange={onRuleChange}
              onBeautify={() => onRuleChange(formatJsonSnippet(ruleText))}
              helperText="Укажите JsonLogic правило в формате JSON."
              showLineNumbers
            />
          </div>
        </div>
      </div>
    </div>
  );
}
