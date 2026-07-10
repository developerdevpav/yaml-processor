export function cn(...values) {
  return values.filter(Boolean).join(' ');
}

export function formatJsonSnippet(value) {
  if (!value?.trim()) {
    return '{}';
  }

  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export function stringifyJsonForEditor(value) {
  if (value === undefined) {
    return '';
  }

  const serialized = JSON.stringify(value, null, 2);
  return serialized ?? 'null';
}

const JSON_LOGIC_INLINE_MAX_LENGTH = 90;

function getIndent(level) {
  return '  '.repeat(level);
}

function stringifyJsonLogicInline(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    const items = value.map(stringifyJsonLogicInline);
    if (items.some((item) => item === undefined)) {
      return undefined;
    }

    return `[ ${items.join(', ')} ]`;
  }

  const entries = Object.entries(value);
  const parts = entries.map(([key, item]) => {
    const serialized = stringifyJsonLogicInline(item);
    return serialized === undefined ? undefined : `${JSON.stringify(key)}: ${serialized}`;
  });

  if (parts.some((part) => part === undefined)) {
    return undefined;
  }

  return `{ ${parts.join(', ')} }`;
}

function stringifyCompactJsonLogicValue(value, level = 0) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }

    const inline = stringifyJsonLogicInline(value);
    if (level > 0 && inline && inline.length <= JSON_LOGIC_INLINE_MAX_LENGTH) {
      return inline;
    }

    const indent = getIndent(level);
    const nextIndent = getIndent(level + 1);
    const items = value.map((item) => `${nextIndent}${stringifyCompactJsonLogicValue(item, level + 1)}`);
    return `[\n${items.join(',\n')}\n${indent}]`;
  }

  const entries = Object.entries(value);
  if (entries.length === 0) {
    return '{}';
  }

  const inline = stringifyJsonLogicInline(value);
  if (level > 0 && inline && inline.length <= JSON_LOGIC_INLINE_MAX_LENGTH) {
    return inline;
  }

  const indent = getIndent(level);
  const nextIndent = getIndent(level + 1);
  const fields = entries.map(([key, item]) => {
    return `${nextIndent}${JSON.stringify(key)}: ${stringifyCompactJsonLogicValue(item, level + 1)}`;
  });

  return `{\n${fields.join(',\n')}\n${indent}}`;
}

export function stringifyCompactJsonLogicForEditor(value) {
  if (value === undefined) {
    return '';
  }

  return stringifyCompactJsonLogicValue(value) ?? 'null';
}

export function formatCompactJsonLogicSnippet(value) {
  if (!value?.trim()) {
    return '{}';
  }

  try {
    return stringifyCompactJsonLogicForEditor(JSON.parse(value));
  } catch {
    return value;
  }
}
