import { BellRinging04, CheckVerified02, Edit01, Eye, NotificationBox, Plus, Rows01, Trash01, ZapCircle } from '@untitledui/icons';
import { Handle, Position } from 'reactflow';
import { cn } from '../../../utils/ui';

function truncateText(value, maxLength = 84) {
  if (!value) {
    return '';
  }

  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}
export function ProcessNode({ data, selected }) {
  const title = data?.title ?? 'node';
  const subtitle = truncateText(data?.secondaryLabel ?? '');
  const kind = data?.kind ?? 'node';
  const summaryItems = data?.summaryItems ?? [];
  const childCount = data?.childCount;
  const isExpandable = Boolean(data?.isExpandable);
  const isExpanded = Boolean(data?.isExpanded);
  const nodeStyle = data?.nodeHeight
    ? kind === 'reverseOutput'
      ? { minHeight: `${data.nodeHeight}px` }
      : { height: `${data.nodeHeight}px`, minHeight: `${data.nodeHeight}px` }
    : undefined;

  const stopAndRun = (callback) => (event) => {
    event.stopPropagation();
    callback?.();
  };

  const showTitle = kind !== 'result' && kind !== 'reverse' && kind !== 'reverseOutput';
  const showSubtitle = kind !== 'result' && kind !== 'reverse' && kind !== 'reverseOutput';

  return (
    <div className={cn('process-node', data?.nodeClassName, selected && 'selected')} style={nodeStyle}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="process-node__actions">
        <button type="button" className="process-node__action process-node__action-view" onClick={stopAndRun(data?.onView)} aria-label="View node" title="View">
          <Eye aria-hidden className="process-node__edit-icon" size={18} />
        </button>
        <button type="button" className="process-node__edit" onClick={stopAndRun(data?.onEdit)} aria-label="Edit node" title="Edit">
          <Edit01 aria-hidden className="process-node__edit-icon" size={18} />
        </button>
        {(kind === 'subprocess' || kind === 'reverse') && (
          <button
            type="button"
            className="process-node__action process-node__action-order"
            onClick={stopAndRun(data?.onReorder)}
            aria-label={kind === 'reverse' ? 'Change reverse output order' : 'Change stage order'}
            title={kind === 'reverse' ? 'Change reverse output order' : 'Change stage order'}
          >
            <Rows01 aria-hidden className="process-node__edit-icon" size={18} />
          </button>
        )}
        {(kind === 'process' || kind === 'subprocess' || kind === 'stage' || kind === 'result' || kind === 'reverse') && (
          <button
            type="button"
            className="process-node__action process-node__action-add"
            onClick={stopAndRun(data?.onAddChild)}
            aria-label={
              kind === 'process'
                ? 'Add subprocess'
                : kind === 'subprocess'
                  ? 'Add stage'
                  : kind === 'stage'
                    ? 'Add result'
                    : kind === 'result'
                      ? 'Add reverse'
                      : 'Add reverse output'
            }
            title={
              kind === 'process'
                ? 'Add subprocess'
                : kind === 'subprocess'
                  ? 'Add stage'
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
            onClick={stopAndRun(data?.onDelete)}
            aria-label="Delete node"
            title="Delete node"
          >
            <Trash01 aria-hidden className="process-node__edit-icon" size={18} />
          </button>
        )}
      </div>
      <div className="process-node__meta">
        {typeof childCount === 'number' && <div className="process-node__counter">{childCount}</div>}
      </div>
      {showTitle && <div className="process-node__title">{title}</div>}
      {showSubtitle && <div className="process-node__subtitle">{subtitle || 'Без описания'}</div>}
      {summaryItems.length > 0 && (
        <div className={cn('process-node__summary', (kind === 'result' || kind === 'reverseOutput') && 'process-node__summary--plain-list')}>
          {summaryItems.map((item, index) => (
            <div
              key={`${kind}-${index}-${item.value}`}
              className={cn('process-node__summary-item', (kind === 'result' || kind === 'reverseOutput') && 'process-node__summary-item--plain')}
            >
              {kind === 'result' || kind === 'reverseOutput' ? (
                <div className="process-node__summary-list-item">
                  {kind === 'result' && <BellRinging04 aria-hidden className="process-node__summary-icon" size={16} />}
                  {kind === 'reverse' && item.icon === 'notification' && (
                    <NotificationBox aria-hidden className="process-node__summary-icon" size={16} />
                  )}
                  {kind === 'reverseOutput' && item.icon === 'send' && (
                    <ZapCircle aria-hidden className="process-node__summary-icon" size={16} />
                  )}
                  {kind === 'reverseOutput' && item.icon === 'check' && (
                    <CheckVerified02 aria-hidden className="process-node__summary-icon process-node__summary-icon--success" size={16} />
                  )}
                  <div className="process-node__summary-value">{item.value}</div>
                </div>
              ) : (
                <>
                  <div className="process-node__summary-label">{item.label}</div>
                  <div className="process-node__summary-value">{item.value}</div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      {isExpandable && <div className="process-node__hint">{isExpanded ? 'Скрыть дочерние' : 'Показать дочерние'}</div>}
      {kind === 'result' && (
        <div className="process-node__context-note">
          Входящие сценарии для обработки
        </div>
      )}
      {kind === 'reverse' && (
        <div className="process-node__context-note process-node__context-note--reverse">
          Входящий статус события для обработки
        </div>
      )}
    </div>
  );
}

export function StructureNode({ data, selected }) {
  const kind = data?.kind ?? 'stage';

  return (
    <div
      className={cn(
        'structure-node',
        `structure-node--${kind}`,
        data?.disabled && 'structure-node--disabled',
        data?.executed && 'structure-node--executed',
        selected && 'selected',
      )}
      style={{ minHeight: data?.nodeHeight ? `${data.nodeHeight}px` : undefined }}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      {data?.executed && (
        <span className="structure-node__executed" title="Node отработал" aria-label="Node отработал">
          <CheckVerified02 aria-hidden size={16} />
        </span>
      )}
      {data?.title && <div className="structure-node__title">{data.title}</div>}
      {data?.subtitle && <div className="structure-node__subtitle">{data.subtitle}</div>}
    </div>
  );
}
