/** Full-page navigation — reliable when client-side routing fails */
export function goToPath(path) {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  const normalized = path.startsWith('/') ? path : `/${path}`
  window.location.assign(`${base}${normalized}`)
}
