/** Resolve public assets under both localhost and a GitHub Pages project path. */
export function publicUrl(path) {
  return `${import.meta.env?.BASE_URL || '/'}${path.replace(/^\//, '')}`;
}
