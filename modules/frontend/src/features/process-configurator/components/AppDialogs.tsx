import { useEffect, useRef, useState } from 'react';
import { XClose } from '@untitledui/icons';
import { Button, FormGroup, Text, Title } from '../../../components/ui/AppPrimitives';

export function ErrorDetailsModal({ errorInfo, onClose }) {
  useEffect(() => {
    if (!errorInfo) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [errorInfo, onClose]);

  if (!errorInfo) {
    return null;
  }

  return (
    <div className="modal-shell error-details-modal" role="dialog" aria-modal="true" aria-labelledby="error-details-title">
      <div className="modal-shell__backdrop" onClick={onClose} />
      <div className="modal-card error-details-modal__card">
        <div className="modal-card__header">
          <div>
            <Title headingLevel="h4" className="modal-card__title">
              <span id="error-details-title">Информация об ошибке</span>
            </Title>
            <Text className="modal-card__subtitle">{errorInfo.message}</Text>
          </div>
          <button type="button" className="modal-card__close" onClick={onClose} aria-label="Закрыть информацию об ошибке">
            <XClose aria-hidden size={18} />
          </button>
        </div>

        <div className="error-details-modal__meta">
          <span>Время: {new Date(errorInfo.occurredAt).toLocaleString('ru-RU')}</span>
        </div>
        <pre className="error-details-modal__details">{errorInfo.details}</pre>
      </div>
    </div>
  );
}

export function AppDialogModal({ dialog, onResolve }) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!dialog) {
      return;
    }

    setInputValue(dialog.defaultValue ?? '');
    const focusTimeoutId = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select?.();
    }, 0);

    return () => window.clearTimeout(focusTimeoutId);
  }, [dialog]);

  useEffect(() => {
    if (!dialog) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onResolve(dialog.type === 'prompt' ? null : false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialog, onResolve]);

  if (!dialog) {
    return null;
  }

  const isPrompt = dialog.type === 'prompt';
  const isAlert = dialog.type === 'alert';
  const titleId = `${dialog.id}-title`;
  const descriptionId = `${dialog.id}-description`;
  const cancelValue = isAlert ? true : isPrompt ? null : false;
  const confirmText = dialog.confirmText ?? (isAlert ? 'Ок' : 'Подтвердить');
  const cancelText = dialog.cancelText ?? 'Отмена';

  const handleSubmit = (event) => {
    event.preventDefault();
    onResolve(isPrompt ? inputValue : true);
  };

  return (
    <div
      className="modal-shell app-dialog-modal"
      role={dialog.variant === 'danger' ? 'alertdialog' : 'dialog'}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <div className="modal-shell__backdrop" onClick={() => onResolve(cancelValue)} />
      <form className="modal-card app-dialog-modal__card" onSubmit={handleSubmit}>
        <div className="modal-card__header">
          <div>
            <Title headingLevel="h4" className="modal-card__title" id={titleId}>
              {dialog.title}
            </Title>
            {dialog.message && (
              <p className="modal-card__subtitle app-dialog-modal__message" id={descriptionId}>
                {dialog.message}
              </p>
            )}
          </div>
          <button
            type="button"
            className="modal-card__close"
            onClick={() => onResolve(cancelValue)}
            aria-label="Закрыть"
          >
            <XClose aria-hidden size={18} />
          </button>
        </div>

        {isPrompt && (
          <div className="app-dialog-modal__body">
            <FormGroup label={dialog.inputLabel ?? dialog.title} fieldId={`${dialog.id}-input`}>
              <input
                ref={inputRef}
                id={`${dialog.id}-input`}
                className="app-dialog-modal__input"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder={dialog.placeholder ?? ''}
              />
            </FormGroup>
          </div>
        )}

        <div className="modal-card__footer">
          {!isAlert && (
            <Button type="button" variant="secondary" onClick={() => onResolve(cancelValue)}>
              {cancelText}
            </Button>
          )}
          <Button
            type="submit"
            className={dialog.variant === 'danger' ? 'app-dialog-modal__danger-button' : ''}
          >
            {confirmText}
          </Button>
        </div>
      </form>
    </div>
  );
}
