/**
 * Normalizes input into an array of IDs/strings.
 * Handles:
 * - Arrays: ['id1', 'id2']
 * - Comma-separated strings: 'id1,id2' or 'id1, id2'
 * - JSON stringified arrays: '["id1", "id2"]'
 * - Single ID strings: 'id1'
 * - Empty / null / undefined: []
 */
const normalizeArray = (value) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .flatMap((item) => {
        if (typeof item === 'string') {
          const trimmed = item.trim();
          if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            try {
              const parsed = JSON.parse(trimmed);
              if (Array.isArray(parsed)) return parsed;
            } catch (e) {}
          }
          if (trimmed.includes(',')) {
            return trimmed.split(',').map((s) => s.trim());
          }
          return trimmed;
        }
        return item;
      })
      .filter((item) => item !== undefined && item !== null && item !== '');
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return normalizeArray(parsed);
        }
      } catch (e) {}
    }
    if (trimmed.includes(',')) {
      return trimmed
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [trimmed];
  }

  return [value];
};

module.exports = normalizeArray;
