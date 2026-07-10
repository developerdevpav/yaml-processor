import { CheckVerified02, Plus, Trash01, XCircle } from '@untitledui/icons';
import { JsonSnippetEditor } from '../../../../components/modals/YamlModals';
import { ProcessSelectField } from '../../../../components/ProcessSelectField';
import { Button, FormGroup, Text, TextArea, TextInput, Title } from '../../../../components/ui/AppPrimitives';

export function ProcessIdentityFields({ kind, draft, setDraft, updateDraftPath, contextCodeOptions }: any) {
  const isProcess = kind === 'process';

  return (
    <>
      <FormGroup label={isProcess ? 'Название процесса' : 'Название подпроцесса'} fieldId="process-node-name">
        <TextInput
          id="process-node-name"
          value={draft.nodeName ?? ''}
          onChange={(_, value) => setDraft((current) => ({ ...current, nodeName: value }))}
        />
        <Text component="small">
          {isProcess
            ? 'Название процесса необходимо для визуальной идентификации.'
            : 'Название подпроцесса необходимо для визуальной идентификации.'}
        </Text>
      </FormGroup>
      <FormGroup label={isProcess ? 'Описание процесса' : 'Описание подпроцесса'} fieldId="process-node-comment">
        <TextArea
          id="process-node-comment"
          value={draft.nodeComment ?? ''}
          onChange={(_, value) => setDraft((current) => ({ ...current, nodeComment: value }))}
          resizeOrientation="vertical"
        />
        <Text component="small">
          {isProcess
            ? 'Описание процесса необходимо для описания назначения процесса.'
            : 'Описание подпроцесса необходимо для описания назначения подпроцесса.'}
        </Text>
      </FormGroup>
      {isProcess && (
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
  );
}

export function SubprocessTriggerFields({
  subprocessTriggerText,
  setSubprocessTriggerText,
  subprocessTriggerStatus,
  subprocessTriggerError,
  handleFormatSubprocessTrigger,
  onOpenJsonLogicPlayground,
}: any) {
  return (
    <div className="stage-editor-section">
      <div className="stage-editor-inline-header">
        <Title headingLevel="h5">JsonLogic правило запуска</Title>
        <span className={subprocessTriggerStatus === 'valid' ? 'json-status json-status-valid' : 'json-status json-status-invalid'}>
          {subprocessTriggerStatus === 'valid' ? <CheckVerified02 aria-hidden size={16} /> : <XCircle aria-hidden size={16} />}
          {subprocessTriggerStatus === 'valid' ? 'JSON валиден' : 'JSON невалиден'}
        </span>
      </div>
      <JsonSnippetEditor
        id="subprocess-trigger"
        value={subprocessTriggerText}
        onChange={setSubprocessTriggerText}
        onBeautify={handleFormatSubprocessTrigger}
        onOpenPlayground={() =>
          onOpenJsonLogicPlayground?.('Playground для JsonLogic правила запуска', subprocessTriggerText)
        }
        helperText="Редактируйте JsonLogic правило запуска как JSON. Для выравнивания отступов используйте кнопку форматирования."
        error={subprocessTriggerError}
      />
    </div>
  );
}

export function ResultScenarioFields({
  draft,
  updateResultInputScenario,
  addDraftArrayItem,
  removeDraftArrayItem,
}: any) {
  return (
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
          <Button variant="secondary" onClick={() => addDraftArrayItem(['inputScenarios'], '')} className="w-full sm:w-auto">
            <Plus aria-hidden size={18} />
            Добавить сценарий
          </Button>
        </div>
        <Text component="small">
          Укажите сценарии, на которые система должна отвечать. Если во входящем событии значение
          `b3event.body.service.scenario` совпадет с одним из этих сценариев или подходящим паттерном, событие будет
          принято в обработку для формирования ответного события.
        </Text>
      </FormGroup>
    </div>
  );
}

export function ReverseStatusFields({ draft, setDraft, b3StatusOptions }: any) {
  return (
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
  );
}
