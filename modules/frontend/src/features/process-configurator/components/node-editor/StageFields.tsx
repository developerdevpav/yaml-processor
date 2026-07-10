import { CheckVerified02, XCircle } from '@untitledui/icons';
import { JsonSnippetEditor } from '../../../../components/modals/YamlModals';
import { ProcessSelectField } from '../../../../components/ProcessSelectField';
import { Checkbox, FormGroup, Text, TextArea, TextInput, Title } from '../../../../components/ui/AppPrimitives';

export function StageFields({
  draft,
  setDraft,
  updateDraftPath,
  contextCodeOptions,
  filterEventRuleText,
  setFilterEventRuleText,
  filterEventRuleStatus,
  filterEventRuleError,
  handleFormatFilterEventRule,
  onOpenJsonLogicPlayground,
  nodeNameHelperText,
  nodeCommentHelperText,
}: any) {
  return (
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
      <Text component="small">{nodeNameHelperText}</Text>
    </FormGroup>
    <FormGroup label="Описание" fieldId="stage-node-comment">
      <TextArea
        id="stage-node-comment"
        value={draft.nodeComment ?? ''}
        onChange={(_, value) => setDraft((current) => ({ ...current, nodeComment: value }))}
        resizeOrientation="vertical"
      />
      <Text component="small">{nodeCommentHelperText}</Text>
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
  );
}
