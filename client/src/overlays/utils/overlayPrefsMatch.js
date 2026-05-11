/** True when saved overlay target applies to current page (pathname). */
export function overlayPathMatches(savedPath, pathname) {
  if (!savedPath || !pathname) return false;
  const norm = (p) => {
    let x = String(p).trim();
    if (!x.startsWith("/")) x = `/${x}`;
    const y = x.replace(/\/+$/, "");
    return y || "/";
  };
  return norm(pathname) === norm(savedPath);
}
