import { gql, useMutation, useQuery } from '@apollo/client';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardTitle,
  Checkbox,
  EmptyState,
  EmptyStateBody,
  EmptyStateFooter,
  Form,
  FormGroup,
  Page,
  PageSection,
  Spinner,
  Split,
  SplitItem,
  Text,
  TextArea,
  TextInput,
  Title,
} from '@patternfly/react-core';
import { useEffect, useRef, useState } from 'react';
import ReactFlow, {
  Controls,
  MarkerType,
  Position,
  ReactFlowProvider,
} from 'reactflow';

const PROCESS_FIELDS = gql`
  fragment ReverseOutputFields on ReverseOutput {
    dbId
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
        status
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
    dbId
    status {
      code
    }
    output {
      ...ReverseOutputFields
    }
  }

  fragment ResultFields on Result {
    dbId
    inputScenarios
    reverse {
      ...ReverseFields
    }
  }

  fragment ConfiguratorFields on Configurator {
    dbId
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
    dbId
    id
    executor
    description
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
    dbId
    id
    description
    disabled
    contextCode {
      code
    }
    trigger {
      rule
    }
    stages {
      ...StageFields
    }
  }

  query ProcessConfigList {
    contextCodesDictionaryList {
      code
    }
    processConfigList {
      dbId
      process {
        dbId
        id
        description
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
      dbId
      process {
        dbId
        id
        description
        disabled
        contextCode {
          code
        }
        subprocess {
          dbId
          id
          description
          disabled
          contextCode {
            code
          }
          trigger {
            rule
          }
          stages {
            dbId
          }
        }
      }
    }
  }
`;

const UPDATE_PROCESS = gql`
  mutation UpdateProcessConfig($id: ID!, $input: ProcessConfigInput!) {
    updateProcessConfig(id: $id, input: $input) {
      dbId
    }
  }
`;

const UPDATE_STAGE_NODE = gql`
  mutation UpdateStageNode($id: ID!, $input: StageInput!) {
    updateStageNode(id: $id, input: $input) {
      dbId
    }
  }
`;

const EMPTY_PROCESS_FORM = {
  code: '',
  description: '',
};

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

function createDefaultStage(index) {
  return {
    id: false,
    executor: `executor_${index}`,
    description: '',
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
  const processDbId = processConfig?.process?.dbId;
  return processDbId ? [`process:${processDbId}`] : [];
}

function createDefaultSubprocess(index) {
  return {
    id: `subprocess_${index}`,
    description: '',
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

function serializeConfigurator(configurator) {
  if (!configurator) {
    return null;
  }

  return {
    dbId: configurator.dbId ?? undefined,
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
      dbId: result.dbId ?? undefined,
      inputScenarios: result.inputScenarios ?? [],
      reverse: (result.reverse ?? []).map((reverse) => ({
        dbId: reverse.dbId ?? undefined,
        status: refInput(reverse.status),
        output: (reverse.output ?? []).map((output) => ({
          dbId: output.dbId ?? undefined,
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
                      status: output.body.service.status ?? '',
                      sla: output.body.service.sla
                        ? {
                            durationValue: output.body.service.sla.durationValue ?? null,
                            durationUnit: refInput(output.body.service.sla.durationUnit),
                            status: refInput(output.body.service.sla.status),
                          }
                        : null,
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

function serializeStage(stage) {
  return {
    dbId: stage.dbId ?? undefined,
    id: stage.id ?? false,
    executor: stage.executor ?? '',
    description: stage.description ?? '',
    contextCode: refInput(stage.contextCode),
    log: stage.log
      ? {
          journalServiceName: stage.log.journalServiceName ?? '',
        }
      : null,
    configurator: serializeConfigurator(stage.configurator),
  };
}

function serializeSubprocess(subprocess) {
  return {
    dbId: subprocess.dbId ?? undefined,
    id: subprocess.id ?? '',
    description: subprocess.description ?? '',
    disabled: subprocess.disabled ?? false,
    contextCode: refInput(subprocess.contextCode),
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
          dbId: processConfig.process.dbId ?? undefined,
          id: processConfig.process.id ?? '',
          description: processConfig.process.description ?? '',
          disabled: processConfig.process.disabled ?? false,
          contextCode: refInput(processConfig.process.contextCode),
          subprocess: (processConfig.process.subprocess ?? []).map(serializeSubprocess),
        }
      : null,
  };
}

const TOPOLOGY_NODE_WIDTH = 220;
const TOPOLOGY_VERTICAL_GAP = 56;
const TOPOLOGY_HORIZONTAL_GAP = 72;
const TOPOLOGY_TOP_PADDING = 32;
const TOPOLOGY_LEFT_PADDING = 48;
const TOPOLOGY_TITLE_CHARS_PER_LINE = 20;
const TOPOLOGY_SUBTITLE_CHARS_PER_LINE = 28;

function estimateTextLines(value, charsPerLine, maxLines) {
  const text = String(value ?? '').trim();

  if (!text) {
    return 1;
  }

  return Math.max(
    1,
    Math.min(
      maxLines,
      text.split(/\r?\n/).reduce((total, line) => {
        return total + Math.max(1, Math.ceil(line.length / charsPerLine));
      }, 0),
    ),
  );
}

function estimateNodeHeight({ title, subtitle, isExpandable }) {
  const titleLines = estimateTextLines(title, TOPOLOGY_TITLE_CHARS_PER_LINE, 2);
  const subtitleLines = estimateTextLines(subtitle, TOPOLOGY_SUBTITLE_CHARS_PER_LINE, 3);
  const hintHeight = isExpandable ? 20 : 0;
  const estimatedHeight = 62 + titleLines * 20 + subtitleLines * 16 + hintHeight;

  return Math.max(104, estimatedHeight);
}

function getSubprocessTopologyLayout(subprocess, expandedSet) {
  const subprocessNodeId = `subprocess:${subprocess.dbId}`;
  const subprocessExpanded = expandedSet.has(subprocessNodeId);
  const subprocessHeight = estimateNodeHeight({
    title: subprocess.id || 'subprocess',
    subtitle: subprocess.description || 'Подпроцесс',
    isExpandable: (subprocess.stages?.length ?? 0) > 0,
  });
  const stageLayouts = (subprocess.stages ?? []).map((stage) => {
    const stageExpanded = expandedSet.has(`stage:${stage.dbId}`);
    const stageHeight = estimateNodeHeight({
      title: stage.executor || 'stage',
      subtitle: stage.description || 'Stage',
      isExpandable: true,
    });
    const configuratorHeight = stageExpanded
      ? estimateNodeHeight({
          title: 'configurator',
          subtitle: stage.configurator?.filterEventRule || 'Configurator settings',
          isExpandable: false,
        })
      : 0;

    return {
      stage,
      stageExpanded,
      stageHeight,
      configuratorHeight,
      totalHeight: stageHeight + (stageExpanded ? TOPOLOGY_VERTICAL_GAP + configuratorHeight : 0),
    };
  });
  const hasConfiguratorColumn = stageLayouts.some((stageLayout) => stageLayout.stageExpanded);
  let totalHeight = subprocessHeight;

  if (subprocessExpanded && stageLayouts.length > 0) {
    totalHeight += TOPOLOGY_VERTICAL_GAP;
    stageLayouts.forEach((stageLayout, index) => {
      totalHeight += stageLayout.totalHeight;
      if (index < stageLayouts.length - 1) {
        totalHeight += TOPOLOGY_VERTICAL_GAP;
      }
    });
  }

  return {
    subprocess,
    subprocessExpanded,
    subprocessHeight,
    stageLayouts,
    width: TOPOLOGY_NODE_WIDTH + (hasConfiguratorColumn ? TOPOLOGY_HORIZONTAL_GAP + TOPOLOGY_NODE_WIDTH : 0),
    height: totalHeight,
    hasConfiguratorColumn,
  };
}

function buildTopologyModel(processConfig, expandedNodeIds = []) {
  const nodes = [];
  const edges = [];
  const expandedSet = new Set(expandedNodeIds);

  if (!processConfig?.process) {
    return { nodes, edges };
  }

  const processNodeId = `process:${processConfig.process.dbId}`;
  const processExpanded = expandedSet.has(processNodeId);
  const subprocessLayouts = processExpanded
    ? (processConfig.process.subprocess ?? []).map((subprocess) => getSubprocessTopologyLayout(subprocess, expandedSet))
    : [];
  const processHeight = estimateNodeHeight({
    title: processConfig.process.id || 'process',
    subtitle: processConfig.process.description || 'Корневой процесс',
    isExpandable: (processConfig.process.subprocess?.length ?? 0) > 0,
  });
  const visibleChildrenWidth =
    subprocessLayouts.reduce((sum, item) => sum + item.width, 0) +
    Math.max(subprocessLayouts.length - 1, 0) * TOPOLOGY_HORIZONTAL_GAP;
  const contentWidth = Math.max(TOPOLOGY_NODE_WIDTH, visibleChildrenWidth);
  const contentStartX = TOPOLOGY_LEFT_PADDING;
  const processX = contentStartX + (contentWidth - TOPOLOGY_NODE_WIDTH) / 2;
  const processY = TOPOLOGY_TOP_PADDING;

  nodes.push({
    id: processNodeId,
    type: 'processNode',
    position: { x: processX, y: processY },
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
    data: {
      title: processConfig.process.id || 'process',
      kind: 'process',
      secondaryLabel: processConfig.process.description || 'Корневой процесс',
      isExpandable: (processConfig.process.subprocess?.length ?? 0) > 0,
      isExpanded: expandedSet.has(processNodeId),
    },
  });

  if (!processExpanded) {
    return { nodes, edges };
  }

  const subprocessY = processY + processHeight + TOPOLOGY_VERTICAL_GAP;
  let currentLaneX = contentStartX + (contentWidth - visibleChildrenWidth) / 2;

  subprocessLayouts.forEach(({ subprocess, width, subprocessExpanded, subprocessHeight, stageLayouts, hasConfiguratorColumn }) => {
    const subprocessNodeId = `subprocess:${subprocess.dbId}`;
    const subprocessX = currentLaneX + (hasConfiguratorColumn ? 0 : (width - TOPOLOGY_NODE_WIDTH) / 2);

    nodes.push({
      id: subprocessNodeId,
      type: 'processNode',
      position: { x: subprocessX, y: subprocessY },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      data: {
        title: subprocess.id || 'subprocess',
        kind: 'subprocess',
        secondaryLabel: subprocess.description || 'Подпроцесс',
        isExpandable: (subprocess.stages?.length ?? 0) > 0,
        isExpanded: expandedSet.has(subprocessNodeId),
      },
    });
    edges.push({
      id: `${processNodeId}->${subprocessNodeId}`,
      source: processNodeId,
      target: subprocessNodeId,
      markerEnd: {
        type: MarkerType.ArrowClosed,
      },
    });

    if (!subprocessExpanded) {
      currentLaneX += width + TOPOLOGY_HORIZONTAL_GAP;
      return;
    }

    let currentStageY = subprocessY + subprocessHeight + TOPOLOGY_VERTICAL_GAP;
    stageLayouts.forEach(({ stage, stageExpanded, stageHeight, configuratorHeight }, index) => {
      const stageNodeId = `stage:${stage.dbId}`;
      nodes.push({
        id: stageNodeId,
        type: 'processNode',
        position: { x: currentLaneX, y: currentStageY },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        data: {
          title: stage.executor || 'stage',
          kind: 'stage',
          secondaryLabel: stage.description || 'Stage',
          isExpandable: true,
          isExpanded: stageExpanded,
        },
      });
      edges.push({
        id: `${subprocessNodeId}->${stageNodeId}`,
        source: subprocessNodeId,
        target: stageNodeId,
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
      });

      if (stageExpanded) {
        const configuratorNodeId = `configurator:${stage.dbId}`;
        nodes.push({
          id: configuratorNodeId,
          type: 'processNode',
          position: {
            x: currentLaneX + TOPOLOGY_NODE_WIDTH + TOPOLOGY_HORIZONTAL_GAP,
            y: currentStageY + stageHeight + TOPOLOGY_VERTICAL_GAP,
          },
          sourcePosition: Position.Left,
          targetPosition: Position.Left,
          data: {
            title: 'configurator',
            kind: 'configurator',
            secondaryLabel: stage.configurator?.filterEventRule || 'Configurator settings',
            isExpandable: false,
            isExpanded: false,
          },
        });
        edges.push({
          id: `${stageNodeId}->${configuratorNodeId}`,
          source: stageNodeId,
          target: configuratorNodeId,
          sourceHandle: null,
          markerEnd: {
            type: MarkerType.ArrowClosed,
          },
        });
        currentStageY += stageHeight + TOPOLOGY_VERTICAL_GAP + configuratorHeight;
      } else {
        currentStageY += stageHeight;
      }

      if (index < stageLayouts.length - 1) {
        currentStageY += TOPOLOGY_VERTICAL_GAP;
      }
    });

    currentLaneX += width + TOPOLOGY_HORIZONTAL_GAP;
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
          String(subprocess.dbId) === targetId ? { ...subprocess, ...values } : subprocess,
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
            String(stage.dbId) === targetId ? { ...stage, ...values } : stage,
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
            String(stage.dbId) === targetId ? { ...stage, configurator: values } : stage,
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
    const subprocess = (processConfig.process.subprocess ?? []).find((item) => String(item.dbId) === targetId);
    return subprocess ? { kind, node: subprocess } : null;
  }

  if (kind === 'stage') {
    for (const subprocess of processConfig.process.subprocess ?? []) {
      const stage = (subprocess.stages ?? []).find((item) => String(item.dbId) === targetId);
      if (stage) {
        return { kind, node: stage, parent: subprocess };
      }
    }
  }

  if (kind === 'configurator') {
    for (const subprocess of processConfig.process.subprocess ?? []) {
      const stage = (subprocess.stages ?? []).find((item) => String(item.dbId) === targetId);
      if (stage) {
        return { kind, node: stage.configurator ?? {}, parent: stage, subprocess };
      }
    }
  }

  return null;
}

function ProcessNode({ data, selected }) {
  const title = data?.title ?? 'node';
  const subtitle = data?.secondaryLabel ?? '';
  const kind = data?.kind ?? 'node';
  const isExpandable = Boolean(data?.isExpandable);
  const isExpanded = Boolean(data?.isExpanded);
  const editNode = (event) => {
    event.stopPropagation();
    data?.onEdit?.();
  };
  const reorderStages = (event) => {
    event.stopPropagation();
    data?.onReorder?.();
  };

  return (
    <div className={selected ? 'process-node selected' : 'process-node'}>
      <button type="button" className="process-node__edit" onClick={editNode} aria-label="Edit node" title="Edit">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="process-node__edit-icon">
          <path
            d="M4 17.25V20h2.75L17.81 8.94l-2.75-2.75L4 17.25zm15.71-9.04a1.003 1.003 0 0 0 0-1.42l-2.5-2.5a1.003 1.003 0 0 0-1.42 0l-1.96 1.96 2.75 2.75 1.13-1.13z"
            fill="currentColor"
          />
        </svg>
      </button>
      {kind === 'subprocess' && (
        <button
          type="button"
          className="process-node__action process-node__action-order"
          onClick={reorderStages}
          aria-label="Change stage order"
          title="Change stage order"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="process-node__edit-icon">
            <path
              d="M8 6h12v2H8V6zm0 5h12v2H8v-2zm0 5h12v2H8v-2zM4 7.5A1.5 1.5 0 1 1 4 4.5a1.5 1.5 0 0 1 0 3zm0 5A1.5 1.5 0 1 1 4 9.5a1.5 1.5 0 0 1 0 3zm0 5A1.5 1.5 0 1 1 4 14.5a1.5 1.5 0 0 1 0 3z"
              fill="currentColor"
            />
          </svg>
        </button>
      )}
      <div className="process-node__kind">{kind}</div>
      <div className="process-node__title">{title}</div>
      <div className="process-node__subtitle">{subtitle || 'Без описания'}</div>
      {isExpandable && <div className="process-node__hint">{isExpanded ? 'Скрыть дочерние' : 'Показать дочерние'}</div>}
    </div>
  );
}

function ProcessTopology({ processConfig, selectedNodeId, expandedNodeIds, onToggleNode, onEditNode, onReorderSubprocessNode }) {
  const [graph, setGraph] = useState({ nodes: [], edges: [] });

  useEffect(() => {
    setGraph(buildTopologyModel(processConfig, expandedNodeIds));
  }, [expandedNodeIds, processConfig]);

  return (
    <ReactFlowProvider>
      <div className="topology-canvas">
        <ReactFlow
          nodes={graph.nodes.map((node) => ({
            ...node,
            selected: node.id === selectedNodeId,
            data: {
              ...node.data,
              onEdit: () => onEditNode(node.id),
              onReorder: node.data.kind === 'subprocess' ? () => onReorderSubprocessNode(node.id) : undefined,
            },
          }))}
          edges={graph.edges}
          nodeTypes={{ processNode: ProcessNode }}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={2}
          nodesDraggable={false}
          onNodeClick={(_, node) => onToggleNode(node.id)}
          proOptions={{ hideAttribution: true }}
        >
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
  onAddSubprocess,
  onAddStage,
  onReorderStages,
  contextCodeOptions,
  isSaving,
}) {
  const selected = findSelectedNode(processConfig, selectedNodeId);
  const [draft, setDraft] = useState({});
  const [stageOrder, setStageOrder] = useState([]);
  const [draggedStageId, setDraggedStageId] = useState(null);
  const stageOrderRef = useRef([]);
  const selectedNodeSnapshot = selected?.node ? JSON.stringify(selected.node) : '';
  const selectedSubprocessStageIds =
    selected?.kind === 'subprocess' ? (selected.node?.stages ?? []).map((stage) => String(stage.dbId)).join('|') : '';

  useEffect(() => {
    setDraft(selected?.node ?? {});
  }, [selectedNodeId, selectedNodeSnapshot]);

  useEffect(() => {
    if (selected?.kind !== 'subprocess') {
      setStageOrder([]);
      stageOrderRef.current = [];
      setDraggedStageId(null);
      return;
    }

    const nextStageOrder = (selected.node?.stages ?? []).map((stage) => String(stage.dbId));
    setStageOrder(nextStageOrder);
    stageOrderRef.current = nextStageOrder;
    setDraggedStageId(null);
  }, [selectedNodeId, selected?.kind, selectedSubprocessStageIds]);

  if (!selected) {
    return null;
  }

  const save = () => {
    if (selected.kind === 'process') {
      onSave({
        id: draft.id ?? '',
        description: draft.description ?? '',
        disabled: draft.disabled ?? false,
        contextCode: normalizeReferenceDraft(draft.contextCode),
      });
      return;
    }

    if (selected.kind === 'subprocess') {
      onSave({
        id: draft.id ?? '',
        description: draft.description ?? '',
        disabled: draft.disabled ?? false,
        contextCode: normalizeReferenceDraft(draft.contextCode),
        trigger: draft.trigger ?? { rule: '' },
      });
      return;
    }

    if (selected.kind === 'stage') {
      onSave({
        id: draft.id ?? false,
        executor: draft.executor ?? '',
        description: draft.description ?? '',
        contextCode: normalizeReferenceDraft(draft.contextCode),
        log: draft.log ?? { journalServiceName: '' },
        configurator: draft.configurator ?? null,
      });
      return;
    }

    onSave(draft);
  };
  const orderedStages =
    selected.kind === 'subprocess'
      ? stageOrder
          .map((stageId) => (selected.node?.stages ?? []).find((stage) => String(stage.dbId) === stageId))
          .filter(Boolean)
      : [];

  const handlePointerDown = (stageId) => {
    setDraggedStageId(stageId);
  };

  const handlePointerEnter = (targetStageId) => {
    if (!draggedStageId || draggedStageId === targetStageId) {
      return;
    }

    const currentOrder = stageOrderRef.current;
    const fromIndex = currentOrder.indexOf(draggedStageId);
    const toIndex = currentOrder.indexOf(targetStageId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
      return;
    }

    const nextOrder = reorderItems(currentOrder, fromIndex, toIndex);
    stageOrderRef.current = nextOrder;
    setStageOrder(nextOrder);
  };

  const handlePointerUp = async () => {
    const nextStageOrder = [...stageOrderRef.current];
    setDraggedStageId(null);

    if (selected.kind !== 'subprocess' || !selected.node?.dbId) {
      return;
    }

    if (nextStageOrder.join('|') === selectedSubprocessStageIds) {
      return;
    }

    await onReorderStages(String(selected.node.dbId), nextStageOrder);
  };

  const updateDraftPath = (path, value) => {
    setDraft((current) => updateNestedValue(current, path, value));
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
      <CardTitle>Свойства: {selected.kind}</CardTitle>
      <CardBody>
        <Form>
          {(selected.kind === 'process' || selected.kind === 'subprocess') && (
            <>
              <FormGroup label="Код" fieldId="node-code">
                <TextInput
                  id="node-code"
                  value={draft.id ?? ''}
                  onChange={(_, value) => setDraft((current) => ({ ...current, id: value }))}
                />
              </FormGroup>
              <FormGroup label="Context code" fieldId="node-context-code">
                <select
                  id="node-context-code"
                  className="process-select"
                  value={draft.contextCode?.code ?? ''}
                  onChange={(event) => updateDraftPath(['contextCode', 'code'], event.target.value)}
                >
                  <option value="">Выберите context code</option>
                  {contextCodeOptions.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </FormGroup>
            </>
          )}

          {selected.kind === 'stage' && (
            <>
              <FormGroup label="Stage enabled flag" fieldId="stage-id-flag">
                <Checkbox
                  id="stage-id-flag"
                  isChecked={Boolean(draft.id)}
                  onChange={(_, checked) => setDraft((current) => ({ ...current, id: checked }))}
                  label="id"
                />
              </FormGroup>
              <FormGroup label="Executor" fieldId="stage-executor">
                <TextInput
                  id="stage-executor"
                  value={draft.executor ?? ''}
                  onChange={(_, value) => setDraft((current) => ({ ...current, executor: value }))}
                />
              </FormGroup>
              <FormGroup label="Context code" fieldId="stage-context-code">
                <select
                  id="stage-context-code"
                  className="process-select"
                  value={draft.contextCode?.code ?? ''}
                  onChange={(event) => updateDraftPath(['contextCode', 'code'], event.target.value)}
                >
                  <option value="">Выберите context code</option>
                  {contextCodeOptions.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </FormGroup>
              <div className="stage-editor-section">
                <Title headingLevel="h4">Stage log</Title>
                <FormGroup label="Journal service name" fieldId="stage-log-journal">
                  <TextInput
                    id="stage-log-journal"
                    value={draft.log?.journalServiceName ?? ''}
                    onChange={(_, value) => updateDraftPath(['log', 'journalServiceName'], value)}
                  />
                </FormGroup>
              </div>
              <div className="stage-editor-section">
                <Title headingLevel="h4">Configurator</Title>
                <div className="stage-editor-grid">
                  <Checkbox
                    id="stage-configurator-disabled"
                    isChecked={Boolean(draft.configurator?.disabled)}
                    onChange={(_, checked) => updateDraftPath(['configurator', 'disabled'], checked)}
                    label="Disabled"
                  />
                  <Checkbox
                    id="stage-configurator-interrupted"
                    isChecked={Boolean(draft.configurator?.interrupted)}
                    onChange={(_, checked) => updateDraftPath(['configurator', 'interrupted'], checked)}
                    label="Interrupted"
                  />
                  <Checkbox
                    id="stage-configurator-multiple"
                    isChecked={Boolean(draft.configurator?.multiple)}
                    onChange={(_, checked) => updateDraftPath(['configurator', 'multiple'], checked)}
                    label="Multiple"
                  />
                </div>
                <FormGroup label="Filter event rule" fieldId="stage-filter-event-rule">
                  <TextInput
                    id="stage-filter-event-rule"
                    value={draft.configurator?.filterEventRule ?? ''}
                    onChange={(_, value) => updateDraftPath(['configurator', 'filterEventRule'], value)}
                  />
                </FormGroup>
                <div className="stage-editor-subsection">
                  <Title headingLevel="h5">Audit</Title>
                  <div className="stage-editor-grid">
                    <Checkbox
                      id="stage-audit-enabled"
                      isChecked={Boolean(draft.configurator?.audit?.enabled)}
                      onChange={(_, checked) => updateDraftPath(['configurator', 'audit', 'enabled'], checked)}
                      label="Enabled"
                    />
                  </div>
                  <FormGroup label="Event code" fieldId="stage-audit-event-code">
                    <TextInput
                      id="stage-audit-event-code"
                      value={draft.configurator?.audit?.eventCode ?? ''}
                      onChange={(_, value) => updateDraftPath(['configurator', 'audit', 'eventCode'], value)}
                    />
                  </FormGroup>
                  <FormGroup label="Event description" fieldId="stage-audit-event-description">
                    <TextInput
                      id="stage-audit-event-description"
                      value={draft.configurator?.audit?.eventDescription ?? ''}
                      onChange={(_, value) => updateDraftPath(['configurator', 'audit', 'eventDescription'], value)}
                    />
                  </FormGroup>
                </div>
                <div className="stage-editor-subsection">
                  <div className="stage-editor-inline-header">
                    <Title headingLevel="h5">Results</Title>
                    <Button variant="secondary" onClick={() => addDraftArrayItem(['configurator', 'result'], createDefaultResult())}>
                      Добавить result
                    </Button>
                  </div>
                  {(draft.configurator?.result ?? []).map((result, resultIndex) => (
                    <Card key={result.dbId ?? `result-${resultIndex}`} className="stage-editor-card">
                      <CardTitle>
                        <div className="stage-editor-inline-header">
                          <span>Result {resultIndex + 1}</span>
                          <Button variant="link" onClick={() => removeDraftArrayItem(['configurator', 'result'], resultIndex)}>
                            Удалить
                          </Button>
                        </div>
                      </CardTitle>
                      <CardBody>
                        <FormGroup label="Input scenarios" fieldId={`result-input-scenarios-${resultIndex}`}>
                          <TextArea
                            id={`result-input-scenarios-${resultIndex}`}
                            value={(result.inputScenarios ?? []).join('\n')}
                            onChange={(_, value) =>
                              updateDraftArrayItem(['configurator', 'result'], resultIndex, (currentResult) => ({
                                ...currentResult,
                                inputScenarios: value
                                  .split('\n')
                                  .map((item) => item.trim())
                                  .filter(Boolean),
                              }))
                            }
                            resizeOrientation="vertical"
                          />
                        </FormGroup>
                        <div className="stage-editor-subsection">
                          <div className="stage-editor-inline-header">
                            <Title headingLevel="h6">Reverse</Title>
                            <Button
                              variant="secondary"
                              onClick={() =>
                                updateDraftArrayItem(['configurator', 'result'], resultIndex, (currentResult) => ({
                                  ...currentResult,
                                  reverse: [...(currentResult.reverse ?? []), createDefaultReverse()],
                                }))
                              }
                            >
                              Добавить reverse
                            </Button>
                          </div>
                          {(result.reverse ?? []).map((reverse, reverseIndex) => (
                            <Card key={reverse.dbId ?? `reverse-${resultIndex}-${reverseIndex}`} className="stage-editor-card">
                              <CardTitle>
                                <div className="stage-editor-inline-header">
                                  <span>Reverse {reverseIndex + 1}</span>
                                  <Button
                                    variant="link"
                                    onClick={() =>
                                      updateDraftArrayItem(['configurator', 'result'], resultIndex, (currentResult) => ({
                                        ...currentResult,
                                        reverse: (currentResult.reverse ?? []).filter((_, itemIndex) => itemIndex !== reverseIndex),
                                      }))
                                    }
                                  >
                                    Удалить
                                  </Button>
                                </div>
                              </CardTitle>
                              <CardBody>
                                <FormGroup label="Status code" fieldId={`reverse-status-${resultIndex}-${reverseIndex}`}>
                                  <TextInput
                                    id={`reverse-status-${resultIndex}-${reverseIndex}`}
                                    value={reverse.status?.code ?? ''}
                                    onChange={(_, value) =>
                                      updateDraftArrayItem(['configurator', 'result'], resultIndex, (currentResult) => ({
                                        ...currentResult,
                                        reverse: updateItemAt(currentResult.reverse ?? [], reverseIndex, (currentReverse) => ({
                                          ...currentReverse,
                                          status: {
                                            ...(currentReverse.status ?? {}),
                                            code: value,
                                          },
                                        })),
                                      }))
                                    }
                                  />
                                </FormGroup>
                                <div className="stage-editor-subsection">
                                  <div className="stage-editor-inline-header">
                                    <Title headingLevel="h6">Output</Title>
                                    <Button
                                      variant="secondary"
                                      onClick={() =>
                                        updateDraftArrayItem(['configurator', 'result'], resultIndex, (currentResult) => ({
                                          ...currentResult,
                                          reverse: updateItemAt(currentResult.reverse ?? [], reverseIndex, (currentReverse) => ({
                                            ...currentReverse,
                                            output: [...(currentReverse.output ?? []), createDefaultOutput()],
                                          })),
                                        }))
                                      }
                                    >
                                      Добавить output
                                    </Button>
                                  </div>
                                  {(reverse.output ?? []).map((output, outputIndex) => (
                                    <Card
                                      key={output.dbId ?? `output-${resultIndex}-${reverseIndex}-${outputIndex}`}
                                      className="stage-editor-card"
                                    >
                                      <CardTitle>
                                        <div className="stage-editor-inline-header">
                                          <span>Output {outputIndex + 1}</span>
                                          <Button
                                            variant="link"
                                            onClick={() =>
                                              updateDraftArrayItem(['configurator', 'result'], resultIndex, (currentResult) => ({
                                                ...currentResult,
                                                reverse: updateItemAt(
                                                  currentResult.reverse ?? [],
                                                  reverseIndex,
                                                  (currentReverse) => ({
                                                    ...currentReverse,
                                                    output: (currentReverse.output ?? []).filter(
                                                      (_, itemIndex) => itemIndex !== outputIndex,
                                                    ),
                                                  }),
                                                ),
                                              }))
                                            }
                                          >
                                            Удалить
                                          </Button>
                                        </div>
                                      </CardTitle>
                                      <CardBody>
                                        <FormGroup label="Phase code" fieldId={`output-phase-${resultIndex}-${reverseIndex}-${outputIndex}`}>
                                          <TextInput
                                            id={`output-phase-${resultIndex}-${reverseIndex}-${outputIndex}`}
                                            value={output.phase?.code ?? ''}
                                            onChange={(_, value) =>
                                              updateDraftArrayItem(['configurator', 'result'], resultIndex, (currentResult) => ({
                                                ...currentResult,
                                                reverse: updateItemAt(currentResult.reverse ?? [], reverseIndex, (currentReverse) => ({
                                                  ...currentReverse,
                                                  output: updateItemAt(currentReverse.output ?? [], outputIndex, (currentOutput) => ({
                                                    ...currentOutput,
                                                    phase: {
                                                      ...(currentOutput.phase ?? {}),
                                                      code: value,
                                                    },
                                                  })),
                                                })),
                                              }))
                                            }
                                          />
                                        </FormGroup>
                                        <FormGroup label="Name" fieldId={`output-name-${resultIndex}-${reverseIndex}-${outputIndex}`}>
                                          <TextInput
                                            id={`output-name-${resultIndex}-${reverseIndex}-${outputIndex}`}
                                            value={output.name ?? ''}
                                            onChange={(_, value) =>
                                              updateDraftArrayItem(['configurator', 'result'], resultIndex, (currentResult) => ({
                                                ...currentResult,
                                                reverse: updateItemAt(currentResult.reverse ?? [], reverseIndex, (currentReverse) => ({
                                                  ...currentReverse,
                                                  output: updateItemAt(currentReverse.output ?? [], outputIndex, (currentOutput) => ({
                                                    ...currentOutput,
                                                    name: value,
                                                  })),
                                                })),
                                              }))
                                            }
                                          />
                                        </FormGroup>
                                        <FormGroup label="Rule" fieldId={`output-rule-${resultIndex}-${reverseIndex}-${outputIndex}`}>
                                          <TextInput
                                            id={`output-rule-${resultIndex}-${reverseIndex}-${outputIndex}`}
                                            value={output.rule ?? ''}
                                            onChange={(_, value) =>
                                              updateDraftArrayItem(['configurator', 'result'], resultIndex, (currentResult) => ({
                                                ...currentResult,
                                                reverse: updateItemAt(currentResult.reverse ?? [], reverseIndex, (currentReverse) => ({
                                                  ...currentReverse,
                                                  output: updateItemAt(currentReverse.output ?? [], outputIndex, (currentOutput) => ({
                                                    ...currentOutput,
                                                    rule: value,
                                                  })),
                                                })),
                                              }))
                                            }
                                          />
                                        </FormGroup>
                                        <div className="stage-editor-subsection">
                                          <Title headingLevel="h6">Body</Title>
                                          <FormGroup label="Body type" fieldId={`output-body-type-${resultIndex}-${reverseIndex}-${outputIndex}`}>
                                            <TextInput
                                              id={`output-body-type-${resultIndex}-${reverseIndex}-${outputIndex}`}
                                              value={output.body?.type ?? ''}
                                              onChange={(_, value) =>
                                                updateDraftArrayItem(['configurator', 'result'], resultIndex, (currentResult) => ({
                                                  ...currentResult,
                                                  reverse: updateItemAt(
                                                    currentResult.reverse ?? [],
                                                    reverseIndex,
                                                    (currentReverse) => ({
                                                      ...currentReverse,
                                                      output: updateItemAt(
                                                        currentReverse.output ?? [],
                                                        outputIndex,
                                                        (currentOutput) => ({
                                                          ...currentOutput,
                                                          body: {
                                                            ...(currentOutput.body ?? {}),
                                                            type: value,
                                                          },
                                                        }),
                                                      ),
                                                    }),
                                                  ),
                                                }))
                                              }
                                            />
                                          </FormGroup>
                                          <FormGroup
                                            label="Event object type"
                                            fieldId={`output-event-object-type-${resultIndex}-${reverseIndex}-${outputIndex}`}
                                          >
                                            <TextInput
                                              id={`output-event-object-type-${resultIndex}-${reverseIndex}-${outputIndex}`}
                                              value={output.body?.eventObject?.type ?? ''}
                                              onChange={(_, value) =>
                                                updateDraftArrayItem(['configurator', 'result'], resultIndex, (currentResult) => ({
                                                  ...currentResult,
                                                  reverse: updateItemAt(
                                                    currentResult.reverse ?? [],
                                                    reverseIndex,
                                                    (currentReverse) => ({
                                                      ...currentReverse,
                                                      output: updateItemAt(
                                                        currentReverse.output ?? [],
                                                        outputIndex,
                                                        (currentOutput) => ({
                                                          ...currentOutput,
                                                          body: {
                                                            ...(currentOutput.body ?? {}),
                                                            eventObject: {
                                                              ...(currentOutput.body?.eventObject ?? {}),
                                                              type: value,
                                                            },
                                                          },
                                                        }),
                                                      ),
                                                    }),
                                                  ),
                                                }))
                                              }
                                            />
                                          </FormGroup>
                                          <FormGroup label="Service scenario" fieldId={`output-service-scenario-${resultIndex}-${reverseIndex}-${outputIndex}`}>
                                            <TextInput
                                              id={`output-service-scenario-${resultIndex}-${reverseIndex}-${outputIndex}`}
                                              value={output.body?.service?.scenario ?? ''}
                                              onChange={(_, value) =>
                                                updateDraftArrayItem(['configurator', 'result'], resultIndex, (currentResult) => ({
                                                  ...currentResult,
                                                  reverse: updateItemAt(
                                                    currentResult.reverse ?? [],
                                                    reverseIndex,
                                                    (currentReverse) => ({
                                                      ...currentReverse,
                                                      output: updateItemAt(
                                                        currentReverse.output ?? [],
                                                        outputIndex,
                                                        (currentOutput) => ({
                                                          ...currentOutput,
                                                          body: {
                                                            ...(currentOutput.body ?? {}),
                                                            service: {
                                                              ...(currentOutput.body?.service ?? {}),
                                                              scenario: value,
                                                            },
                                                          },
                                                        }),
                                                      ),
                                                    }),
                                                  ),
                                                }))
                                              }
                                            />
                                          </FormGroup>
                                          <FormGroup label="Service status" fieldId={`output-service-status-${resultIndex}-${reverseIndex}-${outputIndex}`}>
                                            <TextInput
                                              id={`output-service-status-${resultIndex}-${reverseIndex}-${outputIndex}`}
                                              value={output.body?.service?.status ?? ''}
                                              onChange={(_, value) =>
                                                updateDraftArrayItem(['configurator', 'result'], resultIndex, (currentResult) => ({
                                                  ...currentResult,
                                                  reverse: updateItemAt(
                                                    currentResult.reverse ?? [],
                                                    reverseIndex,
                                                    (currentReverse) => ({
                                                      ...currentReverse,
                                                      output: updateItemAt(
                                                        currentReverse.output ?? [],
                                                        outputIndex,
                                                        (currentOutput) => ({
                                                          ...currentOutput,
                                                          body: {
                                                            ...(currentOutput.body ?? {}),
                                                            service: {
                                                              ...(currentOutput.body?.service ?? {}),
                                                              status: value,
                                                            },
                                                          },
                                                        }),
                                                      ),
                                                    }),
                                                  ),
                                                }))
                                              }
                                            />
                                          </FormGroup>
                                          <FormGroup label="SLA duration value" fieldId={`output-sla-duration-${resultIndex}-${reverseIndex}-${outputIndex}`}>
                                            <TextInput
                                              id={`output-sla-duration-${resultIndex}-${reverseIndex}-${outputIndex}`}
                                              value={output.body?.service?.sla?.durationValue ?? ''}
                                              onChange={(_, value) =>
                                                updateDraftArrayItem(['configurator', 'result'], resultIndex, (currentResult) => ({
                                                  ...currentResult,
                                                  reverse: updateItemAt(
                                                    currentResult.reverse ?? [],
                                                    reverseIndex,
                                                    (currentReverse) => ({
                                                      ...currentReverse,
                                                      output: updateItemAt(
                                                        currentReverse.output ?? [],
                                                        outputIndex,
                                                        (currentOutput) => ({
                                                          ...currentOutput,
                                                          body: {
                                                            ...(currentOutput.body ?? {}),
                                                            service: {
                                                              ...(currentOutput.body?.service ?? {}),
                                                              sla: {
                                                                ...(currentOutput.body?.service?.sla ?? {}),
                                                                durationValue: value,
                                                              },
                                                            },
                                                          },
                                                        }),
                                                      ),
                                                    }),
                                                  ),
                                                }))
                                              }
                                            />
                                          </FormGroup>
                                          <FormGroup
                                            label="SLA duration unit code"
                                            fieldId={`output-sla-duration-unit-${resultIndex}-${reverseIndex}-${outputIndex}`}
                                          >
                                            <TextInput
                                              id={`output-sla-duration-unit-${resultIndex}-${reverseIndex}-${outputIndex}`}
                                              value={output.body?.service?.sla?.durationUnit?.code ?? ''}
                                              onChange={(_, value) =>
                                                updateDraftArrayItem(['configurator', 'result'], resultIndex, (currentResult) => ({
                                                  ...currentResult,
                                                  reverse: updateItemAt(
                                                    currentResult.reverse ?? [],
                                                    reverseIndex,
                                                    (currentReverse) => ({
                                                      ...currentReverse,
                                                      output: updateItemAt(
                                                        currentReverse.output ?? [],
                                                        outputIndex,
                                                        (currentOutput) => ({
                                                          ...currentOutput,
                                                          body: {
                                                            ...(currentOutput.body ?? {}),
                                                            service: {
                                                              ...(currentOutput.body?.service ?? {}),
                                                              sla: {
                                                                ...(currentOutput.body?.service?.sla ?? {}),
                                                                durationUnit: {
                                                                  ...(currentOutput.body?.service?.sla?.durationUnit ?? {}),
                                                                  code: value,
                                                                },
                                                              },
                                                            },
                                                          },
                                                        }),
                                                      ),
                                                    }),
                                                  ),
                                                }))
                                              }
                                            />
                                          </FormGroup>
                                          <FormGroup label="SLA status code" fieldId={`output-sla-status-${resultIndex}-${reverseIndex}-${outputIndex}`}>
                                            <TextInput
                                              id={`output-sla-status-${resultIndex}-${reverseIndex}-${outputIndex}`}
                                              value={output.body?.service?.sla?.status?.code ?? ''}
                                              onChange={(_, value) =>
                                                updateDraftArrayItem(['configurator', 'result'], resultIndex, (currentResult) => ({
                                                  ...currentResult,
                                                  reverse: updateItemAt(
                                                    currentResult.reverse ?? [],
                                                    reverseIndex,
                                                    (currentReverse) => ({
                                                      ...currentReverse,
                                                      output: updateItemAt(
                                                        currentReverse.output ?? [],
                                                        outputIndex,
                                                        (currentOutput) => ({
                                                          ...currentOutput,
                                                          body: {
                                                            ...(currentOutput.body ?? {}),
                                                            service: {
                                                              ...(currentOutput.body?.service ?? {}),
                                                              sla: {
                                                                ...(currentOutput.body?.service?.sla ?? {}),
                                                                status: {
                                                                  ...(currentOutput.body?.service?.sla?.status ?? {}),
                                                                  code: value,
                                                                },
                                                              },
                                                            },
                                                          },
                                                        }),
                                                      ),
                                                    }),
                                                  ),
                                                }))
                                              }
                                            />
                                          </FormGroup>
                                        </div>
                                        <div className="stage-editor-subsection">
                                          <Title headingLevel="h6">Output log</Title>
                                          <FormGroup
                                            label="Journal service name"
                                            fieldId={`output-log-journal-${resultIndex}-${reverseIndex}-${outputIndex}`}
                                          >
                                            <TextInput
                                              id={`output-log-journal-${resultIndex}-${reverseIndex}-${outputIndex}`}
                                              value={output.log?.journalServiceName ?? ''}
                                              onChange={(_, value) =>
                                                updateDraftArrayItem(['configurator', 'result'], resultIndex, (currentResult) => ({
                                                  ...currentResult,
                                                  reverse: updateItemAt(
                                                    currentResult.reverse ?? [],
                                                    reverseIndex,
                                                    (currentReverse) => ({
                                                      ...currentReverse,
                                                      output: updateItemAt(
                                                        currentReverse.output ?? [],
                                                        outputIndex,
                                                        (currentOutput) => ({
                                                          ...currentOutput,
                                                          log: {
                                                            ...(currentOutput.log ?? {}),
                                                            journalServiceName: value,
                                                          },
                                                        }),
                                                      ),
                                                    }),
                                                  ),
                                                }))
                                              }
                                            />
                                          </FormGroup>
                                          <FormGroup label="Message" fieldId={`output-log-message-${resultIndex}-${reverseIndex}-${outputIndex}`}>
                                            <TextArea
                                              id={`output-log-message-${resultIndex}-${reverseIndex}-${outputIndex}`}
                                              value={output.log?.message ?? ''}
                                              onChange={(_, value) =>
                                                updateDraftArrayItem(['configurator', 'result'], resultIndex, (currentResult) => ({
                                                  ...currentResult,
                                                  reverse: updateItemAt(
                                                    currentResult.reverse ?? [],
                                                    reverseIndex,
                                                    (currentReverse) => ({
                                                      ...currentReverse,
                                                      output: updateItemAt(
                                                        currentReverse.output ?? [],
                                                        outputIndex,
                                                        (currentOutput) => ({
                                                          ...currentOutput,
                                                          log: {
                                                            ...(currentOutput.log ?? {}),
                                                            message: value,
                                                          },
                                                        }),
                                                      ),
                                                    }),
                                                  ),
                                                }))
                                              }
                                              resizeOrientation="vertical"
                                            />
                                          </FormGroup>
                                        </div>
                                      </CardBody>
                                    </Card>
                                  ))}
                                </div>
                              </CardBody>
                            </Card>
                          ))}
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            </>
          )}

          {selected.kind !== 'configurator' && (
            <FormGroup label="Описание" fieldId="node-description">
              <TextArea
                id="node-description"
                value={draft.description ?? ''}
                onChange={(_, value) => setDraft((current) => ({ ...current, description: value }))}
                resizeOrientation="vertical"
              />
            </FormGroup>
          )}

          {selected.kind === 'subprocess' && (
            <FormGroup label="Trigger rule" fieldId="subprocess-trigger">
              <TextInput
                id="subprocess-trigger"
                value={draft.trigger?.rule ?? ''}
                onChange={(_, value) =>
                  setDraft((current) => ({
                    ...current,
                    trigger: {
                      ...(current.trigger ?? {}),
                      rule: value,
                    },
                  }))
                }
              />
            </FormGroup>
          )}

          {selected.kind === 'subprocess' && (
            <div className="stage-order-panel">
              <div className="stage-order-panel__header">
                <Title headingLevel="h4">Порядок stages</Title>
                <Text component="small">Перетащите stage. После отпускания порядок сохранится сразу.</Text>
              </div>
              <div className="stage-order-list">
                {orderedStages.map((stage, index) => {
                  const stageId = String(stage.dbId);
                  return (
                    <button
                      key={stageId}
                      type="button"
                      className={draggedStageId === stageId ? 'stage-order-item dragging' : 'stage-order-item'}
                      onPointerDown={() => handlePointerDown(stageId)}
                      onPointerEnter={() => handlePointerEnter(stageId)}
                      onPointerUp={handlePointerUp}
                      onPointerLeave={(event) => {
                        if (event.buttons === 0 && draggedStageId) {
                          handlePointerUp();
                        }
                      }}
                    >
                      <span className="stage-order-item__index">{index + 1}</span>
                      <span className="stage-order-item__content">
                        <strong>{stage.executor || 'stage'}</strong>
                        <small>{stage.description || 'Без описания'}</small>
                      </span>
                      <span className="stage-order-item__handle">::</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {selected.kind === 'configurator' && (
            <div className="stage-editor-section">
              <Title headingLevel="h4">Configurator</Title>
              <div className="stage-editor-grid">
                <Checkbox
                  id="configurator-disabled"
                  isChecked={Boolean(draft.disabled)}
                  onChange={(_, checked) => updateDraftPath(['disabled'], checked)}
                  label="Disabled"
                />
                <Checkbox
                  id="configurator-interrupted"
                  isChecked={Boolean(draft.interrupted)}
                  onChange={(_, checked) => updateDraftPath(['interrupted'], checked)}
                  label="Interrupted"
                />
                <Checkbox
                  id="configurator-multiple"
                  isChecked={Boolean(draft.multiple)}
                  onChange={(_, checked) => updateDraftPath(['multiple'], checked)}
                  label="Multiple"
                />
              </div>
              <FormGroup label="Filter event rule" fieldId="configurator-filter-event-rule">
                <TextInput
                  id="configurator-filter-event-rule"
                  value={draft.filterEventRule ?? ''}
                  onChange={(_, value) => updateDraftPath(['filterEventRule'], value)}
                />
              </FormGroup>
              <div className="stage-editor-subsection">
                <Title headingLevel="h5">Audit</Title>
                <div className="stage-editor-grid">
                  <Checkbox
                    id="configurator-audit-enabled"
                    isChecked={Boolean(draft.audit?.enabled)}
                    onChange={(_, checked) => updateDraftPath(['audit', 'enabled'], checked)}
                    label="Enabled"
                  />
                </div>
                <FormGroup label="Event code" fieldId="configurator-audit-event-code">
                  <TextInput
                    id="configurator-audit-event-code"
                    value={draft.audit?.eventCode ?? ''}
                    onChange={(_, value) => updateDraftPath(['audit', 'eventCode'], value)}
                  />
                </FormGroup>
                <FormGroup label="Event description" fieldId="configurator-audit-event-description">
                  <TextInput
                    id="configurator-audit-event-description"
                    value={draft.audit?.eventDescription ?? ''}
                    onChange={(_, value) => updateDraftPath(['audit', 'eventDescription'], value)}
                  />
                </FormGroup>
              </div>
              <div className="stage-editor-subsection">
                <div className="stage-editor-inline-header">
                  <Title headingLevel="h5">Results</Title>
                  <Button variant="secondary" onClick={() => addDraftArrayItem(['result'], createDefaultResult())}>
                    Добавить result
                  </Button>
                </div>
                {(draft.result ?? []).map((result, resultIndex) => (
                  <Card key={result.dbId ?? `config-result-${resultIndex}`} className="stage-editor-card">
                    <CardTitle>
                      <div className="stage-editor-inline-header">
                        <span>Result {resultIndex + 1}</span>
                        <Button variant="link" onClick={() => removeDraftArrayItem(['result'], resultIndex)}>
                          Удалить
                        </Button>
                      </div>
                    </CardTitle>
                    <CardBody>
                      <FormGroup label="Input scenarios" fieldId={`config-result-input-scenarios-${resultIndex}`}>
                        <TextArea
                          id={`config-result-input-scenarios-${resultIndex}`}
                          value={(result.inputScenarios ?? []).join('\n')}
                          onChange={(_, value) =>
                            updateDraftArrayItem(['result'], resultIndex, (currentResult) => ({
                              ...currentResult,
                              inputScenarios: value
                                .split('\n')
                                .map((item) => item.trim())
                                .filter(Boolean),
                            }))
                          }
                          resizeOrientation="vertical"
                        />
                      </FormGroup>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div className="editor-actions">
            <Button onClick={save} isLoading={isSaving}>
              Сохранить изменения
            </Button>
            {selected.kind === 'process' && (
              <Button variant="secondary" onClick={onAddSubprocess} isLoading={isSaving}>
                Добавить subprocess
              </Button>
            )}
            {selected.kind === 'subprocess' && (
              <Button variant="secondary" onClick={onAddStage} isLoading={isSaving}>
                Добавить stage
              </Button>
            )}
          </div>
        </Form>
      </CardBody>
    </Card>
  );
}

export function App() {
  const { data, loading, error, refetch } = useQuery(PROCESS_FIELDS);
  const [createProcess, createState] = useMutation(CREATE_PROCESS, {
    fetchPolicy: 'no-cache',
  });
  const [updateProcess, updateState] = useMutation(UPDATE_PROCESS, {
    fetchPolicy: 'no-cache',
  });
  const [updateStageNode, updateStageState] = useMutation(UPDATE_STAGE_NODE, {
    fetchPolicy: 'no-cache',
  });
  const [form, setForm] = useState(EMPTY_PROCESS_FORM);
  const [selectedConfigId, setSelectedConfigId] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [expandedNodeIds, setExpandedNodeIds] = useState([]);
  const [createErrorMessage, setCreateErrorMessage] = useState('');
  const [updateErrorMessage, setUpdateErrorMessage] = useState('');
  const [isTopologyFullscreen, setIsTopologyFullscreen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [localProcessConfig, setLocalProcessConfig] = useState(null);
  const topologyContainerRef = useRef(null);

  const processConfigs = data?.processConfigList ?? [];
  const isInitialLoading = loading && processConfigs.length === 0;
  const processCodeOptions = (data?.contextCodesDictionaryList ?? []).map((item) => item.code).filter(Boolean);
  const serverActiveProcessConfig =
    processConfigs.find((item) => item.dbId === selectedConfigId) ?? processConfigs[0] ?? null;
  const activeProcessConfig =
    localProcessConfig?.dbId && localProcessConfig.dbId === serverActiveProcessConfig?.dbId
      ? localProcessConfig
      : serverActiveProcessConfig;

  useEffect(() => {
    if (!serverActiveProcessConfig) {
      setLocalProcessConfig(null);
      return;
    }

    setLocalProcessConfig((current) =>
      current?.dbId === serverActiveProcessConfig.dbId ? serverActiveProcessConfig : current
    );
  }, [serverActiveProcessConfig]);

  useEffect(() => {
    if (activeProcessConfig && activeProcessConfig.dbId !== selectedConfigId) {
      setSelectedConfigId(activeProcessConfig.dbId);
      setSelectedNodeId(activeProcessConfig.process?.dbId ? `process:${activeProcessConfig.process.dbId}` : null);
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
      const processNodeId = activeProcessConfig.process?.dbId ? `process:${activeProcessConfig.process.dbId}` : null;

      if (processNodeId && currentSet.size === 0) {
        return [processNodeId];
      }

      const validNodeIds = new Set();
      if (processNodeId) {
        validNodeIds.add(processNodeId);
      }
      (activeProcessConfig.process?.subprocess ?? []).forEach((subprocess) => {
        validNodeIds.add(`subprocess:${subprocess.dbId}`);
        (subprocess.stages ?? []).forEach((stage) => {
          validNodeIds.add(`stage:${stage.dbId}`);
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
    setIsEditorOpen(Boolean(findSelectedNode(activeProcessConfig, selectedNodeId)));
  }, [activeProcessConfig, selectedNodeId]);

  const saveProcessConfig = async (nextConfig) => {
    try {
      setUpdateErrorMessage('');
      setLocalProcessConfig(nextConfig);
      await updateProcess({
        variables: {
          id: nextConfig.dbId,
          input: serializeProcessConfig(nextConfig),
        },
      });
      refetch();
    } catch (mutationError) {
      setLocalProcessConfig(serverActiveProcessConfig);
      setUpdateErrorMessage(getErrorMessage(mutationError, 'Не удалось сохранить изменения процесса.'));
    }
  };

  const saveStageNode = async (nextConfig) => {
    if (!selectedNodeId?.startsWith('stage:')) {
      return;
    }

    const stageId = selectedNodeId.split(':')[1];
    const selectedStage = findSelectedNode(nextConfig, selectedNodeId)?.node;
    if (!selectedStage) {
      return;
    }

    try {
      setUpdateErrorMessage('');
      setLocalProcessConfig(nextConfig);
      await updateStageNode({
        variables: {
          id: stageId,
          input: serializeStage(selectedStage),
        },
      });
      refetch();
    } catch (mutationError) {
      setLocalProcessConfig(serverActiveProcessConfig);
      setUpdateErrorMessage(getErrorMessage(mutationError, 'Не удалось сохранить изменения stage.'));
    }
  };

  const handleCreateProcess = async (event) => {
    event.preventDefault();
    setCreateErrorMessage('');

    const input = {
      process: {
        id: form.code.trim(),
        description: form.description.trim(),
        disabled: false,
        contextCode: form.code.trim() ? { code: form.code.trim() } : null,
        subprocess: [],
      },
    };

    try {
      const response = await createProcess({
        variables: { input },
      });

      const created = response.data?.createProcessConfig;
      if (!created?.dbId) {
        setCreateErrorMessage('GraphQL не вернул созданный процесс. Проверьте backend-логи и схему мутации.');
        return;
      }

      setForm(EMPTY_PROCESS_FORM);
      await refetch();

      setSelectedConfigId(created.dbId);
      if (created.process?.dbId) {
        setSelectedNodeId(`process:${created.process.dbId}`);
      }
    } catch (mutationError) {
      setCreateErrorMessage(getErrorMessage(mutationError, 'Не удалось создать процесс.'));
    }
  };

  const handleSaveNode = async (values) => {
    if (!activeProcessConfig || !selectedNodeId) {
      return;
    }

    const nextConfig = updateSelectedNode(activeProcessConfig, selectedNodeId, values);
    if (selectedNodeId.startsWith('stage:')) {
      await saveStageNode(nextConfig);
      return;
    }
    await saveProcessConfig(nextConfig);
  };

  const handleAddSubprocess = async () => {
    if (!activeProcessConfig?.process) {
      return;
    }

    const nextConfig = {
      ...activeProcessConfig,
      process: {
        ...activeProcessConfig.process,
        subprocess: [
          ...(activeProcessConfig.process.subprocess ?? []),
          createDefaultSubprocess((activeProcessConfig.process.subprocess ?? []).length + 1),
        ],
      },
    };

    await saveProcessConfig(nextConfig);
    setExpandedNodeIds((current) => {
      const processNodeId = activeProcessConfig.process?.dbId ? `process:${activeProcessConfig.process.dbId}` : null;
      return processNodeId && !current.includes(processNodeId) ? [...current, processNodeId] : current;
    });
  };

  const handleAddStage = async () => {
    if (!activeProcessConfig?.process || !selectedNodeId?.startsWith('subprocess:')) {
      return;
    }

    const targetId = selectedNodeId.split(':')[1];
    const nextConfig = {
      ...activeProcessConfig,
      process: {
        ...activeProcessConfig.process,
        subprocess: (activeProcessConfig.process.subprocess ?? []).map((subprocess) =>
          String(subprocess.dbId) === targetId
            ? {
                ...subprocess,
                stages: [...(subprocess.stages ?? []), createDefaultStage((subprocess.stages ?? []).length + 1)],
              }
            : subprocess,
        ),
      },
    };

    await saveProcessConfig(nextConfig);
    setExpandedNodeIds((current) => (current.includes(selectedNodeId) ? current : [...current, selectedNodeId]));
  };

  const handleToggleNode = (nodeId) => {
    const [kind] = nodeId.split(':');
    if (kind === 'configurator') {
      return;
    }

    setExpandedNodeIds((current) =>
      current.includes(nodeId) ? current.filter((item) => item !== nodeId) : [...current, nodeId],
    );
  };

  const handleEditNode = (nodeId) => {
    setSelectedNodeId(nodeId);
    setIsEditorOpen(true);
  };

  const handleReorderSubprocessNode = (nodeId) => {
    setSelectedNodeId(nodeId);
    setIsEditorOpen(true);
  };

  const handleCloseEditor = () => {
    setIsEditorOpen(false);
    setSelectedNodeId(null);
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

  const handleReorderStages = async (subprocessId, nextStageOrder) => {
    if (!activeProcessConfig?.process) {
      return;
    }

    const nextConfig = {
      ...activeProcessConfig,
      process: {
        ...activeProcessConfig.process,
        subprocess: (activeProcessConfig.process.subprocess ?? []).map((subprocess) => {
          if (String(subprocess.dbId) !== subprocessId) {
            return subprocess;
          }

          const reorderedStages = nextStageOrder
            .map((stageId) => (subprocess.stages ?? []).find((stage) => String(stage.dbId) === stageId))
            .filter(Boolean);

          return {
            ...subprocess,
            stages: reorderedStages,
          };
        }),
      },
    };

    await saveProcessConfig(nextConfig);
  };

  return (
    <Page>
      <PageSection className="hero-section">
        <Title headingLevel="h1">Process Topology Editor</Title>
        <Text component="p">
          React frontend для проектирования процессов через topology graph и GraphQL проекта.
        </Text>
      </PageSection>

      <PageSection className="workspace-section">
        <Split hasGutter className="workspace-layout">
          <SplitItem isFilled={false} className="sidebar-column">
            <Card className="sidebar-card">
              <CardTitle>Новый процесс</CardTitle>
              <CardBody>
                <Form onSubmit={handleCreateProcess}>
                  <FormGroup label="Код процесса" fieldId="process-code">
                    <select
                      id="process-code"
                      className="process-select"
                      value={form.code}
                      onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                    >
                      <option value="">Выберите код процесса</option>
                      {processCodeOptions.map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                    </select>
                  </FormGroup>
                  <FormGroup label="Описание" fieldId="process-description">
                    <TextArea
                      id="process-description"
                      value={form.description}
                      onChange={(_, value) => setForm((current) => ({ ...current, description: value }))}
                      resizeOrientation="vertical"
                    />
                  </FormGroup>
                  <Button
                    type="submit"
                    isBlock
                    isLoading={createState.loading}
                    isDisabled={!form.code.trim() || processCodeOptions.length === 0}
                  >
                    Создать процесс
                  </Button>
                  {createErrorMessage && (
                    <Alert isInline variant="danger" title={createErrorMessage} className="form-alert" />
                  )}
                </Form>
              </CardBody>
            </Card>

            <Card className="sidebar-card">
              <CardTitle>Список процессов</CardTitle>
              <CardBody className="process-list">
                {processConfigs.map((processConfig) => (
                  <button
                    key={processConfig.dbId}
                    type="button"
                    className={processConfig.dbId === activeProcessConfig?.dbId ? 'process-chip active' : 'process-chip'}
                    onClick={() => {
                      setSelectedConfigId(processConfig.dbId);
                      if (processConfig.process?.dbId) {
                        setSelectedNodeId(`process:${processConfig.process.dbId}`);
                        setExpandedNodeIds(getDefaultExpandedNodeIds(processConfig));
                      }
                    }}
                  >
                    <span>{processConfig.process?.id || `process-${processConfig.dbId}`}</span>
                    <small>{processConfig.process?.description || 'Без описания'}</small>
                  </button>
                ))}
              </CardBody>
            </Card>
          </SplitItem>

          <SplitItem isFilled className="canvas-column">
            <div
              ref={topologyContainerRef}
              className={isTopologyFullscreen ? 'topology-shell topology-shell-fullscreen' : 'topology-shell'}
            >
              <Card className="canvas-card">
                <div className="canvas-card-header">
                  <CardTitle>Topology graph</CardTitle>
                  <Button variant="secondary" onClick={handleToggleTopologyFullscreen}>
                    {isTopologyFullscreen ? 'Свернуть экран' : 'На весь экран'}
                  </Button>
                </div>
                <CardBody className="canvas-card-body">
                  {isInitialLoading && (
                    <div className="loading-state">
                      <Spinner size="xl" />
                    </div>
                  )}

                  {error && !isInitialLoading && (
                    <EmptyState>
                      <Title headingLevel="h4">GraphQL недоступен</Title>
                      <EmptyStateBody>{error.message}</EmptyStateBody>
                      <EmptyStateFooter>
                        <Button onClick={() => refetch()}>Повторить запрос</Button>
                      </EmptyStateFooter>
                    </EmptyState>
                  )}

                  {!isInitialLoading && !error && !activeProcessConfig && (
                    <EmptyState>
                      <Title headingLevel="h4">Процессов пока нет</Title>
                      <EmptyStateBody>Создайте первый процесс слева, затем соберите дерево из subprocess и stage.</EmptyStateBody>
                    </EmptyState>
                  )}

                  {!isInitialLoading && !error && activeProcessConfig && (
                    <ProcessTopology
                      processConfig={activeProcessConfig}
                      selectedNodeId={selectedNodeId}
                    expandedNodeIds={expandedNodeIds}
                    onToggleNode={handleToggleNode}
                    onEditNode={handleEditNode}
                    onReorderSubprocessNode={handleReorderSubprocessNode}
                  />
                )}
                </CardBody>
              </Card>
            </div>
          </SplitItem>
        </Split>
      </PageSection>

      <div
        className={isEditorOpen ? 'editor-drawer-backdrop editor-drawer-backdrop-open' : 'editor-drawer-backdrop'}
        onClick={handleCloseEditor}
        aria-hidden={!isEditorOpen}
      />
      <aside className={isEditorOpen ? 'editor-drawer editor-drawer-open' : 'editor-drawer'} aria-hidden={!isEditorOpen}>
        <div className="editor-drawer__header">
          <Title headingLevel="h3">Свойства узла</Title>
          <Button variant="plain" onClick={handleCloseEditor} aria-label="Закрыть панель свойств">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="editor-drawer__close-icon">
              <path
                d="M18.3 5.71 12 12l6.3 6.29-1.41 1.41L10.59 13.41 4.29 19.7 2.88 18.29 9.17 12 2.88 5.71 4.29 4.3l6.3 6.29 6.29-6.3z"
                fill="currentColor"
              />
            </svg>
          </Button>
        </div>
        <div className="editor-drawer__body" onClick={(event) => event.stopPropagation()}>
          <NodeEditor
            processConfig={activeProcessConfig}
            selectedNodeId={selectedNodeId}
            onSave={handleSaveNode}
            onAddSubprocess={handleAddSubprocess}
            onAddStage={handleAddStage}
            onReorderStages={handleReorderStages}
            contextCodeOptions={processCodeOptions}
            isSaving={updateState.loading || updateStageState.loading}
          />
          {updateErrorMessage && (
            <Alert isInline variant="danger" title={updateErrorMessage} className="form-alert" />
          )}
        </div>
      </aside>
    </Page>
  );
}
