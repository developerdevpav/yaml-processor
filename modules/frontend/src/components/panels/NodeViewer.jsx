import { Card, CardBody, StaticField, StaticJsonField, Title } from '../ui/AppPrimitives';

export function NodeViewer({ processConfig, selectedNodeId, findSelectedNode, formatReverseOutputEventType }) {
  const selected = findSelectedNode(processConfig, selectedNodeId);

  if (!selected) {
    return null;
  }

  const node = selected.node;

  return (
    <Card className="editor-card">
      <CardBody className="space-y-4">
        {selected.kind === 'process' && (
          <>
            <StaticField label="Название процесса" value={node.nodeName || '—'} />
            <StaticField label="Описание процесса" value={node.nodeComment || '—'} />
            <StaticField label="Код процесса" value={node.contextCode?.code || '—'} />
          </>
        )}

        {selected.kind === 'subprocess' && (
          <>
            <StaticField label="Название подпроцесса" value={node.nodeName || '—'} />
            <StaticField label="Описание подпроцесса" value={node.nodeComment || '—'} />
            <StaticJsonField label="JsonLogic правило запуска" value={node.trigger?.rule ?? ''} />
          </>
        )}

        {selected.kind === 'stage' && (
          <>
            <StaticField label="Исполнитель" value={node.executor || '—'} />
            <StaticField label="Context code" value={node.contextCode?.code || '—'} />
            <StaticField label="Название" value={node.nodeName || '—'} />
            <StaticField label="Описание" value={node.nodeComment || '—'} />
            <StaticJsonField label="Правило JsonLogic" value={node.configurator?.filterEventRule ?? ''} />
            <div className="viewer-section">
              <Title headingLevel="h5">Настройка состояния стадии</Title>
              <StaticField label="Выключить" value={node.configurator?.disabled ? 'Да' : 'Нет'} />
              <StaticField label="Прервать обработку" value={node.configurator?.interrupted ? 'Да' : 'Нет'} />
              <StaticField label="Множественная обработка" value={node.configurator?.multiple ? 'Да' : 'Нет'} />
            </div>
            <div className="viewer-section">
              <Title headingLevel="h5">Настройка аудита</Title>
              <StaticField label="Включить" value={node.configurator?.audit?.enabled ? 'Да' : 'Нет'} />
              <StaticField label="Код события" value={node.configurator?.audit?.eventCode || '—'} />
              <StaticField label="Описание события" value={node.configurator?.audit?.eventDescription || '—'} />
            </div>
            <div className="viewer-section">
              <Title headingLevel="h5">Настройки логирования</Title>
              <StaticField label="Название в интеграционном журнале" value={node.log?.journalServiceName || '—'} />
            </div>
          </>
        )}

        {selected.kind === 'result' && (
          <div className="viewer-section">
            <Title headingLevel="h5">Обрабатываемые входящие сценарии</Title>
            <div className="viewer-list">
              {(node.inputScenarios?.length ? node.inputScenarios : ['—']).map((scenario, index) => (
                <div key={`${scenario}-${index}`} className="viewer-list__item">{scenario}</div>
              ))}
            </div>
          </div>
        )}

        {selected.kind === 'reverse' && (
          <StaticField label="STATUS" value={node.status?.code ? formatReverseOutputEventType(node.status.code) : '—'} />
        )}

        {selected.kind === 'reverseOutput' && (
          <>
            <StaticField label="Тип события" value={node.phase?.code || '—'} />
            <StaticField label="Идентификационное имя" value={node.name || '—'} />
            <StaticJsonField label="Правило JsonLogic" value={node.rule ?? ''} />
            <div className="viewer-section">
              <Title headingLevel="h5">B3Event Body</Title>
              <StaticField label="B3Event.body.type" value={node.body?.type || '—'} />
              <StaticField label="B3Event.body.status" value={node.body?.eventObject?.type || '—'} />
            </div>
            <div className="viewer-section">
              <Title headingLevel="h5">B3Event Service</Title>
              <StaticField label="B3Event.body.service.scenario" value={node.body?.service?.scenario || '—'} />
              <StaticField label="B3Event.body.service.type" value={node.body?.service?.type || '—'} />
              <StaticField label="B3Event.body.service.status" value={node.body?.service?.status?.code || '—'} />
            </div>
            <div className="viewer-section">
              <Title headingLevel="h5">SLA</Title>
              <StaticField label="B3Event.body.service.slaState.durationValue" value={node.body?.service?.sla?.durationValue ?? '—'} />
              <StaticField label="B3Event.body.service.slaState.durationUnit" value={node.body?.service?.sla?.durationUnit?.code || '—'} />
              <StaticField label="B3Event.body.service.slaState.status" value={node.body?.service?.sla?.status?.code || '—'} />
            </div>
            <div className="viewer-section">
              <Title headingLevel="h5">Настройки интеграционного журналирования</Title>
              <StaticField label="Название сервиса" value={node.log?.journalServiceName || '—'} />
              <StaticField label="Сообщение" value={node.log?.message || '—'} />
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
