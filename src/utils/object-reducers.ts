/**
 * Check if a value is empty (null, undefined, empty string, or empty array).
 * @param value
 * @returns {boolean}
 */
function isEmptyValue(value) {
  return (
    value === null ||
    typeof value === 'undefined' ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === 'string' && value.trim().length === 0)
  );
}

function stringIsBase64Image(value) {
  return /^data:image\/[a-zA-Z]*;base64,/.test(value);
}

function stringIsHexColor(value) {
  return /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value);
}

function isValueToIgnore(value) {
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
export function reduceObject(object) {
  
}
