import { CheckVerified02, XCircle } from '@untitledui/icons';
import { JsonSnippetEditor } from '../../../../components/modals/YamlModals';
import { ProcessSelectField } from '../../../../components/ProcessSelectField';
import { Checkbox, FormGroup, Text, TextArea, TextInput, Title } from '../../../../components/ui/AppPrimitives';

export function ReverseOutputFields({
  draft,
  updateReverseOutputDraft,
  phaseOptions,
  b3StatusOptions,
  slaDurationUnitOptions,
  slaStatusOptions,
  reverseOutputRuleText,
  setReverseOutputRuleText,
  reverseOutputRuleStatus,
  reverseOutputRuleError,
  handleFormatReverseOutputRule,
  onOpenJsonLogicPlayground,
}: any) {
  return (
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

  );
}
