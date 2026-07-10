import { MarkerType, Position } from 'reactflow';

const STRUCTURE_NODE_WIDTH = 304;
const STRUCTURE_OUTPUT_NODE_WIDTH = 336;
const STRUCTURE_LEFT_PADDING = 72;
const STRUCTURE_TOP_PADDING = 96;
const STRUCTURE_COLUMN_STEP = 372;
const STRUCTURE_ROW_STEP = 154;

const STRUCTURE_KIND_META = {
  process: { label: 'Process', column: 0, height: 118 },
  subprocess: { label: 'Subprocess', column: 1, height: 122 },
  stage: { label: 'Stage', column: 2, height: 130 },
  result: { label: 'Result', column: 3, height: 118 },
  reverse: { label: 'Reverse', column: 4, height: 112 },
  reverseOutput: { label: 'Output', column: 5, height: 128 },
};

function formatCount(value, oneLabel, fewLabel, manyLabel = fewLabel) {
  const count = Number(value) || 0;
  const mod10 = count % 10;
  const mod100 = count % 100;
  const label = mod10 === 1 && mod100 !== 11 ? oneLabel : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? fewLabel : manyLabel;

  return `${count} ${label}`;
}

function getStructureResultNodeId(stageId, resultIndex) {
  return `result:${stageId}:${resultIndex}`;
}

function getStructureReverseNodeId(stageId, resultIndex, reverseIndex) {
  return `reverse:${stageId}:${resultIndex}:${reverseIndex}`;
}

function getStructureReverseOutputNodeId(stageId, resultIndex, reverseIndex, outputIndex) {
  return `reverseOutput:${stageId}:${resultIndex}:${reverseIndex}:${outputIndex}`;
}

function formatStructureRuleState(rule) {
  return String(rule ?? '').trim() ? 'rule configured' : 'rule empty';
}

function formatStructureReference(value, fallback = 'not set') {
  return String(value?.code ?? value ?? '').trim() || fallback;
}

function compactStructureItems(items, limit = 3) {
  const normalizedItems = (items ?? []).map((item) => String(item ?? '').trim()).filter(Boolean);
  if (normalizedItems.length <= limit) {
    return normalizedItems;
  }

  return [...normalizedItems.slice(0, limit), `+${normalizedItems.length - limit}`];
}

function pickStructureText(...values) {
  return values.map((value) => String(value ?? '').trim()).find(Boolean) ?? '';
}

function createStructureEdge(source, target, level) {
  const palette = ['#7f56d9', '#1570ef', '#039855', '#dc6803', '#c11574', '#475467'];

  return {
    id: `structure:${source}->${target}`,
    source,
    target,
    type: 'smoothstep',
    animated: false,
    selectable: false,
    focusable: false,
    deletable: false,
    interactionWidth: 12,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: palette[level] ?? '#98a2b3',
      width: 16,
      height: 16,
    },
    style: {
      stroke: palette[level] ?? '#98a2b3',
      strokeWidth: 2,
    },
  };
}

function createStructureTreeNode({ id, kind, title, subtitle, metaItems = [], accentItems = [], disabled = false, children = [] }) {
  const kindMeta = STRUCTURE_KIND_META[kind] ?? STRUCTURE_KIND_META.stage;

  return {
    id,
    kind,
    title: title ?? '',
    subtitle: subtitle ?? '',
    metaItems,
    accentItems,
    disabled,
    children,
    column: kindMeta.column,
    nodeHeight: kindMeta.height,
  };
}

function buildReverseOutputStructureNode(stage, resultIndex, reverseIndex, output, outputIndex) {
  const serviceSummary = [
    output.body?.service?.scenario,
    output.body?.service?.type,
    output.body?.service?.status?.code,
  ].filter(Boolean).join(' / ');
  const bodySummary = [output.body?.type, output.body?.eventObject?.type].filter(Boolean).join(' / ');
  const outputTitle = output.name || formatStructureReference(output.phase, '');
  const outputSubtitle = serviceSummary || bodySummary || output.log?.journalServiceName || '';
  const slaSummary = [
    output.body?.service?.sla?.durationValue,
    output.body?.service?.sla?.durationUnit?.code,
    output.body?.service?.sla?.status?.code,
  ].filter(Boolean).join(' ');

  return createStructureTreeNode({
    id: getStructureReverseOutputNodeId(stage.id, resultIndex, reverseIndex, outputIndex),
    kind: 'reverseOutput',
    title: pickStructureText(output.nodeName, outputTitle, 'Output'),
    subtitle: pickStructureText(output.nodeComment, outputSubtitle),
    metaItems: [
      formatStructureReference(output.phase, 'phase not set'),
      serviceSummary,
      bodySummary,
      output.log?.journalServiceName ? 'log configured' : '',
      slaSummary ? `SLA ${slaSummary}` : '',
    ],
    accentItems: [formatStructureRuleState(output.rule)],
  });
}

function buildReverseStructureNode(stage, resultIndex, reverse, reverseIndex) {
  const outputNodes = (reverse.output ?? []).map((output, outputIndex) =>
    buildReverseOutputStructureNode(stage, resultIndex, reverseIndex, output, outputIndex),
  );

  return createStructureTreeNode({
    id: getStructureReverseNodeId(stage.id, resultIndex, reverseIndex),
    kind: 'reverse',
    title: pickStructureText(reverse.nodeName, formatStructureReference(reverse.status, ''), 'Reverse'),
    subtitle: pickStructureText(reverse.nodeComment, formatCount(outputNodes.length, 'output', 'outputs')),
    metaItems: [formatCount(outputNodes.length, 'output', 'outputs')],
    accentItems: compactStructureItems(outputNodes.map((node) => node.title), 2),
    children: outputNodes,
  });
}

function buildResultStructureNode(stage, result, resultIndex) {
  const reverseNodes = (result.reverse ?? []).map((reverse, reverseIndex) =>
    buildReverseStructureNode(stage, resultIndex, reverse, reverseIndex),
  );
  const scenarios = result.inputScenarios?.length ? result.inputScenarios : ['Сценарии не заданы'];

  return createStructureTreeNode({
    id: getStructureResultNodeId(stage.id, resultIndex),
    kind: 'result',
    title: pickStructureText(result.nodeName, compactStructureItems(scenarios, 1)[0]),
    subtitle: pickStructureText(result.nodeComment, formatCount(reverseNodes.length, 'reverse', 'reverse')),
    metaItems: [formatCount(reverseNodes.length, 'reverse', 'reverse')],
    accentItems: compactStructureItems(scenarios, 3),
    children: reverseNodes,
  });
}

function buildStageStructureNode(stage) {
  const resultNodes = (stage.configurator?.result ?? []).map((result, resultIndex) =>
    buildResultStructureNode(stage, result, resultIndex),
  );

  return createStructureTreeNode({
    id: `stage:${stage.id}`,
    kind: 'stage',
    title: pickStructureText(stage.nodeName, stage.executor, stage.contextCode?.code, 'Stage'),
    subtitle: pickStructureText(stage.nodeComment, formatCount(resultNodes.length, 'result', 'results')),
    metaItems: [
      stage.executor ? `executor ${stage.executor}` : '',
      stage.contextCode?.code ? `context ${stage.contextCode.code}` : '',
      formatCount(resultNodes.length, 'result', 'results'),
    ],
    accentItems: [
      stage.configurator?.disabled ? 'disabled' : 'active',
      stage.configurator?.multiple ? 'multiple' : '',
      stage.configurator?.interrupted ? 'interrupt' : '',
      formatStructureRuleState(stage.configurator?.filterEventRule),
    ],
    disabled: Boolean(stage.configurator?.disabled),
    children: resultNodes,
  });
}

function buildSubprocessStructureNode(subprocess) {
  const stageNodes = (subprocess.stages ?? []).map((stage) => buildStageStructureNode(stage));

  return createStructureTreeNode({
    id: `subprocess:${subprocess.id}`,
    kind: 'subprocess',
    title: pickStructureText(subprocess.nodeName, 'Subprocess'),
    subtitle: pickStructureText(subprocess.nodeComment, formatCount(stageNodes.length, 'stage', 'stages')),
    metaItems: [formatCount(stageNodes.length, 'stage', 'stages')],
    accentItems: [
      subprocess.disabled ? 'disabled' : 'active',
      formatStructureRuleState(subprocess.trigger?.rule),
    ],
    disabled: Boolean(subprocess.disabled),
    children: stageNodes,
  });
}

function measureStructureRowSpan(treeNode) {
  if (!treeNode.children?.length) {
    treeNode.rowSpan = 1;
    return 1;
  }

  treeNode.rowSpan = 1 + treeNode.children.reduce((sum, child) => sum + measureStructureRowSpan(child), 0);
  return treeNode.rowSpan;
}

function placeStructureTreeNode(treeNode, rowIndex, nodes, edges, parentNode = null) {
  const width = treeNode.kind === 'reverseOutput' ? STRUCTURE_OUTPUT_NODE_WIDTH : STRUCTURE_NODE_WIDTH;
  const nodeHeight = treeNode.nodeHeight;

  nodes.push({
    id: treeNode.id,
    type: 'structureNode',
    position: {
      x: STRUCTURE_LEFT_PADDING + treeNode.column * STRUCTURE_COLUMN_STEP,
      y: STRUCTURE_TOP_PADDING + rowIndex * STRUCTURE_ROW_STEP,
    },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data: {
      kind: treeNode.kind,
      kindLabel: STRUCTURE_KIND_META[treeNode.kind]?.label ?? 'Node',
      title: treeNode.title,
      subtitle: treeNode.subtitle,
      metaItems: compactStructureItems(treeNode.metaItems, 4),
      accentItems: compactStructureItems(treeNode.accentItems, 4),
      disabled: treeNode.disabled,
      childCount: treeNode.children?.length ?? 0,
      nodeHeight,
    },
    style: {
      width,
    },
  });

  if (parentNode) {
    edges.push(createStructureEdge(parentNode.id, treeNode.id, Math.min(treeNode.column, 5)));
  }

  let nextRowIndex = rowIndex + 1;
  (treeNode.children ?? []).forEach((childNode) => {
    placeStructureTreeNode(childNode, nextRowIndex, nodes, edges, treeNode);
    nextRowIndex += Math.max(1, childNode.rowSpan);
  });
}

export function buildStructureFlowModel(processConfig) {
  const nodes = [];
  const edges = [];
  const process = processConfig?.process;

  if (!process?.id) {
    return { nodes, edges };
  }

  const subprocessNodes = (process.subprocess ?? []).map((subprocess) => buildSubprocessStructureNode(subprocess));
  const rootNode = createStructureTreeNode({
    id: `process:${process.id}`,
    kind: 'process',
    title: pickStructureText(process.nodeName, process.contextCode?.code, 'Process'),
    subtitle: pickStructureText(process.nodeComment, formatCount(subprocessNodes.length, 'subprocess', 'subprocesses')),
    metaItems: [
      process.contextCode?.code ? `context ${process.contextCode.code}` : '',
      formatCount(subprocessNodes.length, 'subprocess', 'subprocesses'),
    ],
    accentItems: [process.disabled ? 'disabled' : 'active'],
    disabled: Boolean(process.disabled),
    children: subprocessNodes,
  });

  measureStructureRowSpan(rootNode);
  placeStructureTreeNode(rootNode, 0, nodes, edges);

  return { nodes, edges };
}
