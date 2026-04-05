import { gql, useMutation, useQuery } from '@apollo/client';
import { CheckVerified02, Edit01, Plus, Rows01, Trash01, XCircle, XClose } from '@untitledui/icons';
import { useEffect, useRef, useState } from 'react';
import ReactFlow, {
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlowProvider,
} from 'reactflow';
import { ProcessSelectField } from './components/ProcessSelectField';

function cn(...values) {
  return values.filter(Boolean).join(' ');
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

function Alert({ title, className = '', variant = 'danger' }) {
  const variantClassName =
    variant === 'danger'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : 'border-slate-200 bg-slate-50 text-slate-700';

  return <div className={cn('rounded-2xl border px-4 py-3 text-sm', variantClassName, className)}>{title}</div>;
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

function JsonSnippetEditor({
  id,
  value,
  onChange,
  error,
  helperText,
}) {
  return (
    <div className="json-snippet">
      <textarea
        id={id}
        className="json-snippet__textarea"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {helperText && <p className="json-snippet__helper">{helperText}</p>}
      {error && <p className="json-snippet__error">{error}</p>}
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
    nodeName
    nodeComment
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
    id
    nodeName
    nodeComment
    status {
      code
    }
    output {
      ...ReverseOutputFields
    }
  }

  fragment ResultFields on Result {
    id
    nodeName
    nodeComment
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
    id
    nodeName
    nodeComment
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
    actionPhasesDictionaryList {
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
      process {
        id
        nodeName
        nodeComment
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
      id
      process {
        id
        nodeName
        nodeComment
        description
        disabled
        contextCode {
          code
        }
        subprocess {
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

const UPDATE_STAGE_NODE = gql`
  mutation UpdateStageNode($id: ID!, $input: StageInput!) {
    updateStageNode(id: $id, input: $input) {
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

const UPDATE_PROCESS_NODE = gql`
  mutation UpdateProcessNode($id: ID!, $input: ProcessInput!) {
    updateProcessNode(id: $id, input: $input) {
      id
      nodeName
      nodeComment
      description
      contextCode {
        code
      }
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

function createDefaultStage(index) {
  return {
    executor: `executor_${index}`,
    description: '',
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
  return processId ? [`process:${processId}`] : [];
}

function createDefaultSubprocess(index) {
  return {
    description: '',
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
      description: '',
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
      nodeName: result.nodeName ?? '',
      nodeComment: result.nodeComment ?? '',
      inputScenarios: result.inputScenarios ?? [],
      reverse: (result.reverse ?? []).map((reverse) => ({
        id: reverse.id ?? undefined,
        nodeName: reverse.nodeName ?? '',
        nodeComment: reverse.nodeComment ?? '',
        status: refInput(reverse.status),
        output: (reverse.output ?? []).map((output) => ({
          id: output.id ?? undefined,
          nodeName: output.nodeName ?? '',
          nodeComment: output.nodeComment ?? '',
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
    id: stage.id ?? undefined,
    executor: stage.executor ?? '',
    description: stage.description ?? '',
    nodeName: stage.nodeName ?? '',
    nodeComment: stage.nodeComment ?? '',
    contextCode: refInput(stage.contextCode),
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
    nodeName: output.nodeName ?? '',
    nodeComment: output.nodeComment ?? '',
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
      : {
          journalServiceName: '',
          message: '',
        },
  };
}

function serializeSubprocess(subprocess) {
  return {
    id: subprocess.id ?? undefined,
    description: subprocess.description ?? '',
    nodeName: subprocess.nodeName ?? '',
    nodeComment: subprocess.nodeComment ?? '',
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
          id: processConfig.process.id ?? undefined,
          description: processConfig.process.description ?? '',
          nodeName: processConfig.process.nodeName ?? '',
          nodeComment: processConfig.process.nodeComment ?? '',
          disabled: processConfig.process.disabled ?? false,
          contextCode: refInput(processConfig.process.contextCode),
          subprocess: (processConfig.process.subprocess ?? []).map(serializeSubprocess),
        }
      : null,
  };
}

const TOPOLOGY_NODE_WIDTH = 300;
const TOPOLOGY_NODE_HEIGHT = 136;
const TOPOLOGY_VERTICAL_GAP = 56;
const TOPOLOGY_HORIZONTAL_GAP = 128;
const REVERSE_OUTPUT_AUTOSAVE_DELAY_MS = 10_000;
const TOPOLOGY_TOP_PADDING = 32;
const TOPOLOGY_LEFT_PADDING = 48;
const TOPOLOGY_TITLE_CHARS_PER_LINE = 20;
const TOPOLOGY_SUBTITLE_CHARS_PER_LINE = 28;

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
    type: 'smoothstep',
    pathOptions: {
      borderRadius: 0,
      offset: 24,
    },
    animated: false,
    selectable: false,
    focusable: false,
    deletable: false,
    interactionWidth: 0,
    style: {
      stroke: '#1570ef',
      strokeWidth: 2.25,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 18,
      height: 18,
      color: '#1570ef',
    },
    ...extra,
  };
}

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
  return TOPOLOGY_NODE_HEIGHT;
}

function stackBranchHeight(items) {
  if (items.length === 0) {
    return 0;
  }

  return items.reduce((sum, item, index) => sum + item.branchHeight + (index < items.length - 1 ? TOPOLOGY_VERTICAL_GAP : 0), 0);
}

function getReverseOutputLayout(stage, resultIndex, reverseIndex, output, outputIndex) {
  const serviceSummary = [output.body?.service?.scenario, output.body?.service?.status].filter(Boolean).join(' / ');
  const slaSummary = [
    output.body?.service?.sla?.durationValue,
    output.body?.service?.sla?.durationUnit?.code,
    output.body?.service?.sla?.status?.code,
  ]
    .filter(Boolean)
    .join(' / ');
  const summaryItems = [
    { label: 'Body', value: output.body?.type || output.body?.eventObject?.type || 'not set' },
    { label: 'Service', value: serviceSummary || 'not set' },
    { label: 'SLA', value: slaSummary || 'not set' },
  ];
  const nodeHeight = 208;

  return {
    nodeId: getReverseOutputNodeId(stage.id, resultIndex, reverseIndex, outputIndex),
    title: output.nodeName || `reverseOutput_${outputIndex + 1}`,
    subtitle: output.nodeComment || output.rule || output.log?.message || 'добавьте комментарий',
    summaryItems,
    nodeHeight,
    branchHeight: nodeHeight,
  };
}

function getReverseLayout(stage, resultIndex, reverse, reverseIndex, expandedSet) {
  const nodeId = getReverseNodeId(stage.id, resultIndex, reverseIndex);
  const expanded = expandedSet.has(nodeId);
  const outputLayouts = expanded
    ? (reverse.output ?? []).map((output, outputIndex) => getReverseOutputLayout(stage, resultIndex, reverseIndex, output, outputIndex))
    : [];
  const nodeHeight = estimateNodeHeight({
    title: reverse.nodeName || `reverse_${reverseIndex + 1}`,
    subtitle: reverse.nodeComment || `${(reverse.output ?? []).length} output`,
    isExpandable: (reverse.output?.length ?? 0) > 0,
  });

  return {
    nodeId,
    expanded,
    title: reverse.nodeName || `reverse_${reverseIndex + 1}`,
    subtitle: reverse.nodeComment || `${(reverse.output ?? []).length} output`,
    nodeHeight,
    outputLayouts,
    branchHeight: Math.max(nodeHeight, stackBranchHeight(outputLayouts)),
  };
}

function getResultLayout(stage, result, resultIndex, expandedSet) {
  const nodeId = getResultNodeId(stage.id, resultIndex);
  const expanded = expandedSet.has(nodeId);
  const reverseLayouts = expanded
    ? (result.reverse ?? []).map((reverse, reverseIndex) => getReverseLayout(stage, resultIndex, reverse, reverseIndex, expandedSet))
    : [];
  const nodeHeight = estimateNodeHeight({
    title: result.nodeName || `result_${resultIndex + 1}`,
    subtitle: result.nodeComment || result.reverse?.[0]?.status?.code || 'добавьте комментарий',
    isExpandable: (result.reverse?.length ?? 0) > 0,
  });

  return {
    nodeId,
    expanded,
    title: result.nodeName || `result_${resultIndex + 1}`,
    subtitle: result.nodeComment || result.reverse?.[0]?.status?.code || 'добавьте комментарий',
    nodeHeight,
    reverseLayouts,
    branchHeight: Math.max(nodeHeight, stackBranchHeight(reverseLayouts)),
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
    subtitle: stage.nodeComment || stage.description || 'добавьте комментарий',
    isExpandable: (stage.configurator?.result?.length ?? 0) > 0,
  });

  return {
    nodeId,
    stage,
    expanded,
    nodeHeight,
    resultLayouts,
    branchHeight: Math.max(nodeHeight, stackBranchHeight(resultLayouts)),
  };
}

function getSubprocessLayout(subprocess, expandedSet) {
  const nodeId = `subprocess:${subprocess.id}`;
  const expanded = expandedSet.has(nodeId);
  const stageLayouts = expanded ? (subprocess.stages ?? []).map((stage) => getStageLayout(stage, expandedSet)) : [];
  const nodeHeight = estimateNodeHeight({
    title: subprocess.nodeName || 'subprocess',
    subtitle: subprocess.description || 'Подпроцесс',
    isExpandable: (subprocess.stages?.length ?? 0) > 0,
  });

  return {
    nodeId,
    subprocess,
    expanded,
    nodeHeight,
    stageLayouts,
    branchHeight: Math.max(nodeHeight, stackBranchHeight(stageLayouts)),
  };
}

function placeTopologyNode(nodes, nodeId, x, startY, nodeHeight, branchHeight, data) {
  const rawY = startY + Math.max(0, (branchHeight - nodeHeight) / 2);
  const y = Math.round(rawY / 8) * 8;
  nodes.push({
    id: nodeId,
    type: 'processNode',
    position: { x, y },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data,
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
    subtitle: processConfig.process.nodeComment || processConfig.process.description || 'Корневой процесс',
    isExpandable: (processConfig.process.subprocess?.length ?? 0) > 0,
  });
  const processBranchHeight = Math.max(processHeight, stackBranchHeight(subprocessLayouts));
  const columnStep = TOPOLOGY_NODE_WIDTH + TOPOLOGY_HORIZONTAL_GAP;
  const processX = TOPOLOGY_LEFT_PADDING;

  placeTopologyNode(nodes, processNodeId, processX, TOPOLOGY_TOP_PADDING, processHeight, processBranchHeight, {
    title: processConfig.process.nodeName || processConfig.process.contextCode?.code || 'process',
    kind: 'process',
    secondaryLabel: processConfig.process.nodeComment || processConfig.process.description || 'Корневой процесс',
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
        secondaryLabel: subprocessLayout.subprocess.nodeComment || subprocessLayout.subprocess.description || 'добавьте комментарий',
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
          title: stageLayout.stage.nodeName || stageLayout.stage.executor || 'stage',
          kind: 'stage',
          secondaryLabel: stageLayout.stage.nodeComment || stageLayout.stage.description || 'добавьте комментарий',
          isExpandable: (stageLayout.stage.configurator?.result?.length ?? 0) > 0,
          isExpanded: stageLayout.expanded,
        });
        edges.push(createTopologyEdge(`${subprocessLayout.nodeId}->${stageLayout.nodeId}`, subprocessLayout.nodeId, stageLayout.nodeId));

        if (stageLayout.expanded) {
          let currentResultY = currentStageY;
          stageLayout.resultLayouts.forEach((resultLayout, resultIndex) => {
              const resultX = stageX + columnStep;
              placeTopologyNode(nodes, resultLayout.nodeId, resultX, currentResultY, resultLayout.nodeHeight, resultLayout.branchHeight, {
                title: resultLayout.title,
                kind: 'result',
                secondaryLabel: resultLayout.subtitle,
                isExpandable: resultLayout.reverseLayouts.length > 0,
                isExpanded: resultLayout.expanded,
              });
              edges.push(createTopologyEdge(`${stageLayout.nodeId}->${resultLayout.nodeId}`, stageLayout.nodeId, resultLayout.nodeId));

              if (resultLayout.expanded) {
                let currentReverseY = currentResultY;
                resultLayout.reverseLayouts.forEach((reverseLayout, reverseIndex) => {
                  const reverseX = resultX + columnStep;
                  placeTopologyNode(nodes, reverseLayout.nodeId, reverseX, currentReverseY, reverseLayout.nodeHeight, reverseLayout.branchHeight, {
                    title: reverseLayout.title,
                    kind: 'reverse',
                    secondaryLabel: reverseLayout.subtitle,
                    isExpandable: reverseLayout.outputLayouts.length > 0,
                    isExpanded: reverseLayout.expanded,
                  });
                  edges.push(createTopologyEdge(`${resultLayout.nodeId}->${reverseLayout.nodeId}`, resultLayout.nodeId, reverseLayout.nodeId));

                  if (reverseLayout.expanded) {
                    let currentOutputY = currentReverseY;
                    reverseLayout.outputLayouts.forEach((outputLayout, outputIndex) => {
                      const outputX = reverseX + columnStep;
                      placeTopologyNode(nodes, outputLayout.nodeId, outputX, currentOutputY, outputLayout.nodeHeight, outputLayout.branchHeight, {
                        title: outputLayout.title,
                        kind: 'reverseOutput',
                        secondaryLabel: outputLayout.subtitle,
                        summaryItems: outputLayout.summaryItems,
                        nodeClassName: 'process-node--reverse-output',
                        nodeStyle: { width: 360 },
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
            String(stage.id) === targetId ? { ...stage, ...values } : stage,
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
                  description: values.description ?? stage.description,
                  configurator: {
                    ...(stage.configurator ?? {}),
                    ...Object.fromEntries(Object.entries(values).filter(([key]) => key !== 'description')),
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
          node: {
            ...(stage.configurator ?? {}),
            description: stage.description ?? '',
          },
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

function ProcessNode({ data, selected }) {
  const title = data?.title ?? 'node';
  const subtitle = data?.secondaryLabel ?? '';
  const kind = data?.kind ?? 'node';
  const summaryItems = data?.summaryItems ?? [];
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
  const deleteNode = (event) => {
    event.stopPropagation();
    data?.onDelete?.();
  };
  const addChildNode = (event) => {
    event.stopPropagation();
    data?.onAddChild?.();
  };

  return (
    <div className={cn('process-node', data?.nodeClassName, selected && 'selected')}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <button type="button" className="process-node__edit" onClick={editNode} aria-label="Edit node" title="Edit">
        <Edit01 aria-hidden className="process-node__edit-icon" size={18} />
      </button>
      {kind === 'subprocess' && (
        <button
          type="button"
          className="process-node__action process-node__action-order"
          onClick={reorderStages}
          aria-label="Change stage order"
          title="Change stage order"
        >
          <Rows01 aria-hidden className="process-node__edit-icon" size={18} />
        </button>
      )}
      {(kind === 'process' || kind === 'stage' || kind === 'result' || kind === 'reverse') && (
        <button
          type="button"
          className="process-node__action process-node__action-add"
          onClick={addChildNode}
          aria-label={
            kind === 'process'
              ? 'Add subprocess'
              : kind === 'stage'
                ? 'Add result'
                : kind === 'result'
                  ? 'Add reverse'
                  : 'Add reverse output'
          }
          title={
            kind === 'process'
              ? 'Add subprocess'
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
      <div className="process-node__kind">{kind}</div>
      <div className="process-node__title">{title}</div>
      <div className="process-node__subtitle">{subtitle || 'Без описания'}</div>
      {summaryItems.length > 0 && (
        <div className="process-node__summary">
          {summaryItems.map((item) => (
            <div key={`${item.label}-${item.value}`} className="process-node__summary-item">
              <div className="process-node__summary-label">{item.label}</div>
              <div className="process-node__summary-value">{item.value}</div>
            </div>
          ))}
        </div>
      )}
      {isExpandable && <div className="process-node__hint">{isExpanded ? 'Скрыть дочерние' : 'Показать дочерние'}</div>}
    </div>
  );
}

function ProcessTopology({
  processConfig,
  processConfigOptions,
  selectedProcessConfigId,
  selectedNodeId,
  expandedNodeIds,
  onToggleNode,
  onEditNode,
  onReorderSubprocessNode,
  onDeleteNode,
  onAddChildNode,
  onAddSubprocess,
  onCreateProcess,
  onSelectProcessConfig,
  onToggleFullscreen,
  isFullscreen,
  isCreateDisabled,
  isCreating,
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
              onReorder: node.data.kind === 'subprocess' ? () => onReorderSubprocessNode(node.id) : undefined,
              onDelete: () => onDeleteNode(node.id),
              onAddChild:
                node.data.kind === 'process'
                  ? () => onAddSubprocess()
                  : node.data.kind === 'stage' || node.data.kind === 'result' || node.data.kind === 'reverse'
                    ? () => onAddChildNode(node.id)
                  : undefined,
              canDelete: node.data.kind !== 'process',
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
  onBulkCreateResults,
  contextCodeOptions,
  phaseOptions,
  slaStatusOptions,
  isSaving,
}) {
  const selected = findSelectedNode(processConfig, selectedNodeId);
  const [draft, setDraft] = useState({});
  const [bulkResultInput, setBulkResultInput] = useState('');
  const [stageOrder, setStageOrder] = useState([]);
  const [draggedStageId, setDraggedStageId] = useState(null);
  const [subprocessTriggerText, setSubprocessTriggerText] = useState('');
  const [subprocessTriggerError, setSubprocessTriggerError] = useState('');
  const [subprocessTriggerStatus, setSubprocessTriggerStatus] = useState('valid');
  const draftRef = useRef({});
  const stageOrderRef = useRef([]);
  const reverseOutputAutosaveTimeoutRef = useRef(null);
  const selectedNodeSnapshot = selected?.node ? JSON.stringify(selected.node) : '';
  const selectedSubprocessStageIds =
    selected?.kind === 'subprocess' ? (selected.node?.stages ?? []).map((stage) => String(stage.id)).join('|') : '';

  useEffect(() => {
    setDraft(selected?.node ?? {});
    draftRef.current = selected?.node ?? {};
  }, [selectedNodeId, selectedNodeSnapshot]);

  useEffect(() => {
    setBulkResultInput('');
    if (reverseOutputAutosaveTimeoutRef.current) {
      clearTimeout(reverseOutputAutosaveTimeoutRef.current);
      reverseOutputAutosaveTimeoutRef.current = null;
    }
  }, [selectedNodeId]);

  useEffect(() => {
    return () => {
      if (reverseOutputAutosaveTimeoutRef.current) {
        clearTimeout(reverseOutputAutosaveTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (selected?.kind !== 'subprocess') {
      setStageOrder([]);
      stageOrderRef.current = [];
      setDraggedStageId(null);
      return;
    }

    const nextStageOrder = (selected.node?.stages ?? []).map((stage) => String(stage.id));
    setStageOrder(nextStageOrder);
    stageOrderRef.current = nextStageOrder;
    setDraggedStageId(null);
  }, [selectedNodeId, selected?.kind, selectedSubprocessStageIds]);

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

  if (!selected) {
    return null;
  }

  const save = () => {
    if (selected.kind === 'process') {
      onSave({
        description: draft.description ?? '',
        nodeName: draft.nodeName ?? '',
        nodeComment: draft.nodeComment ?? '',
        disabled: draft.disabled ?? false,
        contextCode: normalizeReferenceDraft(draft.contextCode),
      });
      return;
    }

    if (selected.kind === 'subprocess') {
      try {
        const rawTrigger = subprocessTriggerText.trim();
        const parsedTrigger = rawTrigger ? JSON.parse(rawTrigger) : {};
        setSubprocessTriggerError('');

        onSave({
          description: draft.description ?? '',
          nodeName: draft.nodeName ?? '',
          nodeComment: draft.nodeComment ?? '',
          disabled: draft.disabled ?? false,
          contextCode: normalizeReferenceDraft(draft.contextCode),
          trigger: {
            ...(draft.trigger ?? {}),
            rule: JSON.stringify(parsedTrigger, null, 2),
          },
        });
      } catch {
        setSubprocessTriggerError('Trigger rule должен быть валидным JSON.');
      }
      return;
    }

    if (selected.kind === 'stage') {
      onSave({
        executor: draft.executor ?? '',
        nodeName: draft.nodeName ?? '',
        nodeComment: draft.nodeComment ?? '',
        contextCode: normalizeReferenceDraft(draft.contextCode),
        log: draft.log ?? { journalServiceName: '' },
        configurator: draft.configurator ?? null,
      });
      return;
    }

    if (selected.kind === 'configurator') {
      onSave({
        disabled: draft.disabled ?? false,
        interrupted: draft.interrupted ?? true,
        multiple: draft.multiple ?? false,
        filterEventRule: draft.filterEventRule ?? '',
        audit: draft.audit ?? null,
        result: draft.result ?? [],
        description: draft.description ?? '',
      });
      return;
    }

    onSave(draft);
  };
  const orderedStages =
    selected.kind === 'subprocess'
      ? stageOrder
          .map((stageId) => (selected.node?.stages ?? []).find((stage) => String(stage.id) === stageId))
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

    if (selected.kind !== 'subprocess' || !selected.node?.id) {
      return;
    }

    if (nextStageOrder.join('|') === selectedSubprocessStageIds) {
      return;
    }

    await onReorderStages(String(selected.node.id), nextStageOrder);
  };

  const updateDraftPath = (path, value) => {
    setDraft((current) => updateNestedValue(current, path, value));
  };

  const scheduleReverseOutputSave = (nextDraft, delayMs = 0) => {
    if (selected.kind !== 'reverseOutput') {
      return;
    }

    if (reverseOutputAutosaveTimeoutRef.current) {
      clearTimeout(reverseOutputAutosaveTimeoutRef.current);
      reverseOutputAutosaveTimeoutRef.current = null;
    }

    if (delayMs > 0) {
      reverseOutputAutosaveTimeoutRef.current = window.setTimeout(() => {
        reverseOutputAutosaveTimeoutRef.current = null;
        onSave(nextDraft);
      }, delayMs);
      return;
    }

    onSave(nextDraft);
  };

  const updateReverseOutputDraft = (updater, delayMs = 0) => {
    const nextDraft = updater(draftRef.current);
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    scheduleReverseOutputSave(nextDraft, delayMs);
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
    nodeName: `result_${(selected?.stage?.configurator?.result ?? []).length + 1 || 1}`,
    nodeComment: 'добавьте комментарий',
    inputScenarios: [],
    reverse: [],
  });

  const createDefaultReverse = () => ({
    nodeName: 'reverse_1',
    nodeComment: 'добавьте комментарий',
    status: { code: '' },
    output: [],
  });

  const createDefaultOutput = () => ({
    nodeName: 'reverseOutput_1',
    nodeComment: 'добавьте комментарий',
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

  const editorTitle =
    selected.kind === 'subprocess'
      ? `Подпроцесс ${selected.node?.nodeName ?? ''}`.trim()
      : `Свойства: ${selected.kind}`;

  return (
    <Card className="editor-card">
      <CardTitle>{editorTitle}</CardTitle>
      <CardBody>
        <Form>
          {(selected.kind === 'process' || selected.kind === 'subprocess') && (
            <>
              {(selected.kind === 'process' || selected.kind === 'subprocess') && (
                <>
                  <FormGroup
                    label={selected.kind === 'subprocess' ? 'Название подпроцесса' : 'Node name'}
                    fieldId="process-node-name"
                  >
                    <TextInput
                      id="process-node-name"
                      value={draft.nodeName ?? ''}
                      onChange={(_, value) => setDraft((current) => ({ ...current, nodeName: value }))}
                    />
                    {selected.kind === 'subprocess' && (
                      <Text component="small">Название подпроцесса необходимо для визуальной идентификации</Text>
                    )}
                  </FormGroup>
                  <FormGroup
                    label={selected.kind === 'subprocess' ? 'Описание подпроцесса' : 'Node comment'}
                    fieldId="process-node-comment"
                  >
                    <TextArea
                      id="process-node-comment"
                      value={draft.nodeComment ?? ''}
                      onChange={(_, value) => setDraft((current) => ({ ...current, nodeComment: value }))}
                      resizeOrientation="vertical"
                    />
                    {selected.kind === 'subprocess' && (
                      <Text component="small">Название подпроцесса необходимо для описания назначения подпроцесса</Text>
                    )}
                  </FormGroup>
                </>
              )}
              <FormGroup
                label={selected.kind === 'subprocess' ? 'Код процесса' : 'Context code'}
                fieldId="node-context-code"
              >
                <ProcessSelectField
                  id="node-context-code"
                  value={draft.contextCode?.code ?? ''}
                  onChange={(next) => updateDraftPath(['contextCode', 'code'], next)}
                  options={contextCodeOptions}
                  placeholder="Выберите context code"
                />
                {selected.kind === 'subprocess' && (
                  <Text component="small">
                    Код процесса необязателен. Установить в случае необходимости использования в конкретной реализации
                    информации о коде процесса
                  </Text>
                )}
              </FormGroup>
            </>
          )}

          {selected.kind === 'stage' && (
            <>
              <FormGroup label="Executor" fieldId="stage-executor">
                <TextInput
                  id="stage-executor"
                  value={draft.executor ?? ''}
                  onChange={(_, value) => setDraft((current) => ({ ...current, executor: value }))}
                />
              </FormGroup>
              <FormGroup label="Node name" fieldId="stage-node-name">
                <TextInput
                  id="stage-node-name"
                  value={draft.nodeName ?? ''}
                  onChange={(_, value) => setDraft((current) => ({ ...current, nodeName: value }))}
                />
              </FormGroup>
              <FormGroup label="Node comment" fieldId="stage-node-comment">
                <TextArea
                  id="stage-node-comment"
                  value={draft.nodeComment ?? ''}
                  onChange={(_, value) => setDraft((current) => ({ ...current, nodeComment: value }))}
                  resizeOrientation="vertical"
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
                  </div>
                  <Text component="small">Result создаётся через `+` на node stage и редактируется как отдельный узел.</Text>
                  <FormGroup label="Массовое создание results" fieldId="bulk-results-create-stage">
                    <TextArea
                      id="bulk-results-create-stage"
                      value={bulkResultInput}
                      onChange={(_, value) => setBulkResultInput(value)}
                      placeholder={'Каждый result отделяйте пустой строкой.\nВнутри блока каждая строка станет inputScenario.'}
                      resizeOrientation="vertical"
                    />
                  </FormGroup>
                  <Button
                    variant="secondary"
                    isLoading={isSaving}
                    isDisabled={!bulkResultInput.trim()}
                    onClick={async () => {
                      const groups = bulkResultInput
                        .trim()
                        .split(/\n\s*\n/)
                        .map((group) => group.split('\n').map((item) => item.trim()).filter(Boolean))
                        .filter((group) => group.length > 0);

                      if (groups.length === 0) {
                        return;
                      }

                      await onBulkCreateResults(selectedNodeId, groups);
                      setBulkResultInput('');
                    }}
                  >
                    Создать results массово
                  </Button>
                </div>
              </div>
            </>
          )}

          {(selected.kind === 'process' || selected.kind === 'subprocess') && (
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
                helperText="Редактируйте JsonLogic правило запуска как JSON. Для выравнивания отступов используйте кнопку форматирования."
                error={subprocessTriggerError}
              />
              <div className="json-status-actions">
                <Button variant="secondary" onClick={handleFormatSubprocessTrigger}>
                  Форматировать JSON
                </Button>
              </div>
            </div>
          )}

          {selected.kind === 'subprocess' && (
            <div className="stage-order-panel">
              <div className="stage-order-panel__header">
                <Title headingLevel="h4">Порядок исполнения стадий</Title>
                <Text component="small">Перетащите стадию. После отпускания порядок сохранится сразу.</Text>
              </div>
              <div className="stage-order-list">
                {orderedStages.map((stage, index) => {
                  const stageId = String(stage.id);
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

          {selected.kind === 'result' && (
            <div className="stage-editor-section">
              <Title headingLevel="h4">Result</Title>
              <FormGroup label="Node name" fieldId="result-node-name">
                <TextInput
                  id="result-node-name"
                  value={draft.nodeName ?? ''}
                  onChange={(_, value) => setDraft((current) => ({ ...current, nodeName: value }))}
                />
              </FormGroup>
              <FormGroup label="Node comment" fieldId="result-node-comment">
                <TextArea
                  id="result-node-comment"
                  value={draft.nodeComment ?? ''}
                  onChange={(_, value) => setDraft((current) => ({ ...current, nodeComment: value }))}
                  resizeOrientation="vertical"
                />
              </FormGroup>
              <FormGroup label="Input scenarios" fieldId="result-input-scenarios">
                <TextArea
                  id="result-input-scenarios"
                  value={(draft.inputScenarios ?? []).join('\n')}
                  onChange={(_, value) =>
                    setDraft((current) => ({
                      ...current,
                      inputScenarios: value
                        .split('\n')
                        .map((item) => item.trim())
                        .filter(Boolean),
                    }))
                  }
                  resizeOrientation="vertical"
                />
              </FormGroup>
              <Text component="small">Для этого node сейчас отображается отдельное редактирование result. Reverse и output остаются в данных результата.</Text>
            </div>
          )}

          {selected.kind === 'reverse' && (
            <div className="stage-editor-section">
              <Title headingLevel="h4">Reverse</Title>
              <FormGroup label="Node name" fieldId="reverse-node-name">
                <TextInput
                  id="reverse-node-name"
                  value={draft.nodeName ?? ''}
                  onChange={(_, value) => setDraft((current) => ({ ...current, nodeName: value }))}
                />
              </FormGroup>
              <FormGroup label="Node comment" fieldId="reverse-node-comment">
                <TextArea
                  id="reverse-node-comment"
                  value={draft.nodeComment ?? ''}
                  onChange={(_, value) => setDraft((current) => ({ ...current, nodeComment: value }))}
                  resizeOrientation="vertical"
                />
              </FormGroup>
              <FormGroup label="STATUS" fieldId="reverse-status-code">
                <TextInput
                  id="reverse-status-code"
                  value={draft.status?.code ?? ''}
                  onChange={(_, value) =>
                    setDraft((current) => ({
                      ...current,
                      status: {
                        ...(current.status ?? {}),
                        code: value,
                      },
                    }))
                  }
                />
              </FormGroup>
            </div>
          )}

          {selected.kind === 'reverseOutput' && (
            <div className="stage-editor-section">
              <Title headingLevel="h4">ReverseOutput</Title>
              <FormGroup label="Node name" fieldId="reverse-output-node-name">
                <TextInput
                  id="reverse-output-node-name"
                  value={draft.nodeName ?? ''}
                  onChange={(_, value) =>
                    updateReverseOutputDraft((current) => ({ ...current, nodeName: value }), REVERSE_OUTPUT_AUTOSAVE_DELAY_MS)
                  }
                />
              </FormGroup>
              <FormGroup label="Node comment" fieldId="reverse-output-node-comment">
                <TextArea
                  id="reverse-output-node-comment"
                  value={draft.nodeComment ?? ''}
                  onChange={(_, value) =>
                    updateReverseOutputDraft((current) => ({ ...current, nodeComment: value }), REVERSE_OUTPUT_AUTOSAVE_DELAY_MS)
                  }
                  resizeOrientation="vertical"
                />
              </FormGroup>
              <FormGroup label="Phase" fieldId="reverse-output-phase">
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
                  placeholder="Выберите phase"
                />
              </FormGroup>
              <FormGroup label="Name" fieldId="reverse-output-name">
                <TextInput
                  id="reverse-output-name"
                  value={draft.name ?? ''}
                  onChange={(_, value) =>
                    updateReverseOutputDraft((current) => ({ ...current, name: value }), REVERSE_OUTPUT_AUTOSAVE_DELAY_MS)
                  }
                />
              </FormGroup>
              <FormGroup label="Rule" fieldId="reverse-output-rule">
                <TextInput
                  id="reverse-output-rule"
                  value={draft.rule ?? ''}
                  onChange={(_, value) =>
                    updateReverseOutputDraft((current) => ({ ...current, rule: value }), REVERSE_OUTPUT_AUTOSAVE_DELAY_MS)
                  }
                />
              </FormGroup>
              <div className="stage-editor-subsection">
                <Title headingLevel="h5">Body</Title>
                <FormGroup label="Body type" fieldId="reverse-output-body-type">
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
                      }), REVERSE_OUTPUT_AUTOSAVE_DELAY_MS)
                    }
                  />
                </FormGroup>
                <FormGroup label="Event object type" fieldId="reverse-output-event-object-type">
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
                      }), REVERSE_OUTPUT_AUTOSAVE_DELAY_MS)
                    }
                  />
                </FormGroup>
              </div>
              <div className="stage-editor-subsection">
                <Title headingLevel="h5">Service</Title>
                <FormGroup label="Service scenario" fieldId="reverse-output-service-scenario">
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
                      }), REVERSE_OUTPUT_AUTOSAVE_DELAY_MS)
                    }
                  />
                </FormGroup>
                <FormGroup label="Service status" fieldId="reverse-output-service-status">
                  <TextInput
                    id="reverse-output-service-status"
                    value={draft.body?.service?.status ?? ''}
                    onChange={(_, value) =>
                      updateReverseOutputDraft((current) => ({
                        ...current,
                        body: {
                          ...(current.body ?? {}),
                          service: {
                            ...(current.body?.service ?? {}),
                            status: value,
                          },
                        },
                      }), REVERSE_OUTPUT_AUTOSAVE_DELAY_MS)
                    }
                  />
                </FormGroup>
              </div>
              <div className="stage-editor-subsection">
                <Title headingLevel="h5">SLA</Title>
                <FormGroup label="SLA duration value" fieldId="reverse-output-sla-duration-value">
                  <TextInput
                    id="reverse-output-sla-duration-value"
                    value={draft.body?.service?.sla?.durationValue ?? ''}
                    onChange={(_, value) =>
                      updateReverseOutputDraft((current) => ({
                        ...current,
                        body: {
                          ...(current.body ?? {}),
                          service: {
                            ...(current.body?.service ?? {}),
                            sla: {
                              ...(current.body?.service?.sla ?? {}),
                              durationValue: value,
                            },
                          },
                        },
                      }), REVERSE_OUTPUT_AUTOSAVE_DELAY_MS)
                    }
                  />
                </FormGroup>
                <FormGroup label="SLA duration unit code" fieldId="reverse-output-sla-duration-unit">
                  <TextInput
                    id="reverse-output-sla-duration-unit"
                    value={draft.body?.service?.sla?.durationUnit?.code ?? ''}
                    onChange={(_, value) =>
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
                      }), REVERSE_OUTPUT_AUTOSAVE_DELAY_MS)
                    }
                  />
                </FormGroup>
                <FormGroup label="SLA status code" fieldId="reverse-output-sla-status">
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
                      }), REVERSE_OUTPUT_AUTOSAVE_DELAY_MS)
                    }
                    options={slaStatusOptions}
                    placeholder="Выберите SLA status"
                  />
                </FormGroup>
              </div>
              <div className="stage-editor-subsection">
                <Title headingLevel="h5">EventLog</Title>
                <FormGroup label="Journal service name" fieldId="reverse-output-log-journal">
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
                      }), REVERSE_OUTPUT_AUTOSAVE_DELAY_MS)
                    }
                  />
                </FormGroup>
                <FormGroup label="Message" fieldId="reverse-output-log-message">
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
                      }), REVERSE_OUTPUT_AUTOSAVE_DELAY_MS)
                    }
                    resizeOrientation="vertical"
                  />
                </FormGroup>
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
  const [updateSubprocessNode, updateSubprocessState] = useMutation(UPDATE_SUBPROCESS_NODE, {
    fetchPolicy: 'no-cache',
  });
  const [updateProcessNode, updateProcessNodeState] = useMutation(UPDATE_PROCESS_NODE, {
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
  const [expandedNodeIds, setExpandedNodeIds] = useState([]);
  const [createErrorMessage, setCreateErrorMessage] = useState('');
  const [updateErrorMessage, setUpdateErrorMessage] = useState('');
  const [isTopologyFullscreen, setIsTopologyFullscreen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [localProcessConfig, setLocalProcessConfig] = useState(null);
  const topologyContainerRef = useRef(null);

  const processConfigs = data?.processConfigList ?? [];
  const isInitialLoading = loading && processConfigs.length === 0;
  const phaseOptions = (data?.actionPhasesDictionaryList ?? []).map((item) => item.code).filter(Boolean);
  const slaStatusOptions = (data?.slaStatusDictionaryList ?? []).map((item) => item.code).filter(Boolean);
  const processCodeOptions = (data?.contextCodesDictionaryList ?? []).map((item) => item.code).filter(Boolean);
  const processConfigOptions = processConfigs.map((item) => ({
    value: item.id,
    label: item.process?.contextCode?.code || item.process?.nodeName || `Process ${item.id}`,
  }));
  const serverActiveProcessConfig =
    processConfigs.find((item) => item.id === selectedConfigId) ?? processConfigs[0] ?? null;
  const activeProcessConfig =
    localProcessConfig?.id && localProcessConfig.id === serverActiveProcessConfig?.id
      ? localProcessConfig
      : serverActiveProcessConfig;

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
    setIsEditorOpen(Boolean(findSelectedNode(activeProcessConfig, selectedNodeId)));
  }, [activeProcessConfig, selectedNodeId]);

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
          input: stripTypename(serializeStage(selectedStage)),
        },
      });
      refetch();
    } catch (mutationError) {
      setLocalProcessConfig(serverActiveProcessConfig);
      setUpdateErrorMessage(getErrorMessage(mutationError, 'Не удалось сохранить изменения stage.'));
    }
  };

  const saveSubprocessNode = async (nextConfig) => {
    if (!selectedNodeId?.startsWith('subprocess:')) {
      return;
    }

    const subprocessId = selectedNodeId.split(':')[1];
    const selectedSubprocess = findSelectedNode(nextConfig, selectedNodeId)?.node;
    if (!selectedSubprocess) {
      return;
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
    } catch (mutationError) {
      setLocalProcessConfig(serverActiveProcessConfig);
      setUpdateErrorMessage(getErrorMessage(mutationError, 'Не удалось сохранить изменения subprocess.'));
    }
  };

  const saveReverseNode = async (nextConfig) => {
    if (!selectedNodeId?.startsWith('reverse:')) {
      return;
    }

    const selectedReverse = findSelectedNode(nextConfig, selectedNodeId)?.node;
    if (!selectedReverse?.id) {
      return;
    }

    try {
      setUpdateErrorMessage('');
      setLocalProcessConfig(nextConfig);
      await updateReverseNode({
        variables: {
          id: selectedReverse.id,
          input: stripTypename({
            nodeName: selectedReverse.nodeName ?? '',
            nodeComment: selectedReverse.nodeComment ?? '',
            status: normalizeReferenceDraft(selectedReverse.status),
            output: (selectedReverse.output ?? []).map(serializeReverseOutput),
          }),
        },
      });
      await refetch();
    } catch (mutationError) {
      setLocalProcessConfig(serverActiveProcessConfig);
      setUpdateErrorMessage(getErrorMessage(mutationError, 'Не удалось сохранить reverse.'));
    }
  };

  const saveReverseOutputNode = async (nextConfig) => {
    if (!selectedNodeId?.startsWith('reverseOutput:')) {
      return;
    }

    const selectedOutput = findSelectedNode(nextConfig, selectedNodeId)?.node;
    if (!selectedOutput?.id) {
      return;
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
    } catch (mutationError) {
      setLocalProcessConfig(serverActiveProcessConfig);
      setUpdateErrorMessage(getErrorMessage(mutationError, 'Не удалось сохранить reverse output.'));
    }
  };

  const saveResultNode = async (nextConfig) => {
    if (!selectedNodeId?.startsWith('result:')) {
      return;
    }

    const selectedResult = findSelectedNode(nextConfig, selectedNodeId)?.node;
    if (!selectedResult?.id) {
      return;
    }

    try {
      setUpdateErrorMessage('');
      setLocalProcessConfig(nextConfig);
      await updateResultNode({
        variables: {
          id: selectedResult.id,
          input: stripTypename({
            nodeName: selectedResult.nodeName ?? '',
            nodeComment: selectedResult.nodeComment ?? '',
            inputScenarios: selectedResult.inputScenarios ?? [],
            reverse: (selectedResult.reverse ?? []).map((reverse) => ({
              id: reverse.id ?? undefined,
              nodeName: reverse.nodeName ?? '',
              nodeComment: reverse.nodeComment ?? '',
              status: normalizeReferenceDraft(reverse.status),
              output: (reverse.output ?? []).map(serializeReverseOutput),
            })),
          }),
        },
      });
      await refetch();
    } catch (mutationError) {
      setLocalProcessConfig(serverActiveProcessConfig);
      setUpdateErrorMessage(getErrorMessage(mutationError, 'Не удалось сохранить result.'));
    }
  };

  const saveProcessNode = async (nextConfig) => {
    if (!selectedNodeId?.startsWith('process:')) {
      return;
    }

    const processId = selectedNodeId.split(':')[1];
    const selectedProcess = findSelectedNode(nextConfig, selectedNodeId)?.node;
    if (!selectedProcess) {
      return;
    }

    try {
      setUpdateErrorMessage('');
      setLocalProcessConfig(nextConfig);
      await updateProcessNode({
        variables: {
          id: processId,
          input: stripTypename({
            description: selectedProcess.description ?? '',
            nodeName: selectedProcess.nodeName ?? '',
            nodeComment: selectedProcess.nodeComment ?? '',
            contextCode: normalizeReferenceDraft(selectedProcess.contextCode),
          }),
        },
      });
      refetch();
    } catch (mutationError) {
      setLocalProcessConfig(serverActiveProcessConfig);
      setUpdateErrorMessage(getErrorMessage(mutationError, 'Не удалось сохранить изменения process.'));
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
        setExpandedNodeIds(getDefaultExpandedNodeIds(created));
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
    if (selectedNodeId.startsWith('process:')) {
      await saveProcessNode(nextConfig);
      return;
    }
    if (selectedNodeId.startsWith('subprocess:')) {
      await saveSubprocessNode(nextConfig);
      return;
    }
    if (selectedNodeId.startsWith('result:')) {
      await saveResultNode(nextConfig);
      return;
    }
    if (selectedNodeId.startsWith('reverseOutput:')) {
      await saveReverseOutputNode(nextConfig);
      return;
    }
    if (selectedNodeId.startsWith('reverse:')) {
      await saveReverseNode(nextConfig);
      return;
    }
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
      const processNodeId = activeProcessConfig.process?.id ? `process:${activeProcessConfig.process.id}` : null;
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
          String(subprocess.id) === targetId
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

  const handleAddChildNode = async (nodeId) => {
    const [kind, rawId] = nodeId.split(':');
    try {
      setUpdateErrorMessage('');

      if (kind === 'stage') {
        const selectedStage = findSelectedNode(activeProcessConfig, nodeId);
        const configuratorId = selectedStage?.node?.configurator?.id;
        if (!configuratorId) {
          setUpdateErrorMessage('Не удалось определить configurator stage для создания result.');
          return;
        }

        await createResultNode({
          variables: {
            configuratorId,
            input: stripTypename({
              nodeName: `result_${(selectedStage?.node?.configurator?.result ?? []).length + 1}`,
              nodeComment: 'добавьте комментарий',
              inputScenarios: [],
              reverse: [],
            }),
          },
        });
      } else if (kind === 'result') {
        const selectedResult = findSelectedNode(activeProcessConfig, nodeId);
        const resultId = selectedResult?.node?.id;
        if (!resultId) {
          setUpdateErrorMessage('Не удалось определить result для создания reverse.');
          return;
        }

        await createReverseNode({
          variables: {
            resultId,
            input: stripTypename({
              nodeName: `reverse_${(selectedResult?.node?.reverse ?? []).length + 1}`,
              nodeComment: 'добавьте комментарий',
              status: { code: 'INITIATED' },
              output: [],
            }),
          },
        });
      } else if (kind === 'reverse') {
        const selectedReverse = findSelectedNode(activeProcessConfig, nodeId);
        const reverseId = selectedReverse?.node?.id;
        if (!reverseId) {
          setUpdateErrorMessage('Не удалось определить reverse для создания reverse output.');
          return;
        }

        await createReverseOutputNode({
          variables: {
            reverseId,
            input: stripTypename({
              nodeName: `reverseOutput_${(selectedReverse?.node?.output ?? []).length + 1}`,
              nodeComment: 'добавьте комментарий',
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
          kind === 'stage'
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

    const selectedStage = findSelectedNode(activeProcessConfig, nodeId);
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
                nodeName: `result_${(selectedStage?.node?.configurator?.result ?? []).length + index + 1}`,
                nodeComment: 'добавьте комментарий',
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
        const selectedResult = findSelectedNode(activeProcessConfig, nodeId);
        const resultId = selectedResult?.node?.id ?? extraId;
        if (!resultId) {
          throw new Error('Result id not found');
        }
        await deleteResultNode({ variables: { id: resultId } });
      } else if (kind === 'reverse') {
        const reverseId = findSelectedNode(activeProcessConfig, nodeId)?.node?.id;
        if (!reverseId) {
          throw new Error('Reverse id not found');
        }
        await deleteReverseNode({ variables: { id: reverseId } });
      } else if (kind === 'reverseOutput') {
        const reverseOutputId = findSelectedNode(activeProcessConfig, nodeId)?.node?.id;
        if (!reverseOutputId) {
          throw new Error('ReverseOutput id not found');
        }
        await deleteReverseOutputNode({ variables: { id: reverseOutputId } });
      } else {
        return;
      }

      setSelectedNodeId(null);
      setIsEditorOpen(false);
      await refetch();
    } catch (mutationError) {
      setUpdateErrorMessage(getErrorMessage(mutationError, 'Не удалось удалить узел.'));
    }
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

  const handleSelectProcessConfig = (configId) => {
    setSelectedConfigId(configId || null);
    setLocalProcessConfig(null);
    setUpdateErrorMessage('');
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

    await saveProcessConfig(nextConfig);
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
                <Title headingLevel="h4">Процесс пока не создан</Title>
                <EmptyStateBody>
                  Нажмите «Создать процесс», чтобы создать `ProcessConfig` и открыть `React Flow` для редактирования.
                </EmptyStateBody>
                <EmptyStateFooter>
                  <Button
                    onClick={handleCreateProcess}
                    isLoading={createState.loading}
                    isDisabled={processCodeOptions.length === 0}
                  >
                    Создать процесс
                  </Button>
                </EmptyStateFooter>
                {processCodeOptions.length === 0 && (
                  <EmptyStateBody>Нет доступных кодов процесса в справочнике `contextCodesDictionaryList`.</EmptyStateBody>
                )}
              </div>
            </EmptyState>
          )}

          {!isInitialLoading && !error && activeProcessConfig && (
            <ProcessTopology
              processConfig={activeProcessConfig}
              processConfigOptions={processConfigOptions}
              selectedProcessConfigId={activeProcessConfig?.id ?? ''}
              selectedNodeId={selectedNodeId}
              expandedNodeIds={expandedNodeIds}
              onToggleNode={handleToggleNode}
              onEditNode={handleEditNode}
              onReorderSubprocessNode={handleReorderSubprocessNode}
              onDeleteNode={handleDeleteNode}
              onAddChildNode={handleAddChildNode}
              onAddSubprocess={handleAddSubprocess}
              onCreateProcess={handleCreateProcess}
              onSelectProcessConfig={handleSelectProcessConfig}
              onToggleFullscreen={handleToggleTopologyFullscreen}
              isFullscreen={isTopologyFullscreen}
              isCreateDisabled={processCodeOptions.length === 0}
              isCreating={createState.loading}
            />
          )}

          {createErrorMessage && <Alert variant="danger" title={createErrorMessage} className="topology-stage__alert" />}

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
              <Title headingLevel="h3">Свойства узла</Title>
              <Button variant="plain" onClick={handleCloseEditor} aria-label="Закрыть панель свойств">
                <XClose aria-hidden className="editor-drawer__close-icon" size={16} />
              </Button>
            </div>
            <div className="editor-drawer__body">
              <NodeEditor
                processConfig={activeProcessConfig}
                selectedNodeId={selectedNodeId}
                onSave={handleSaveNode}
                onAddSubprocess={handleAddSubprocess}
                onAddStage={handleAddStage}
                onReorderStages={handleReorderStages}
                onBulkCreateResults={handleBulkCreateResults}
                contextCodeOptions={processCodeOptions}
                phaseOptions={phaseOptions}
                slaStatusOptions={slaStatusOptions}
                isSaving={
                  updateState.loading ||
                  updateStageState.loading ||
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
                  deleteReverseOutputState.loading
                }
              />
              {updateErrorMessage && (
                <Alert isInline variant="danger" title={updateErrorMessage} className="form-alert" />
              )}
            </div>
          </aside>
        </div>
      </div>
    </Page>
  );
}
