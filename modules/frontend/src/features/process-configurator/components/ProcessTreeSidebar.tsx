import { useMemo, useState } from 'react';
import { ChevronRight, Download01, Edit02, File02, Folder, FolderPlus, Inbox02, Trash01 } from '@untitledui/icons';
import { cn } from '../../../utils/ui';
import { getProcessConfigDisplayName, PROCESS_TREE_DRAG_TYPE, ROOT_PROCESS_TREE_FOLDER_ID } from '../model/processTreeState';

export function ProcessTreeSidebar({
  processConfigs,
  selectedProcessConfigId,
  processTreeState,
  expandedFolderIds,
  onToggleFolder,
  onCreateProcess,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveProcess,
  onSelectProcessConfig,
  onImportProcessConfig,
  onExportProcessConfig,
  onDeleteProcessConfig,
  isCreateProcessDisabled = false,
}) {
  const [dropTargetFolderId, setDropTargetFolderId] = useState(null);
  const folders = processTreeState?.folders ?? [];
  const processFolders = processTreeState?.processFolders ?? {};
  const expandedFolderSet = useMemo(() => new Set(expandedFolderIds ?? []), [expandedFolderIds]);
  const folderIds = useMemo(
    () => new Set([ROOT_PROCESS_TREE_FOLDER_ID, ...folders.map((folder) => folder.id)]),
    [folders],
  );
  const foldersByParent = useMemo(() => {
    const next = new Map();
    folders.forEach((folder) => {
      const parentId = folderIds.has(folder.parentId) ? folder.parentId : ROOT_PROCESS_TREE_FOLDER_ID;
      const current = next.get(parentId) ?? [];
      current.push(folder);
      next.set(parentId, current);
    });

    next.forEach((items) => {
      items.sort((left, right) => left.name.localeCompare(right.name, 'ru'));
    });

    return next;
  }, [folderIds, folders]);
  const processesByFolder = useMemo(() => {
    const next = new Map([[ROOT_PROCESS_TREE_FOLDER_ID, []]]);
    processConfigs.forEach((processConfig) => {
      const configuredFolderId = processFolders[String(processConfig.id)];
      const folderId = folderIds.has(configuredFolderId) ? configuredFolderId : ROOT_PROCESS_TREE_FOLDER_ID;
      const current = next.get(folderId) ?? [];
      current.push(processConfig);
      next.set(folderId, current);
    });

    next.forEach((items) => {
      items.sort((left, right) => getProcessConfigDisplayName(left).localeCompare(getProcessConfigDisplayName(right), 'ru'));
    });

    return next;
  }, [folderIds, processConfigs, processFolders]);

  const handleDragStartProcess = (event, processConfigId) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(PROCESS_TREE_DRAG_TYPE, String(processConfigId));
  };

  const handleDragOverFolder = (event, folderId) => {
    if (!Array.from(event.dataTransfer.types).includes(PROCESS_TREE_DRAG_TYPE)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropTargetFolderId(folderId);
  };

  const handleDropOnFolder = (event, folderId) => {
    const processConfigId = event.dataTransfer.getData(PROCESS_TREE_DRAG_TYPE);
    if (!processConfigId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setDropTargetFolderId(null);
    onMoveProcess(processConfigId, folderId);
  };

  const countProcessesInsideFolder = (folderId, visitedFolderIds = new Set()) => {
    if (visitedFolderIds.has(folderId)) {
      return 0;
    }

    const nextVisited = new Set(visitedFolderIds);
    nextVisited.add(folderId);

    return (
      (processesByFolder.get(folderId) ?? []).length +
      (foldersByParent.get(folderId) ?? []).reduce(
        (sum, childFolder) => sum + countProcessesInsideFolder(childFolder.id, nextVisited),
        0,
      )
    );
  };

  const folderHasChildren = (folderId) =>
    (foldersByParent.get(folderId) ?? []).length > 0 || (processesByFolder.get(folderId) ?? []).length > 0;

  const renderProcess = (processConfig, level) => {
    const processConfigId = String(processConfig.id);
    const isSelected = processConfigId === selectedProcessConfigId;
    const label = getProcessConfigDisplayName(processConfig);

    return (
      <div
        key={processConfigId}
        className={cn('process-tree__process', isSelected && 'process-tree__process--active')}
        style={{ paddingLeft: `${0.45 + level * 0.9 + (level > 0 ? 1.95 : 0)}rem` }}
        draggable
        onDragStart={(event) => handleDragStartProcess(event, processConfigId)}
      >
        <button
          type="button"
          className="process-tree__process-main"
          onClick={() => onSelectProcessConfig(processConfigId)}
        >
          <File02 aria-hidden size={16} className="process-tree__item-icon" />
          <span className="process-tree__item-text">
            <span className="process-tree__item-title">{label}</span>
          </span>
        </button>
        <button
          type="button"
          className="process-tree__process-action process-tree__process-action--export"
          onClick={(event) => {
            event.stopPropagation();
            onExportProcessConfig(processConfigId);
          }}
          aria-label={`Экспортировать процесс ${label}`}
          title="Экспортировать процесс"
        >
          <Download01 aria-hidden size={15} />
        </button>
        <button
          type="button"
          className="process-tree__process-action process-tree__process-action--delete"
          onClick={(event) => {
            event.stopPropagation();
            onDeleteProcessConfig(processConfigId);
          }}
          aria-label={`Удалить процесс ${label}`}
          title="Удалить процесс"
        >
          <Trash01 aria-hidden size={15} />
        </button>
      </div>
    );
  };

  const renderFolder = (folder, level, visitedFolderIds = new Set()) => {
    if (visitedFolderIds.has(folder.id)) {
      return null;
    }

    const nextVisited = new Set(visitedFolderIds);
    nextVisited.add(folder.id);
    const childFolders = foldersByParent.get(folder.id) ?? [];
    const folderProcesses = processesByFolder.get(folder.id) ?? [];
    const isExpanded = expandedFolderSet.has(folder.id);
    const processCount = countProcessesInsideFolder(folder.id);
    const isDropTarget = dropTargetFolderId === folder.id;
    const hasChildren = folderHasChildren(folder.id);

    return (
      <div key={folder.id} className="process-tree__folder" role="treeitem" aria-expanded={isExpanded}>
        <div
          className={cn('process-tree__folder-row', isDropTarget && 'process-tree__drop-target')}
          style={{ paddingLeft: `${0.45 + level * 0.9}rem` }}
          onDragOver={(event) => handleDragOverFolder(event, folder.id)}
          onDragLeave={() => setDropTargetFolderId(null)}
          onDrop={(event) => handleDropOnFolder(event, folder.id)}
        >
          <button
            type="button"
            className="process-tree__toggle"
            onClick={() => onToggleFolder(folder.id)}
            aria-label={isExpanded ? `Свернуть папку ${folder.name}` : `Раскрыть папку ${folder.name}`}
          >
            <ChevronRight aria-hidden size={14} className={cn('process-tree__toggle-icon', isExpanded && 'process-tree__toggle-icon--open')} />
          </button>
          <button type="button" className="process-tree__folder-name" onClick={() => onToggleFolder(folder.id)}>
            <Folder aria-hidden size={16} className="process-tree__item-icon process-tree__item-icon--folder" />
            <span className="process-tree__item-text">
              <span className="process-tree__item-title">{folder.name}</span>
            </span>
          </button>
          <div className="process-tree__folder-actions">
            <button
              type="button"
              className="process-tree__icon-button"
              onClick={() => onCreateFolder(folder.id)}
              aria-label={`Создать подпапку в ${folder.name}`}
              title="Создать подпапку"
            >
              <FolderPlus aria-hidden size={15} />
            </button>
            <button
              type="button"
              className="process-tree__icon-button"
              onClick={() => onRenameFolder(folder.id)}
              aria-label={`Переименовать папку ${folder.name}`}
              title="Переименовать"
            >
              <Edit02 aria-hidden size={15} />
            </button>
            <button
              type="button"
              className="process-tree__icon-button process-tree__icon-button--danger"
              onClick={() => onDeleteFolder(folder.id)}
              disabled={hasChildren}
              aria-label={`Удалить папку ${folder.name}`}
              title={hasChildren ? 'Удалить можно только пустую папку' : 'Удалить'}
            >
              <Trash01 aria-hidden size={15} />
            </button>
          </div>
          <span className="process-tree__counter">{processCount}</span>
        </div>
        {isExpanded && (
          <div className="process-tree__children" role="group">
            {childFolders.map((childFolder) => renderFolder(childFolder, level + 1, nextVisited))}
            {folderProcesses.map((processConfig) => renderProcess(processConfig, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const rootFolders = foldersByParent.get(ROOT_PROCESS_TREE_FOLDER_ID) ?? [];
  const rootProcesses = processesByFolder.get(ROOT_PROCESS_TREE_FOLDER_ID) ?? [];
  const rootProcessCount = processConfigs.length;
  const isRootDropTarget = dropTargetFolderId === ROOT_PROCESS_TREE_FOLDER_ID;

  return (
    <div className="process-tree">
      <div
        className={cn('process-tree__root', isRootDropTarget && 'process-tree__drop-target')}
        onDragOver={(event) => handleDragOverFolder(event, ROOT_PROCESS_TREE_FOLDER_ID)}
        onDragLeave={() => setDropTargetFolderId(null)}
        onDrop={(event) => handleDropOnFolder(event, ROOT_PROCESS_TREE_FOLDER_ID)}
      >
        <Inbox02 aria-hidden size={17} className="process-tree__item-icon" />
        <div className="process-tree__root-title">
          <span>Процессы</span>
          <span>{rootProcessCount}</span>
        </div>
        <div className="process-tree__root-actions">
          <button
            type="button"
            className="process-tree__icon-button process-tree__icon-button--strong"
            onClick={onCreateProcess}
            disabled={isCreateProcessDisabled}
            aria-label="Создать процесс"
            title="Создать процесс"
          >
            <svg
              aria-hidden
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M20 10.5V6.8C20 5.11984 20 4.27976 19.673 3.63803C19.3854 3.07354 18.9265 2.6146 18.362 2.32698C17.7202 2 16.8802 2 15.2 2H8.8C7.11984 2 6.27976 2 5.63803 2.32698C5.07354 2.6146 4.6146 3.07354 4.32698 3.63803C4 4.27976 4 5.11984 4 6.8V17.2C4 18.8802 4 19.7202 4.32698 20.362C4.6146 20.9265 5.07354 21.3854 5.63803 21.673C6.27976 22 7.11984 22 8.8 22H12M14 11H8M10 15H8M16 7H8M18 21V15M15 18H21"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            type="button"
            className="process-tree__icon-button process-tree__icon-button--strong"
            onClick={() => onCreateFolder(ROOT_PROCESS_TREE_FOLDER_ID)}
            aria-label="Создать папку"
            title="Создать папку"
          >
            <FolderPlus aria-hidden size={16} />
          </button>
          <button
            type="button"
            className="process-tree__icon-button process-tree__icon-button--strong"
            onClick={onImportProcessConfig}
            aria-label="Импортировать процесс"
            title="Импортировать процесс"
          >
            <svg
              aria-hidden
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M20 12.5V6.8C20 5.11984 20 4.27976 19.673 3.63803C19.3854 3.07354 18.9265 2.6146 18.362 2.32698C17.7202 2 16.8802 2 15.2 2H8.8C7.11984 2 6.27976 2 5.63803 2.32698C5.07354 2.6146 4.6146 3.07354 4.32698 3.63803C4 4.27976 4 5.11984 4 6.8V17.2C4 18.8802 4 19.7202 4.32698 20.362C4.6146 20.9265 5.07354 21.3854 5.63803 21.673C6.27976 22 7.1198 22 8.79986 22H12.5M14 11H8M10 15H8M16 7H8M15 19L18 22M18 22L21 19M18 22V16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
      <div className="process-tree__content" role="tree" aria-label="Дерево процессов">
        {rootFolders.map((folder) => renderFolder(folder, 0))}
        {rootProcesses.map((processConfig) => renderProcess(processConfig, 0))}
        {processConfigs.length === 0 && (
          <div className="process-tree__empty">Нет процессов</div>
        )}
      </div>
    </div>
  );
}
