import { useEffect, useRef, useState } from 'react';
import { Card, CardBody } from '../../../components/ui/AppPrimitives';

export function NodeOrderEditor({ selected, selectedNodeId, onReorderStages, onReorderReverseOutputs, isSaving, reorderItems, formatReverseOutputEventType }: any) {
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
