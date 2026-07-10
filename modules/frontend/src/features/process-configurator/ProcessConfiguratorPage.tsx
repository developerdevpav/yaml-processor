import { gql, useMutation, useQuery } from '@apollo/client';
import {
  CheckVerified02,
  ChevronRight,
  Download01,
  Edit02,
  File02,
  Folder,
  FolderPlus,
  Inbox02,
  Plus,
  Save01,
  Trash01,
  XCircle,
  XClose,
} from '@untitledui/icons';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Position } from 'reactflow';
import {
  FileUploadModal,
  ExportTypeModal,
  FlowProcessPlaygroundModal,
  JsonLogicPlaygroundModal,
  JsonSnippetEditor,
  ProcessPlaygroundModal,
} from '../../components/modals/YamlModals';
import { NodeViewer } from '../../components/panels/NodeViewer';
import { ProcessTopology } from '../../components/topology/ProcessTopology';
import { ProcessSelectField } from '../../components/ProcessSelectField';
import {
  Button,
  Card,
  CardBody,
  Checkbox,
  EmptyState,
  EmptyStateBody,
  EmptyStateFooter,
  Form,
  FormGroup,
  Page,
  Spinner,
  Text,
  TextArea,
  TextInput,
  Title,
  Toast,
  YamlActionsMenu,
} from '../../components/ui/AppPrimitives';
import {
  cn,
  formatCompactJsonLogicSnippet,
  formatJsonSnippet,
  stringifyCompactJsonLogicForEditor,
  stringifyJsonForEditor,
} from '../../utils/ui';
import {
  CREATE_CONTEXT_CODE,
  CREATE_PROCESS,
  CREATE_RESULT_NODE,
  CREATE_REVERSE_NODE,
  CREATE_REVERSE_OUTPUT_NODE,
  CREATE_STAGE_NODE,
  CREATE_SUBPROCESS_NODE,
  DELETE_CONFIGURATOR_NODE,
  DELETE_CONTEXT_CODE,
  DELETE_PROCESS_CONFIG,
  DELETE_RESULT_NODE,
  DELETE_REVERSE_NODE,
  DELETE_REVERSE_OUTPUT_NODE,
  DELETE_STAGE_NODE,
  DELETE_SUBPROCESS_NODE,
  PROCESS_FIELDS,
  RENAME_CONTEXT_CODE,
  REORDER_REVERSE_OUTPUTS,
  REORDER_SUBPROCESS_STAGES,
  UPDATE_CONFIGURATOR_NODE,
  UPDATE_PROCESS,
  UPDATE_PROCESS_NODE,
  UPDATE_RESULT_NODE,
  UPDATE_REVERSE_NODE,
  UPDATE_REVERSE_OUTPUT_NODE,
  UPDATE_STAGE_NODE,
  UPDATE_SUBPROCESS_NODE,
} from './api/graphqlDocuments';
import { ErrorDetailsModal, AppDialogModal } from './components/AppDialogs';
import { ProcessCodeManagerModal } from './components/ProcessCodeManagerModal';
import { NodeOrderEditor } from './components/NodeOrderEditor';
import { NodeEditor } from './components/node-editor/NodeEditor';
import { ProcessTreeSidebar } from './components/ProcessTreeSidebar';
import { buildProcessCodeUsage, formatProcessCodeUsage, normalizeProcessCode, validateProcessCode } from './model/processCodes';
import { createProcessTreeFolderId, getProcessConfigDisplayName, normalizeProcessTreeFolderName, normalizeProcessTreeState, readProcessTreeState, ROOT_PROCESS_TREE_FOLDER_ID, writeProcessTreeState } from './model/processTreeState';

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

function getImportFilePath(file) {
  return file?.webkitRelativePath || file?.name || '';
}

function getImportFileKey(file) {
  return `${getImportFilePath(file)}:${file?.size ?? 0}:${file?.lastModified ?? 0}`;
}

function readRestField(source, camelCaseName, snakeCaseName) {
  return source?.[camelCaseName] ?? source?.[snakeCaseName] ?? null;
}

function getImportedProcessConfigId(importResult) {
  return readRestField(importResult, 'processConfigId', 'process_config_id');
}

function getImportedProcessId(importResult) {
  return readRestField(importResult, 'processId', 'process_id');
}

function formatAutosaveCountdownLabel(secondsLeft) {
  return `${Math.max(1, Math.ceil(secondsLeft))} c`;
}

function getYamlEditorSourceKey(processConfig) {
  if (!processConfig?.id) {
    return '';
  }

  return `${processConfig.id}:${processConfig.updatedAt ?? ''}`;
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


function getErrorMessage(error, fallback) {
  if (!error) {
    return fallback || '';
  }

  if (typeof error === 'string') {
    return error || fallback || '';
  }

  if (Array.isArray(error.graphQLErrors) && error.graphQLErrors.length > 0) {
    return error.graphQLErrors.map((item) => item.message).join('; ');
  }

  return error.message || fallback || '';
}

function createToastId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getCircularReplacer() {
  const seen = new WeakSet();

  return (key, value) => {
    if (typeof value !== 'object' || value === null) {
      return value;
    }

    if (seen.has(value)) {
      return '[Circular]';
    }

    seen.add(value);
    return value;
  };
}

function formatErrorValue(value) {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Error) {
    return [value.name, value.message, value.stack].filter(Boolean).join('\n');
  }

  try {
    return JSON.stringify(value, getCircularReplacer(), 2);
  } catch {
    return String(value);
  }
}

function formatGraphQLError(error, index) {
  const lines = [`${index + 1}. ${error?.message || formatErrorValue(error)}`];

  if (Array.isArray(error?.path) && error.path.length > 0) {
    lines.push(`Path: ${error.path.join('.')}`);
  }

  if (Array.isArray(error?.locations) && error.locations.length > 0) {
    lines.push(`Locations: ${JSON.stringify(error.locations)}`);
  }

  if (error?.extensions && Object.keys(error.extensions).length > 0) {
    lines.push(`Extensions: ${formatErrorValue(error.extensions)}`);
  }

  return lines.join('\n');
}

function getErrorDetails(error, fallback) {
  const message = getErrorMessage(error, fallback) || fallback || 'Произошла ошибка.';
  const sections = [`Сообщение:\n${message}`];

  if (error && typeof error === 'object') {
    if (error.name && error.name !== 'Error') {
      sections.push(`Тип:\n${error.name}`);
    }

    if (Array.isArray(error.graphQLErrors) && error.graphQLErrors.length > 0) {
      sections.push(`GraphQL:\n${error.graphQLErrors.map(formatGraphQLError).join('\n\n')}`);
    }

    if (error.networkError) {
      sections.push(`Network:\n${formatErrorValue(error.networkError)}`);
    }

    if (Array.isArray(error.clientErrors) && error.clientErrors.length > 0) {
      sections.push(`Client errors:\n${error.clientErrors.map(formatErrorValue).join('\n\n')}`);
    }

    if (error.cause) {
      sections.push(`Cause:\n${formatErrorValue(error.cause)}`);
    }

    if (error.stack) {
      sections.push(`Stack trace:\n${error.stack}`);
    }

    if (!(error instanceof Error)) {
      const rawError = formatErrorValue(error);
      if (rawError && rawError !== '{}' && rawError !== message) {
        sections.push(`Raw error:\n${rawError}`);
      }
    }
  }

  return sections.filter(Boolean).join('\n\n');
}

function createErrorInfo(error, fallback = 'Произошла ошибка.', options: any = {}) {
  const message = getErrorMessage(error, fallback) || fallback;

  return {
    id: createToastId(),
    title: options.title || 'Ошибка',
    message: options.message || message,
    details: getErrorDetails(error, fallback),
    occurredAt: new Date().toISOString(),
  };
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

const DEFAULT_PROCESS_PLAYGROUND_TRIGGER = JSON.stringify(
  {
    triggerId: null,
    triggerCode: '',
    activityId: '',
    events: [],
  },
  null,
  2,
);

const PROCESS_PLAYGROUND_TRIGGER_HISTORY_KEY = 'yamlProcessor.processPlaygroundTriggerHistory.v1';
const PROCESS_PLAYGROUND_TRIGGER_HISTORY_LIMIT = 12;
const FLOW_PLAYBACK_STEP_DELAY_MS = 520;
function getEventService(event) {
  return (
    event?.body?.eventObject?.service ??
    event?.body?.service ??
    event?.header?.body?.eventObject?.service ??
    event?.header?.body?.service ??
    {}
  );
}

function getReferenceCode(value) {
  if (typeof value === 'string') {
    return value;
  }

  return value?.code ?? '';
}

function formatProcessPlaygroundHistoryDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function createProcessPlaygroundHistoryId() {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getProcessPlaygroundTriggerHistoryTitle(trigger) {
  const events = Array.isArray(trigger?.events) ? trigger.events : [];
  const firstService = getEventService(events[0]);

  return (
    String(trigger?.triggerCode ?? '').trim() ||
    String(trigger?.activityId ?? '').trim() ||
    String(firstService.scenario ?? '').trim() ||
    'Trigger'
  );
}

function getProcessPlaygroundTriggerHistoryMeta(trigger) {
  const events = Array.isArray(trigger?.events) ? trigger.events : [];
  const firstService = getEventService(events[0]);
  const scenario = String(firstService.scenario ?? '').trim();
  const status = String(getReferenceCode(firstService.status)).trim();

  return [`${events.length} событ.`, scenario, status].filter(Boolean).join(' / ');
}

function createProcessPlaygroundTriggerHistoryItem(trigger, triggerText) {
  const createdAt = new Date().toISOString();

  return {
    id: createProcessPlaygroundHistoryId(),
    createdAt,
    title: getProcessPlaygroundTriggerHistoryTitle(trigger),
    meta: getProcessPlaygroundTriggerHistoryMeta(trigger),
    savedAtLabel: formatProcessPlaygroundHistoryDate(createdAt),
    triggerText,
  };
}

function normalizeProcessPlaygroundTriggerHistoryItem(item) {
  const triggerText = typeof item?.triggerText === 'string' ? item.triggerText : '';
  if (!triggerText.trim()) {
    return null;
  }

  let parsedTrigger = null;
  try {
    parsedTrigger = JSON.parse(triggerText);
  } catch {
    // A malformed historical item can still be inserted and edited by the user.
  }

  const createdAt = typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString();

  return {
    id: typeof item.id === 'string' ? item.id : createProcessPlaygroundHistoryId(),
    createdAt,
    title: item.title || getProcessPlaygroundTriggerHistoryTitle(parsedTrigger),
    meta: item.meta || getProcessPlaygroundTriggerHistoryMeta(parsedTrigger),
    savedAtLabel: formatProcessPlaygroundHistoryDate(createdAt),
    triggerText,
  };
}

function readProcessPlaygroundTriggerHistory() {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(PROCESS_PLAYGROUND_TRIGGER_HISTORY_KEY);
    const parsedValue = rawValue ? JSON.parse(rawValue) : [];

    return Array.isArray(parsedValue)
      ? parsedValue
          .map(normalizeProcessPlaygroundTriggerHistoryItem)
          .filter(Boolean)
          .slice(0, PROCESS_PLAYGROUND_TRIGGER_HISTORY_LIMIT)
      : [];
  } catch {
    return [];
  }
}

function writeProcessPlaygroundTriggerHistory(items) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const payload = (items ?? []).map(({ id, createdAt, title, meta, triggerText }) => ({
      id,
      createdAt,
      title,
      meta,
      triggerText,
    }));

    if (payload.length === 0) {
      window.localStorage.removeItem(PROCESS_PLAYGROUND_TRIGGER_HISTORY_KEY);
      return;
    }

    window.localStorage.setItem(PROCESS_PLAYGROUND_TRIGGER_HISTORY_KEY, JSON.stringify(payload));
  } catch {
    // localStorage can be unavailable in private mode; history is best-effort.
  }
}

function upsertProcessPlaygroundTriggerHistoryItem(items, trigger, triggerText) {
  const normalizedTriggerText = triggerText.trim();
  const nextItem = createProcessPlaygroundTriggerHistoryItem(trigger, normalizedTriggerText);
  const currentItems = (items ?? [])
    .map(normalizeProcessPlaygroundTriggerHistoryItem)
    .filter(Boolean)
    .filter((item) => item.triggerText.trim() !== normalizedTriggerText);

  return [nextItem, ...currentItems].slice(0, PROCESS_PLAYGROUND_TRIGGER_HISTORY_LIMIT);
}

function parseJsonLogicRule(ruleText, label) {
  const rawRule = String(ruleText ?? '').trim();
  if (!rawRule) {
    return null;
  }

  try {
    const parsedRule = JSON.parse(rawRule);
    return isEmptyJsonValue(parsedRule) ? null : parsedRule;
  } catch {
    throw new Error(`${label}: правило JsonLogic должно быть валидным JSON.`);
  }
}

function parseRegexpPattern(pattern) {
  const normalizedPattern = String(pattern ?? '').trim();
  const slashRegexp = normalizedPattern.match(/^\/(.+)\/([a-z]*)$/i);
  if (slashRegexp) {
    return new RegExp(slashRegexp[1], slashRegexp[2]);
  }

  if (
    normalizedPattern.startsWith('^') ||
    normalizedPattern.endsWith('$') ||
    normalizedPattern.startsWith('(?')
  ) {
    return new RegExp(normalizedPattern);
  }

  return null;
}

function globPatternToRegExp(pattern) {
  const expression = Array.from(String(pattern))
    .map((character) => {
      if (character === '*') {
        return '.*';
      }
      if (character === '?') {
        return '.';
      }
      return character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('');

  return new RegExp(`^${expression}$`);
}

function matchesScenarioPattern(pattern, scenario) {
  const normalizedPattern = String(pattern ?? '').trim();
  const normalizedScenario = String(scenario ?? '').trim();
  if (!normalizedPattern || !normalizedScenario) {
    return false;
  }

  if (normalizedPattern === normalizedScenario) {
    return true;
  }

  try {
    const regexp = parseRegexpPattern(normalizedPattern);
    if (regexp) {
      return regexp.test(normalizedScenario);
    }
    return globPatternToRegExp(normalizedPattern).test(normalizedScenario);
  } catch {
    return false;
  }
}

function getProcessPlaygroundLabel(name, comment, fallback) {
  const title = String(name ?? '').trim() || fallback;
  const subtitle = String(comment ?? '').trim();
  return subtitle ? `${title} (${subtitle})` : title;
}

function getOutputPlaygroundLabel(output) {
  const phase = output?.phase?.code || output?.phase || '';
  return phase || output?.name || 'output';
}

async function evaluateJsonLogicBoolean(rule, data) {
  const response = await fetch('/api/json-logic/evaluate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data,
      rule,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }

  const payload = await response.json();
  return payload?.result === true;
}

async function buildProcessPlaygroundResult(processConfigs, trigger) {
  const events = Array.isArray(trigger?.events) ? trigger.events : [];
  const result = {
    eventCount: events.length,
    processCount: 0,
    subprocessCount: 0,
    stageCount: 0,
    scenarioCount: 0,
    reverseCount: 0,
    outputCount: 0,
    processes: [],
  };

  for (const processConfig of processConfigs ?? []) {
    const process = processConfig?.process;
    if (!process || process.disabled) {
      continue;
    }

    const processNodeId = process.id ? `process:${process.id}` : null;
    const processMatch = {
      id: process.id ?? processConfig.id,
      processConfigId: processConfig.id,
      nodeId: processNodeId,
      expandedNodeIds: [processNodeId].filter(Boolean),
      label: getProcessPlaygroundLabel(process.nodeName, process.nodeComment, process.contextCode?.code || 'process'),
      subprocesses: [],
    };

    for (const subprocess of process.subprocess ?? []) {
      if (subprocess.disabled) {
        continue;
      }

      const triggerRule = parseJsonLogicRule(
        subprocess.trigger?.rule,
        `${processMatch.label} / ${subprocess.nodeName || 'subprocess'} / trigger.rule`,
      );
      if (!triggerRule) {
        continue;
      }

      const subprocessMatches = await evaluateJsonLogicBoolean(triggerRule, trigger);
      if (!subprocessMatches) {
        continue;
      }

      const subprocessNodeId = subprocess.id ? `subprocess:${subprocess.id}` : null;
      const subprocessMatch = {
        id: subprocess.id,
        nodeId: subprocessNodeId,
        expandedNodeIds: [processNodeId].filter(Boolean),
        label: getProcessPlaygroundLabel(subprocess.nodeName, subprocess.nodeComment, 'subprocess'),
        stages: [],
      };

      for (const stage of subprocess.stages ?? []) {
        const configurator = stage.configurator;
        if (!configurator || configurator.disabled) {
          continue;
        }

        const filterRule = parseJsonLogicRule(
          configurator.filterEventRule,
          `${processMatch.label} / ${subprocessMatch.label} / ${stage.nodeName || 'stage'} / filter-event-rule`,
        );
        if (!filterRule) {
          continue;
        }

        const stageEvents = [];
        if (configurator.multiple) {
          const stageMatches = await evaluateJsonLogicBoolean(filterRule, trigger);
          if (stageMatches) {
            stageEvents.push(...events);
          }
        } else {
          for (const event of events) {
            if (await evaluateJsonLogicBoolean(filterRule, event)) {
              stageEvents.push(event);
            }
          }
        }

        if (stageEvents.length === 0) {
          continue;
        }

        const stageNodeId = stage.id ? `stage:${stage.id}` : null;
        const stageMatch = {
          id: stage.id,
          nodeId: stageNodeId,
          expandedNodeIds: [processNodeId, subprocessNodeId].filter(Boolean),
          label: getProcessPlaygroundLabel(stage.nodeName, stage.nodeComment, 'stage'),
          eventCount: stageEvents.length,
          scenarios: [],
        };

        for (const [resultIndex, resultItem] of (configurator.result ?? []).entries()) {
          const resultNodeId = getResultNodeId(stage.id, resultIndex);
          for (const scenarioPattern of sanitizeInputScenarios(resultItem.inputScenarios)) {
            const scenarioEvents = stageEvents.filter((event) =>
              matchesScenarioPattern(scenarioPattern, getEventService(event).scenario),
            );
            if (scenarioEvents.length === 0) {
              continue;
            }

            const scenarioMatch = {
              id: `${resultItem.id ?? 'result'}:${scenarioPattern}`,
              nodeId: resultNodeId,
              expandedNodeIds: [processNodeId, subprocessNodeId, stageNodeId].filter(Boolean),
              label: scenarioPattern,
              eventCount: scenarioEvents.length,
              statuses: [],
            };

            for (const [reverseIndex, reverse] of (resultItem.reverse ?? []).entries()) {
              const statusCode = getReferenceCode(reverse.status);
              const reverseEvents = scenarioEvents.filter((event) => getReferenceCode(getEventService(event).status) === statusCode);
              if (reverseEvents.length === 0) {
                continue;
              }

              const reverseNodeId = getReverseNodeId(stage.id, resultIndex, reverseIndex);
              const statusMatch = {
                id: reverse.id,
                nodeId: reverseNodeId,
                expandedNodeIds: [processNodeId, subprocessNodeId, stageNodeId, resultNodeId].filter(Boolean),
                label: statusCode || 'STATUS не задан',
                eventCount: reverseEvents.length,
                outputs: [],
              };

              for (const [outputIndex, output] of (reverse.output ?? []).entries()) {
                const outputRule = parseJsonLogicRule(
                  output.rule,
                  `${processMatch.label} / ${subprocessMatch.label} / ${stageMatch.label} / ${scenarioPattern} / ${statusMatch.label} / ${getOutputPlaygroundLabel(output)} / output.rule`,
                );
                const outputEvents = outputRule
                  ? []
                  : [...reverseEvents];

                if (outputRule) {
                  for (const event of reverseEvents) {
                    if (await evaluateJsonLogicBoolean(outputRule, event)) {
                      outputEvents.push(event);
                    }
                  }
                }

                if (outputEvents.length === 0) {
                  continue;
                }

                statusMatch.outputs.push({
                  id: output.id ?? `${statusMatch.id ?? statusMatch.label}:${getOutputPlaygroundLabel(output)}`,
                  nodeId: getReverseOutputNodeId(stage.id, resultIndex, reverseIndex, outputIndex),
                  expandedNodeIds: [processNodeId, subprocessNodeId, stageNodeId, resultNodeId, reverseNodeId].filter(Boolean),
                  label: getOutputPlaygroundLabel(output),
                  eventCount: outputEvents.length,
                  autoMatched: !outputRule,
                });
              }

              scenarioMatch.statuses.push(statusMatch);
            }

            stageMatch.scenarios.push(scenarioMatch);
          }
        }

        subprocessMatch.stages.push(stageMatch);
      }

      processMatch.subprocesses.push(subprocessMatch);
    }

    if (processMatch.subprocesses.length > 0) {
      result.processes.push(processMatch);
    }
  }

  result.processCount = result.processes.length;
  result.subprocessCount = result.processes.reduce((sum, process) => sum + process.subprocesses.length, 0);
  result.stageCount = result.processes.reduce(
    (processSum, process) =>
      processSum + process.subprocesses.reduce((subprocessSum, subprocess) => subprocessSum + subprocess.stages.length, 0),
    0,
  );
  result.scenarioCount = result.processes.reduce(
    (processSum, process) =>
      processSum +
      process.subprocesses.reduce(
        (subprocessSum, subprocess) =>
          subprocessSum + subprocess.stages.reduce((stageSum, stage) => stageSum + stage.scenarios.length, 0),
        0,
      ),
    0,
  );
  result.reverseCount = result.processes.reduce(
    (processSum, process) =>
      processSum +
      process.subprocesses.reduce(
        (subprocessSum, subprocess) =>
          subprocessSum +
          subprocess.stages.reduce(
            (stageSum, stage) => stageSum + stage.scenarios.reduce((scenarioSum, scenario) => scenarioSum + scenario.statuses.length, 0),
            0,
          ),
        0,
      ),
    0,
  );
  result.outputCount = result.processes.reduce(
    (processSum, process) =>
      processSum +
      process.subprocesses.reduce(
        (subprocessSum, subprocess) =>
          subprocessSum +
          subprocess.stages.reduce(
            (stageSum, stage) =>
              stageSum +
              stage.scenarios.reduce(
                (scenarioSum, scenario) =>
                  scenarioSum + scenario.statuses.reduce((statusSum, status) => statusSum + status.outputs.length, 0),
                0,
              ),
            0,
          ),
        0,
      ),
    0,
  );

  return result;
}

// The playground mirrors backend matching rules on the client so an analyst can inspect
// which process nodes would handle a trigger before saving or exporting YAML.
function collectProcessPlaygroundExecutedNodeIds(result, processConfigId = null) {
  const nodeIds = new Set();
  const shouldIncludeProcess = (process) =>
    !processConfigId || String(process?.processConfigId ?? '') === String(processConfigId);
  const addNode = (item) => {
    if (item?.nodeId) {
      nodeIds.add(item.nodeId);
    }
  };

  (result?.processes ?? []).forEach((process) => {
    if (!shouldIncludeProcess(process)) {
      return;
    }

    addNode(process);
    (process.subprocesses ?? []).forEach((subprocess) => {
      addNode(subprocess);
      (subprocess.stages ?? []).forEach((stage) => {
        addNode(stage);
        (stage.scenarios ?? []).forEach((scenario) => {
          addNode(scenario);
          (scenario.statuses ?? []).forEach((status) => {
            addNode(status);
            (status.outputs ?? []).forEach(addNode);
          });
        });
      });
    });
  });

  return Array.from(nodeIds);
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

function findProcessPlaygroundNodeTarget(processConfigs, target) {
  const targetNodeId = String(target?.nodeId ?? '');
  if (!targetNodeId) {
    return null;
  }

  const candidates = target?.processConfigId
    ? (processConfigs ?? []).filter((processConfig) => String(processConfig.id) === String(target.processConfigId))
    : (processConfigs ?? []);

  for (const processConfig of candidates) {
    if (findSelectedNode(processConfig, targetNodeId)) {
      return {
        processConfigId: processConfig.id,
        nodeId: targetNodeId,
        expandedNodeIds: target?.expandedNodeIds ?? [],
      };
    }
  }

  return null;
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
    parent: {
      include: output.parent?.include ?? true,
      mode: output.parent?.mode ?? 'SURFACE',
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
  // GraphQL mutations expect clean input objects without Apollo metadata or display-only fields.
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
  const contextNoteLines = estimateTextLines('Входящий статус события для обработки', 26);
  const statusLines = estimateTextLines(statusValue, 24);
  return Math.min(
    TOPOLOGY_NODE_HEIGHT,
    Math.max(
      126,
      92 + contextNoteLines * TOPOLOGY_TEXT_LINE_HEIGHT + statusLines * TOPOLOGY_TEXT_LINE_HEIGHT + (isExpandable ? 28 : 0),
    ),
  );
}

function estimateResultNodeHeight({ scenarios, isExpandable }) {
  const normalizedScenarios = (scenarios?.length ? scenarios : ['']).map((scenario) => estimateTextLines(scenario, 32));
  const contextNoteHeight = 24;
  const contentHeight = normalizedScenarios.reduce(
    (sum, lineCount) => sum + Math.max(40, lineCount * TOPOLOGY_TEXT_LINE_HEIGHT + 8),
    0,
  );
  return Math.min(
    TOPOLOGY_NODE_HEIGHT,
    Math.max(120, 84 + contextNoteHeight + contentHeight + (normalizedScenarios.length - 1) * 8 + (isExpandable ? 28 : 0)),
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
        rule: stringifyCompactJsonLogicForEditor(rawTrigger ? JSON.parse(rawTrigger) : {}),
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
        stringifyCompactJsonLogicForEditor(rawFilterEventRule ? JSON.parse(rawFilterEventRule) : {}),
      ),
    };
  }

  if (kind === 'reverseOutput') {
    const rawRule = reverseOutputRuleText.trim();
    const parsedRule = rawRule ? JSON.parse(rawRule) : {};
    return {
      ...serializeReverseOutput(draft),
      rule: isEmptyJsonValue(parsedRule) ? null : stringifyCompactJsonLogicForEditor(parsedRule),
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

export function ProcessConfiguratorPage() {
  const { data, loading, error, refetch } = useQuery(PROCESS_FIELDS, {
    fetchPolicy: 'no-cache',
    notifyOnNetworkStatusChange: true,
  });
  const [createProcess, createState] = useMutation(CREATE_PROCESS, {
    fetchPolicy: 'no-cache',
  });
  const [deleteProcessConfig, deleteProcessConfigState] = useMutation(DELETE_PROCESS_CONFIG, {
    fetchPolicy: 'no-cache',
  });
  const [createContextCode, createContextCodeState] = useMutation(CREATE_CONTEXT_CODE, {
    fetchPolicy: 'no-cache',
  });
  const [renameContextCode, renameContextCodeState] = useMutation(RENAME_CONTEXT_CODE, {
    fetchPolicy: 'no-cache',
  });
  const [deleteContextCode, deleteContextCodeState] = useMutation(DELETE_CONTEXT_CODE, {
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
  const [topologyFocusRequest, setTopologyFocusRequest] = useState(null);
  const [createErrorMessage, setCreateErrorMessage] = useState('');
  const [updateErrorMessage, setUpdateErrorMessage] = useState('');
  const [exportErrorMessage, setExportErrorMessage] = useState('');
  const [importErrorMessage, setImportErrorMessage] = useState('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [localProcessConfig, setLocalProcessConfig] = useState(null);
  const [editorPreview, setEditorPreview] = useState(null);
  const [toast, setToast] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);
  const [isExportingProcessConfig, setIsExportingProcessConfig] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportProcessConfigId, setExportProcessConfigId] = useState(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImportingProcessConfig, setIsImportingProcessConfig] = useState(false);
  const [isProcessCodeManagerOpen, setIsProcessCodeManagerOpen] = useState(false);
  const [processCodeManagerError, setProcessCodeManagerError] = useState('');
  const [importFiles, setImportFiles] = useState([]);
  const [importFileResults, setImportFileResults] = useState({});
  const [processEditorMode, setProcessEditorMode] = useState('VISUAL');
  const [yamlEditorText, setYamlEditorText] = useState('');
  const [yamlEditorBaseline, setYamlEditorBaseline] = useState('');
  const [yamlEditorError, setYamlEditorError] = useState('');
  const [yamlEditorSourceKey, setYamlEditorSourceKey] = useState('');
  const [yamlEditorOpenVersion, setYamlEditorOpenVersion] = useState(0);
  const [isYamlEditorLoading, setIsYamlEditorLoading] = useState(false);
  const [isYamlEditorSaving, setIsYamlEditorSaving] = useState(false);
  const [isYamlEditorBeautifying, setIsYamlEditorBeautifying] = useState(false);
  const [isJsonLogicPlaygroundOpen, setIsJsonLogicPlaygroundOpen] = useState(false);
  const [jsonLogicPlaygroundTitle, setJsonLogicPlaygroundTitle] = useState('');
  const [jsonLogicPlaygroundInput, setJsonLogicPlaygroundInput] = useState('{}');
  const [jsonLogicPlaygroundRule, setJsonLogicPlaygroundRule] = useState('{}');
  const [jsonLogicPlaygroundResult, setJsonLogicPlaygroundResult] = useState('');
  const [jsonLogicPlaygroundError, setJsonLogicPlaygroundError] = useState('');
  const [isEvaluatingJsonLogic, setIsEvaluatingJsonLogic] = useState(false);
  const [isProcessPlaygroundOpen, setIsProcessPlaygroundOpen] = useState(false);
  const [processPlaygroundTrigger, setProcessPlaygroundTrigger] = useState(DEFAULT_PROCESS_PLAYGROUND_TRIGGER);
  const [processPlaygroundResult, setProcessPlaygroundResult] = useState(null);
  const [processPlaygroundError, setProcessPlaygroundError] = useState('');
  const [isFlowProcessPlaygroundOpen, setIsFlowProcessPlaygroundOpen] = useState(false);
  const [flowProcessPlaygroundTrigger, setFlowProcessPlaygroundTrigger] = useState(DEFAULT_PROCESS_PLAYGROUND_TRIGGER);
  const [flowProcessPlaygroundError, setFlowProcessPlaygroundError] = useState('');
  const [flowExecutedNodeIds, setFlowExecutedNodeIds] = useState([]);
  const [flowPlaybackRequest, setFlowPlaybackRequest] = useState(null);
  const [isFlowPlaybackRunning, setIsFlowPlaybackRunning] = useState(false);
  const [isEvaluatingFlowProcessPlayground, setIsEvaluatingFlowProcessPlayground] = useState(false);
  const [processPlaygroundTriggerHistory, setProcessPlaygroundTriggerHistory] = useState([]);
  const [isEvaluatingProcessPlayground, setIsEvaluatingProcessPlayground] = useState(false);
  const [processTreeState, setProcessTreeState] = useState(() => readProcessTreeState());
  const [expandedProcessTreeFolderIds, setExpandedProcessTreeFolderIds] = useState([]);
  const [autosaveStatus, setAutosaveStatus] = useState(null);
  const [appDialog, setAppDialog] = useState(null);
  const nodeEditorRef = useRef(null);
  const manualEditorSaveInFlightRef = useRef(false);
  const appDialogResolverRef = useRef(null);
  const flowPlaybackRunIdRef = useRef(0);

  const getAppDialogCancelValue = (dialog) => {
    if (!dialog || dialog.type === 'prompt') {
      return null;
    }
    return dialog.type === 'alert' ? true : false;
  };

  const closeAppDialog = (value) => {
    const resolver = appDialogResolverRef.current;
    appDialogResolverRef.current = null;
    setAppDialog(null);
    resolver?.(value);
  };

  const openAppDialog = (dialogOptions) => new Promise((resolve) => {
    if (appDialogResolverRef.current) {
      appDialogResolverRef.current(getAppDialogCancelValue(appDialog));
    }

    appDialogResolverRef.current = resolve;
    setAppDialog({
      id: createToastId(),
      title: dialogOptions.title ?? 'Подтверждение',
      message: dialogOptions.message ?? '',
      confirmText: dialogOptions.confirmText,
      cancelText: dialogOptions.cancelText,
      defaultValue: dialogOptions.defaultValue,
      inputLabel: dialogOptions.inputLabel,
      placeholder: dialogOptions.placeholder,
      type: dialogOptions.type ?? 'confirm',
      variant: dialogOptions.variant,
    });
  });

  const showConfirmDialog = (dialogOptions) => openAppDialog({ type: 'confirm', ...dialogOptions });
  const showPromptDialog = (dialogOptions) => openAppDialog({ type: 'prompt', ...dialogOptions });
  const showAlertDialog = (dialogOptions) => openAppDialog({ type: 'alert', ...dialogOptions });

  useEffect(() => () => {
    appDialogResolverRef.current?.(null);
    appDialogResolverRef.current = null;
  }, []);

  const processConfigs = data?.processConfigList ?? [];
  const processConfigIdSignature = processConfigs.map((item) => String(item.id)).join('|');
  const isInitialLoading = loading && processConfigs.length === 0;
  const phaseOptions = (data?.actionPhasesDictionaryList ?? []).map((item) => item.code).filter(Boolean);
  const b3StatusOptions = (data?.b3StatusDictionaryList ?? []).map((item) => item.code).filter(Boolean);
  const slaDurationUnitOptions = (data?.slaDurationUnitDictionaryList ?? []).map((item) => item.code).filter(Boolean);
  const slaStatusOptions = (data?.slaStatusDictionaryList ?? []).map((item) => item.code).filter(Boolean);
  const processCodeOptions = (data?.contextCodesDictionaryList ?? []).map((item) => item.code).filter(Boolean);
  const isProcessCodeManagerSubmitting =
    createContextCodeState.loading || renameContextCodeState.loading || deleteContextCodeState.loading;
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
  const processCodeUsage = buildProcessCodeUsage(
    workingProcessConfig?.id
      ? processConfigs.map((processConfig) =>
          processConfig.id === workingProcessConfig.id ? workingProcessConfig : processConfig,
        )
      : processConfigs,
  );
  const hasYamlEditorChanges = yamlEditorText !== yamlEditorBaseline;
  const yamlEditorStatus = isYamlEditorLoading
    ? 'Загрузка...'
    : isYamlEditorSaving
      ? 'Сохранение...'
      : isYamlEditorBeautifying
        ? 'Форматирование...'
        : hasYamlEditorChanges
          ? 'Есть несохраненные изменения'
          : yamlEditorText
            ? 'YAML актуален'
            : '';

  const resetFlowPlayback = () => {
    flowPlaybackRunIdRef.current += 1;
    setFlowPlaybackRequest(null);
    setFlowExecutedNodeIds([]);
    setIsFlowPlaybackRunning(false);
    setIsEvaluatingFlowProcessPlayground(false);
  };

  useEffect(() => {
    const nodeIds = flowPlaybackRequest?.nodeIds ?? [];
    if (nodeIds.length === 0) {
      setIsFlowPlaybackRunning(false);
      return undefined;
    }

    const timeoutIds = [];
    setFlowExecutedNodeIds([]);
    setIsFlowPlaybackRunning(true);

    nodeIds.forEach((nodeId, index) => {
      timeoutIds.push(
        window.setTimeout(() => {
          setFlowExecutedNodeIds((current) => (current.includes(nodeId) ? current : [...current, nodeId]));
          if (index === nodeIds.length - 1) {
            setIsFlowPlaybackRunning(false);
          }
        }, index * FLOW_PLAYBACK_STEP_DELAY_MS),
      );
    });

    return () => {
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [flowPlaybackRequest]);

  useEffect(() => {
    setProcessTreeState((current) => normalizeProcessTreeState(current, processConfigs));
  }, [processConfigIdSignature]);

  useEffect(() => {
    writeProcessTreeState(processTreeState);
  }, [processTreeState]);

  useEffect(() => {
    const folderIds = new Set((processTreeState.folders ?? []).map((folder) => folder.id));
    setExpandedProcessTreeFolderIds((current) => {
      const next = current.filter((folderId) => folderIds.has(folderId));
      if (next.length === 0 && folderIds.size > 0) {
        return Array.from(folderIds);
      }

      return next.length === current.length ? current : next;
    });
  }, [processTreeState.folders]);

  async function loadYamlEditorContent(processConfig) {
    if (!processConfig?.id) {
      setYamlEditorText('');
      setYamlEditorBaseline('');
      setYamlEditorError('');
      setYamlEditorSourceKey('');
      return;
    }

    try {
      setYamlEditorError('');
      setIsYamlEditorLoading(true);
      const response = await fetch(`/api/process-configs/${processConfig.id}/export`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      const yaml = await response.text();
      setYamlEditorText(yaml);
      setYamlEditorBaseline(yaml);
      setYamlEditorSourceKey(getYamlEditorSourceKey(processConfig));
    } catch (requestError) {
      reportError(setYamlEditorError, requestError, 'Не удалось загрузить YAML-конфигурацию.');
    } finally {
      setIsYamlEditorLoading(false);
    }
  }

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
    resetFlowPlayback();
    setFlowProcessPlaygroundError('');
  }, [activeProcessConfig?.id]);

  useEffect(() => {
    if (processEditorMode !== 'YAML') {
      return;
    }

    if (!activeProcessConfig?.id) {
      setYamlEditorText('');
      setYamlEditorBaseline('');
      setYamlEditorError('');
      setYamlEditorSourceKey('');
      return;
    }

    if (hasYamlEditorChanges) {
      return;
    }

    loadYamlEditorContent(activeProcessConfig);
  }, [processEditorMode, activeProcessConfig?.id, activeProcessConfig?.updatedAt, yamlEditorOpenVersion]);

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
      if (processNodeId && next.length === 0) {
        return getDefaultExpandedNodeIds(activeProcessConfig);
      }
      return next.length === current.length ? current : next;
    });
  }, [activeProcessConfig]);

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
      id: createToastId(),
      variant: 'success',
      title,
      message,
    });
  };

  const showSaveSuccessToast = () => {
    showSuccessToast('Изменения сохранены', 'Информация по node успешно обновлена.');
  };

  const showErrorToast = (errorValue, fallback, options = {}) => {
    const errorInfo = createErrorInfo(errorValue, fallback, options);
    if (!errorInfo.message) {
      return errorInfo;
    }

    setToast({
      id: errorInfo.id,
      variant: 'error',
      title: errorInfo.title,
      message: errorInfo.message,
      errorInfo,
    });

    return errorInfo;
  };

  const reportError = (setErrorMessage, errorValue, fallback, options = {}) => {
    const errorInfo = showErrorToast(errorValue, fallback, options);
    setErrorMessage?.(errorInfo.message);
    return errorInfo.message;
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleGlobalError = (event) => {
      showErrorToast(event.error || event.message, 'Непредвиденная ошибка приложения.');
    };

    const handleUnhandledRejection = (event) => {
      showErrorToast(event.reason, 'Непредвиденная ошибка приложения.');
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    if (error && !isInitialLoading) {
      showErrorToast(error, 'GraphQL недоступен.');
    }
  }, [error, isInitialLoading]);

  useEffect(() => {
    setProcessPlaygroundTriggerHistory(readProcessPlaygroundTriggerHistory());
  }, []);

  const handleOpenProcessCodeManager = () => {
    setProcessCodeManagerError('');
    setIsProcessCodeManagerOpen(true);
  };

  const handleCloseProcessCodeManager = () => {
    if (isProcessCodeManagerSubmitting) {
      return;
    }

    setProcessCodeManagerError('');
    setIsProcessCodeManagerOpen(false);
  };

  const handleCreateProcessCode = async (rawCode) => {
    const code = normalizeProcessCode(rawCode);
    const validationError = validateProcessCode(code);
    if (validationError) {
      reportError(setProcessCodeManagerError, validationError, validationError);
      return false;
    }

    if (processCodeOptions.includes(code)) {
      const errorMessage = `Код процесса "${code}" уже существует.`;
      reportError(setProcessCodeManagerError, errorMessage, errorMessage);
      return false;
    }

    try {
      setProcessCodeManagerError('');
      await createContextCode({
        variables: { code },
      });
      await refetch();
      showSuccessToast('Код процесса создан', `Код "${code}" добавлен в справочник.`);
      return true;
    } catch (mutationError) {
      reportError(setProcessCodeManagerError, mutationError, 'Не удалось создать код процесса.');
      return false;
    }
  };

  const handleRenameProcessCode = async (currentCode, rawNextCode) => {
    const nextCode = normalizeProcessCode(rawNextCode);
    const validationError = validateProcessCode(nextCode);
    if (validationError) {
      reportError(setProcessCodeManagerError, validationError, validationError);
      return false;
    }

    if (nextCode === currentCode) {
      return true;
    }

    if (processCodeOptions.includes(nextCode)) {
      const errorMessage = `Код процесса "${nextCode}" уже существует.`;
      reportError(setProcessCodeManagerError, errorMessage, errorMessage);
      return false;
    }

    try {
      setProcessCodeManagerError('');
      await renameContextCode({
        variables: {
          id: currentCode,
          code: nextCode,
        },
      });
      setLocalProcessConfig(null);
      setEditorPreview(null);
      setAutosaveStatus(null);
      await refetch();
      showSuccessToast('Код процесса обновлен', `Код "${currentCode}" переименован в "${nextCode}".`);
      return true;
    } catch (mutationError) {
      reportError(setProcessCodeManagerError, mutationError, 'Не удалось обновить код процесса.');
      return false;
    }
  };

  const handleDeleteProcessCode = async (rawCode) => {
    const code = normalizeProcessCode(rawCode);
    if (!code) {
      const errorMessage = 'Код процесса не должен быть пустым.';
      reportError(setProcessCodeManagerError, errorMessage, errorMessage);
      return false;
    }

    if (!processCodeOptions.includes(code)) {
      const errorMessage = `Код процесса "${code}" не найден.`;
      reportError(setProcessCodeManagerError, errorMessage, errorMessage);
      return false;
    }

    const usage = processCodeUsage.get(code);
    if (usage?.totalCount > 0) {
      const errorMessage = `Код процесса "${code}" нельзя удалить. ${formatProcessCodeUsage(usage)}.`;
      reportError(setProcessCodeManagerError, errorMessage, errorMessage);
      return false;
    }

    const shouldDelete = await showConfirmDialog({
      title: 'Удалить код процесса',
      message: `Удалить код процесса "${code}"?`,
      confirmText: 'Удалить',
      variant: 'danger',
    });
    if (!shouldDelete) {
      return false;
    }

    try {
      setProcessCodeManagerError('');
      await deleteContextCode({
        variables: { id: code },
      });
      setLocalProcessConfig(null);
      setEditorPreview(null);
      setAutosaveStatus(null);
      await refetch();
      showSuccessToast('Код процесса удален', `Код "${code}" удален из справочника.`);
      return true;
    } catch (mutationError) {
      reportError(setProcessCodeManagerError, mutationError, 'Не удалось удалить код процесса.');
      return false;
    }
  };

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
      reportError(setUpdateErrorMessage, mutationError, 'Не удалось сохранить изменения процесса.');
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
            contextCode: normalizeReferenceDraft(selectedStage.contextCode),
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
      reportError(setUpdateErrorMessage, mutationError, 'Не удалось сохранить изменения stage.');
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
      reportError(setUpdateErrorMessage, mutationError, 'Не удалось сохранить изменения subprocess.');
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
      reportError(setUpdateErrorMessage, mutationError, 'Не удалось сохранить reverse.');
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
      reportError(setUpdateErrorMessage, mutationError, 'Не удалось сохранить reverse output.');
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
      reportError(setUpdateErrorMessage, mutationError, 'Не удалось сохранить result.');
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
      reportError(setUpdateErrorMessage, mutationError, 'Не удалось сохранить изменения process.');
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
        const errorMessage = 'GraphQL не вернул созданный процесс. Проверьте backend-логи и схему мутации.';
        reportError(setCreateErrorMessage, errorMessage, errorMessage);
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
      reportError(setCreateErrorMessage, mutationError, 'Не удалось создать процесс.');
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

  const handleManualEditorSave = async () => {
    if (editorIsSaving || manualEditorSaveInFlightRef.current) {
      return;
    }

    manualEditorSaveInFlightRef.current = true;
    try {
      await nodeEditorRef.current?.saveNow?.();
    } finally {
      manualEditorSaveInFlightRef.current = false;
    }
  };

  const handleAddSubprocess = async () => {
    const processId = workingProcessConfig?.process?.id;
    if (!processId) {
      return;
    }

    try {
      setUpdateErrorMessage('');
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
    } catch (mutationError) {
      reportError(setUpdateErrorMessage, mutationError, 'Не удалось создать subprocess.');
    }
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

    try {
      setUpdateErrorMessage('');
      await createStageNode({
        variables: {
          subprocessId,
          input: stripTypename(serializeStage(createDefaultStage((subprocess.stages ?? []).length + 1))),
        },
      });
      await refetch();
      setExpandedNodeIds((current) => (current.includes(editorNodeId) ? current : [...current, editorNodeId]));
    } catch (mutationError) {
      reportError(setUpdateErrorMessage, mutationError, 'Не удалось создать stage.');
    }
  };

  const handleToggleNode = (nodeId) => {
    setExpandedNodeIds((current) =>
      current.includes(nodeId) ? current.filter((item) => item !== nodeId) : [...current, nodeId],
    );
  };

  const handleExpandAllNodes = () => {
    setExpandedNodeIds(getDefaultExpandedNodeIds(workingProcessConfig));
  };

  const handleCollapseAllNodes = () => {
    setExpandedNodeIds([]);
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
          const errorMessage = 'Не удалось определить subprocess для создания stage.';
          reportError(setUpdateErrorMessage, errorMessage, errorMessage);
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
          const errorMessage = 'Не удалось определить configurator stage для создания result.';
          reportError(setUpdateErrorMessage, errorMessage, errorMessage);
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
          const errorMessage = 'Не удалось определить result для создания reverse.';
          reportError(setUpdateErrorMessage, errorMessage, errorMessage);
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
          const errorMessage = 'Не удалось определить reverse для создания reverse output.';
          reportError(setUpdateErrorMessage, errorMessage, errorMessage);
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
              parent: {
                include: true,
                mode: 'SURFACE',
              },
            }),
          },
        });
      } else {
        return;
      }

      setExpandedNodeIds((current) => (current.includes(nodeId) ? current : [...current, nodeId]));
      await refetch();
    } catch (mutationError) {
      reportError(
        setUpdateErrorMessage,
        mutationError,
        kind === 'subprocess'
          ? 'Не удалось создать stage.'
          : kind === 'stage'
          ? 'Не удалось создать result.'
          : kind === 'result'
            ? 'Не удалось создать reverse.'
            : 'Не удалось создать reverse output.',
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
      const errorMessage = 'Не удалось определить configurator stage для массового создания results.';
      reportError(setUpdateErrorMessage, errorMessage, errorMessage);
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
      reportError(setUpdateErrorMessage, mutationError, 'Не удалось массово создать results.');
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
      reportError(setUpdateErrorMessage, mutationError, 'Не удалось удалить узел.');
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

  const handleSelectProcessConfig = async (configId) => {
    if (processEditorMode === 'YAML' && hasYamlEditorChanges && configId !== selectedConfigId) {
      const shouldSelect = await showConfirmDialog({
        title: 'Несохраненные изменения',
        message: 'Есть несохраненные изменения YAML. Перейти к другому процессу без сохранения?',
        confirmText: 'Перейти',
      });
      if (!shouldSelect) {
        return;
      }
    }

    const nextProcessConfig = processConfigs.find((processConfig) => processConfig.id === configId) ?? null;
    const nextProcessNodeId = nextProcessConfig?.process?.id ? `process:${nextProcessConfig.process.id}` : null;

    setSelectedConfigId(configId || null);
    setSelectedNodeId(nextProcessNodeId);
    setExpandedNodeIds(getDefaultExpandedNodeIds(nextProcessConfig));
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
    setYamlEditorError('');
    setIsExportModalOpen(false);
  };

  const handleToggleProcessTreeFolder = (folderId) => {
    setExpandedProcessTreeFolderIds((current) =>
      current.includes(folderId) ? current.filter((item) => item !== folderId) : [...current, folderId],
    );
  };

  const handleCreateProcessTreeFolder = async (parentId = ROOT_PROCESS_TREE_FOLDER_ID) => {
    const normalizedCurrent = normalizeProcessTreeState(processTreeState, processConfigs);
    const folderIds = new Set([
      ROOT_PROCESS_TREE_FOLDER_ID,
      ...normalizedCurrent.folders.map((folder) => folder.id),
    ]);
    const normalizedParentId = folderIds.has(parentId) ? parentId : ROOT_PROCESS_TREE_FOLDER_ID;
    const folderName = await showPromptDialog({
      title: 'Название папки',
      defaultValue: 'Новая папка',
      inputLabel: 'Название папки',
      confirmText: 'Создать',
    });
    if (folderName == null) {
      return;
    }

    const normalizedName = normalizeProcessTreeFolderName(folderName);
    if (!normalizedName) {
      const errorMessage = 'Название папки не должно быть пустым.';
      showErrorToast(errorMessage, errorMessage);
      return;
    }

    const nextFolder = {
      id: createProcessTreeFolderId(),
      name: normalizedName,
      parentId: normalizedParentId,
    };

    setProcessTreeState({
      ...normalizedCurrent,
      folders: [...normalizedCurrent.folders, nextFolder],
    });
    setExpandedProcessTreeFolderIds((current) =>
      Array.from(new Set([...current, normalizedParentId, nextFolder.id].filter((id) => id !== ROOT_PROCESS_TREE_FOLDER_ID))),
    );
  };

  const handleRenameProcessTreeFolder = async (folderId) => {
    const normalizedCurrent = normalizeProcessTreeState(processTreeState, processConfigs);
    const targetFolder = normalizedCurrent.folders.find((folder) => folder.id === folderId);
    if (!targetFolder) {
      return;
    }

    const folderName = await showPromptDialog({
      title: 'Название папки',
      defaultValue: targetFolder.name,
      inputLabel: 'Название папки',
      confirmText: 'Сохранить',
    });
    if (folderName == null) {
      return;
    }

    const normalizedName = normalizeProcessTreeFolderName(folderName);
    if (!normalizedName) {
      const errorMessage = 'Название папки не должно быть пустым.';
      showErrorToast(errorMessage, errorMessage);
      return;
    }

    setProcessTreeState({
      ...normalizedCurrent,
      folders: normalizedCurrent.folders.map((folder) =>
        folder.id === folderId ? { ...folder, name: normalizedName } : folder,
      ),
    });
  };

  const handleDeleteProcessTreeFolder = async (folderId) => {
    const normalizedCurrent = normalizeProcessTreeState(processTreeState, processConfigs);
    const targetFolder = normalizedCurrent.folders.find((folder) => folder.id === folderId);
    if (!targetFolder) {
      return;
    }

    const hasChildFolders = normalizedCurrent.folders.some((folder) => folder.parentId === folderId);
    const hasProcesses = Object.values(normalizedCurrent.processFolders).some((assignedFolderId) => assignedFolderId === folderId);
    if (hasChildFolders || hasProcesses) {
      const errorMessage = 'Удалить можно только пустую папку.';
      showErrorToast(errorMessage, errorMessage);
      return;
    }

    const shouldDelete = await showConfirmDialog({
      title: 'Удалить папку',
      message: `Удалить папку "${targetFolder.name}"?`,
      confirmText: 'Удалить',
      variant: 'danger',
    });
    if (!shouldDelete) {
      return;
    }

    setProcessTreeState({
      ...normalizedCurrent,
      folders: normalizedCurrent.folders.filter((folder) => folder.id !== folderId),
    });
    setExpandedProcessTreeFolderIds((current) => current.filter((item) => item !== folderId));
  };

  const handleMoveProcessTreeProcess = (processConfigId, targetFolderId) => {
    const normalizedProcessConfigId = String(processConfigId);
    const processExists = processConfigs.some((processConfig) => String(processConfig.id) === normalizedProcessConfigId);
    if (!processExists) {
      return;
    }

    const normalizedCurrent = normalizeProcessTreeState(processTreeState, processConfigs);
    const folderIds = new Set([
      ROOT_PROCESS_TREE_FOLDER_ID,
      ...normalizedCurrent.folders.map((folder) => folder.id),
    ]);
    const normalizedTargetFolderId = folderIds.has(targetFolderId) ? targetFolderId : ROOT_PROCESS_TREE_FOLDER_ID;
    const processFolders = { ...normalizedCurrent.processFolders };

    if (normalizedTargetFolderId === ROOT_PROCESS_TREE_FOLDER_ID) {
      delete processFolders[normalizedProcessConfigId];
    } else {
      processFolders[normalizedProcessConfigId] = normalizedTargetFolderId;
      setExpandedProcessTreeFolderIds((current) => Array.from(new Set([...current, normalizedTargetFolderId])));
    }

    setProcessTreeState({
      ...normalizedCurrent,
      processFolders,
    });
  };

  const handleProcessEditorModeChange = async (nextMode) => {
    if (nextMode === processEditorMode) {
      return;
    }

    if (processEditorMode === 'YAML' && hasYamlEditorChanges) {
      const shouldSwitch = await showConfirmDialog({
        title: 'Несохраненные изменения',
        message: 'Есть несохраненные изменения YAML. Перейти без сохранения?',
        confirmText: 'Перейти',
      });
      if (!shouldSwitch) {
        return;
      }
      setYamlEditorText(yamlEditorBaseline);
      setYamlEditorError('');
    }

    if (nextMode === 'YAML') {
      setYamlEditorOpenVersion((current) => current + 1);
    }

    setProcessEditorMode(nextMode);
  };

  const handleReloadYamlEditor = async () => {
    if (!activeProcessConfig?.id || isYamlEditorLoading || isYamlEditorSaving || isYamlEditorBeautifying) {
      return;
    }

    if (hasYamlEditorChanges) {
      const shouldReload = await showConfirmDialog({
        title: 'Несохраненные изменения',
        message: 'Есть несохраненные изменения YAML. Обновить текст с сервера?',
        confirmText: 'Обновить',
      });
      if (!shouldReload) {
        return;
      }
    }

    await loadYamlEditorContent(activeProcessConfig);
  };

  const handleBeautifyYamlEditor = async () => {
    if (isYamlEditorLoading || isYamlEditorSaving || isYamlEditorBeautifying) {
      return;
    }

    if (!yamlEditorText.trim()) {
      setYamlEditorText('');
      setYamlEditorError('');
      return;
    }

    try {
      setYamlEditorError('');
      setIsYamlEditorBeautifying(true);
      const response = await fetch('/api/process-configs/yaml/beautify', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=UTF-8',
        },
        body: yamlEditorText,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      setYamlEditorText(await response.text());
    } catch (requestError) {
      reportError(setYamlEditorError, requestError, 'Не удалось отформатировать YAML.');
    } finally {
      setIsYamlEditorBeautifying(false);
    }
  };

  const handleSaveYamlEditor = async () => {
    if (!activeProcessConfig?.id || isYamlEditorLoading || isYamlEditorSaving || isYamlEditorBeautifying || !hasYamlEditorChanges) {
      return;
    }

    try {
      setYamlEditorError('');
      setIsYamlEditorSaving(true);
      const response = await fetch(`/api/process-configs/${activeProcessConfig.id}/yaml`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'text/plain;charset=UTF-8',
        },
        body: yamlEditorText,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      const payload = await response.json();
      const nextProcessConfigId = payload?.processConfigId ?? payload?.process_config_id ?? activeProcessConfig.id;
      const nextProcessId = payload?.processId ?? payload?.process_id ?? null;

      setYamlEditorBaseline(yamlEditorText);
      setEditorPreview(null);
      setEditorNodeId(null);
      setViewerNodeId(null);
      setOrderNodeId(null);
      setIsEditorOpen(false);
      setSelectedConfigId(nextProcessConfigId);
      setSelectedNodeId(nextProcessId ? `process:${nextProcessId}` : null);
      setExpandedNodeIds(nextProcessId ? [`process:${nextProcessId}`] : []);

      const refreshResult = await refetch();
      const refreshedProcessConfig = (refreshResult.data?.processConfigList ?? []).find(
        (item) => item.id === nextProcessConfigId,
      );
      if (refreshedProcessConfig) {
        const refreshedProcessId = refreshedProcessConfig.process?.id ?? nextProcessId;
        setYamlEditorSourceKey(getYamlEditorSourceKey(refreshedProcessConfig));
        setLocalProcessConfig(refreshedProcessConfig);
        setSelectedConfigId(refreshedProcessConfig.id);
        setSelectedNodeId(refreshedProcessId ? `process:${refreshedProcessId}` : null);
        setExpandedNodeIds(getDefaultExpandedNodeIds(refreshedProcessConfig));
      } else {
        setLocalProcessConfig(null);
      }
      showSuccessToast('YAML сохранен', 'Конфигурация процесса обновлена.');
    } catch (requestError) {
      reportError(setYamlEditorError, requestError, 'Не удалось сохранить YAML-конфигурацию.');
    } finally {
      setIsYamlEditorSaving(false);
    }
  };

  const handleOpenExportModal = (targetProcessConfigId) => {
    const processConfigId =
      typeof targetProcessConfigId === 'string' ? targetProcessConfigId : activeProcessConfig?.id;

    if (!processConfigId || isExportingProcessConfig) {
      return;
    }

    const targetProcessConfig = processConfigs.find((processConfig) => String(processConfig.id) === processConfigId);
    if (targetProcessConfig) {
      setSelectedConfigId(targetProcessConfig.id);
      setLocalProcessConfig(targetProcessConfig);
      setSelectedNodeId(targetProcessConfig.process?.id ? `process:${targetProcessConfig.process.id}` : null);
    }

    setExportErrorMessage('');
    setExportProcessConfigId(processConfigId);
    setIsExportModalOpen(true);
  };

  const handleCloseExportModal = () => {
    if (isExportingProcessConfig) {
      return;
    }

    setIsExportModalOpen(false);
    setExportProcessConfigId(null);
    setExportErrorMessage('');
  };

  const handleExportProcessConfig = async () => {
    const processConfigId = exportProcessConfigId ?? activeProcessConfig?.id;
    const targetProcessConfig =
      processConfigs.find((processConfig) => String(processConfig.id) === String(processConfigId)) ??
      (String(activeProcessConfig?.id) === String(processConfigId) ? activeProcessConfig : null);

    if (!processConfigId || isExportingProcessConfig) {
      return;
    }

    try {
      setExportErrorMessage('');
      setIsExportingProcessConfig(true);

      const response = await fetch(`/api/process-configs/${processConfigId}/export`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      const filename =
        getFilenameFromContentDisposition(response.headers.get('content-disposition')) ||
        `${targetProcessConfig?.process?.contextCode?.code || 'process'}.yaml`;
      const blob = await response.blob();
      downloadBlob(blob, filename);
      handleCloseExportModal();
    } catch (requestError) {
      reportError(setExportErrorMessage, requestError, 'Не удалось скачать YAML-конфигурацию процесса.');
    } finally {
      setIsExportingProcessConfig(false);
    }
  };

  const handleDeleteProcessConfig = async (targetProcessConfigId = activeProcessConfig?.id) => {
    const processConfigId =
      typeof targetProcessConfigId === 'string' ? targetProcessConfigId : activeProcessConfig?.id;

    if (!processConfigId || deleteProcessConfigState.loading) {
      return;
    }

    const targetProcessConfig =
      processConfigs.find((processConfig) => String(processConfig.id) === processConfigId) ??
      (String(activeProcessConfig?.id) === processConfigId ? activeProcessConfig : null);
    const processLabel =
      targetProcessConfig?.process?.nodeName ||
      targetProcessConfig?.process?.contextCode?.code ||
      processConfigId;
    const shouldDelete = await showConfirmDialog({
      title: 'Удалить процесс',
      message: `Удалить процесс "${processLabel}"?\nБудет удален весь process config со всеми subprocess, stage, configurator, result, reverse и output.`,
      confirmText: 'Удалить',
      variant: 'danger',
    });
    if (!shouldDelete) {
      return;
    }

    try {
      setUpdateErrorMessage('');
      await deleteProcessConfig({
        variables: {
          id: processConfigId,
        },
      });
      setProcessTreeState((currentState) => {
        const normalizedState = normalizeProcessTreeState(currentState, processConfigs);
        const processFolders = { ...normalizedState.processFolders };
        delete processFolders[processConfigId];

        return {
          ...normalizedState,
          processFolders,
        };
      });

      if (String(activeProcessConfig?.id) === processConfigId) {
        setSelectedConfigId(null);
        setSelectedNodeId(null);
        setEditorNodeId(null);
        setViewerNodeId(null);
        setOrderNodeId(null);
        setLocalProcessConfig(null);
        setEditorPreview(null);
        setIsEditorOpen(false);
        setExpandedNodeIds([]);
      }
      await refetch();
      showSuccessToast('Процесс удален', `Процесс "${processLabel}" удален вместе со всей вложенной конфигурацией.`);
    } catch (mutationError) {
      reportError(setUpdateErrorMessage, mutationError, 'Не удалось удалить процесс.');
    }
  };

  const handleOpenImportModal = () => {
    setImportErrorMessage('');
    setImportFiles([]);
    setImportFileResults({});
    setIsImportModalOpen(true);
  };

  const handleCloseImportModal = (force = false) => {
    if (isImportingProcessConfig && !force) {
      return;
    }

    setIsImportModalOpen(false);
    setImportFiles([]);
    setImportFileResults({});
    setImportErrorMessage('');
  };

  const handleOpenJsonLogicPlayground = (title, ruleText) => {
    setJsonLogicPlaygroundTitle(title);
    setJsonLogicPlaygroundInput('{}');
    setJsonLogicPlaygroundRule(formatCompactJsonLogicSnippet(ruleText || '{}'));
    setJsonLogicPlaygroundResult('');
    setJsonLogicPlaygroundError('');
    setIsJsonLogicPlaygroundOpen(true);
  };

  const handleOpenStandaloneJsonLogicPlayground = () => {
    setJsonLogicPlaygroundTitle('Playground JsonLogic');
    setJsonLogicPlaygroundInput('{}');
    setJsonLogicPlaygroundRule('{}');
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

  const handleOpenProcessPlayground = () => {
    setProcessPlaygroundError('');
    setProcessPlaygroundResult(null);
    setProcessPlaygroundTrigger((current) => formatJsonSnippet(current || DEFAULT_PROCESS_PLAYGROUND_TRIGGER));
    setIsProcessPlaygroundOpen(true);
  };

  const handleOpenCurrentProcessPlayground = () => {
    setFlowProcessPlaygroundError('');
    setFlowProcessPlaygroundTrigger((current) =>
      formatJsonSnippet(current || processPlaygroundTrigger || DEFAULT_PROCESS_PLAYGROUND_TRIGGER),
    );
    setIsFlowProcessPlaygroundOpen(true);
  };

  const handleCloseFlowProcessPlayground = () => {
    if (isEvaluatingFlowProcessPlayground) {
      return;
    }

    setIsFlowProcessPlaygroundOpen(false);
    setFlowProcessPlaygroundError('');
  };

  const handleCloseProcessPlayground = () => {
    if (isEvaluatingProcessPlayground) {
      return;
    }

    setIsProcessPlaygroundOpen(false);
    setProcessPlaygroundError('');
  };

  const handleImportFilesSelected = (files) => {
    setImportErrorMessage('');
    const yamlFiles = files.filter((file) => /\.ya?ml$/i.test(file.name));

    if (files.length > 0 && yamlFiles.length === 0) {
      const errorMessage = 'В выбранных файлах не найдено YAML-конфигураций с расширением .yaml или .yml.';
      reportError(setImportErrorMessage, errorMessage, errorMessage);
      return;
    }

    setImportFiles((current) => {
      const nextByKey = new Map(current.map((file) => [getImportFileKey(file), file]));
      yamlFiles.forEach((file) => nextByKey.set(getImportFileKey(file), file));
      const nextFiles = Array.from(nextByKey.values());
      const nextKeys = new Set(nextFiles.map(getImportFileKey));

      setImportFileResults((currentResults) =>
        Object.fromEntries(Object.entries(currentResults).filter(([fileKey]) => nextKeys.has(fileKey))),
      );

      return nextFiles;
    });
  };

  const handleRemoveImportFile = (index) => {
    setImportFiles((current) => {
      const removedFile = current[index];
      const nextFiles = current.filter((_, fileIndex) => fileIndex !== index);
      if (removedFile) {
        const removedFileKey = getImportFileKey(removedFile);
        setImportFileResults((currentResults) => {
          const nextResults = { ...currentResults };
          delete nextResults[removedFileKey];
          return nextResults;
        });
      }
      return nextFiles;
    });
  };

  const handleShowImportFileError = (file, result) => {
    const filePath = getImportFilePath(file);
    const message = result?.error || `Не удалось импортировать файл ${filePath}.`;

    setErrorDetails(
      createErrorInfo(message, message, {
        title: 'Ошибка импорта',
        message: `Файл ${filePath} не импортирован.`,
      }),
    );
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
      reportError(setJsonLogicPlaygroundError, requestError, 'Не удалось проверить JsonLogic правило.', {
        message: 'Произошла ошибка в Playground JsonLogic. Нажмите, чтобы открыть лог.',
      });
      setJsonLogicPlaygroundResult('');
    } finally {
      setIsEvaluatingJsonLogic(false);
    }
  };

  const handleEvaluateProcessPlayground = async () => {
    try {
      setProcessPlaygroundError('');
      setIsEvaluatingProcessPlayground(true);

      const parsedTrigger = JSON.parse(processPlaygroundTrigger || '{}');
      if (!Array.isArray(parsedTrigger.events)) {
        throw new Error('Trigger должен содержать массив events.');
      }

      const normalizedTriggerText = stringifyJsonForEditor(parsedTrigger);
      const playgroundProcessConfigs = (processConfigs ?? []).map((processConfig) =>
        workingProcessConfig?.id && processConfig.id === workingProcessConfig.id ? workingProcessConfig : processConfig,
      );

      const playgroundResult = await buildProcessPlaygroundResult(playgroundProcessConfigs, parsedTrigger);
      setProcessPlaygroundTrigger(normalizedTriggerText);
      setProcessPlaygroundResult(playgroundResult);

      setProcessPlaygroundTriggerHistory((current) => {
        const next = upsertProcessPlaygroundTriggerHistoryItem(current, parsedTrigger, normalizedTriggerText);
        writeProcessPlaygroundTriggerHistory(next);
        return next;
      });
    } catch (requestError) {
      reportError(setProcessPlaygroundError, requestError, 'Не удалось проиграть процессы.', {
        message: 'Произошла ошибка в Playground процесса. Нажмите, чтобы открыть лог.',
      });
      setProcessPlaygroundResult(null);
    } finally {
      setIsEvaluatingProcessPlayground(false);
    }
  };

  const handleEvaluateFlowProcessPlayground = async () => {
    let parsedTrigger;
    let normalizedTriggerText;

    try {
      parsedTrigger = JSON.parse(flowProcessPlaygroundTrigger || '{}');
      if (!Array.isArray(parsedTrigger.events)) {
        throw new Error('Trigger должен содержать массив events.');
      }
      normalizedTriggerText = stringifyJsonForEditor(parsedTrigger);
    } catch (validationError) {
      setFlowProcessPlaygroundError(getErrorMessage(validationError, 'Trigger должен быть валидным JSON.'));
      return;
    }

    resetFlowPlayback();
    const runId = flowPlaybackRunIdRef.current;
    setFlowProcessPlaygroundError('');
    setIsFlowProcessPlaygroundOpen(false);
    setIsEvaluatingFlowProcessPlayground(true);
    setFlowProcessPlaygroundTrigger(normalizedTriggerText);
    setProcessPlaygroundTrigger(normalizedTriggerText);

    try {
      if (!workingProcessConfig?.process) {
        throw new Error('Не выбран текущий процесс.');
      }

      const playgroundResult = await buildProcessPlaygroundResult([workingProcessConfig], parsedTrigger);
      if (flowPlaybackRunIdRef.current !== runId) {
        return;
      }

      const playbackNodeIds = collectProcessPlaygroundExecutedNodeIds(playgroundResult, activeProcessConfig?.id);
      setProcessPlaygroundTriggerHistory((current) => {
        const next = upsertProcessPlaygroundTriggerHistoryItem(current, parsedTrigger, normalizedTriggerText);
        writeProcessPlaygroundTriggerHistory(next);
        return next;
      });

      if (playbackNodeIds.length === 0) {
        showSuccessToast('Путь не найден', 'Текущий процесс не обработал Trigger.');
        return;
      }

      setFlowPlaybackRequest({
        id: `${runId}-${Date.now()}`,
        nodeIds: playbackNodeIds,
      });
    } catch (requestError) {
      if (flowPlaybackRunIdRef.current !== runId) {
        return;
      }

      setFlowPlaybackRequest(null);
      setFlowExecutedNodeIds([]);
      showErrorToast(requestError, 'Не удалось проиграть текущий процесс.', {
        message: 'Произошла ошибка при запуске Playground текущего процесса. Нажмите, чтобы открыть лог.',
      });
    } finally {
      if (flowPlaybackRunIdRef.current === runId) {
        setIsEvaluatingFlowProcessPlayground(false);
      }
    }
  };

  const handleSelectProcessPlaygroundTriggerHistoryItem = (item) => {
    if (!item?.triggerText) {
      return;
    }

    setProcessPlaygroundTrigger(item.triggerText);
    setProcessPlaygroundResult(null);
    setProcessPlaygroundError('');
  };

  const handleClearProcessPlaygroundTriggerHistory = () => {
    setProcessPlaygroundTriggerHistory([]);
    writeProcessPlaygroundTriggerHistory([]);
  };

  const handleRemoveProcessPlaygroundTriggerHistoryItem = (item) => {
    if (!item?.id) {
      return;
    }

    setProcessPlaygroundTriggerHistory((current) => {
      const next = (current ?? []).filter((currentItem) => currentItem.id !== item.id);
      writeProcessPlaygroundTriggerHistory(next);
      return next;
    });
  };

  const handleSelectProcessPlaygroundNode = async (targetNode) => {
    const playgroundProcessConfigs = (processConfigs ?? []).map((processConfig) =>
      workingProcessConfig?.id && processConfig.id === workingProcessConfig.id ? workingProcessConfig : processConfig,
    );
    const target = findProcessPlaygroundNodeTarget(playgroundProcessConfigs, targetNode);

    if (!target) {
      const errorMessage = 'Не удалось найти node в React Flow.';
      reportError(setProcessPlaygroundError, errorMessage, errorMessage, {
        message: 'Произошла ошибка в Playground процесса. Нажмите, чтобы открыть лог.',
      });
      return;
    }

    if (processEditorMode === 'YAML' && hasYamlEditorChanges) {
      const shouldSwitch = await showConfirmDialog({
        title: 'Несохраненные изменения',
        message: 'Есть несохраненные изменения YAML. Перейти к node в React Flow без сохранения?',
        confirmText: 'Перейти',
      });
      if (!shouldSwitch) {
        return;
      }
      setYamlEditorText(yamlEditorBaseline);
      setYamlEditorError('');
    }

    setProcessPlaygroundError('');
    setProcessEditorMode(processEditorMode === 'FLOW' ? 'FLOW' : 'VISUAL');
    setSelectedConfigId(target.processConfigId);
    setSelectedNodeId(target.nodeId);
    setEditorNodeId(null);
    setViewerNodeId(null);
    setOrderNodeId(null);
    setEditorPreview(null);
    setAutosaveStatus(null);
    setIsEditorOpen(false);
    setExpandedNodeIds((current) => {
      const next = new Set(current);
      target.expandedNodeIds.forEach((nodeId) => next.add(nodeId));
      return Array.from(next);
    });
    setTopologyFocusRequest({ id: Date.now(), nodeId: target.nodeId });
    setIsProcessPlaygroundOpen(false);
  };

  const handleImportProcessConfigs = async () => {
    if (importFiles.length === 0 || isImportingProcessConfig) {
      return;
    }

    try {
      setImportErrorMessage('');
      setImportFileResults({});
      setIsImportingProcessConfig(true);

      const formData = new FormData();
      importFiles.forEach((file) => {
        formData.append('files', file, getImportFilePath(file));
      });

      const response = await fetch('/api/process-configs/import', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      const payload = await response.json();
      const imported = Array.isArray(payload?.imported) ? payload.imported : [];
      const failed = Array.isArray(payload?.failed) ? payload.failed : [];
      const lastImported = imported[imported.length - 1] ?? null;
      const importedByFilename = new Map(
        imported.map((item: any) => [item.filename, item] as [string, any]),
      );
      const failedByFilename = new Map(
        failed.map((item: any) => [item.filename, item] as [string, any]),
      );

      setImportFileResults(
        Object.fromEntries(
          importFiles.map((file) => {
            const filePath = getImportFilePath(file);
            const fileKey = getImportFileKey(file);
            const failedResult = failedByFilename.get(filePath) as any;
            if (failedResult) {
              return [
                fileKey,
                {
                  status: 'error',
                  error: failedResult.error || 'Не удалось импортировать файл.',
                },
              ];
            }

            if (importedByFilename.has(filePath)) {
              return [fileKey, { status: 'success' }];
            }

            return [fileKey, { status: 'idle' }];
          }),
        ),
      );

      if (imported.length > 0) {
        await refetch();
      }

      const lastImportedProcessConfigId = getImportedProcessConfigId(lastImported);
      const lastImportedProcessId = getImportedProcessId(lastImported);

      if (lastImportedProcessConfigId) {
        setSelectedConfigId(lastImportedProcessConfigId);
        setSelectedNodeId(lastImportedProcessId ? `process:${lastImportedProcessId}` : null);
        setEditorNodeId(lastImportedProcessId ? `process:${lastImportedProcessId}` : null);
        setViewerNodeId(null);
        setOrderNodeId(null);
        setIsEditorOpen(Boolean(lastImportedProcessId));
      }

      if (imported.length > 0) {
        showSuccessToast(
          'Импорт завершён',
          failed.length > 0
            ? `Создано процессов: ${imported.length}. Не импортировано файлов: ${failed.length}.`
            : imported.length > 1
              ? `Создано процессов: ${imported.length}.`
              : `Файл ${imported[0]?.filename ?? 'YAML'} успешно импортирован.`,
        );
      }

      if (imported.length === 0 && failed.length > 0) {
        setImportErrorMessage('Не удалось импортировать выбранные YAML-файлы. Ошибки отмечены в списке.');
      } else if (failed.length > 0) {
        setImportErrorMessage('Часть YAML-файлов не импортирована. Нажмите на иконку ошибки рядом с файлом.');
      }
    } catch (requestError) {
      reportError(setImportErrorMessage, requestError, 'Не удалось импортировать YAML-файлы.');
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
      reportError(setUpdateErrorMessage, mutationError, 'Не удалось изменить порядок stage.');
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
      reportError(setUpdateErrorMessage, mutationError, 'Не удалось изменить порядок reverse output.');
    }
  };

  const handleOpenToastDetails = () => {
    if (toast?.variant !== 'error' || !toast.errorInfo) {
      return;
    }

    setErrorDetails(toast.errorInfo);
    setToast(null);
  };

  return (
    <Page>
      <div className="topology-workspace">
        <div className="topology-stage">
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
                    <Button variant="secondary" onClick={handleOpenProcessCodeManager}>
                      Коды процесса
                    </Button>
                    <Button variant="secondary" onClick={handleOpenStandaloneJsonLogicPlayground}>
                      Playground JsonLogic
                    </Button>
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
              processTreeSidebar={
                <ProcessTreeSidebar
                  processConfigs={processConfigs}
                  selectedProcessConfigId={activeProcessConfig?.id ?? ''}
                  processTreeState={processTreeState}
                  expandedFolderIds={expandedProcessTreeFolderIds}
                  onToggleFolder={handleToggleProcessTreeFolder}
                  onCreateProcess={handleCreateProcess}
                  onCreateFolder={handleCreateProcessTreeFolder}
                  onRenameFolder={handleRenameProcessTreeFolder}
                  onDeleteFolder={handleDeleteProcessTreeFolder}
                  onMoveProcess={handleMoveProcessTreeProcess}
                  onSelectProcessConfig={handleSelectProcessConfig}
                  onImportProcessConfig={handleOpenImportModal}
                  onExportProcessConfig={handleOpenExportModal}
                  onDeleteProcessConfig={handleDeleteProcessConfig}
                  isCreateProcessDisabled={processCodeOptions.length === 0 || createState.loading}
                />
              }
              selectedProcessConfigId={activeProcessConfig?.id ?? ''}
              selectedNodeId={selectedNodeId}
              expandedNodeIds={expandedNodeIds}
              onToggleNode={handleToggleNode}
              onExpandAllNodes={handleExpandAllNodes}
              onCollapseAllNodes={handleCollapseAllNodes}
              onEditNode={handleEditNode}
              onViewNode={handleViewNode}
              onReorderSubprocessNode={handleReorderSubprocessNode}
              onReorderReverseNode={handleReorderReverseNode}
              onDeleteNode={handleDeleteNode}
              onAddChildNode={handleAddChildNode}
              onAddSubprocess={handleAddSubprocess}
              onOpenProcessCodeManager={handleOpenProcessCodeManager}
              onOpenJsonLogicPlayground={handleOpenStandaloneJsonLogicPlayground}
              onOpenProcessPlayground={handleOpenProcessPlayground}
              onOpenCurrentProcessPlayground={handleOpenCurrentProcessPlayground}
              onResetCurrentProcessPlayground={resetFlowPlayback}
              executedNodeIds={flowExecutedNodeIds}
              isCurrentProcessPlaygroundRunning={isEvaluatingFlowProcessPlayground}
              isFlowPlaybackRunning={isFlowPlaybackRunning}
              hasCurrentProcessPlayback={flowExecutedNodeIds.length > 0 || Boolean(flowPlaybackRequest?.nodeIds?.length)}
              focusRequest={topologyFocusRequest}
              onSelectProcessConfig={handleSelectProcessConfig}
              editorMode={processEditorMode}
              onEditorModeChange={handleProcessEditorModeChange}
              yamlEditorText={yamlEditorText}
              onYamlEditorChange={setYamlEditorText}
              onYamlEditorSave={handleSaveYamlEditor}
              onYamlEditorReload={handleReloadYamlEditor}
              onYamlEditorBeautify={handleBeautifyYamlEditor}
              isYamlEditorLoading={isYamlEditorLoading}
              isYamlEditorSaving={isYamlEditorSaving}
              isYamlEditorBeautifying={isYamlEditorBeautifying}
              yamlEditorError={yamlEditorError}
              yamlEditorStatus={yamlEditorStatus}
              hasYamlEditorChanges={hasYamlEditorChanges}
              buildTopologyModel={buildTopologyModel}
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
                <button
                  type="button"
                  className={cn(
                    'editor-drawer__save-button editor-drawer__status flex items-center gap-2',
                    !editorIsSaving && !autosaveStatus?.secondsLeft && 'text-emerald-600',
                  )}
                  onClick={handleManualEditorSave}
                  disabled={editorIsSaving}
                  aria-label="Сохранить изменения сразу"
                  title="Сохранить изменения сразу"
                >
                  <Save01 aria-hidden size={16} className={cn(!editorIsSaving && !autosaveStatus?.secondsLeft && 'text-emerald-600')} />
                  {(editorIsSaving || autosaveStatus?.secondsLeft) && (
                    <span className={cn(!editorIsSaving && !autosaveStatus?.secondsLeft && 'text-emerald-600')}>
                      {editorIsSaving ? '...' : formatAutosaveCountdownLabel(autosaveStatus.secondsLeft)}
                    </span>
                  )}
                </button>
              </div>
              <Button variant="plain" onClick={handleCloseEditor} aria-label="Закрыть панель свойств">
                <XClose aria-hidden className="editor-drawer__close-icon" size={16} />
              </Button>
            </div>
            <div className="editor-drawer__body">
              <NodeEditor
                ref={nodeEditorRef}
                selected={findSelectedNode(activeProcessConfig, editorNodeId)}
                selectedNodeId={editorNodeId}
                onSave={handleSaveNode}
                onDraftChange={(values) => setEditorPreview(values ? { nodeId: editorNodeId, values } : null)}
                onAutosaveStatusChange={setAutosaveStatus}
                onOpenJsonLogicPlayground={handleOpenJsonLogicPlayground}
                onAddSubprocess={handleAddSubprocess}
                onBulkCreateResults={handleBulkCreateResults}
                onError={(errorValue, fallback) => showErrorToast(errorValue, fallback)}
                contextCodeOptions={processCodeOptions}
                phaseOptions={phaseOptions}
                b3StatusOptions={b3StatusOptions}
                slaDurationUnitOptions={slaDurationUnitOptions}
                slaStatusOptions={slaStatusOptions}
                isSaving={editorIsSaving}
                getNodeSavePayload={getNodeSavePayload}
                getNodePreviewPayload={getNodePreviewPayload}
                updateNestedValue={updateNestedValue}
                updateItemAt={updateItemAt}
                sanitizeInputScenarios={sanitizeInputScenarios}
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
              <NodeViewer
                processConfig={activeProcessConfig}
                selectedNodeId={viewerNodeId}
                findSelectedNode={findSelectedNode}
                formatReverseOutputEventType={formatReverseOutputEventType}
              />
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
                selected={findSelectedNode(activeProcessConfig, orderNodeId)}
                selectedNodeId={orderNodeId}
                onReorderStages={handleReorderStages}
                onReorderReverseOutputs={handleReorderReverseOutputs}
                isSaving={editorIsSaving}
                reorderItems={reorderItems}
                formatReverseOutputEventType={formatReverseOutputEventType}
              />
            </div>
          </aside>
          <FileUploadModal
            isOpen={isImportModalOpen}
            files={importFiles}
            fileResults={importFileResults}
            isSubmitting={isImportingProcessConfig}
            errorMessage={importErrorMessage}
            onClose={handleCloseImportModal}
            onSubmit={handleImportProcessConfigs}
            onFilesSelected={handleImportFilesSelected}
            onRemoveFile={handleRemoveImportFile}
            onShowFileError={handleShowImportFileError}
          />
          <ExportTypeModal
            isOpen={isExportModalOpen}
            isSubmitting={isExportingProcessConfig}
            errorMessage={exportErrorMessage}
            onClose={handleCloseExportModal}
            onSubmit={handleExportProcessConfig}
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
            onRuleChange={setJsonLogicPlaygroundRule}
            onEvaluate={handleEvaluateJsonLogic}
          />
          <ProcessPlaygroundModal
            isOpen={isProcessPlaygroundOpen}
            triggerText={processPlaygroundTrigger}
            triggerHistory={processPlaygroundTriggerHistory}
            result={processPlaygroundResult}
            isSubmitting={isEvaluatingProcessPlayground}
            onClose={handleCloseProcessPlayground}
            onTriggerChange={setProcessPlaygroundTrigger}
            onEvaluate={handleEvaluateProcessPlayground}
            onSelectTriggerHistoryItem={handleSelectProcessPlaygroundTriggerHistoryItem}
            onClearTriggerHistory={handleClearProcessPlaygroundTriggerHistory}
            onRemoveTriggerHistoryItem={handleRemoveProcessPlaygroundTriggerHistoryItem}
            onSelectNode={handleSelectProcessPlaygroundNode}
          />
          <FlowProcessPlaygroundModal
            isOpen={isFlowProcessPlaygroundOpen}
            triggerText={flowProcessPlaygroundTrigger}
            isSubmitting={isEvaluatingFlowProcessPlayground}
            errorMessage={flowProcessPlaygroundError}
            onClose={handleCloseFlowProcessPlayground}
            onTriggerChange={setFlowProcessPlaygroundTrigger}
            onEvaluate={handleEvaluateFlowProcessPlayground}
          />
          <ProcessCodeManagerModal
            isOpen={isProcessCodeManagerOpen}
            codes={processCodeOptions}
            codeUsage={processCodeUsage}
            isSubmitting={isProcessCodeManagerSubmitting}
            errorMessage={processCodeManagerError}
            onClose={handleCloseProcessCodeManager}
            onCreate={handleCreateProcessCode}
            onRename={handleRenameProcessCode}
            onDelete={handleDeleteProcessCode}
            onError={(errorValue, fallback) => showErrorToast(errorValue, fallback)}
          />
          <AppDialogModal dialog={appDialog} onResolve={closeAppDialog} />
          <ErrorDetailsModal errorInfo={errorDetails} onClose={() => setErrorDetails(null)} />
          {toast && (
            <Toast
              title={toast.title}
              message={toast.message}
              variant={toast.variant}
              onClose={() => setToast(null)}
              onClick={toast.variant === 'error' ? handleOpenToastDetails : undefined}
            />
          )}
        </div>
      </div>
    </Page>
  );
}
