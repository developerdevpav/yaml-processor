import { Maximize01, Minimize01, Play, RefreshCcw01 } from '@untitledui/icons';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import ReactFlow, { Background, ReactFlowProvider } from 'reactflow';
import { DictionariesMenu, TopologyPlaygroundButton, TopologyProcessCheckButton } from '../ui/AppPrimitives';
import { AutoFitView, FitTopologyViewButton, FocusRequestedNode, TopologyEditorModeSwitch } from './controls/FlowControls';
import { buildStructureFlowModel } from './model/structureModel';
import { ProcessNode, StructureNode } from './nodes/FlowNodes';
import { YamlProcessActions, YamlProcessEditor } from './yaml/YamlProcessEditor';

const TOPOLOGY_SIDEBAR_WIDTH_STORAGE_KEY = 'yamlProcessor.topologySidebarWidth.v1';
const TOPOLOGY_SIDEBAR_MIN_WIDTH = 320;
const TOPOLOGY_SIDEBAR_MAX_WIDTH = 550;
const TOPOLOGY_SIDEBAR_DEFAULT_WIDTH = 360;

function clampTopologySidebarWidth(width) {
  return Math.min(TOPOLOGY_SIDEBAR_MAX_WIDTH, Math.max(TOPOLOGY_SIDEBAR_MIN_WIDTH, width));
}

export function ProcessTopology({
  processConfig,
  processTreeSidebar,
  selectedProcessConfigId,
  selectedNodeId,
  expandedNodeIds,
  onToggleNode,
  onExpandAllNodes,
  onCollapseAllNodes,
  onEditNode,
  onViewNode,
  onReorderSubprocessNode,
  onReorderReverseNode,
  onDeleteNode,
  onAddChildNode,
  onAddSubprocess,
  onOpenProcessCodeManager,
  onOpenJsonLogicPlayground,
  onOpenProcessPlayground,
  onOpenCurrentProcessPlayground,
  onResetCurrentProcessPlayground,
  executedNodeIds = [],
  isCurrentProcessPlaygroundRunning = false,
  isFlowPlaybackRunning = false,
  hasCurrentProcessPlayback = false,
  focusRequest,
  editorMode,
  onEditorModeChange,
  yamlEditorText,
  onYamlEditorChange,
  onYamlEditorSave,
  onYamlEditorReload,
  onYamlEditorBeautify,
  isYamlEditorLoading,
  isYamlEditorSaving,
  isYamlEditorBeautifying,
  yamlEditorError,
  yamlEditorStatus,
  hasYamlEditorChanges,
  buildTopologyModel,
}: any) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window === 'undefined') {
      return TOPOLOGY_SIDEBAR_DEFAULT_WIDTH;
    }

    const storedWidth = Number.parseInt(window.localStorage.getItem(TOPOLOGY_SIDEBAR_WIDTH_STORAGE_KEY) ?? '', 10);
    return Number.isFinite(storedWidth)
      ? clampTopologySidebarWidth(storedWidth)
      : TOPOLOGY_SIDEBAR_DEFAULT_WIDTH;
  });
  const graph = useMemo(
    () => buildTopologyModel(processConfig, expandedNodeIds),
    [buildTopologyModel, expandedNodeIds, processConfig],
  );
  const structureGraph = useMemo(() => buildStructureFlowModel(processConfig), [processConfig]);
  const executedNodeIdSet = useMemo(() => new Set(executedNodeIds ?? []), [executedNodeIds]);
  const highlightedStructureEdges = useMemo(
    () =>
      structureGraph.edges.map((edge) => {
        const isExecutedPath = executedNodeIdSet.has(edge.source) && executedNodeIdSet.has(edge.target);
        if (!isExecutedPath) {
          return edge;
        }

        return {
          ...edge,
          animated: true,
          markerEnd: {
            ...edge.markerEnd,
            color: '#039855',
          },
          style: {
            ...edge.style,
            stroke: '#039855',
            strokeWidth: 3,
          },
        };
      }),
    [executedNodeIdSet, structureGraph.edges],
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(TOPOLOGY_SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  const handleSidebarResizePointerDown = (event) => {
    if (event.button != null && event.button !== 0) {
      return;
    }

    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    const handlePointerMove = (moveEvent) => {
      const nextWidth = clampTopologySidebarWidth(startWidth + moveEvent.clientX - startX);
      setSidebarWidth(nextWidth);
    };
    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.classList.remove('topology-sidebar-resizing');
    };

    document.body.classList.add('topology-sidebar-resizing');
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
  };

  const handleSidebarResizeKeyDown = (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }

    event.preventDefault();
    setSidebarWidth((currentWidth) =>
      clampTopologySidebarWidth(currentWidth + (event.key === 'ArrowRight' ? 24 : -24)),
    );
  };

  return (
    <div className="topology-layout">
      <div className="topology-toolbar">
        <div className="topology-toolbar__menu">
          <div className="topology-toolbar__group">
            <DictionariesMenu onOpenProcessCodes={onOpenProcessCodeManager} />
          </div>
          <div className="topology-toolbar__group topology-toolbar__group--right">
            <TopologyPlaygroundButton onOpenJsonLogicPlayground={onOpenJsonLogicPlayground} />
            <TopologyProcessCheckButton onOpenProcessPlayground={onOpenProcessPlayground} />
          </div>
        </div>
      </div>
      <div
        className="topology-main"
        style={{
          '--topology-sidebar-width': `${sidebarWidth}px`,
          '--topology-sidebar-min-width': `${TOPOLOGY_SIDEBAR_MIN_WIDTH}px`,
        } as CSSProperties}
      >
        <aside className="topology-sidebar" aria-label="Дерево процессов">
          {processTreeSidebar}
        </aside>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Изменить ширину панели процессов"
          aria-valuemin={TOPOLOGY_SIDEBAR_MIN_WIDTH}
          aria-valuemax={TOPOLOGY_SIDEBAR_MAX_WIDTH}
          aria-valuenow={Math.round(sidebarWidth)}
          tabIndex={0}
          className="topology-sidebar-resizer"
          onPointerDown={handleSidebarResizePointerDown}
          title="Изменить ширину панели процессов"
          onKeyDown={handleSidebarResizeKeyDown}
        />
        {editorMode === 'YAML' ? (
          <div className="topology-canvas topology-canvas-yaml">
            <div className="topology-canvas-controls">
              <YamlProcessActions
                onSave={onYamlEditorSave}
                onReload={onYamlEditorReload}
                onBeautify={onYamlEditorBeautify}
                isLoading={isYamlEditorLoading}
                isSaving={isYamlEditorSaving}
                isBeautifying={isYamlEditorBeautifying}
                hasChanges={hasYamlEditorChanges}
              />
              <TopologyEditorModeSwitch
                editorMode={editorMode}
                onEditorModeChange={onEditorModeChange}
                selectedProcessConfigId={selectedProcessConfigId}
              />
            </div>
            <YamlProcessEditor
              value={yamlEditorText}
              onChange={onYamlEditorChange}
              isLoading={isYamlEditorLoading}
              isSaving={isYamlEditorSaving}
              isBeautifying={isYamlEditorBeautifying}
              errorMessage={yamlEditorError}
            />
          </div>
        ) : editorMode === 'FLOW' ? (
          <ReactFlowProvider>
            <div className="topology-canvas topology-canvas-structure">
              <div className="topology-canvas-controls">
                <div className="topology-flow-actions" aria-label="Управление структурой">
                  <FitTopologyViewButton nodes={structureGraph.nodes} />
                  <button
                    type="button"
                    className="topology-flow-actions__button"
                    onClick={onOpenCurrentProcessPlayground}
                    disabled={!processConfig?.process?.id || isCurrentProcessPlaygroundRunning}
                    aria-label="Запустить Playground текущего процесса"
                    title="Запустить Playground текущего процесса"
                  >
                    {isCurrentProcessPlaygroundRunning ? (
                      <span className="topology-flow-actions__spinner" aria-hidden="true" />
                    ) : (
                      <Play aria-hidden size={18} />
                    )}
                  </button>
                  <button
                    type="button"
                    className="topology-flow-actions__button"
                    onClick={onResetCurrentProcessPlayground}
                    disabled={!hasCurrentProcessPlayback && !isFlowPlaybackRunning && !isCurrentProcessPlaygroundRunning}
                    aria-label="Сбросить проигранный сценарий"
                    title="Сбросить проигранный сценарий"
                  >
                    <RefreshCcw01 aria-hidden size={18} />
                  </button>
                </div>
                <TopologyEditorModeSwitch
                  editorMode={editorMode}
                  onEditorModeChange={onEditorModeChange}
                  selectedProcessConfigId={selectedProcessConfigId}
                />
              </div>
              <ReactFlow
                className="structure-flow"
                nodes={structureGraph.nodes.map((node) => ({
                  ...node,
                  selected: false,
                  data: {
                    ...node.data,
                    executed: executedNodeIdSet.has(node.id),
                  },
                }))}
                edges={highlightedStructureEdges}
                nodeTypes={{ structureNode: StructureNode }}
                minZoom={0.18}
                maxZoom={1.65}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                nodesFocusable={false}
                edgesFocusable={false}
                proOptions={{ hideAttribution: true }}
              >
                <Background color="#e4e7ec" gap={28} size={1.2} />
                <AutoFitView processConfig={processConfig} nodes={structureGraph.nodes} />
                <FocusRequestedNode focusRequest={focusRequest} nodes={structureGraph.nodes} />
              </ReactFlow>
            </div>
          </ReactFlowProvider>
        ) : (
          <ReactFlowProvider>
            <div className="topology-canvas">
              <div className="topology-canvas-controls">
                <div className="topology-flow-actions" aria-label="Управление деревом">
                  <FitTopologyViewButton nodes={graph.nodes} />
                  <button
                    type="button"
                    className="topology-flow-actions__button"
                    onClick={onExpandAllNodes}
                    disabled={!processConfig?.process?.id}
                    aria-label="Раскрыть все дерево"
                    title="Раскрыть все дерево"
                  >
                    <Maximize01 aria-hidden size={18} />
                  </button>
                  <button
                    type="button"
                    className="topology-flow-actions__button"
                    onClick={onCollapseAllNodes}
                    disabled={!processConfig?.process?.id}
                    aria-label="Свернуть все дерево"
                    title="Свернуть все дерево"
                  >
                    <Minimize01 aria-hidden size={18} />
                  </button>
                </div>
                <TopologyEditorModeSwitch
                  editorMode={editorMode}
                  onEditorModeChange={onEditorModeChange}
                  selectedProcessConfigId={selectedProcessConfigId}
                />
              </div>
              <ReactFlow
                nodes={graph.nodes.map((node) => ({
                  ...node,
                  selected: node.id === selectedNodeId,
                  data: {
                    ...node.data,
                    onEdit: () => onEditNode(node.id),
                    onView: () => onViewNode(node.id),
                    onReorder:
                      node.data.kind === 'subprocess'
                        ? () => onReorderSubprocessNode(node.id)
                        : node.data.kind === 'reverse'
                          ? () => onReorderReverseNode(node.id)
                          : undefined,
                    onDelete: () => onDeleteNode(node.id),
                    onAddChild:
                      node.data.kind === 'process'
                        ? () => onAddSubprocess()
                        : node.data.kind === 'subprocess' || node.data.kind === 'stage' || node.data.kind === 'result' || node.data.kind === 'reverse'
                          ? () => onAddChildNode(node.id)
                          : undefined,
                    canDelete: node.data.kind !== 'process',
                  },
                }))}
                edges={graph.edges}
                nodeTypes={{ processNode: ProcessNode }}
                minZoom={0.15}
                maxZoom={2}
                nodesDraggable={false}
                onNodeClick={(_, node) => onToggleNode(node.id)}
                proOptions={{ hideAttribution: true }}
              >
                <AutoFitView processConfig={processConfig} nodes={graph.nodes} />
                <FocusRequestedNode focusRequest={focusRequest} nodes={graph.nodes} />
              </ReactFlow>
            </div>
          </ReactFlowProvider>
        )}
      </div>
    </div>
  );
}
