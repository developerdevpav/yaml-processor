import { gql, useMutation, useQuery } from '@apollo/client';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardTitle,
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

function buildTopologyModel(processConfig, expandedNodeIds = []) {
  const nodes = [];
  const edges = [];
  const expandedSet = new Set(expandedNodeIds);

  if (!processConfig?.process) {
    return { nodes, edges };
  }

  const nodeWidth = 220;
  const nodeHeight = 92;
  const columnGap = 56;
  const rowGap = 136;
  const processY = 32;
  const subprocessY = processY + rowGap;
  const subprocessLayouts = (processConfig.process.subprocess ?? []).map((subprocess) => {
    return {
      subprocess,
      laneWidth: nodeWidth,
    };
  });
  const processNodeId = `process:${processConfig.process.dbId}`;
  const totalWidth =
    subprocessLayouts.reduce((sum, item) => sum + item.laneWidth, 0) +
    Math.max(subprocessLayouts.length - 1, 0) * columnGap;
  const processX = Math.max((totalWidth - nodeWidth) / 2, 32);

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

  let currentLaneX = 32;
  subprocessLayouts.forEach(({ subprocess, laneWidth }) => {
    const subprocessNodeId = `subprocess:${subprocess.dbId}`;
    const subprocessX = currentLaneX + (laneWidth - nodeWidth) / 2;
    const processExpanded = expandedSet.has(processNodeId);

    if (!processExpanded) {
      return;
    }

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

    if (!expandedSet.has(subprocessNodeId)) {
      currentLaneX += laneWidth + columnGap;
      return;
    }

    (subprocess.stages ?? []).forEach((stage, stageIndex) => {
      const stageNodeId = `stage:${stage.dbId}`;
      const stageY = subprocessY + rowGap * (stageIndex + 1);
      nodes.push({
        id: stageNodeId,
        type: 'processNode',
        position: { x: subprocessX, y: stageY },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        data: {
          title: stage.executor || 'stage',
          kind: 'stage',
          secondaryLabel: stage.description || 'Stage',
          isExpandable: false,
          isExpanded: false,
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
    });

    currentLaneX += laneWidth + columnGap;
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

function NodeEditor({ processConfig, selectedNodeId, onSave, onAddSubprocess, onAddStage, onReorderStages, isSaving }) {
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

  const save = () => onSave(draft);
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

  return (
    <Card className="editor-card">
      <CardTitle>Свойства: {selected.kind}</CardTitle>
      <CardBody>
        <Form>
          {(selected.kind === 'process' || selected.kind === 'subprocess') && (
            <FormGroup label="Код" fieldId="node-code">
              <TextInput
                id="node-code"
                value={draft.id ?? ''}
                onChange={(_, value) => setDraft((current) => ({ ...current, id: value }))}
              />
            </FormGroup>
          )}

          {selected.kind === 'stage' && (
            <FormGroup label="Executor" fieldId="stage-executor">
              <TextInput
                id="stage-executor"
                value={draft.executor ?? ''}
                onChange={(_, value) => setDraft((current) => ({ ...current, executor: value }))}
              />
            </FormGroup>
          )}

          <FormGroup label="Описание" fieldId="node-description">
            <TextArea
              id="node-description"
              value={draft.description ?? ''}
              onChange={(_, value) => setDraft((current) => ({ ...current, description: value }))}
              resizeOrientation="vertical"
            />
          </FormGroup>

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
    if (kind === 'stage') {
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
            isSaving={updateState.loading}
          />
          {updateErrorMessage && (
            <Alert isInline variant="danger" title={updateErrorMessage} className="form-alert" />
          )}
        </div>
      </aside>
    </Page>
  );
}
