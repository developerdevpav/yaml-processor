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
