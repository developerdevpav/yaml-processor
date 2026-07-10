import { useEffect } from 'react';
import { Target01 } from '@untitledui/icons';
import { useReactFlow } from 'reactflow';
import { cn } from '../../../utils/ui';

function fitTopologyView(reactFlow, duration = 250, nodeIds = null) {
  const expectedNodeIds = nodeIds ? new Set(nodeIds) : null;
  const renderedNodes = reactFlow.getNodes().filter((node) => !expectedNodeIds || expectedNodeIds.has(node.id));
  if (renderedNodes.length === 0) {
    return false;
  }

  reactFlow.fitView({
    nodes: renderedNodes.map((node) => ({ id: node.id })),
    padding: 0.35,
    minZoom: 0.15,
    duration,
  });
  return true;
}

export function AutoFitView({ processConfig, nodes }) {
  const reactFlow = useReactFlow();
  const hasNodes = nodes.length > 0;

  useEffect(() => {
    if (!processConfig?.id || !hasNodes) {
      return;
    }

    let isCancelled = false;
    const frameIds = [];
    const timeoutIds = [];
    const nodeIds = nodes.map((node) => node.id);

    const fitWhenReady = () => {
      if (!isCancelled) {
        fitTopologyView(reactFlow, 250, nodeIds);
      }
    };

    frameIds.push(
      window.requestAnimationFrame(() => {
        frameIds.push(window.requestAnimationFrame(fitWhenReady));
      }),
    );
    timeoutIds.push(window.setTimeout(fitWhenReady, 80));
    timeoutIds.push(window.setTimeout(fitWhenReady, 180));

    return () => {
      isCancelled = true;
      frameIds.forEach((frameId) => window.cancelAnimationFrame(frameId));
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [hasNodes, processConfig?.id, reactFlow]);

  return null;
}

export function FitTopologyViewButton({ nodes }) {
  const reactFlow = useReactFlow();

  const handleFitView = () => {
    fitTopologyView(reactFlow, 300, nodes.map((node) => node.id));
  };

  return (
    <button
      type="button"
      className="topology-flow-actions__button"
      onClick={handleFitView}
      disabled={nodes.length === 0}
      aria-label="Показать все nodes"
      title="Показать все nodes"
    >
      <Target01 aria-hidden size={18} />
    </button>
  );
}

export function TopologyEditorModeSwitch({ editorMode, onEditorModeChange, selectedProcessConfigId }) {
  return (
    <div className="topology-editor-mode" aria-label="Режим редактирования">
      <button
        type="button"
        className={cn('topology-editor-mode__button', editorMode === 'VISUAL' && 'topology-editor-mode__button-active')}
        onClick={() => onEditorModeChange('VISUAL')}
      >
        Chart
      </button>
      <button
        type="button"
        className={cn('topology-editor-mode__button', editorMode === 'FLOW' && 'topology-editor-mode__button-active')}
        onClick={() => onEditorModeChange('FLOW')}
        disabled={!selectedProcessConfigId}
      >
        Flow
      </button>
      <button
        type="button"
        className={cn('topology-editor-mode__button', editorMode === 'YAML' && 'topology-editor-mode__button-active')}
        onClick={() => onEditorModeChange('YAML')}
        disabled={!selectedProcessConfigId}
      >
        YAML
      </button>
    </div>
  );
}

export function FocusRequestedNode({ focusRequest, nodes }) {
  const reactFlow = useReactFlow();
  const nodeId = focusRequest?.nodeId;

  useEffect(() => {
    if (!nodeId) {
      return;
    }

    const graphNode = nodes.find((node) => node.id === nodeId);
    if (!graphNode) {
      return;
    }

    window.requestAnimationFrame(() => {
      const renderedNode = reactFlow.getNode(nodeId) ?? graphNode;
      const nodeWidth = renderedNode.width ?? graphNode.style?.width ?? 300;
      const nodeHeight = renderedNode.height ?? graphNode.data?.nodeHeight ?? 286;

      reactFlow.setCenter(
        graphNode.position.x + nodeWidth / 2,
        graphNode.position.y + nodeHeight / 2,
        {
          duration: 350,
          zoom: Math.max(reactFlow.getZoom(), 0.7),
        },
      );
    });
  }, [focusRequest?.id, nodeId, nodes, reactFlow]);

  return null;
}
