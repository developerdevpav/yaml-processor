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
} from './components/modals/YamlModals';
import { NodeViewer } from './components/panels/NodeViewer';
import { ProcessTopology } from './components/topology/ProcessTopology';
import { ProcessSelectField } from './components/ProcessSelectField';
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
} from './components/ui/AppPrimitives';
import { cn, formatJsonSnippet, stringifyJsonForEditor } from './utils/ui';

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

function formatAutosaveCountdownLabel(secondsLeft) {
  return `${Math.max(1, Math.ceil(secondsLeft))} c`;
}

const CONTEXT_CODE_MAX_LENGTH = 64;

function normalizeProcessCode(value) {
  return String(value ?? '').trim();
}

function validateProcessCode(value) {
  const code = normalizeProcessCode(value);
  if (!code) {
    return 'Код процесса не должен быть пустым.';
  }

  if (code.length > CONTEXT_CODE_MAX_LENGTH) {
    return `Код процесса должен быть не длиннее ${CONTEXT_CODE_MAX_LENGTH} символов.`;
  }

  return '';
}

function incrementProcessCodeUsage(usageMap, rawCode, usageKey) {
  const code = normalizeProcessCode(rawCode);
  if (!code) {
    return;
  }

  const current = usageMap.get(code) ?? {
    processCount: 0,
    stageCount: 0,
    totalCount: 0,
  };

  usageMap.set(code, {
    ...current,
    [usageKey]: current[usageKey] + 1,
    totalCount: current.totalCount + 1,
  });
}

function buildProcessCodeUsage(processConfigs) {
  const usageMap = new Map();

  processConfigs.forEach((config) => {
    const process = config?.process;
    incrementProcessCodeUsage(usageMap, process?.contextCode?.code, 'processCount');

    (process?.subprocess ?? []).forEach((subprocess) => {
      (subprocess?.stages ?? []).forEach((stage) => {
        incrementProcessCodeUsage(usageMap, stage?.contextCode?.code, 'stageCount');
      });
    });
  });

  return usageMap;
}

function formatProcessCodeUsage(usage) {
  if (!usage?.totalCount) {
    return 'Не используется';
  }

  const parts = [];
  if (usage.processCount > 0) {
    parts.push(`процессов: ${usage.processCount}`);
  }
  if (usage.stageCount > 0) {
    parts.push(`стадий: ${usage.stageCount}`);
  }

  return `Используется, ${parts.join(', ')}`;
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
    parent {
      include
      mode
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

const CREATE_CONTEXT_CODE = gql`
  mutation CreateContextCode($code: ID!) {
    createContextCodesDictionary(input: { code: $code }) {
      code
    }
  }
`;

const RENAME_CONTEXT_CODE = gql`
  mutation RenameContextCode($id: ID!, $code: String!) {
    renameContextCodesDictionary(id: $id, code: $code) {
      code
    }
  }
`;

const DELETE_CONTEXT_CODE = gql`
  mutation DeleteContextCode($id: ID!) {
    deleteContextCodesDictionary(id: $id)
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

function createErrorInfo(error, fallback = 'Произошла ошибка.', options = {}) {
  const message = getErrorMessage(error, fallback) || fallback;

  return {
    id: createToastId(),
    title: options.title || 'Ошибка',
    message: options.message || message,
    details: getErrorDetails(error, fallback),
    occurredAt: new Date().toISOString(),
  };
}

function ErrorDetailsModal({ errorInfo, onClose }) {
  useEffect(() => {
    if (!errorInfo) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [errorInfo, onClose]);

  if (!errorInfo) {
    return null;
  }

  return (
    <div className="modal-shell error-details-modal" role="dialog" aria-modal="true" aria-labelledby="error-details-title">
      <div className="modal-shell__backdrop" onClick={onClose} />
      <div className="modal-card error-details-modal__card">
        <div className="modal-card__header">
          <div>
            <Title headingLevel="h4" className="modal-card__title">
              <span id="error-details-title">Информация об ошибке</span>
            </Title>
            <Text className="modal-card__subtitle">{errorInfo.message}</Text>
          </div>
          <button type="button" className="modal-card__close" onClick={onClose} aria-label="Закрыть информацию об ошибке">
            <XClose aria-hidden size={18} />
          </button>
        </div>

        <div className="error-details-modal__meta">
          <span>Время: {new Date(errorInfo.occurredAt).toLocaleString('ru-RU')}</span>
        </div>
        <pre className="error-details-modal__details">{errorInfo.details}</pre>
      </div>
    </div>
  );
}

function AppDialogModal({ dialog, onResolve }) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!dialog) {
      return;
    }

    setInputValue(dialog.defaultValue ?? '');
    const focusTimeoutId = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select?.();
    }, 0);

    return () => window.clearTimeout(focusTimeoutId);
  }, [dialog]);

  useEffect(() => {
    if (!dialog) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onResolve(dialog.type === 'prompt' ? null : false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialog, onResolve]);

  if (!dialog) {
    return null;
  }

  const isPrompt = dialog.type === 'prompt';
  const isAlert = dialog.type === 'alert';
  const titleId = `${dialog.id}-title`;
  const descriptionId = `${dialog.id}-description`;
  const cancelValue = isAlert ? true : isPrompt ? null : false;
  const confirmText = dialog.confirmText ?? (isAlert ? 'Ок' : 'Подтвердить');
  const cancelText = dialog.cancelText ?? 'Отмена';

  const handleSubmit = (event) => {
    event.preventDefault();
    onResolve(isPrompt ? inputValue : true);
  };

  return (
    <div
      className="modal-shell app-dialog-modal"
      role={dialog.variant === 'danger' ? 'alertdialog' : 'dialog'}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <div className="modal-shell__backdrop" onClick={() => onResolve(cancelValue)} />
      <form className="modal-card app-dialog-modal__card" onSubmit={handleSubmit}>
        <div className="modal-card__header">
          <div>
            <Title headingLevel="h4" className="modal-card__title" id={titleId}>
              {dialog.title}
            </Title>
            {dialog.message && (
              <p className="modal-card__subtitle app-dialog-modal__message" id={descriptionId}>
                {dialog.message}
              </p>
            )}
          </div>
          <button
            type="button"
            className="modal-card__close"
            onClick={() => onResolve(cancelValue)}
            aria-label="Закрыть"
          >
            <XClose aria-hidden size={18} />
          </button>
        </div>

        {isPrompt && (
          <div className="app-dialog-modal__body">
            <FormGroup label={dialog.inputLabel ?? dialog.title} fieldId={`${dialog.id}-input`}>
              <input
                ref={inputRef}
                id={`${dialog.id}-input`}
                className="app-dialog-modal__input"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder={dialog.placeholder ?? ''}
              />
            </FormGroup>
          </div>
        )}

        <div className="modal-card__footer">
          {!isAlert && (
            <Button type="button" variant="secondary" onClick={() => onResolve(cancelValue)}>
              {cancelText}
            </Button>
          )}
          <Button
            type="submit"
            className={dialog.variant === 'danger' ? 'app-dialog-modal__danger-button' : ''}
          >
            {confirmText}
          </Button>
        </div>
      </form>
    </div>
  );
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
const PROCESS_TREE_STORAGE_KEY = 'yamlProcessor.processTree.v1';
const ROOT_PROCESS_TREE_FOLDER_ID = 'root';
const PROCESS_TREE_DRAG_TYPE = 'application/x-yaml-processor-process-config';

function createProcessTreeFolderId() {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return `folder:${window.crypto.randomUUID()}`;
  }

  return `folder:${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeProcessTreeFolderName(value) {
  return String(value ?? '').trim();
}

function normalizeProcessTreeState(rawState, processConfigs = []) {
  const source = rawState && typeof rawState === 'object' ? rawState : {};
  const foldersSource = Array.isArray(source.folders) ? source.folders : [];
  const knownProcessIds = new Set((processConfigs ?? []).map((item) => String(item.id)).filter(Boolean));
  const processIdsAreKnown = knownProcessIds.size > 0;
  const folderIds = new Set([ROOT_PROCESS_TREE_FOLDER_ID]);
  const folders = [];

  foldersSource.forEach((folder) => {
    const folderId = typeof folder?.id === 'string' ? folder.id : '';
    if (!folderId || folderId === ROOT_PROCESS_TREE_FOLDER_ID || folderIds.has(folderId)) {
      return;
    }

    folderIds.add(folderId);
    folders.push({
      id: folderId,
      name: normalizeProcessTreeFolderName(folder.name) || 'Новая папка',
      parentId: typeof folder.parentId === 'string' ? folder.parentId : ROOT_PROCESS_TREE_FOLDER_ID,
    });
  });

  const normalizedFolders = folders.map((folder) => ({
    ...folder,
    parentId:
      folder.parentId !== folder.id && folderIds.has(folder.parentId)
        ? folder.parentId
        : ROOT_PROCESS_TREE_FOLDER_ID,
  }));
  const normalizedFolderIds = new Set([
    ROOT_PROCESS_TREE_FOLDER_ID,
    ...normalizedFolders.map((folder) => folder.id),
  ]);
  const processFolders = {};

  Object.entries(source.processFolders ?? {}).forEach(([processId, folderId]) => {
    const normalizedProcessId = String(processId);
    const normalizedFolderId = String(folderId);
    if (processIdsAreKnown && !knownProcessIds.has(normalizedProcessId)) {
      return;
    }
    if (!normalizedFolderIds.has(normalizedFolderId) || normalizedFolderId === ROOT_PROCESS_TREE_FOLDER_ID) {
      return;
    }

    processFolders[normalizedProcessId] = normalizedFolderId;
  });

  return {
    folders: normalizedFolders,
    processFolders,
  };
}

function readProcessTreeState() {
  if (typeof window === 'undefined') {
    return normalizeProcessTreeState(null);
  }

  try {
    const rawValue = window.localStorage.getItem(PROCESS_TREE_STORAGE_KEY);
    return normalizeProcessTreeState(rawValue ? JSON.parse(rawValue) : null);
  } catch {
    return normalizeProcessTreeState(null);
  }
}

function writeProcessTreeState(state) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(PROCESS_TREE_STORAGE_KEY, JSON.stringify(normalizeProcessTreeState(state)));
  } catch {
    // Tree organization is a local convenience; failure to persist should not block process editing.
  }
}

function getProcessConfigDisplayName(processConfig) {
  return (
    processConfig?.process?.nodeName?.trim() ||
    processConfig?.process?.contextCode?.code?.trim() ||
    'Process'
  );
}

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
  const expression = Array.from(pattern)
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

const NodeEditor = forwardRef(function NodeEditor({
  processConfig,
  selectedNodeId,
  onSave,
  onDraftChange,
  onAutosaveStatusChange,
  onOpenJsonLogicPlayground,
  onAddSubprocess,
  onBulkCreateResults,
  onError,
  contextCodeOptions,
  phaseOptions,
  b3StatusOptions,
  slaDurationUnitOptions,
  slaStatusOptions,
  isSaving,
}, ref) {
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
  const onErrorRef = useRef(onError);
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
    onErrorRef.current = onError;
  }, [onError]);

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

  useImperativeHandle(
    ref,
    () => ({
      saveNow: async () => {
        if (!selected) {
          return false;
        }

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
          return false;
        }

        const nextPayloadSnapshot = JSON.stringify(nextPayload);
        if (nextPayloadSnapshot === lastSavedPayloadRef.current) {
          clearAutosaveScheduling();
          return true;
        }

        clearAutosaveScheduling();
        const saved = await onSaveRef.current(nextPayload);
        if (saved) {
          lastSavedPayloadRef.current = nextPayloadSnapshot;
        }

        return saved;
      },
    }),
    [draft, filterEventRuleText, ref, reverseOutputRuleText, selected, selectedKind, subprocessTriggerText],
  );

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
        .catch((saveError) => {
          onErrorRef.current?.(saveError, 'Не удалось автоматически сохранить изменения.');
        });
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
      const errorMessage = 'Trigger rule должен быть валидным JSON, чтобы его можно было форматировать.';
      setSubprocessTriggerError(errorMessage);
      setSubprocessTriggerStatus('invalid');
      onErrorRef.current?.(errorMessage, errorMessage);
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
      const errorMessage = 'Filter event rule должен быть валидным JSON, чтобы его можно было форматировать.';
      setFilterEventRuleError(errorMessage);
      setFilterEventRuleStatus('invalid');
      onErrorRef.current?.(errorMessage, errorMessage);
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
      const errorMessage = 'Правило должно быть валидным JSON, чтобы его можно было форматировать.';
      setReverseOutputRuleError(errorMessage);
      setReverseOutputRuleStatus('invalid');
      onErrorRef.current?.(errorMessage, errorMessage);
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
    parent: {
      include: true,
      mode: 'SURFACE',
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
                <Title headingLevel="h5">Родительский процесс</Title>
                <FormGroup label="" fieldId="reverse-output-parent-include">
                  <Checkbox
                    id="reverse-output-parent-include"
                    isChecked={draft.parent?.include ?? true}
                    onChange={(_, checked) =>
                      updateReverseOutputDraft((current) => ({
                        ...current,
                        parent: {
                          ...(current.parent ?? {}),
                          include: checked,
                          mode: current.parent?.mode ?? 'SURFACE',
                        },
                      }))
                    }
                    label="Включить установку родительского процесса"
                  />
                </FormGroup>
                <FormGroup label="Источник родительского процесса" fieldId="reverse-output-parent-mode">
                  <ProcessSelectField
                    id="reverse-output-parent-mode"
                    value={draft.parent?.mode ?? 'SURFACE'}
                    onChange={(mode) =>
                      updateReverseOutputDraft((current) => ({
                        ...current,
                        parent: {
                          ...(current.parent ?? {}),
                          include: current.parent?.include ?? true,
                          mode: mode || 'SURFACE',
                        },
                      }))
                    }
                    options={[
                      {
                        value: 'SURFACE',
                        label: 'SURFACE',
                        description: 'Устанавливать из входящего события',
                      },
                      {
                        value: 'DEEP',
                        label: 'DEEP',
                        description: 'Устанавливать из родителя входящего события',
                      },
                    ]}
                    placeholder="Выберите источник"
                  />
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
});

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

function ProcessTreeSidebar({
  processConfigs,
  selectedProcessConfigId,
  processTreeState,
  expandedFolderIds,
  onToggleFolder,
  onCreateProcess,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveProcess,
  onSelectProcessConfig,
  onImportProcessConfig,
  onExportProcessConfig,
  onDeleteProcessConfig,
  isCreateProcessDisabled = false,
}) {
  const [dropTargetFolderId, setDropTargetFolderId] = useState(null);
  const folders = processTreeState?.folders ?? [];
  const processFolders = processTreeState?.processFolders ?? {};
  const expandedFolderSet = useMemo(() => new Set(expandedFolderIds ?? []), [expandedFolderIds]);
  const folderIds = useMemo(
    () => new Set([ROOT_PROCESS_TREE_FOLDER_ID, ...folders.map((folder) => folder.id)]),
    [folders],
  );
  const foldersByParent = useMemo(() => {
    const next = new Map();
    folders.forEach((folder) => {
      const parentId = folderIds.has(folder.parentId) ? folder.parentId : ROOT_PROCESS_TREE_FOLDER_ID;
      const current = next.get(parentId) ?? [];
      current.push(folder);
      next.set(parentId, current);
    });

    next.forEach((items) => {
      items.sort((left, right) => left.name.localeCompare(right.name, 'ru'));
    });

    return next;
  }, [folderIds, folders]);
  const processesByFolder = useMemo(() => {
    const next = new Map([[ROOT_PROCESS_TREE_FOLDER_ID, []]]);
    processConfigs.forEach((processConfig) => {
      const configuredFolderId = processFolders[String(processConfig.id)];
      const folderId = folderIds.has(configuredFolderId) ? configuredFolderId : ROOT_PROCESS_TREE_FOLDER_ID;
      const current = next.get(folderId) ?? [];
      current.push(processConfig);
      next.set(folderId, current);
    });

    next.forEach((items) => {
      items.sort((left, right) => getProcessConfigDisplayName(left).localeCompare(getProcessConfigDisplayName(right), 'ru'));
    });

    return next;
  }, [folderIds, processConfigs, processFolders]);

  const handleDragStartProcess = (event, processConfigId) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(PROCESS_TREE_DRAG_TYPE, String(processConfigId));
  };

  const handleDragOverFolder = (event, folderId) => {
    if (!Array.from(event.dataTransfer.types).includes(PROCESS_TREE_DRAG_TYPE)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropTargetFolderId(folderId);
  };

  const handleDropOnFolder = (event, folderId) => {
    const processConfigId = event.dataTransfer.getData(PROCESS_TREE_DRAG_TYPE);
    if (!processConfigId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setDropTargetFolderId(null);
    onMoveProcess(processConfigId, folderId);
  };

  const countProcessesInsideFolder = (folderId, visitedFolderIds = new Set()) => {
    if (visitedFolderIds.has(folderId)) {
      return 0;
    }

    const nextVisited = new Set(visitedFolderIds);
    nextVisited.add(folderId);

    return (
      (processesByFolder.get(folderId) ?? []).length +
      (foldersByParent.get(folderId) ?? []).reduce(
        (sum, childFolder) => sum + countProcessesInsideFolder(childFolder.id, nextVisited),
        0,
      )
    );
  };

  const folderHasChildren = (folderId) =>
    (foldersByParent.get(folderId) ?? []).length > 0 || (processesByFolder.get(folderId) ?? []).length > 0;

  const renderProcess = (processConfig, level) => {
    const processConfigId = String(processConfig.id);
    const isSelected = processConfigId === selectedProcessConfigId;
    const label = getProcessConfigDisplayName(processConfig);

    return (
      <div
        key={processConfigId}
        className={cn('process-tree__process', isSelected && 'process-tree__process--active')}
        style={{ paddingLeft: `${0.45 + level * 0.9 + (level > 0 ? 1.95 : 0)}rem` }}
        draggable
        onDragStart={(event) => handleDragStartProcess(event, processConfigId)}
      >
        <button
          type="button"
          className="process-tree__process-main"
          onClick={() => onSelectProcessConfig(processConfigId)}
        >
          <File02 aria-hidden size={16} className="process-tree__item-icon" />
          <span className="process-tree__item-text">
            <span className="process-tree__item-title">{label}</span>
          </span>
        </button>
        <button
          type="button"
          className="process-tree__process-action process-tree__process-action--export"
          onClick={(event) => {
            event.stopPropagation();
            onExportProcessConfig(processConfigId);
          }}
          aria-label={`Экспортировать процесс ${label}`}
          title="Экспортировать процесс"
        >
          <Download01 aria-hidden size={15} />
        </button>
        <button
          type="button"
          className="process-tree__process-action process-tree__process-action--delete"
          onClick={(event) => {
            event.stopPropagation();
            onDeleteProcessConfig(processConfigId);
          }}
          aria-label={`Удалить процесс ${label}`}
          title="Удалить процесс"
        >
          <Trash01 aria-hidden size={15} />
        </button>
      </div>
    );
  };

  const renderFolder = (folder, level, visitedFolderIds = new Set()) => {
    if (visitedFolderIds.has(folder.id)) {
      return null;
    }

    const nextVisited = new Set(visitedFolderIds);
    nextVisited.add(folder.id);
    const childFolders = foldersByParent.get(folder.id) ?? [];
    const folderProcesses = processesByFolder.get(folder.id) ?? [];
    const isExpanded = expandedFolderSet.has(folder.id);
    const processCount = countProcessesInsideFolder(folder.id);
    const isDropTarget = dropTargetFolderId === folder.id;
    const hasChildren = folderHasChildren(folder.id);

    return (
      <div key={folder.id} className="process-tree__folder" role="treeitem" aria-expanded={isExpanded}>
        <div
          className={cn('process-tree__folder-row', isDropTarget && 'process-tree__drop-target')}
          style={{ paddingLeft: `${0.45 + level * 0.9}rem` }}
          onDragOver={(event) => handleDragOverFolder(event, folder.id)}
          onDragLeave={() => setDropTargetFolderId(null)}
          onDrop={(event) => handleDropOnFolder(event, folder.id)}
        >
          <button
            type="button"
            className="process-tree__toggle"
            onClick={() => onToggleFolder(folder.id)}
            aria-label={isExpanded ? `Свернуть папку ${folder.name}` : `Раскрыть папку ${folder.name}`}
          >
            <ChevronRight aria-hidden size={14} className={cn('process-tree__toggle-icon', isExpanded && 'process-tree__toggle-icon--open')} />
          </button>
          <button type="button" className="process-tree__folder-name" onClick={() => onToggleFolder(folder.id)}>
            <Folder aria-hidden size={16} className="process-tree__item-icon process-tree__item-icon--folder" />
            <span className="process-tree__item-text">
              <span className="process-tree__item-title">{folder.name}</span>
            </span>
          </button>
          <div className="process-tree__folder-actions">
            <button
              type="button"
              className="process-tree__icon-button"
              onClick={() => onCreateFolder(folder.id)}
              aria-label={`Создать подпапку в ${folder.name}`}
              title="Создать подпапку"
            >
              <FolderPlus aria-hidden size={15} />
            </button>
            <button
              type="button"
              className="process-tree__icon-button"
              onClick={() => onRenameFolder(folder.id)}
              aria-label={`Переименовать папку ${folder.name}`}
              title="Переименовать"
            >
              <Edit02 aria-hidden size={15} />
            </button>
            <button
              type="button"
              className="process-tree__icon-button process-tree__icon-button--danger"
              onClick={() => onDeleteFolder(folder.id)}
              disabled={hasChildren}
              aria-label={`Удалить папку ${folder.name}`}
              title={hasChildren ? 'Удалить можно только пустую папку' : 'Удалить'}
            >
              <Trash01 aria-hidden size={15} />
            </button>
          </div>
          <span className="process-tree__counter">{processCount}</span>
        </div>
        {isExpanded && (
          <div className="process-tree__children" role="group">
            {childFolders.map((childFolder) => renderFolder(childFolder, level + 1, nextVisited))}
            {folderProcesses.map((processConfig) => renderProcess(processConfig, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const rootFolders = foldersByParent.get(ROOT_PROCESS_TREE_FOLDER_ID) ?? [];
  const rootProcesses = processesByFolder.get(ROOT_PROCESS_TREE_FOLDER_ID) ?? [];
  const rootProcessCount = processConfigs.length;
  const isRootDropTarget = dropTargetFolderId === ROOT_PROCESS_TREE_FOLDER_ID;

  return (
    <div className="process-tree">
      <div
        className={cn('process-tree__root', isRootDropTarget && 'process-tree__drop-target')}
        onDragOver={(event) => handleDragOverFolder(event, ROOT_PROCESS_TREE_FOLDER_ID)}
        onDragLeave={() => setDropTargetFolderId(null)}
        onDrop={(event) => handleDropOnFolder(event, ROOT_PROCESS_TREE_FOLDER_ID)}
      >
        <Inbox02 aria-hidden size={17} className="process-tree__item-icon" />
        <div className="process-tree__root-title">
          <span>Процессы</span>
          <span>{rootProcessCount}</span>
        </div>
        <div className="process-tree__root-actions">
          <button
            type="button"
            className="process-tree__icon-button process-tree__icon-button--strong"
            onClick={onCreateProcess}
            disabled={isCreateProcessDisabled}
            aria-label="Создать процесс"
            title="Создать процесс"
          >
            <svg
              aria-hidden
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M20 10.5V6.8C20 5.11984 20 4.27976 19.673 3.63803C19.3854 3.07354 18.9265 2.6146 18.362 2.32698C17.7202 2 16.8802 2 15.2 2H8.8C7.11984 2 6.27976 2 5.63803 2.32698C5.07354 2.6146 4.6146 3.07354 4.32698 3.63803C4 4.27976 4 5.11984 4 6.8V17.2C4 18.8802 4 19.7202 4.32698 20.362C4.6146 20.9265 5.07354 21.3854 5.63803 21.673C6.27976 22 7.11984 22 8.8 22H12M14 11H8M10 15H8M16 7H8M18 21V15M15 18H21"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            type="button"
            className="process-tree__icon-button process-tree__icon-button--strong"
            onClick={() => onCreateFolder(ROOT_PROCESS_TREE_FOLDER_ID)}
            aria-label="Создать папку"
            title="Создать папку"
          >
            <FolderPlus aria-hidden size={16} />
          </button>
          <button
            type="button"
            className="process-tree__icon-button process-tree__icon-button--strong"
            onClick={onImportProcessConfig}
            aria-label="Импортировать процесс"
            title="Импортировать процесс"
          >
            <svg
              aria-hidden
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M20 12.5V6.8C20 5.11984 20 4.27976 19.673 3.63803C19.3854 3.07354 18.9265 2.6146 18.362 2.32698C17.7202 2 16.8802 2 15.2 2H8.8C7.11984 2 6.27976 2 5.63803 2.32698C5.07354 2.6146 4.6146 3.07354 4.32698 3.63803C4 4.27976 4 5.11984 4 6.8V17.2C4 18.8802 4 19.7202 4.32698 20.362C4.6146 20.9265 5.07354 21.3854 5.63803 21.673C6.27976 22 7.1198 22 8.79986 22H12.5M14 11H8M10 15H8M16 7H8M15 19L18 22M18 22L21 19M18 22V16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
      <div className="process-tree__content" role="tree" aria-label="Дерево процессов">
        {rootFolders.map((folder) => renderFolder(folder, 0))}
        {rootProcesses.map((processConfig) => renderProcess(processConfig, 0))}
        {processConfigs.length === 0 && (
          <div className="process-tree__empty">Нет процессов</div>
        )}
      </div>
    </div>
  );
}

function ProcessCodeManagerModal({
  isOpen,
  codes,
  codeUsage = new Map(),
  isSubmitting,
  errorMessage,
  onClose,
  onCreate,
  onRename,
  onDelete,
  onError,
}) {
  const [newCode, setNewCode] = useState('');
  const [draftCodes, setDraftCodes] = useState({});
  const [localError, setLocalError] = useState('');
  const codesSnapshot = codes.join('\u0000');

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setNewCode('');
    setLocalError('');
    setDraftCodes(Object.fromEntries(codes.map((code) => [code, code])));
  }, [codesSnapshot, isOpen]);

  if (!isOpen) {
    return null;
  }

  const sortedCodes = [...codes].sort((left, right) => left.localeCompare(right));
  const codeSet = new Set(codes);
  const visibleError = localError || errorMessage;
  const showLocalError = (message) => {
    setLocalError(message);
    onError?.(message, message);
  };

  const validateUniqueCode = (value, currentCode = '') => {
    const validationError = validateProcessCode(value);
    if (validationError) {
      return validationError;
    }

    const normalizedCode = normalizeProcessCode(value);
    if (normalizedCode !== currentCode && codeSet.has(normalizedCode)) {
      return `Код процесса "${normalizedCode}" уже существует.`;
    }

    return '';
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    const validationError = validateUniqueCode(newCode);
    if (validationError) {
      showLocalError(validationError);
      return;
    }

    setLocalError('');
    const created = await onCreate(normalizeProcessCode(newCode));
    if (created) {
      setNewCode('');
    }
  };

  const handleRename = async (currentCode) => {
    const nextCode = normalizeProcessCode(draftCodes[currentCode] ?? currentCode);
    const validationError = validateUniqueCode(nextCode, currentCode);
    if (validationError) {
      showLocalError(validationError);
      return;
    }

    if (nextCode === currentCode) {
      return;
    }

    setLocalError('');
    await onRename(currentCode, nextCode);
  };

  const handleDelete = async (code) => {
    const usage = codeUsage.get(code);
    if (usage?.totalCount > 0) {
      showLocalError(`Код процесса "${code}" нельзя удалить. ${formatProcessCodeUsage(usage)}.`);
      return;
    }

    setLocalError('');
    await onDelete(code);
  };

  return (
    <div className="modal-shell" role="dialog" aria-modal="true" aria-labelledby="process-code-manager-title">
      <div className="modal-shell__backdrop" onClick={isSubmitting ? undefined : onClose} />
      <div className="modal-card process-code-modal">
        <div className="modal-card__header">
          <div>
            <Title headingLevel="h3" className="modal-card__title" id="process-code-manager-title">
              Код процесса
            </Title>
            <Text component="small" className="modal-card__subtitle">
              Создавайте, переименовывайте и удаляйте неиспользуемые значения справочника contextCodesDictionaryList.
            </Text>
          </div>
          <button
            type="button"
            className="modal-card__close"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Закрыть"
          >
            <XClose aria-hidden size={18} />
          </button>
        </div>

        <form className="process-code-manager__create" onSubmit={handleCreate}>
          <TextInput
            value={newCode}
            onChange={(_, value) => setNewCode(value)}
            placeholder="Новый код"
            maxLength={CONTEXT_CODE_MAX_LENGTH}
            aria-label="Новый код процесса"
          />
          <Button type="submit" isLoading={isSubmitting} isDisabled={isSubmitting}>
            Создать
          </Button>
        </form>

        <div className="process-code-manager__list">
          {sortedCodes.length === 0 ? (
            <div className="process-code-manager__empty">Справочник кодов процесса пока пуст.</div>
          ) : (
            sortedCodes.map((code) => {
              const draftValue = draftCodes[code] ?? code;
              const normalizedDraftValue = normalizeProcessCode(draftValue);
              const isChanged = normalizedDraftValue !== code;
              const usage = codeUsage.get(code);
              const isUsed = Boolean(usage?.totalCount);
              const usageLabel = formatProcessCodeUsage(usage);

              return (
                <div key={code} className="process-code-manager__row">
                  <TextInput
                    value={draftValue}
                    onChange={(_, value) =>
                      setDraftCodes((current) => ({
                        ...current,
                        [code]: value,
                      }))
                    }
                    maxLength={CONTEXT_CODE_MAX_LENGTH}
                    aria-label={`Код процесса ${code}`}
                  />
                  <span
                    className={cn(
                      'process-code-manager__usage',
                      !isUsed && 'process-code-manager__usage--free',
                    )}
                  >
                    {usageLabel}
                  </span>
                  <Button
                    variant="secondary"
                    onClick={() => handleRename(code)}
                    isDisabled={isSubmitting || !isChanged || !normalizedDraftValue}
                  >
                    Сохранить
                  </Button>
                  <Button
                    variant="plain"
                    className="process-code-manager__delete"
                    onClick={() => handleDelete(code)}
                    isDisabled={isSubmitting || isUsed}
                    aria-label={`Удалить код процесса ${code}`}
                    title={isUsed ? usageLabel : `Удалить код процесса ${code}`}
                  >
                    <Trash01 aria-hidden size={16} />
                  </Button>
                </div>
              );
            })
          )}
        </div>

        {visibleError && <div className="process-code-manager__error">{visibleError}</div>}
      </div>
    </div>
  );
}

export function App() {
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
    setIsImportModalOpen(true);
  };

  const handleCloseImportModal = (force = false) => {
    if (isImportingProcessConfig && !force) {
      return;
    }

    setIsImportModalOpen(false);
    setImportFiles([]);
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
                processConfig={activeProcessConfig}
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
            isSubmitting={isImportingProcessConfig}
            errorMessage={importErrorMessage}
            onClose={handleCloseImportModal}
            onSubmit={handleImportProcessConfigs}
            onFilesSelected={handleImportFilesSelected}
            onRemoveFile={handleRemoveImportFile}
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
