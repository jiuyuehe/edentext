let embedded = false;

export function setRuntimeEmbedded(value: boolean): void {
  embedded = value;
}

export function runtimeEmbedded(): boolean {
  return embedded;
}
