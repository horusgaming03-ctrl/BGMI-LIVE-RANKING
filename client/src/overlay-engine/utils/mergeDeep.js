export function mergeDeep(target, ...sources) {
  if (!sources.length) return target;
  const src = sources.shift();
  if (src == null) return mergeDeep(target, ...sources);

  if (Array.isArray(target) && Array.isArray(src)) {
    return mergeDeep([...target, ...src], ...sources);
  }

  if (isObject(target) && isObject(src)) {
    for (const key of Object.keys(src)) {
      if (isObject(src[key]) && !Array.isArray(src[key]) && key in target && isObject(target[key])) {
        target[key] = mergeDeep({ ...target[key] }, src[key]);
      } else {
        target[key] = src[key];
      }
    }
  }
  return mergeDeep(target, ...sources);
}

function isObject(x) {
  return x != null && typeof x === "object";
}
