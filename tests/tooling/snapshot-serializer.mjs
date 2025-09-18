const isPlainObject = (value) =>
  value !== null && Object.prototype.toString.call(value) === '[object Object]';

function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item));
  }

  if (isPlainObject(value)) {
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortValue(value[key]);
    }
    return sorted;
  }

  return value;
}

export default function serializeSnapshot(obj) {
  return JSON.stringify(sortValue(obj), null, 2);
}
