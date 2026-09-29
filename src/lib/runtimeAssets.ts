let configuredBaseUrl: string | null = null;

export function setRuntimeAssetBaseUrl(baseUrl?: string): void {
  const trimmed = baseUrl?.trim().replace(/\/+$/, '');
  configuredBaseUrl = trimmed || null;
}

export function runtimeAssetUrl(path: string): string {
  const base = configuredBaseUrl ?? import.meta.env.BASE_URL;
  return `${base.replace(/\/?$/, '/')}${path.replace(/^\/+/, '')}`;
}
