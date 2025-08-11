/**
 * Check if a value is empty (null, undefined, empty string, empty array, or empty object).
 * @param value
 * @returns {boolean}
 */
function isEmptyValue(value: unknown): boolean {
  return (
    value === null ||
    typeof value === 'undefined' ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === 'object' &&
      value !== null &&
      Object.keys(value as Record<string, unknown>).length === 0) ||
    (typeof value === 'string' && value.trim().length === 0)
  );
}

function stringIsBase64Image(value: string): boolean {
  return /^data:image\/[a-zA-Z]*;base64,/.test(value);
}

function stringIsHexColor(value: string): boolean {
  return /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value);
}

function isValueToRemove(value: unknown): boolean {
  if (isEmptyValue(value)) {
    return true;
  }

  if (typeof value === 'string' && stringIsBase64Image(value.trim())) {
    return true;
  }

  if (typeof value === 'string' && stringIsHexColor(value.trim())) {
    return true;
  }

  return false;
}

/**
 * Given an object, recurses of the object and returns a simplified version
 * by removing the following: 
 * 1. Empty arraays
 * 2. Keys with an undefined, null, or empty string value
 * @param object
 */
export function reduceObject<T>(input: T): T {
  // Return primitives (and null/undefined) unchanged
  if (typeof input !== 'object' || input === null) {
    return input;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Arrays
  // ────────────────────────────────────────────────────────────────────────────
  if (Array.isArray(input)) {
    const cleaned = input
      .map((item) => reduceObject(item))
      .filter((item) => !isValueToRemove(item));

    // Casting back to the original generic type
    return cleaned as unknown as T;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Plain objects
  // ────────────────────────────────────────────────────────────────────────────
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (isValueToRemove(value)) {
      continue;
    }

    const reduced = reduceObject(value);

    if (isValueToRemove(reduced)) {
      continue;
    }

    result[key] = reduced;
  }

  return result as unknown as T;
}
