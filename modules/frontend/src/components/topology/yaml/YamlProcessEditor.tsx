import { useRef } from 'react';
import { RefreshCcw01, Save01 } from '@untitledui/icons';

function splitYamlComment(line) {
  let quote = null;
  let isEscaped = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (quote === '"') {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === '\\') {
        isEscaped = true;
      } else if (char === '"') {
        quote = null;
      }
      continue;
    }

    if (quote === "'") {
      if (char === "'") {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === '#' && (index === 0 || /\s/.test(line[index - 1]))) {
      return [line.slice(0, index), line.slice(index)];
    }
  }

  return [line, ''];
}

function renderYamlScalarSegments(text, lineIndex, segmentPrefix) {
  const scalarPattern = /("(?:\\.|[^"\\])*"|'(?:''|[^'])*'|\b(?:true|false|null)\b|~|-?\b\d+(?:\.\d+)?\b)/gi;
  const segments = [];
  let cursor = 0;
  let match;

  while ((match = scalarPattern.exec(text)) !== null) {
    if (match.index > cursor) {
      segments.push(text.slice(cursor, match.index));
    }

    const token = match[0];
    const className =
      token.startsWith('"') || token.startsWith("'")
        ? 'yaml-token yaml-token-string'
        : /^(true|false|null|~)$/i.test(token)
          ? 'yaml-token yaml-token-literal'
          : 'yaml-token yaml-token-number';

    segments.push(
      <span key={`${lineIndex}-${segmentPrefix}-${match.index}`} className={className}>
        {token}
      </span>,
    );
    cursor = match.index + token.length;
  }

  if (cursor < text.length) {
    segments.push(text.slice(cursor));
  }

  return segments;
}

function renderHighlightedYamlLine(line, lineIndex) {
  if (!line) {
    return '\u00A0';
  }

  const [content, comment] = splitYamlComment(line);
  const nodes = [];
  const keyMatch = content.match(/^(\s*)(-\s*)?([^#\s][^:\n]*?)(\s*:\s*)(.*)$/);

  if (keyMatch) {
    const [, indent, listMarker = '', key, separator, value] = keyMatch;
    if (indent) {
      nodes.push(indent);
    }
    if (listMarker) {
      nodes.push(
        <span key={`${lineIndex}-list-marker`} className="yaml-token yaml-token-marker">
          {listMarker}
        </span>,
      );
    }
    nodes.push(
      <span key={`${lineIndex}-key`} className="yaml-token yaml-token-key">
        {key}
      </span>,
    );
    nodes.push(
      <span key={`${lineIndex}-separator`} className="yaml-token yaml-token-separator">
        {separator}
      </span>,
    );
    nodes.push(...renderYamlScalarSegments(value, lineIndex, 'value'));
  } else {
    const listMatch = content.match(/^(\s*)(-\s*)(.*)$/);
    if (listMatch) {
      const [, indent, listMarker, value] = listMatch;
      nodes.push(indent);
      nodes.push(
        <span key={`${lineIndex}-list-marker`} className="yaml-token yaml-token-marker">
          {listMarker}
        </span>,
      );
      nodes.push(...renderYamlScalarSegments(value, lineIndex, 'list-value'));
    } else {
      nodes.push(...renderYamlScalarSegments(content, lineIndex, 'content'));
    }
  }

  if (comment) {
    nodes.push(
      <span key={`${lineIndex}-comment`} className="yaml-token yaml-token-comment">
        {comment}
      </span>,
    );
  }

  return nodes.length > 0 ? nodes : '\u00A0';
}

function BeautifyYamlIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M15 4V2M15 16V14M8 9H10M20 9H22M17.8 11.8L19 13M17.8 6.2L19 5M3 21L12 12M12.2 6.2L11 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function YamlProcessActions({
  onSave,
  onReload,
  onBeautify,
  isLoading,
  isSaving,
  isBeautifying,
  hasChanges,
}: any) {
  return (
    <div className="yaml-process-editor__actions">
      <div className="yaml-process-editor__button-group" aria-label="Управление YAML">
        <button
          type="button"
          className="yaml-process-editor__icon-button"
          onClick={onBeautify}
          disabled={isLoading || isSaving || isBeautifying}
          aria-label="Beautify YAML"
          title="Beautify YAML"
        >
          {isBeautifying ? (
            <span className="yaml-process-editor__spinner" aria-hidden="true" />
          ) : (
            <BeautifyYamlIcon />
          )}
        </button>
        <button
          type="button"
          className="yaml-process-editor__icon-button"
          onClick={onReload}
          disabled={isLoading || isSaving || isBeautifying}
          aria-label="Обновить"
          title="Обновить"
        >
          <RefreshCcw01 aria-hidden size={18} />
        </button>
        <button
          type="button"
          className="yaml-process-editor__icon-button"
          onClick={onSave}
          disabled={isLoading || isBeautifying || !hasChanges}
          aria-label="Сохранить YAML"
          title="Сохранить YAML"
        >
          {isSaving ? (
            <span className="yaml-process-editor__spinner" aria-hidden="true" />
          ) : (
            <Save01 aria-hidden size={18} />
          )}
        </button>
      </div>
    </div>
  );
}

export function YamlProcessEditor({
  value,
  onChange,
  isLoading,
  isSaving,
  isBeautifying,
  errorMessage,
}) {
  const lineNumberGutterRef = useRef(null);
  const highlightRef = useRef(null);
  const editorValue = value ?? '';
  const lineNumbers = Array.from({ length: Math.max(editorValue.split('\n').length, 1) }, (_, index) => index + 1);
  const highlightedLines = editorValue.split('\n');

  const handleScroll = (event) => {
    if (lineNumberGutterRef.current) {
      lineNumberGutterRef.current.scrollTop = event.currentTarget.scrollTop;
    }
    if (highlightRef.current) {
      highlightRef.current.scrollTop = event.currentTarget.scrollTop;
      highlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
    }
  };

  const handleChange = (nextValue) => {
    onChange(nextValue);
  };

  return (
    <div className="yaml-process-editor">
      <div className="yaml-process-editor__body">
        <div ref={lineNumberGutterRef} className="yaml-process-editor__line-numbers" aria-hidden="true">
          {lineNumbers.map((lineNumber) => (
            <div key={lineNumber} className="yaml-process-editor__line-number">
              {lineNumber}
            </div>
          ))}
        </div>
        <div className="yaml-process-editor__input">
          <pre ref={highlightRef} className="yaml-process-editor__highlight" aria-hidden="true">
            {highlightedLines.map((line, index) => (
              <div key={`${index}-${line}`} className="yaml-process-editor__highlight-line">
                {renderHighlightedYamlLine(line, index)}
              </div>
            ))}
          </pre>
          <textarea
            className="yaml-process-editor__textarea"
            spellCheck={false}
            value={editorValue}
            disabled={isLoading || isSaving || isBeautifying}
            onChange={(event) => handleChange(event.target.value)}
            onScroll={handleScroll}
          />
        </div>
      </div>
      {errorMessage && <div className="yaml-process-editor__error">{errorMessage}</div>}
    </div>
  );
}
