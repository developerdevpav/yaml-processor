import {
  BellRinging04,
  CheckVerified02,
  Download01,
  Edit01,
  Eye,
  Maximize01,
  Minimize01,
  NotificationBox,
  Plus,
  Rows01,
  Trash01,
  Upload01,
  ZapCircle,
} from '@untitledui/icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, { Handle, Position, ReactFlowProvider, useReactFlow } from 'reactflow';
import { ProcessSelectField } from '../ProcessSelectField';
import { Button, TopologyPlaygroundMenu } from '../ui/AppPrimitives';
import { cn } from '../../utils/ui';

function truncateText(value, maxLength = 84) {
  if (!value) {
    return '';
  }

  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
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

  const stopAndRun = (callback) => (event) => {
    event.stopPropagation();
    callback?.();
  };

  const showTitle = kind !== 'result' && kind !== 'reverse' && kind !== 'reverseOutput';
  const showSubtitle = kind !== 'result' && kind !== 'reverse' && kind !== 'reverseOutput';

  return (
    <div className={cn('process-node', data?.nodeClassName, selected && 'selected')} style={nodeStyle}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="process-node__actions">
        <button type="button" className="process-node__action process-node__action-view" onClick={stopAndRun(data?.onView)} aria-label="View node" title="View">
          <Eye aria-hidden className="process-node__edit-icon" size={18} />
        </button>
        <button type="button" className="process-node__edit" onClick={stopAndRun(data?.onEdit)} aria-label="Edit node" title="Edit">
          <Edit01 aria-hidden className="process-node__edit-icon" size={18} />
        </button>
        {(kind === 'subprocess' || kind === 'reverse') && (
          <button
            type="button"
            className="process-node__action process-node__action-order"
            onClick={stopAndRun(data?.onReorder)}
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
            onClick={stopAndRun(data?.onAddChild)}
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
            onClick={stopAndRun(data?.onDelete)}
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
        <div className={cn('process-node__summary', (kind === 'result' || kind === 'reverseOutput') && 'process-node__summary--plain-list')}>
          {summaryItems.map((item, index) => (
            <div
              key={`${kind}-${index}-${item.value}`}
              className={cn('process-node__summary-item', (kind === 'result' || kind === 'reverseOutput') && 'process-node__summary-item--plain')}
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
                    <CheckVerified02 aria-hidden className="process-node__summary-icon process-node__summary-icon--success" size={16} />
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
      {kind === 'result' && (
        <div className="process-node__context-note">
          Входящие сценарии для обработки
        </div>
      )}
      {kind === 'reverse' && (
        <div className="process-node__context-note process-node__context-note--reverse">
          Входящий статус события для обработки
        </div>
      )}
    </div>
  );
}

function AutoFitView({ processConfig, expandedNodeIds }) {
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

function FocusRequestedNode({ focusRequest, nodes }) {
  const reactFlow = useReactFlow();
  const nodeId = focusRequest?.nodeId;

  useEffect(() => {
    if (!nodeId) {
      return;
    }

    const graphNode = nodes.find((node) => node.id === nodeId);
    if (!graphNode) {
      return;
    }

    window.requestAnimationFrame(() => {
      const renderedNode = reactFlow.getNode(nodeId) ?? graphNode;
      const nodeWidth = renderedNode.width ?? graphNode.style?.width ?? 300;
      const nodeHeight = renderedNode.height ?? graphNode.data?.nodeHeight ?? 286;

      reactFlow.setCenter(
        graphNode.position.x + nodeWidth / 2,
        graphNode.position.y + nodeHeight / 2,
        {
          duration: 350,
          zoom: Math.max(reactFlow.getZoom(), 0.7),
        },
      );
    });
  }, [focusRequest?.id, nodeId, nodes, reactFlow]);

  return null;
}

function splitYamlComment(line) {
  let quote = null;
  let isEscaped = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (quote === '"') {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === '\\') {
        isEscaped = true;
      } else if (char === '"') {
        quote = null;
      }
      continue;
    }

    if (quote === "'") {
      if (char === "'") {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === '#' && (index === 0 || /\s/.test(line[index - 1]))) {
      return [line.slice(0, index), line.slice(index)];
    }
  }

  return [line, ''];
}

function renderYamlScalarSegments(text, lineIndex, segmentPrefix) {
  const scalarPattern = /("(?:\\.|[^"\\])*"|'(?:''|[^'])*'|\b(?:true|false|null)\b|~|-?\b\d+(?:\.\d+)?\b)/gi;
  const segments = [];
  let cursor = 0;
  let match;

  while ((match = scalarPattern.exec(text)) !== null) {
    if (match.index > cursor) {
      segments.push(text.slice(cursor, match.index));
    }

    const token = match[0];
    const className =
      token.startsWith('"') || token.startsWith("'")
        ? 'yaml-token yaml-token-string'
        : /^(true|false|null|~)$/i.test(token)
          ? 'yaml-token yaml-token-literal'
          : 'yaml-token yaml-token-number';

    segments.push(
      <span key={`${lineIndex}-${segmentPrefix}-${match.index}`} className={className}>
        {token}
      </span>,
    );
    cursor = match.index + token.length;
  }

  if (cursor < text.length) {
    segments.push(text.slice(cursor));
  }

  return segments;
}

function renderHighlightedYamlLine(line, lineIndex) {
  if (!line) {
    return '\u00A0';
  }

  const [content, comment] = splitYamlComment(line);
  const nodes = [];
  const keyMatch = content.match(/^(\s*)(-\s*)?([^#\s][^:\n]*?)(\s*:\s*)(.*)$/);

  if (keyMatch) {
    const [, indent, listMarker = '', key, separator, value] = keyMatch;
    if (indent) {
      nodes.push(indent);
    }
    if (listMarker) {
      nodes.push(
        <span key={`${lineIndex}-list-marker`} className="yaml-token yaml-token-marker">
          {listMarker}
        </span>,
      );
    }
    nodes.push(
      <span key={`${lineIndex}-key`} className="yaml-token yaml-token-key">
        {key}
      </span>,
    );
    nodes.push(
      <span key={`${lineIndex}-separator`} className="yaml-token yaml-token-separator">
        {separator}
      </span>,
    );
    nodes.push(...renderYamlScalarSegments(value, lineIndex, 'value'));
  } else {
    const listMatch = content.match(/^(\s*)(-\s*)(.*)$/);
    if (listMatch) {
      const [, indent, listMarker, value] = listMatch;
      nodes.push(indent);
      nodes.push(
        <span key={`${lineIndex}-list-marker`} className="yaml-token yaml-token-marker">
          {listMarker}
        </span>,
      );
      nodes.push(...renderYamlScalarSegments(value, lineIndex, 'list-value'));
    } else {
      nodes.push(...renderYamlScalarSegments(content, lineIndex, 'content'));
    }
  }

  if (comment) {
    nodes.push(
      <span key={`${lineIndex}-comment`} className="yaml-token yaml-token-comment">
        {comment}
      </span>,
    );
  }

  return nodes.length > 0 ? nodes : '\u00A0';
}

function YamlProcessEditor({
  value,
  onChange,
  onSave,
  onReload,
  onBeautify,
  isLoading,
  isSaving,
  isBeautifying,
  errorMessage,
  statusMessage,
  hasChanges,
}) {
  const lineNumberGutterRef = useRef(null);
  const highlightRef = useRef(null);
  const editorValue = value ?? '';
  const lineNumbers = Array.from({ length: Math.max(editorValue.split('\n').length, 1) }, (_, index) => index + 1);
  const highlightedLines = editorValue.split('\n');

  const handleScroll = (event) => {
    if (lineNumberGutterRef.current) {
      lineNumberGutterRef.current.scrollTop = event.currentTarget.scrollTop;
    }
    if (highlightRef.current) {
      highlightRef.current.scrollTop = event.currentTarget.scrollTop;
      highlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
    }
  };

  const handleChange = (nextValue) => {
    onChange(nextValue);
  };

  return (
    <div className="yaml-process-editor">
      <div className="yaml-process-editor__header">
        <div className="yaml-process-editor__title">YAML Editor</div>
        <div className="yaml-process-editor__actions">
          {statusMessage && <div className="yaml-process-editor__status">{statusMessage}</div>}
          <Button variant="secondary" onClick={onBeautify} isLoading={isBeautifying} isDisabled={isLoading || isSaving || isBeautifying}>
            Beautify YAML
          </Button>
          <Button variant="secondary" onClick={onReload} isDisabled={isLoading || isSaving || isBeautifying}>
            Обновить
          </Button>
          <Button onClick={onSave} isLoading={isSaving} isDisabled={isLoading || isBeautifying || !hasChanges}>
            Сохранить YAML
          </Button>
        </div>
      </div>
      <div className="yaml-process-editor__body">
        <div ref={lineNumberGutterRef} className="yaml-process-editor__line-numbers" aria-hidden="true">
          {lineNumbers.map((lineNumber) => (
            <div key={lineNumber} className="yaml-process-editor__line-number">
              {lineNumber}
            </div>
          ))}
        </div>
        <div className="yaml-process-editor__input">
          <pre ref={highlightRef} className="yaml-process-editor__highlight" aria-hidden="true">
            {highlightedLines.map((line, index) => (
              <div key={`${index}-${line}`} className="yaml-process-editor__highlight-line">
                {renderHighlightedYamlLine(line, index)}
              </div>
            ))}
          </pre>
          <textarea
            className="yaml-process-editor__textarea"
            spellCheck={false}
            value={editorValue}
            disabled={isLoading || isSaving || isBeautifying}
            onChange={(event) => handleChange(event.target.value)}
            onScroll={handleScroll}
          />
        </div>
      </div>
      {errorMessage && <div className="yaml-process-editor__error">{errorMessage}</div>}
    </div>
  );
}

export function ProcessTopology({
  processConfig,
  processConfigOptions,
  selectedProcessConfigId,
  selectedNodeId,
  expandedNodeIds,
  onToggleNode,
  onExpandAllNodes,
  onCollapseAllNodes,
  onEditNode,
  onViewNode,
  onReorderSubprocessNode,
  onReorderReverseNode,
  onDeleteNode,
  onAddChildNode,
  onAddSubprocess,
  onCreateProcess,
  onDeleteProcessConfig,
  onOpenProcessCodeManager,
  onImportProcessConfig,
  onExportProcessConfig,
  onOpenJsonLogicPlayground,
  onOpenProcessPlayground,
  focusRequest,
  onSelectProcessConfig,
  editorMode,
  onEditorModeChange,
  yamlEditorText,
  onYamlEditorChange,
  onYamlEditorSave,
  onYamlEditorReload,
  onYamlEditorBeautify,
  isYamlEditorLoading,
  isYamlEditorSaving,
  isYamlEditorBeautifying,
  yamlEditorError,
  yamlEditorStatus,
  hasYamlEditorChanges,
  isCreateDisabled,
  isCreating,
  isDeleting,
  isImporting,
  isExporting,
  buildTopologyModel,
}) {
  const graph = useMemo(
    () => buildTopologyModel(processConfig, expandedNodeIds),
    [buildTopologyModel, expandedNodeIds, processConfig],
  );

  return (
    <div className="topology-layout">
      <div className="topology-toolbar">
        <div className="topology-toolbar__menu">
          <div className="topology-toolbar__group">
            <Button onClick={onCreateProcess} isLoading={isCreating} isDisabled={isCreateDisabled}>
              Создать процесс
            </Button>
            <Button
              variant="secondary"
              onClick={onImportProcessConfig}
              isLoading={isImporting}
              isDisabled={isDeleting || isImporting || isExporting}
            >
              <Upload01 aria-hidden size={16} />
              Импортировать
            </Button>
            <Button variant="secondary" onClick={onOpenProcessCodeManager}>
              Коды процесса
            </Button>
          </div>
          <div className="topology-toolbar__group topology-toolbar__group--right">
            <TopologyPlaygroundMenu
              onOpenJsonLogicPlayground={onOpenJsonLogicPlayground}
              onOpenProcessPlayground={onOpenProcessPlayground}
            />
          </div>
        </div>
      </div>
      <div className="topology-context-menu">
        <ProcessSelectField
          id="topology-process-select"
          className="topology-toolbar__select"
          value={selectedProcessConfigId}
          onChange={onSelectProcessConfig}
          options={processConfigOptions}
          placeholder="Выберите процесс"
          isDisabled={processConfigOptions.length === 0}
        />
        <Button
          variant="secondary"
          className="topology-export-process"
          onClick={onExportProcessConfig}
          isLoading={isExporting}
          isDisabled={!selectedProcessConfigId || isExporting}
        >
          <Download01 aria-hidden size={16} />
          Экспортировать
        </Button>
        <Button
          variant="secondary"
          className="topology-delete-process"
          onClick={onDeleteProcessConfig}
          isLoading={isDeleting}
          isDisabled={!selectedProcessConfigId || isDeleting}
        >
          <Trash01 aria-hidden size={16} />
          Удалить
        </Button>
        <div className="topology-editor-mode" aria-label="Режим редактирования">
          <button
            type="button"
            className={cn('topology-editor-mode__button', editorMode === 'VISUAL' && 'topology-editor-mode__button-active')}
            onClick={() => onEditorModeChange('VISUAL')}
          >
            Chart
          </button>
          <button
            type="button"
            className={cn('topology-editor-mode__button', editorMode === 'YAML' && 'topology-editor-mode__button-active')}
            onClick={() => onEditorModeChange('YAML')}
            disabled={!selectedProcessConfigId}
          >
            YAML
          </button>
        </div>
      </div>
      {editorMode === 'YAML' ? (
        <div className="topology-canvas topology-canvas-yaml">
          <YamlProcessEditor
            value={yamlEditorText}
            onChange={onYamlEditorChange}
            onSave={onYamlEditorSave}
            onReload={onYamlEditorReload}
            onBeautify={onYamlEditorBeautify}
            isLoading={isYamlEditorLoading}
            isSaving={isYamlEditorSaving}
            isBeautifying={isYamlEditorBeautifying}
            errorMessage={yamlEditorError}
            statusMessage={yamlEditorStatus}
            hasChanges={hasYamlEditorChanges}
          />
        </div>
      ) : (
        <ReactFlowProvider>
          <div className="topology-canvas">
            <div className="topology-flow-actions" aria-label="Управление деревом">
              <button
                type="button"
                className="topology-flow-actions__button"
                onClick={onExpandAllNodes}
                disabled={!processConfig?.process?.id}
                aria-label="Раскрыть все дерево"
                title="Раскрыть все дерево"
              >
                <Maximize01 aria-hidden size={18} />
              </button>
              <button
                type="button"
                className="topology-flow-actions__button"
                onClick={onCollapseAllNodes}
                disabled={!processConfig?.process?.id}
                aria-label="Свернуть все дерево"
                title="Свернуть все дерево"
              >
                <Minimize01 aria-hidden size={18} />
              </button>
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
              <FocusRequestedNode focusRequest={focusRequest} nodes={graph.nodes} />
            </ReactFlow>
          </div>
        </ReactFlowProvider>
      )}
    </div>
  );
}
