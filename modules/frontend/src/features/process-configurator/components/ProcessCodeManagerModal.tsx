import { useEffect, useState } from 'react';
import { Trash01, XClose } from '@untitledui/icons';
import { Button, Text, TextInput, Title } from '../../../components/ui/AppPrimitives';
import { cn } from '../../../utils/ui';
import { CONTEXT_CODE_MAX_LENGTH, formatProcessCodeUsage, normalizeProcessCode, validateProcessCode } from '../model/processCodes';

export function ProcessCodeManagerModal({
  isOpen,
  codes,
  codeUsage = new Map(),
  isSubmitting,
  errorMessage,
  onClose,
  onCreate,
  onRename,
  onDelete,
  onError,
}) {
  const [newCode, setNewCode] = useState('');
  const [draftCodes, setDraftCodes] = useState({});
  const [localError, setLocalError] = useState('');
  const codesSnapshot = codes.join('\u0000');

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setNewCode('');
    setLocalError('');
    setDraftCodes(Object.fromEntries(codes.map((code) => [code, code])));
  }, [codesSnapshot, isOpen]);

  if (!isOpen) {
    return null;
  }

  const sortedCodes = [...codes].sort((left, right) => left.localeCompare(right));
  const codeSet = new Set(codes);
  const visibleError = localError || errorMessage;
  const showLocalError = (message) => {
    setLocalError(message);
    onError?.(message, message);
  };

  const validateUniqueCode = (value, currentCode = '') => {
    const validationError = validateProcessCode(value);
    if (validationError) {
      return validationError;
    }

    const normalizedCode = normalizeProcessCode(value);
    if (normalizedCode !== currentCode && codeSet.has(normalizedCode)) {
      return `Код процесса "${normalizedCode}" уже существует.`;
    }

    return '';
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    const validationError = validateUniqueCode(newCode);
    if (validationError) {
      showLocalError(validationError);
      return;
    }

    setLocalError('');
    const created = await onCreate(normalizeProcessCode(newCode));
    if (created) {
      setNewCode('');
    }
  };

  const handleRename = async (currentCode) => {
    const nextCode = normalizeProcessCode(draftCodes[currentCode] ?? currentCode);
    const validationError = validateUniqueCode(nextCode, currentCode);
    if (validationError) {
      showLocalError(validationError);
      return;
    }

    if (nextCode === currentCode) {
      return;
    }

    setLocalError('');
    await onRename(currentCode, nextCode);
  };

  const handleDelete = async (code) => {
    const usage = codeUsage.get(code);
    if (usage?.totalCount > 0) {
      showLocalError(`Код процесса "${code}" нельзя удалить. ${formatProcessCodeUsage(usage)}.`);
      return;
    }

    setLocalError('');
    await onDelete(code);
  };

  return (
    <div className="modal-shell" role="dialog" aria-modal="true" aria-labelledby="process-code-manager-title">
      <div className="modal-shell__backdrop" onClick={isSubmitting ? undefined : onClose} />
      <div className="modal-card process-code-modal">
        <div className="modal-card__header">
          <div>
            <Title headingLevel="h3" className="modal-card__title" id="process-code-manager-title">
              Код процесса
            </Title>
            <Text component="small" className="modal-card__subtitle">
              Создавайте, переименовывайте и удаляйте неиспользуемые значения справочника contextCodesDictionaryList.
            </Text>
          </div>
          <button
            type="button"
            className="modal-card__close"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Закрыть"
          >
            <XClose aria-hidden size={18} />
          </button>
        </div>

        <form className="process-code-manager__create" onSubmit={handleCreate}>
          <TextInput
            value={newCode}
            onChange={(_, value) => setNewCode(value)}
            placeholder="Новый код"
            maxLength={CONTEXT_CODE_MAX_LENGTH}
            aria-label="Новый код процесса"
          />
          <Button type="submit" isLoading={isSubmitting} isDisabled={isSubmitting}>
            Создать
          </Button>
        </form>

        <div className="process-code-manager__list">
          {sortedCodes.length === 0 ? (
            <div className="process-code-manager__empty">Справочник кодов процесса пока пуст.</div>
          ) : (
            sortedCodes.map((code) => {
              const draftValue = draftCodes[code] ?? code;
              const normalizedDraftValue = normalizeProcessCode(draftValue);
              const isChanged = normalizedDraftValue !== code;
              const usage = codeUsage.get(code);
              const isUsed = Boolean(usage?.totalCount);
              const usageLabel = formatProcessCodeUsage(usage);

              return (
                <div key={code} className="process-code-manager__row">
                  <TextInput
                    value={draftValue}
                    onChange={(_, value) =>
                      setDraftCodes((current) => ({
                        ...current,
                        [code]: value,
                      }))
                    }
                    maxLength={CONTEXT_CODE_MAX_LENGTH}
                    aria-label={`Код процесса ${code}`}
                  />
                  <span
                    className={cn(
                      'process-code-manager__usage',
                      !isUsed && 'process-code-manager__usage--free',
                    )}
                  >
                    {usageLabel}
                  </span>
                  <Button
                    variant="secondary"
                    onClick={() => handleRename(code)}
                    isDisabled={isSubmitting || !isChanged || !normalizedDraftValue}
                  >
                    Сохранить
                  </Button>
                  <Button
                    variant="plain"
                    className="process-code-manager__delete"
                    onClick={() => handleDelete(code)}
                    isDisabled={isSubmitting || isUsed}
                    aria-label={`Удалить код процесса ${code}`}
                    title={isUsed ? usageLabel : `Удалить код процесса ${code}`}
                  >
                    <Trash01 aria-hidden size={16} />
                  </Button>
                </div>
              );
            })
          )}
        </div>

        {visibleError && <div className="process-code-manager__error">{visibleError}</div>}
      </div>
    </div>
  );
}
