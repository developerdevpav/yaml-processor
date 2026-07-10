export const CONTEXT_CODE_MAX_LENGTH = 64;

export function normalizeProcessCode(value) {
  return String(value ?? '').trim();
}

export function validateProcessCode(value) {
  const code = normalizeProcessCode(value);
  if (!code) {
    return 'Код процесса не должен быть пустым.';
  }

  if (code.length > CONTEXT_CODE_MAX_LENGTH) {
    return `Код процесса должен быть не длиннее ${CONTEXT_CODE_MAX_LENGTH} символов.`;
  }

  return '';
}

export function incrementProcessCodeUsage(usageMap, rawCode, usageKey) {
  const code = normalizeProcessCode(rawCode);
  if (!code) {
    return;
  }

  const current = usageMap.get(code) ?? {
    processCount: 0,
    stageCount: 0,
    totalCount: 0,
  };

  usageMap.set(code, {
    ...current,
    [usageKey]: current[usageKey] + 1,
    totalCount: current.totalCount + 1,
  });
}

export function buildProcessCodeUsage(processConfigs) {
  const usageMap = new Map();

  processConfigs.forEach((config) => {
    const process = config?.process;
    incrementProcessCodeUsage(usageMap, process?.contextCode?.code, 'processCount');

    (process?.subprocess ?? []).forEach((subprocess) => {
      (subprocess?.stages ?? []).forEach((stage) => {
        incrementProcessCodeUsage(usageMap, stage?.contextCode?.code, 'stageCount');
      });
    });
  });

  return usageMap;
}

export function formatProcessCodeUsage(usage) {
  if (!usage?.totalCount) {
    return 'Не используется';
  }

  const parts = [];
  if (usage.processCount > 0) {
    parts.push(`процессов: ${usage.processCount}`);
  }
  if (usage.stageCount > 0) {
    parts.push(`стадий: ${usage.stageCount}`);
  }

  return `Используется, ${parts.join(', ')}`;
}
