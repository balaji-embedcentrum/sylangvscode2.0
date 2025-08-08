// Minimal shim to satisfy @preact/preset-vite import in environments
// where prerendering is not used. Exports a no-op plugin array.
export function vitePrerenderPlugin() {
  return [];
}


