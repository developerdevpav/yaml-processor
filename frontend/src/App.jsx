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
import { useEffect, useState } from 'react';
import ReactFlow, {
  Background,
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
  const laneGap = 56;
  const processColumnX = 32;
  const subprocessColumnX = 352;
  const stageColumnX = 672;
  const stageColumnGap = 240;
  const stageRowGap = 136;
  const stagesPerRow = 2;
  const subprocessLayouts = (processConfig.process.subprocess ?? []).map((subprocess) => {
    const stageCount = subprocess.stages?.length ?? 0;
    const stageRows = Math.max(Math.ceil(stageCount / stagesPerRow), 1);
    const stageClusterHeight = nodeHeight + (stageRows - 1) * stageRowGap;
    const laneHeight = Math.max(nodeHeight, stageClusterHeight);

    return {
      subprocess,
      laneHeight,
      stageClusterHeight,
    };
  });
  const processNodeId = `process:${processConfig.process.dbId}`;
  const totalHeight =
    subprocessLayouts.reduce((sum, item) => sum + item.laneHeight, 0) +
    Math.max(subprocessLayouts.length - 1, 0) * laneGap;
  const processY = Math.max((totalHeight - nodeHeight) / 2, 32);

  nodes.push({
    id: processNodeId,
    type: 'processNode',
    position: { x: processColumnX, y: processY },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data: {
      title: processConfig.process.id || 'process',
      kind: 'process',
      secondaryLabel: processConfig.process.description || 'Корневой процесс',
      isExpandable: (processConfig.process.subprocess?.length ?? 0) > 0,
      isExpanded: expandedSet.has(processNodeId),
    },
  });

  let currentLaneY = 32;
  subprocessLayouts.forEach(({ subprocess, laneHeight, stageClusterHeight }) => {
    const subprocessNodeId = `subprocess:${subprocess.dbId}`;
    const subprocessY = currentLaneY + (laneHeight - nodeHeight) / 2;
    const stageClusterStartY = currentLaneY + (laneHeight - stageClusterHeight) / 2;
    const processExpanded = expandedSet.has(processNodeId);

    if (!processExpanded) {
      return;
    }

    nodes.push({
      id: subprocessNodeId,
      type: 'processNode',
      position: { x: subprocessColumnX, y: subprocessY },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
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
      currentLaneY += laneHeight + laneGap;
      return;
    }

    (subprocess.stages ?? []).forEach((stage, stageIndex) => {
      const stageNodeId = `stage:${stage.dbId}`;
      const stageColumn = stageIndex % stagesPerRow;
      const stageRow = Math.floor(stageIndex / stagesPerRow);
      const stageX = stageColumnX + stageColumn * stageColumnGap;
      const stageY = stageClusterStartY + stageRow * stageRowGap;
      nodes.push({
        id: stageNodeId,
        type: 'processNode',
        position: { x: stageX, y: stageY },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
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

    currentLaneY += laneHeight + laneGap;
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

  return (
    <div className={selected ? 'process-node selected' : 'process-node'}>
      <button type="button" className="process-node__edit" onClick={editNode}>
        Edit
      </button>
      <div className="process-node__kind">{kind}</div>
      <div className="process-node__title">{title}</div>
      <div className="process-node__subtitle">{subtitle || 'Без описания'}</div>
      {isExpandable && <div className="process-node__hint">{isExpanded ? 'Скрыть дочерние' : 'Показать дочерние'}</div>}
    </div>
  );
}

function ProcessTopology({ processConfig, selectedNodeId, expandedNodeIds, onToggleNode, onEditNode }) {
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
          <Background gap={24} size={1} color="rgba(19, 38, 58, 0.09)" />
          <Controls position="top-right" showInteractive={false} />
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  );
}

function NodeEditor({ processConfig, selectedNodeId, onSave, onAddSubprocess, onAddStage, isSaving }) {
  const selected = findSelectedNode(processConfig, selectedNodeId);
  const [draft, setDraft] = useState({});

  useEffect(() => {
    setDraft(selected?.node ?? {});
  }, [selectedNodeId, processConfig]);

  if (!selected) {
    return (
      <Card className="editor-card">
        <CardTitle>Свойства узла</CardTitle>
        <CardBody>Выберите узел на графе, чтобы редактировать процесс, subprocess или stage.</CardBody>
      </Card>
    );
  }

  const save = () => onSave(draft);

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

  const processConfigs = data?.processConfigList ?? [];
  const processCodeOptions = (data?.contextCodesDictionaryList ?? []).map((item) => item.code).filter(Boolean);
  const activeProcessConfig =
    processConfigs.find((item) => item.dbId === selectedConfigId) ?? processConfigs[0] ?? null;

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

  const saveProcessConfig = async (nextConfig) => {
    try {
      setUpdateErrorMessage('');
      await updateProcess({
        variables: {
          id: nextConfig.dbId,
          input: serializeProcessConfig(nextConfig),
        },
      });
      await refetch();
    } catch (mutationError) {
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
            <Card className="canvas-card">
              <CardTitle>Topology graph</CardTitle>
              <CardBody className="canvas-card-body">
                {loading && (
                  <div className="loading-state">
                    <Spinner size="xl" />
                  </div>
                )}

                {error && (
                  <EmptyState>
                    <Title headingLevel="h4">GraphQL недоступен</Title>
                    <EmptyStateBody>{error.message}</EmptyStateBody>
                    <EmptyStateFooter>
                      <Button onClick={() => refetch()}>Повторить запрос</Button>
                    </EmptyStateFooter>
                  </EmptyState>
                )}

                {!loading && !error && !activeProcessConfig && (
                  <EmptyState>
                    <Title headingLevel="h4">Процессов пока нет</Title>
                    <EmptyStateBody>Создайте первый процесс слева, затем соберите дерево из subprocess и stage.</EmptyStateBody>
                  </EmptyState>
                )}

                {!loading && !error && activeProcessConfig && (
                  <ProcessTopology
                    processConfig={activeProcessConfig}
                    selectedNodeId={selectedNodeId}
                    expandedNodeIds={expandedNodeIds}
                    onToggleNode={handleToggleNode}
                    onEditNode={handleEditNode}
                  />
                )}
              </CardBody>
            </Card>
          </SplitItem>

          <SplitItem isFilled={false} className="editor-column">
            <NodeEditor
              processConfig={activeProcessConfig}
              selectedNodeId={selectedNodeId}
              onSave={handleSaveNode}
              onAddSubprocess={handleAddSubprocess}
              onAddStage={handleAddStage}
              isSaving={updateState.loading}
            />
            {updateErrorMessage && (
              <Alert isInline variant="danger" title={updateErrorMessage} className="form-alert" />
            )}
          </SplitItem>
        </Split>
      </PageSection>
    </Page>
  );
}
