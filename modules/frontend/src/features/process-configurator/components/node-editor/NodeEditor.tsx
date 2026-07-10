import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Card, CardBody, Form } from '../../../../components/ui/AppPrimitives';
import { formatCompactJsonLogicSnippet, stringifyCompactJsonLogicForEditor } from '../../../../utils/ui';
import {
  ProcessIdentityFields,
  ResultScenarioFields,
  ReverseStatusFields,
  SubprocessTriggerFields,
} from './BasicNodeFields';
import { ReverseOutputFields } from './ReverseOutputFields';
import { StageFields } from './StageFields';

const NODE_AUTOSAVE_DELAY_MS = 3_000;
const NODE_NAME_HELPER_TEXT = 'Название узла нужно для визуальной идентификации на схеме и в редакторе.';
const NODE_COMMENT_HELPER_TEXT = 'Описание узла помогает понять его назначение и отображается в карточке узла.';

export const NodeEditor = forwardRef<any, any>(function NodeEditor({
  selected,
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
  getNodeSavePayload,
  getNodePreviewPayload,
  updateNestedValue,
  updateItemAt,
  sanitizeInputScenarios,
}: any, ref) {
  const [draft, setDraft] = useState<any>({});
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
  const draftRef = useRef<any>({});
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

    setSubprocessTriggerText(formatCompactJsonLogicSnippet(selected.node?.trigger?.rule ?? ''));
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

    setFilterEventRuleText(formatCompactJsonLogicSnippet(selected.node?.configurator?.filterEventRule ?? ''));
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

    setReverseOutputRuleText(formatCompactJsonLogicSnippet(selected.node?.rule ?? ''));
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
      setSubprocessTriggerText(stringifyCompactJsonLogicForEditor(parsedTrigger));
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
      setFilterEventRuleText(stringifyCompactJsonLogicForEditor(parsedFilterEventRule));
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
      setReverseOutputRuleText(stringifyCompactJsonLogicForEditor(parsedRule));
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
            <ProcessIdentityFields
              kind={selected.kind}
              draft={draft}
              setDraft={setDraft}
              updateDraftPath={updateDraftPath}
              contextCodeOptions={contextCodeOptions}
            />
          )}

          {selected.kind === 'stage' && (
            <StageFields
              draft={draft}
              setDraft={setDraft}
              updateDraftPath={updateDraftPath}
              contextCodeOptions={contextCodeOptions}
              filterEventRuleText={filterEventRuleText}
              setFilterEventRuleText={setFilterEventRuleText}
              filterEventRuleStatus={filterEventRuleStatus}
              filterEventRuleError={filterEventRuleError}
              handleFormatFilterEventRule={handleFormatFilterEventRule}
              onOpenJsonLogicPlayground={onOpenJsonLogicPlayground}
              nodeNameHelperText={NODE_NAME_HELPER_TEXT}
              nodeCommentHelperText={NODE_COMMENT_HELPER_TEXT}
            />
          )}

          {selected.kind === 'subprocess' && (
            <SubprocessTriggerFields
              subprocessTriggerText={subprocessTriggerText}
              setSubprocessTriggerText={setSubprocessTriggerText}
              subprocessTriggerStatus={subprocessTriggerStatus}
              subprocessTriggerError={subprocessTriggerError}
              handleFormatSubprocessTrigger={handleFormatSubprocessTrigger}
              onOpenJsonLogicPlayground={onOpenJsonLogicPlayground}
            />
          )}

          {selected.kind === 'result' && (
            <ResultScenarioFields
              draft={draft}
              updateResultInputScenario={updateResultInputScenario}
              addDraftArrayItem={addDraftArrayItem}
              removeDraftArrayItem={removeDraftArrayItem}
            />
          )}

          {selected.kind === 'reverse' && (
            <ReverseStatusFields draft={draft} setDraft={setDraft} b3StatusOptions={b3StatusOptions} />
          )}

          {selected.kind === 'reverseOutput' && (
            <ReverseOutputFields
              draft={draft}
              updateReverseOutputDraft={updateReverseOutputDraft}
              phaseOptions={phaseOptions}
              b3StatusOptions={b3StatusOptions}
              slaDurationUnitOptions={slaDurationUnitOptions}
              slaStatusOptions={slaStatusOptions}
              reverseOutputRuleText={reverseOutputRuleText}
              setReverseOutputRuleText={setReverseOutputRuleText}
              reverseOutputRuleStatus={reverseOutputRuleStatus}
              reverseOutputRuleError={reverseOutputRuleError}
              handleFormatReverseOutputRule={handleFormatReverseOutputRule}
              onOpenJsonLogicPlayground={onOpenJsonLogicPlayground}
            />
          )}

          <div className="editor-actions">
          </div>
        </Form>
      </CardBody>
    </Card>
  );
});
