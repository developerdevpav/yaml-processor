import { AlertCircle, Check, CheckVerified02, FolderPlus, Play, Plus, Trash01, XClose, ZapCircle } from '@untitledui/icons';
import { useEffect, useRef, useState } from 'react';
import { Button, Text, Title } from '../ui/AppPrimitives';
import { cn, formatCompactJsonLogicSnippet, formatJsonSnippet } from '../../utils/ui';

function useEscapeKey(isOpen: boolean, onClose: () => void) {
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
}: any) {
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
  fileResults = {},
  isSubmitting,
  errorMessage,
  onClose,
  onSubmit,
  onFilesSelected,
  onRemoveFile,
  onShowFileError,
}: any) {
  const inputRef = useRef(null);
  const directoryInputRef = useRef(null);
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

  const getFilePath = (file) => file.webkitRelativePath || file.name;
  const getFileKey = (file) => `${getFilePath(file)}:${file?.size ?? 0}:${file?.lastModified ?? 0}`;

  const handleDrop = (event) => {
    event.preventDefault();
    const nextFiles = Array.from<File>(event.dataTransfer?.files ?? []).filter((file) => /\.ya?ml$/i.test(file.name));
    if (nextFiles.length > 0) {
      onFilesSelected(nextFiles);
    }
  };

  return (
    <div className="modal-shell" role="dialog" aria-modal="true" aria-labelledby="yaml-import-title">
      <div className="modal-shell__backdrop" onClick={onClose} />
      <div className="modal-card file-upload-modal__card">
        <div className="modal-card__header">
          <div>
            <Title headingLevel="h4" className="modal-card__title">
              <span id="yaml-import-title">Импортировать YAML</span>
            </Title>
            <Text className="modal-card__subtitle">
              Загрузите YAML-файлы или выберите директорию. Директория будет просканирована рекурсивно.
            </Text>
          </div>
          <button type="button" className="modal-card__close" onClick={onClose} aria-label="Закрыть окно импорта">
            <XClose aria-hidden size={18} />
          </button>
        </div>

        <div className="file-upload-modal__body">
          <div className="file-uploader" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
            <div className="file-uploader__icon">
              <Plus aria-hidden size={20} />
            </div>
            <div className="file-uploader__title">Перетащите YAML сюда</div>
            <div className="file-uploader__subtitle">или выберите файлы/директорию вручную</div>
            <div className="file-uploader__actions">
              <Button variant="secondary" onClick={() => inputRef.current?.click()}>
                Выбрать файлы
              </Button>
              <Button variant="secondary" onClick={() => directoryInputRef.current?.click()}>
                <FolderPlus aria-hidden size={16} />
                Выбрать директорию
              </Button>
            </div>
            <input ref={inputRef} type="file" hidden multiple accept=".yaml,.yml" onChange={handleFileChange} />
            <input
              ref={directoryInputRef}
              type="file"
              hidden
              multiple
              accept=".yaml,.yml"
              {...({ directory: '', webkitdirectory: '' } as any)}
              onChange={handleFileChange}
            />
          </div>

          {files.length > 0 && (
            <div className="file-uploader__list">
              {files.map((file, index) => {
                const filePath = getFilePath(file);
                const fileResult = fileResults[getFileKey(file)];

                return (
                  <div key={`${filePath}-${file.size}-${file.lastModified}-${index}`} className="file-uploader__item">
                    <div>
                      <div className="file-uploader__filename">{filePath}</div>
                      <div className="file-uploader__meta">{Math.max(1, Math.round(file.size / 1024))} KB</div>
                    </div>
                    <div className="file-uploader__item-actions">
                      {fileResult?.status === 'success' && (
                        <span className="file-uploader__status file-uploader__status--success" title="Файл импортирован">
                          <CheckVerified02 aria-hidden size={18} />
                        </span>
                      )}
                      {fileResult?.status === 'error' && (
                        <button
                          type="button"
                          className="file-uploader__status file-uploader__status--error"
                          onClick={() => onShowFileError?.(file, fileResult)}
                          aria-label={`Показать ошибку импорта ${file.name}`}
                          title="Показать ошибку импорта"
                        >
                          <AlertCircle aria-hidden size={18} />
                        </button>
                      )}
                      <button
                        type="button"
                        className="file-uploader__remove"
                        onClick={() => onRemoveFile(index)}
                        aria-label={`Удалить ${file.name}`}
                        disabled={isSubmitting}
                      >
                        <XClose aria-hidden size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {errorMessage && <div className="file-uploader__error">{errorMessage}</div>}
        </div>

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
}: any) {
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
}: any) {
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
              onBeautify={() => onRuleChange(formatCompactJsonLogicSnippet(ruleText))}
              helperText="Укажите JsonLogic правило в формате JSON."
              showLineNumbers
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function formatEventCount(count) {
  return `${count ?? 0} событ.`;
}

function ProcessPlaygroundNode({ label, meta, children, autoMatched = false, isProcess = false, onSelect }: any) {
  const childItems = Array.isArray(children) ? children.filter(Boolean) : children;
  const hasChildren = Array.isArray(childItems) ? childItems.length > 0 : Boolean(childItems);
  const labelClassName = cn('process-playground-tree__label', isProcess && 'process-playground-tree__label--process');

  return (
    <li className="process-playground-tree__item">
      <div className="process-playground-tree__row">
        <span className="process-playground-tree__check" title="Попал в выборку" aria-label="Попал в выборку">
          <Check aria-hidden size={10} />
        </span>
        {onSelect ? (
          <button type="button" className={cn(labelClassName, 'process-playground-tree__label-button')} onClick={onSelect}>
            {label}
          </button>
        ) : (
          <span className={labelClassName}>{label}</span>
        )}
        {autoMatched && <span className="process-playground-tree__badge-muted">без rule</span>}
        {meta && <span className="process-playground-tree__meta">{meta}</span>}
      </div>
      {hasChildren && <ol className="process-playground-tree__children">{childItems}</ol>}
    </li>
  );
}

function ProcessPlaygroundTree({ result, onSelectNode }: any) {
  if (!result) {
    return (
      <div className="process-playground__result process-playground__result--empty">
        <span className="process-playground__empty">Запустите проверку</span>
      </div>
    );
  }

  const hasMatches = (result.processes ?? []).length > 0;
  const getSelectHandler = (item, fallbackProcessConfigId = undefined) =>
    onSelectNode && item?.nodeId
      ? () =>
          onSelectNode({
            processConfigId: item.processConfigId ?? fallbackProcessConfigId,
            nodeId: item.nodeId,
            expandedNodeIds: item.expandedNodeIds ?? [],
          })
      : undefined;

  return (
    <div className={cn('process-playground__result', !hasMatches && 'process-playground__result--empty')}>
      {!hasMatches ? (
        <span className="process-playground__empty">Нет процессов обрабатывающих Trigger</span>
      ) : (
        <ol className="process-playground-tree">
          {result.processes.map((process) => (
            <ProcessPlaygroundNode key={process.id} label={process.label} isProcess onSelect={getSelectHandler(process)}>
              {process.subprocesses.map((subprocess) => (
                <ProcessPlaygroundNode key={subprocess.id} label={subprocess.label} onSelect={getSelectHandler(subprocess, process.processConfigId)}>
                  {subprocess.stages.map((stage) => (
                    <ProcessPlaygroundNode
                      key={stage.id}
                      label={stage.label}
                      meta={formatEventCount(stage.eventCount)}
                      onSelect={getSelectHandler(stage, process.processConfigId)}
                    >
                      {stage.scenarios.map((scenario) => (
                        <ProcessPlaygroundNode
                          key={scenario.id}
                          label={scenario.label}
                          meta={formatEventCount(scenario.eventCount)}
                          onSelect={getSelectHandler(scenario, process.processConfigId)}
                        >
                          {scenario.statuses.map((status) => (
                            <ProcessPlaygroundNode
                              key={status.id}
                              label={status.label}
                              meta={formatEventCount(status.eventCount)}
                              onSelect={getSelectHandler(status, process.processConfigId)}
                            >
                              {status.outputs.map((output) => (
                                <ProcessPlaygroundNode
                                  key={output.id}
                                  label={output.label}
                                  meta={formatEventCount(output.eventCount)}
                                  autoMatched={output.autoMatched}
                                  onSelect={getSelectHandler(output, process.processConfigId)}
                                />
                              ))}
                            </ProcessPlaygroundNode>
                          ))}
                        </ProcessPlaygroundNode>
                      ))}
                    </ProcessPlaygroundNode>
                  ))}
                </ProcessPlaygroundNode>
              ))}
            </ProcessPlaygroundNode>
          ))}
        </ol>
      )}
    </div>
  );
}

function ProcessPlaygroundHistory({ items = [], onSelectItem, onRemoveItem, onClear }: any) {
  const hasItems = items.length > 0;

  return (
    <div className={cn('process-playground-history', !hasItems && 'process-playground-history--empty')}>
      {hasItems ? (
        <>
          <div className="process-playground-history__header">
            <button type="button" className="process-playground-history__clear" onClick={onClear}>
              <Trash01 aria-hidden size={12} />
              Очистить
            </button>
          </div>
          <div className="process-playground-history__list" aria-label="История Trigger">
            {items.map((item) => (
              <div key={item.id} className="process-playground-history__item">
                <button
                  type="button"
                  className="process-playground-history__item-select"
                  onClick={() => onSelectItem?.(item)}
                  title="Вставить Trigger из истории"
                >
                  <span className="process-playground-history__item-title">{item.title || 'Trigger'}</span>
                  <span className="process-playground-history__item-meta">
                    {[item.meta, item.savedAtLabel].filter(Boolean).join(' · ')}
                  </span>
                </button>
                <button
                  type="button"
                  className="process-playground-history__item-delete"
                  onClick={() => onRemoveItem?.(item)}
                  aria-label={`Удалить запись истории ${item.title || 'Trigger'}`}
                  title="Удалить запись истории"
                >
                  <Trash01 aria-hidden size={12} />
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="process-playground-history__empty">История пуста.</div>
      )}
    </div>
  );
}

export function ProcessPlaygroundModal({
  isOpen,
  triggerText,
  triggerHistory,
  result,
  isSubmitting,
  onClose,
  onTriggerChange,
  onEvaluate,
  onSelectTriggerHistoryItem,
  onClearTriggerHistory,
  onRemoveTriggerHistoryItem,
  onSelectNode,
}: any) {
  useEscapeKey(isOpen, onClose);
  const [activeTab, setActiveTab] = useState('trigger');

  useEffect(() => {
    if (isOpen) {
      setActiveTab('trigger');
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSelectHistoryItem = (item) => {
    onSelectTriggerHistoryItem?.(item);
    setActiveTab('trigger');
  };

  return (
    <div className="modal-shell modal-shell-playground" role="dialog" aria-modal="true" aria-labelledby="process-playground-title">
      <div className="modal-shell__backdrop" onClick={onClose} />
      <div className="modal-card modal-card-playground">
        <div className="modal-card__header">
          <div>
            <Title headingLevel="h4" className="modal-card__title">
              <span id="process-playground-title">Playground процесса</span>
            </Title>
          </div>
          <button type="button" className="modal-card__close" onClick={onClose} aria-label="Закрыть playground процесса">
            <XClose aria-hidden size={18} />
          </button>
        </div>

        <div className="process-playground">
          <div className="process-playground__panel process-playground__panel--result">
            <ProcessPlaygroundTree result={result} onSelectNode={onSelectNode} />
          </div>

          <div className="process-playground__action">
            <div className="process-playground__play-control">
              <Button
                variant="success"
                className="process-playground__play-button"
                aria-label="Запустить"
                title="Запустить"
                onClick={onEvaluate}
                isLoading={isSubmitting}
              >
                {!isSubmitting && <Play aria-hidden size={16} />}
              </Button>
              <span className="process-playground__play-label">Запустить</span>
            </div>
          </div>

          <div className="process-playground__panel process-playground__panel--tabs">
            <div className="process-playground-tabs">
              <div className="process-playground-tabs__list" role="tablist" aria-label="Playground процесса">
                <button
                  type="button"
                  className={cn('process-playground-tabs__button', activeTab === 'trigger' && 'process-playground-tabs__button-active')}
                  role="tab"
                  id="process-playground-trigger-tab"
                  aria-selected={activeTab === 'trigger'}
                  aria-controls="process-playground-trigger-panel"
                  onClick={() => setActiveTab('trigger')}
                >
                  Редактор
                </button>
                <button
                  type="button"
                  className={cn('process-playground-tabs__button', activeTab === 'history' && 'process-playground-tabs__button-active')}
                  role="tab"
                  id="process-playground-history-tab"
                  aria-selected={activeTab === 'history'}
                  aria-controls="process-playground-history-panel"
                  onClick={() => setActiveTab('history')}
                >
                  История
                </button>
              </div>
              <div
                className="process-playground-tabs__panel"
                role="tabpanel"
                id={activeTab === 'trigger' ? 'process-playground-trigger-panel' : 'process-playground-history-panel'}
                aria-labelledby={activeTab === 'trigger' ? 'process-playground-trigger-tab' : 'process-playground-history-tab'}
              >
                {activeTab === 'trigger' ? (
                  <JsonSnippetEditor
                    id="process-playground-trigger"
                    value={triggerText}
                    onChange={onTriggerChange}
                    onBeautify={() => onTriggerChange(formatJsonSnippet(triggerText))}
                    helperText="Укажите Trigger JSON."
                    showLineNumbers
                  />
                ) : (
                  <ProcessPlaygroundHistory
                    items={triggerHistory}
                    onSelectItem={handleSelectHistoryItem}
                    onRemoveItem={onRemoveTriggerHistoryItem}
                    onClear={onClearTriggerHistory}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FlowProcessPlaygroundModal({
  isOpen,
  triggerText,
  isSubmitting,
  errorMessage,
  onClose,
  onTriggerChange,
  onEvaluate,
}: any) {
  useEscapeKey(isOpen, onClose);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-shell modal-shell-flow-playground" role="dialog" aria-modal="true" aria-labelledby="flow-playground-title">
      <div className="modal-shell__backdrop" onClick={onClose} />
      <div className="modal-card modal-card-flow-playground">
        <div className="modal-card__header">
          <div>
            <Title headingLevel="h4" className="modal-card__title">
              <span id="flow-playground-title">Запуск текущего процесса</span>
            </Title>
          </div>
          <button type="button" className="modal-card__close" onClick={onClose} aria-label="Закрыть запуск процесса">
            <XClose aria-hidden size={18} />
          </button>
        </div>

        <div className="flow-playground-trigger">
          <JsonSnippetEditor
            id="flow-playground-trigger"
            value={triggerText}
            onChange={onTriggerChange}
            onBeautify={() => onTriggerChange(formatJsonSnippet(triggerText))}
            helperText="Укажите Trigger JSON для текущего процесса."
            error={errorMessage}
            showLineNumbers
          />
        </div>

        <div className="modal-card__footer">
          <Button variant="secondary" onClick={onClose} isDisabled={isSubmitting}>
            Отмена
          </Button>
          <Button variant="success" onClick={onEvaluate} isLoading={isSubmitting}>
            Запустить
          </Button>
        </div>
      </div>
    </div>
  );
}
