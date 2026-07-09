import {
  BellRinging04,
  CheckVerified02,
  Edit01,
  Eye,
  Maximize01,
  Minimize01,
  NotificationBox,
  Play,
  Plus,
  RefreshCcw01,
  Rows01,
  Save01,
  Target01,
  Trash01,
  ZapCircle,
} from '@untitledui/icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, { Background, Handle, MarkerType, Position, ReactFlowProvider, useReactFlow } from 'reactflow';
import { DictionariesMenu, TopologyPlaygroundButton, TopologyProcessCheckButton } from '../ui/AppPrimitives';
import { cn } from '../../utils/ui';

const TOPOLOGY_SIDEBAR_WIDTH_STORAGE_KEY = 'yamlProcessor.topologySidebarWidth.v1';
const TOPOLOGY_SIDEBAR_MIN_WIDTH = 320;
const TOPOLOGY_SIDEBAR_MAX_WIDTH = 550;
const TOPOLOGY_SIDEBAR_DEFAULT_WIDTH = 360;
const STRUCTURE_NODE_WIDTH = 304;
const STRUCTURE_OUTPUT_NODE_WIDTH = 336;
const STRUCTURE_LEFT_PADDING = 72;
const STRUCTURE_TOP_PADDING = 96;
const STRUCTURE_COLUMN_STEP = 372;
const STRUCTURE_ROW_STEP = 154;

const STRUCTURE_KIND_META = {
  process: { label: 'Process', column: 0, height: 118 },
  subprocess: { label: 'Subprocess', column: 1, height: 122 },
  stage: { label: 'Stage', column: 2, height: 130 },
  result: { label: 'Result', column: 3, height: 118 },
  reverse: { label: 'Reverse', column: 4, height: 112 },
  reverseOutput: { label: 'Output', column: 5, height: 128 },
};

function clampTopologySidebarWidth(width) {
  return Math.min(TOPOLOGY_SIDEBAR_MAX_WIDTH, Math.max(TOPOLOGY_SIDEBAR_MIN_WIDTH, width));
}

function truncateText(value, maxLength = 84) {
  if (!value) {
    return '';
  }

  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function formatCount(value, oneLabel, fewLabel, manyLabel = fewLabel) {
  const count = Number(value) || 0;
  const mod10 = count % 10;
  const mod100 = count % 100;
  const label = mod10 === 1 && mod100 !== 11 ? oneLabel : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? fewLabel : manyLabel;

  return `${count} ${label}`;
}

function getStructureResultNodeId(stageId, resultIndex) {
  return `result:${stageId}:${resultIndex}`;
}

function getStructureReverseNodeId(stageId, resultIndex, reverseIndex) {
  return `reverse:${stageId}:${resultIndex}:${reverseIndex}`;
}

function getStructureReverseOutputNodeId(stageId, resultIndex, reverseIndex, outputIndex) {
  return `reverseOutput:${stageId}:${resultIndex}:${reverseIndex}:${outputIndex}`;
}

function formatStructureRuleState(rule) {
  return String(rule ?? '').trim() ? 'rule configured' : 'rule empty';
}

function formatStructureReference(value, fallback = 'not set') {
  return String(value?.code ?? value ?? '').trim() || fallback;
}

function compactStructureItems(items, limit = 3) {
  const normalizedItems = (items ?? []).map((item) => String(item ?? '').trim()).filter(Boolean);
  if (normalizedItems.length <= limit) {
    return normalizedItems;
  }

  return [...normalizedItems.slice(0, limit), `+${normalizedItems.length - limit}`];
}

function pickStructureText(...values) {
  return values.map((value) => String(value ?? '').trim()).find(Boolean) ?? '';
}

function createStructureEdge(source, target, level) {
  const palette = ['#7f56d9', '#1570ef', '#039855', '#dc6803', '#c11574', '#475467'];

  return {
    id: `structure:${source}->${target}`,
    source,
    target,
    type: 'smoothstep',
    animated: false,
    selectable: false,
    focusable: false,
    deletable: false,
    interactionWidth: 12,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: palette[level] ?? '#98a2b3',
      width: 16,
      height: 16,
    },
    style: {
      stroke: palette[level] ?? '#98a2b3',
      strokeWidth: 2,
    },
  };
}

function createStructureTreeNode({ id, kind, title, subtitle, metaItems = [], accentItems = [], disabled = false, children = [] }) {
  const kindMeta = STRUCTURE_KIND_META[kind] ?? STRUCTURE_KIND_META.stage;

  return {
    id,
    kind,
    title: title ?? '',
    subtitle: subtitle ?? '',
    metaItems,
    accentItems,
    disabled,
    children,
    column: kindMeta.column,
    nodeHeight: kindMeta.height,
  };
}

function buildReverseOutputStructureNode(stage, resultIndex, reverseIndex, output, outputIndex) {
  const serviceSummary = [
    output.body?.service?.scenario,
    output.body?.service?.type,
    output.body?.service?.status?.code,
  ].filter(Boolean).join(' / ');
  const bodySummary = [output.body?.type, output.body?.eventObject?.type].filter(Boolean).join(' / ');
  const outputTitle = output.name || formatStructureReference(output.phase, '');
  const outputSubtitle = serviceSummary || bodySummary || output.log?.journalServiceName || '';
  const slaSummary = [
    output.body?.service?.sla?.durationValue,
    output.body?.service?.sla?.durationUnit?.code,
    output.body?.service?.sla?.status?.code,
  ].filter(Boolean).join(' ');

  return createStructureTreeNode({
    id: getStructureReverseOutputNodeId(stage.id, resultIndex, reverseIndex, outputIndex),
    kind: 'reverseOutput',
    title: pickStructureText(output.nodeName, outputTitle, 'Output'),
    subtitle: pickStructureText(output.nodeComment, outputSubtitle),
    metaItems: [
      formatStructureReference(output.phase, 'phase not set'),
      serviceSummary,
      bodySummary,
      output.log?.journalServiceName ? 'log configured' : '',
      slaSummary ? `SLA ${slaSummary}` : '',
    ],
    accentItems: [formatStructureRuleState(output.rule)],
  });
}

function buildReverseStructureNode(stage, resultIndex, reverse, reverseIndex) {
  const outputNodes = (reverse.output ?? []).map((output, outputIndex) =>
    buildReverseOutputStructureNode(stage, resultIndex, reverseIndex, output, outputIndex),
  );

  return createStructureTreeNode({
    id: getStructureReverseNodeId(stage.id, resultIndex, reverseIndex),
    kind: 'reverse',
    title: pickStructureText(reverse.nodeName, formatStructureReference(reverse.status, ''), 'Reverse'),
    subtitle: pickStructureText(reverse.nodeComment, formatCount(outputNodes.length, 'output', 'outputs')),
    metaItems: [formatCount(outputNodes.length, 'output', 'outputs')],
    accentItems: compactStructureItems(outputNodes.map((node) => node.title), 2),
    children: outputNodes,
  });
}

function buildResultStructureNode(stage, result, resultIndex) {
  const reverseNodes = (result.reverse ?? []).map((reverse, reverseIndex) =>
    buildReverseStructureNode(stage, resultIndex, reverse, reverseIndex),
  );
  const scenarios = result.inputScenarios?.length ? result.inputScenarios : ['Сценарии не заданы'];

  return createStructureTreeNode({
    id: getStructureResultNodeId(stage.id, resultIndex),
    kind: 'result',
    title: pickStructureText(result.nodeName, compactStructureItems(scenarios, 1)[0]),
    subtitle: pickStructureText(result.nodeComment, formatCount(reverseNodes.length, 'reverse', 'reverse')),
    metaItems: [formatCount(reverseNodes.length, 'reverse', 'reverse')],
    accentItems: compactStructureItems(scenarios, 3),
    children: reverseNodes,
  });
}

function buildStageStructureNode(stage) {
  const resultNodes = (stage.configurator?.result ?? []).map((result, resultIndex) =>
    buildResultStructureNode(stage, result, resultIndex),
  );

  return createStructureTreeNode({
    id: `stage:${stage.id}`,
    kind: 'stage',
    title: pickStructureText(stage.nodeName, stage.executor, stage.contextCode?.code, 'Stage'),
    subtitle: pickStructureText(stage.nodeComment, formatCount(resultNodes.length, 'result', 'results')),
    metaItems: [
      stage.executor ? `executor ${stage.executor}` : '',
      stage.contextCode?.code ? `context ${stage.contextCode.code}` : '',
      formatCount(resultNodes.length, 'result', 'results'),
    ],
    accentItems: [
      stage.configurator?.disabled ? 'disabled' : 'active',
      stage.configurator?.multiple ? 'multiple' : '',
      stage.configurator?.interrupted ? 'interrupt' : '',
      formatStructureRuleState(stage.configurator?.filterEventRule),
    ],
    disabled: Boolean(stage.configurator?.disabled),
    children: resultNodes,
  });
}

function buildSubprocessStructureNode(subprocess) {
  const stageNodes = (subprocess.stages ?? []).map((stage) => buildStageStructureNode(stage));

  return createStructureTreeNode({
    id: `subprocess:${subprocess.id}`,
    kind: 'subprocess',
    title: pickStructureText(subprocess.nodeName, 'Subprocess'),
    subtitle: pickStructureText(subprocess.nodeComment, formatCount(stageNodes.length, 'stage', 'stages')),
    metaItems: [formatCount(stageNodes.length, 'stage', 'stages')],
    accentItems: [
      subprocess.disabled ? 'disabled' : 'active',
      formatStructureRuleState(subprocess.trigger?.rule),
    ],
    disabled: Boolean(subprocess.disabled),
    children: stageNodes,
  });
}

function measureStructureRowSpan(treeNode) {
  if (!treeNode.children?.length) {
    treeNode.rowSpan = 1;
    return 1;
  }

  treeNode.rowSpan = 1 + treeNode.children.reduce((sum, child) => sum + measureStructureRowSpan(child), 0);
  return treeNode.rowSpan;
}

function placeStructureTreeNode(treeNode, rowIndex, nodes, edges, parentNode = null) {
  const width = treeNode.kind === 'reverseOutput' ? STRUCTURE_OUTPUT_NODE_WIDTH : STRUCTURE_NODE_WIDTH;
  const nodeHeight = treeNode.nodeHeight;

  nodes.push({
    id: treeNode.id,
    type: 'structureNode',
    position: {
      x: STRUCTURE_LEFT_PADDING + treeNode.column * STRUCTURE_COLUMN_STEP,
      y: STRUCTURE_TOP_PADDING + rowIndex * STRUCTURE_ROW_STEP,
    },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data: {
      kind: treeNode.kind,
      kindLabel: STRUCTURE_KIND_META[treeNode.kind]?.label ?? 'Node',
      title: treeNode.title,
      subtitle: treeNode.subtitle,
      metaItems: compactStructureItems(treeNode.metaItems, 4),
      accentItems: compactStructureItems(treeNode.accentItems, 4),
      disabled: treeNode.disabled,
      childCount: treeNode.children?.length ?? 0,
      nodeHeight,
    },
    style: {
      width,
    },
  });

  if (parentNode) {
    edges.push(createStructureEdge(parentNode.id, treeNode.id, Math.min(treeNode.column, 5)));
  }

  let nextRowIndex = rowIndex + 1;
  (treeNode.children ?? []).forEach((childNode) => {
    placeStructureTreeNode(childNode, nextRowIndex, nodes, edges, treeNode);
    nextRowIndex += Math.max(1, childNode.rowSpan);
  });
}

function buildStructureFlowModel(processConfig) {
  const nodes = [];
  const edges = [];
  const process = processConfig?.process;

  if (!process?.id) {
    return { nodes, edges };
  }

  const subprocessNodes = (process.subprocess ?? []).map((subprocess) => buildSubprocessStructureNode(subprocess));
  const rootNode = createStructureTreeNode({
    id: `process:${process.id}`,
    kind: 'process',
    title: pickStructureText(process.nodeName, process.contextCode?.code, 'Process'),
    subtitle: pickStructureText(process.nodeComment, formatCount(subprocessNodes.length, 'subprocess', 'subprocesses')),
    metaItems: [
      process.contextCode?.code ? `context ${process.contextCode.code}` : '',
      formatCount(subprocessNodes.length, 'subprocess', 'subprocesses'),
    ],
    accentItems: [process.disabled ? 'disabled' : 'active'],
    disabled: Boolean(process.disabled),
    children: subprocessNodes,
  });

  measureStructureRowSpan(rootNode);
  placeStructureTreeNode(rootNode, 0, nodes, edges);

  return { nodes, edges };
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

function StructureNode({ data, selected }) {
  const kind = data?.kind ?? 'stage';

  return (
    <div
      className={cn(
        'structure-node',
        `structure-node--${kind}`,
        data?.disabled && 'structure-node--disabled',
        data?.executed && 'structure-node--executed',
        selected && 'selected',
      )}
      style={{ minHeight: data?.nodeHeight ? `${data.nodeHeight}px` : undefined }}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      {data?.executed && (
        <span className="structure-node__executed" title="Node отработал" aria-label="Node отработал">
          <CheckVerified02 aria-hidden size={16} />
        </span>
      )}
      {data?.title && <div className="structure-node__title">{data.title}</div>}
      {data?.subtitle && <div className="structure-node__subtitle">{data.subtitle}</div>}
    </div>
  );
}

function fitTopologyView(reactFlow, duration = 250, nodeIds = null) {
  const expectedNodeIds = nodeIds ? new Set(nodeIds) : null;
  const renderedNodes = reactFlow.getNodes().filter((node) => !expectedNodeIds || expectedNodeIds.has(node.id));
  if (renderedNodes.length === 0) {
    return false;
  }

  reactFlow.fitView({
    nodes: renderedNodes.map((node) => ({ id: node.id })),
    padding: 0.35,
    minZoom: 0.15,
    duration,
  });
  return true;
}

function getTopologyNodeSignature(nodes) {
  return nodes
    .map((node) => [
      node.id,
      node.position?.x ?? 0,
      node.position?.y ?? 0,
      node.data?.nodeHeight ?? '',
      node.style?.width ?? '',
    ].join(':'))
    .join('|');
}

function AutoFitView({ processConfig, nodes, nodeSignature }) {
  const reactFlow = useReactFlow();

  useEffect(() => {
    if (!processConfig?.id || nodes.length === 0) {
      return;
    }

    let isCancelled = false;
    const frameIds = [];
    const timeoutIds = [];
    const nodeIds = nodes.map((node) => node.id);

    const fitWhenReady = () => {
      if (!isCancelled) {
        fitTopologyView(reactFlow, 250, nodeIds);
      }
    };

    frameIds.push(
      window.requestAnimationFrame(() => {
        frameIds.push(window.requestAnimationFrame(fitWhenReady));
      }),
    );
    timeoutIds.push(window.setTimeout(fitWhenReady, 80));
    timeoutIds.push(window.setTimeout(fitWhenReady, 180));

    return () => {
      isCancelled = true;
      frameIds.forEach((frameId) => window.cancelAnimationFrame(frameId));
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [nodeSignature, processConfig?.id, reactFlow]);

  return null;
}

function FitTopologyViewButton({ nodes }) {
  const reactFlow = useReactFlow();

  const handleFitView = () => {
    fitTopologyView(reactFlow, 300, nodes.map((node) => node.id));
  };

  return (
    <button
      type="button"
      className="topology-flow-actions__button"
      onClick={handleFitView}
      disabled={nodes.length === 0}
      aria-label="Показать все nodes"
      title="Показать все nodes"
    >
      <Target01 aria-hidden size={18} />
    </button>
  );
}

function TopologyEditorModeSwitch({ editorMode, onEditorModeChange, selectedProcessConfigId }) {
  return (
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
        className={cn('topology-editor-mode__button', editorMode === 'FLOW' && 'topology-editor-mode__button-active')}
        onClick={() => onEditorModeChange('FLOW')}
        disabled={!selectedProcessConfigId}
      >
        Flow
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
  );
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

function BeautifyYamlIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M15 4V2M15 16V14M8 9H10M20 9H22M17.8 11.8L19 13M17.8 6.2L19 5M3 21L12 12M12.2 6.2L11 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function YamlProcessActions({
  onSave,
  onReload,
  onBeautify,
  isLoading,
  isSaving,
  isBeautifying,
  statusMessage,
  hasChanges,
}) {
  return (
    <div className="yaml-process-editor__actions">
      {statusMessage && <div className="yaml-process-editor__status">{statusMessage}</div>}
      <button
        type="button"
        className="yaml-process-editor__icon-button"
        onClick={onBeautify}
        disabled={isLoading || isSaving || isBeautifying}
        aria-label="Beautify YAML"
        title="Beautify YAML"
      >
        {isBeautifying ? (
          <span className="yaml-process-editor__spinner" aria-hidden="true" />
        ) : (
          <BeautifyYamlIcon />
        )}
      </button>
      <button
        type="button"
        className="yaml-process-editor__icon-button"
        onClick={onReload}
        disabled={isLoading || isSaving || isBeautifying}
        aria-label="Обновить"
        title="Обновить"
      >
        <RefreshCcw01 aria-hidden size={18} />
      </button>
      <button
        type="button"
        className="yaml-process-editor__icon-button"
        onClick={onSave}
        disabled={isLoading || isBeautifying || !hasChanges}
        aria-label="Сохранить YAML"
        title="Сохранить YAML"
      >
        {isSaving ? (
          <span className="yaml-process-editor__spinner" aria-hidden="true" />
        ) : (
          <Save01 aria-hidden size={18} />
        )}
      </button>
    </div>
  );
}

function YamlProcessEditor({
  value,
  onChange,
  isLoading,
  isSaving,
  isBeautifying,
  errorMessage,
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
  processTreeSidebar,
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
  onOpenProcessCodeManager,
  onOpenJsonLogicPlayground,
  onOpenProcessPlayground,
  onOpenCurrentProcessPlayground,
  onResetCurrentProcessPlayground,
  executedNodeIds = [],
  isCurrentProcessPlaygroundRunning = false,
  isFlowPlaybackRunning = false,
  hasCurrentProcessPlayback = false,
  focusRequest,
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
  buildTopologyModel,
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window === 'undefined') {
      return TOPOLOGY_SIDEBAR_DEFAULT_WIDTH;
    }

    const storedWidth = Number.parseInt(window.localStorage.getItem(TOPOLOGY_SIDEBAR_WIDTH_STORAGE_KEY) ?? '', 10);
    return Number.isFinite(storedWidth)
      ? clampTopologySidebarWidth(storedWidth)
      : TOPOLOGY_SIDEBAR_DEFAULT_WIDTH;
  });
  const graph = useMemo(
    () => buildTopologyModel(processConfig, expandedNodeIds),
    [buildTopologyModel, expandedNodeIds, processConfig],
  );
  const structureGraph = useMemo(() => buildStructureFlowModel(processConfig), [processConfig]);
  const graphNodeSignature = useMemo(() => getTopologyNodeSignature(graph.nodes), [graph.nodes]);
  const structureGraphNodeSignature = useMemo(() => getTopologyNodeSignature(structureGraph.nodes), [structureGraph.nodes]);
  const executedNodeIdSet = useMemo(() => new Set(executedNodeIds ?? []), [executedNodeIds]);
  const highlightedStructureEdges = useMemo(
    () =>
      structureGraph.edges.map((edge) => {
        const isExecutedPath = executedNodeIdSet.has(edge.source) && executedNodeIdSet.has(edge.target);
        if (!isExecutedPath) {
          return edge;
        }

        return {
          ...edge,
          animated: true,
          markerEnd: {
            ...edge.markerEnd,
            color: '#039855',
          },
          style: {
            ...edge.style,
            stroke: '#039855',
            strokeWidth: 3,
          },
        };
      }),
    [executedNodeIdSet, structureGraph.edges],
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(TOPOLOGY_SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  const handleSidebarResizePointerDown = (event) => {
    if (event.button != null && event.button !== 0) {
      return;
    }

    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    const handlePointerMove = (moveEvent) => {
      const nextWidth = clampTopologySidebarWidth(startWidth + moveEvent.clientX - startX);
      setSidebarWidth(nextWidth);
    };
    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.classList.remove('topology-sidebar-resizing');
    };

    document.body.classList.add('topology-sidebar-resizing');
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
  };

  const handleSidebarResizeKeyDown = (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }

    event.preventDefault();
    setSidebarWidth((currentWidth) =>
      clampTopologySidebarWidth(currentWidth + (event.key === 'ArrowRight' ? 24 : -24)),
    );
  };

  return (
    <div className="topology-layout">
      <div className="topology-toolbar">
        <div className="topology-toolbar__menu">
          <div className="topology-toolbar__group">
            <DictionariesMenu onOpenProcessCodes={onOpenProcessCodeManager} />
          </div>
          <div className="topology-toolbar__group topology-toolbar__group--right">
            <TopologyPlaygroundButton onOpenJsonLogicPlayground={onOpenJsonLogicPlayground} />
            <TopologyProcessCheckButton onOpenProcessPlayground={onOpenProcessPlayground} />
          </div>
        </div>
      </div>
      <div
        className="topology-main"
        style={{
          '--topology-sidebar-width': `${sidebarWidth}px`,
          '--topology-sidebar-min-width': `${TOPOLOGY_SIDEBAR_MIN_WIDTH}px`,
        }}
      >
        <aside className="topology-sidebar" aria-label="Дерево процессов">
          {processTreeSidebar}
        </aside>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Изменить ширину панели процессов"
          aria-valuemin={TOPOLOGY_SIDEBAR_MIN_WIDTH}
          aria-valuemax={TOPOLOGY_SIDEBAR_MAX_WIDTH}
          aria-valuenow={Math.round(sidebarWidth)}
          tabIndex={0}
          className="topology-sidebar-resizer"
          onPointerDown={handleSidebarResizePointerDown}
          title="Изменить ширину панели процессов"
          onKeyDown={handleSidebarResizeKeyDown}
        />
        {editorMode === 'YAML' ? (
          <div className="topology-canvas topology-canvas-yaml">
            <div className="topology-canvas-controls">
              <YamlProcessActions
                onSave={onYamlEditorSave}
                onReload={onYamlEditorReload}
                onBeautify={onYamlEditorBeautify}
                isLoading={isYamlEditorLoading}
                isSaving={isYamlEditorSaving}
                isBeautifying={isYamlEditorBeautifying}
                statusMessage={yamlEditorStatus}
                hasChanges={hasYamlEditorChanges}
              />
              <TopologyEditorModeSwitch
                editorMode={editorMode}
                onEditorModeChange={onEditorModeChange}
                selectedProcessConfigId={selectedProcessConfigId}
              />
            </div>
            <YamlProcessEditor
              value={yamlEditorText}
              onChange={onYamlEditorChange}
              isLoading={isYamlEditorLoading}
              isSaving={isYamlEditorSaving}
              isBeautifying={isYamlEditorBeautifying}
              errorMessage={yamlEditorError}
            />
          </div>
        ) : editorMode === 'FLOW' ? (
          <ReactFlowProvider>
            <div className="topology-canvas topology-canvas-structure">
              <div className="topology-canvas-controls">
                <div className="topology-flow-actions" aria-label="Управление структурой">
                  <FitTopologyViewButton nodes={structureGraph.nodes} />
                  <button
                    type="button"
                    className="topology-flow-actions__button"
                    onClick={onOpenCurrentProcessPlayground}
                    disabled={!processConfig?.process?.id || isCurrentProcessPlaygroundRunning}
                    aria-label="Запустить Playground текущего процесса"
                    title="Запустить Playground текущего процесса"
                  >
                    {isCurrentProcessPlaygroundRunning ? (
                      <span className="topology-flow-actions__spinner" aria-hidden="true" />
                    ) : (
                      <Play aria-hidden size={18} />
                    )}
                  </button>
                  <button
                    type="button"
                    className="topology-flow-actions__button"
                    onClick={onResetCurrentProcessPlayground}
                    disabled={!hasCurrentProcessPlayback && !isFlowPlaybackRunning && !isCurrentProcessPlaygroundRunning}
                    aria-label="Сбросить проигранный сценарий"
                    title="Сбросить проигранный сценарий"
                  >
                    <RefreshCcw01 aria-hidden size={18} />
                  </button>
                </div>
                <TopologyEditorModeSwitch
                  editorMode={editorMode}
                  onEditorModeChange={onEditorModeChange}
                  selectedProcessConfigId={selectedProcessConfigId}
                />
              </div>
              <ReactFlow
                className="structure-flow"
                nodes={structureGraph.nodes.map((node) => ({
                  ...node,
                  selected: false,
                  data: {
                    ...node.data,
                    executed: executedNodeIdSet.has(node.id),
                  },
                }))}
                edges={highlightedStructureEdges}
                nodeTypes={{ structureNode: StructureNode }}
                minZoom={0.18}
                maxZoom={1.65}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                nodesFocusable={false}
                edgesFocusable={false}
                proOptions={{ hideAttribution: true }}
              >
                <Background color="#e4e7ec" gap={28} size={1.2} />
                <AutoFitView
                  processConfig={processConfig}
                  nodes={structureGraph.nodes}
                  nodeSignature={structureGraphNodeSignature}
                />
                <FocusRequestedNode focusRequest={focusRequest} nodes={structureGraph.nodes} />
              </ReactFlow>
            </div>
          </ReactFlowProvider>
        ) : (
          <ReactFlowProvider>
            <div className="topology-canvas">
              <div className="topology-canvas-controls">
                <div className="topology-flow-actions" aria-label="Управление деревом">
                  <FitTopologyViewButton nodes={graph.nodes} />
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
                <TopologyEditorModeSwitch
                  editorMode={editorMode}
                  onEditorModeChange={onEditorModeChange}
                  selectedProcessConfigId={selectedProcessConfigId}
                />
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
                minZoom={0.15}
                maxZoom={2}
                nodesDraggable={false}
                onNodeClick={(_, node) => onToggleNode(node.id)}
                proOptions={{ hideAttribution: true }}
              >
                <AutoFitView processConfig={processConfig} nodes={graph.nodes} nodeSignature={graphNodeSignature} />
                <FocusRequestedNode focusRequest={focusRequest} nodes={graph.nodes} />
              </ReactFlow>
            </div>
          </ReactFlowProvider>
        )}
      </div>
    </div>
  );
}
