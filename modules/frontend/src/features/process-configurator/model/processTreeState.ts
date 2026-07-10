export const PROCESS_TREE_STORAGE_KEY = 'yamlProcessor.processTree.v1';
export const ROOT_PROCESS_TREE_FOLDER_ID = 'root';
export const PROCESS_TREE_DRAG_TYPE = 'application/x-yaml-processor-process-config';

export function createProcessTreeFolderId() {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return `folder:${window.crypto.randomUUID()}`;
  }

  return `folder:${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function normalizeProcessTreeFolderName(value) {
  return String(value ?? '').trim();
}

export function normalizeProcessTreeState(rawState, processConfigs = []) {
  const source = rawState && typeof rawState === 'object' ? rawState : {};
  const foldersSource = Array.isArray(source.folders) ? source.folders : [];
  const knownProcessIds = new Set((processConfigs ?? []).map((item) => String(item.id)).filter(Boolean));
  const processIdsAreKnown = knownProcessIds.size > 0;
  const folderIds = new Set([ROOT_PROCESS_TREE_FOLDER_ID]);
  const folders = [];

  foldersSource.forEach((folder) => {
    const folderId = typeof folder?.id === 'string' ? folder.id : '';
    if (!folderId || folderId === ROOT_PROCESS_TREE_FOLDER_ID || folderIds.has(folderId)) {
      return;
    }

    folderIds.add(folderId);
    folders.push({
      id: folderId,
      name: normalizeProcessTreeFolderName(folder.name) || 'Новая папка',
      parentId: typeof folder.parentId === 'string' ? folder.parentId : ROOT_PROCESS_TREE_FOLDER_ID,
    });
  });

  const normalizedFolders = folders.map((folder) => ({
    ...folder,
    parentId:
      folder.parentId !== folder.id && folderIds.has(folder.parentId)
        ? folder.parentId
        : ROOT_PROCESS_TREE_FOLDER_ID,
  }));
  const normalizedFolderIds = new Set([
    ROOT_PROCESS_TREE_FOLDER_ID,
    ...normalizedFolders.map((folder) => folder.id),
  ]);
  const processFolders = {};

  Object.entries(source.processFolders ?? {}).forEach(([processId, folderId]) => {
    const normalizedProcessId = String(processId);
    const normalizedFolderId = String(folderId);
    if (processIdsAreKnown && !knownProcessIds.has(normalizedProcessId)) {
      return;
    }
    if (!normalizedFolderIds.has(normalizedFolderId) || normalizedFolderId === ROOT_PROCESS_TREE_FOLDER_ID) {
      return;
    }

    processFolders[normalizedProcessId] = normalizedFolderId;
  });

  return {
    folders: normalizedFolders,
    processFolders,
  };
}

// Folder organization is intentionally stored only in the browser: backend data remains
// the source of truth for process configuration, while tree folders are a local UI aid.
export function readProcessTreeState() {
  if (typeof window === 'undefined') {
    return normalizeProcessTreeState(null);
  }

  try {
    const rawValue = window.localStorage.getItem(PROCESS_TREE_STORAGE_KEY);
    return normalizeProcessTreeState(rawValue ? JSON.parse(rawValue) : null);
  } catch {
    return normalizeProcessTreeState(null);
  }
}

export function writeProcessTreeState(state) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(PROCESS_TREE_STORAGE_KEY, JSON.stringify(normalizeProcessTreeState(state)));
  } catch {
    // Tree organization is a local convenience; failure to persist should not block process editing.
  }
}

export function getProcessConfigDisplayName(processConfig) {
  return (
    processConfig?.process?.nodeName?.trim() ||
    processConfig?.process?.contextCode?.code?.trim() ||
    'Process'
  );
}
