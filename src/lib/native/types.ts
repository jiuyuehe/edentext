import type { DocumentFormat } from '../storage/documentName';
import type { DocumentLanguage } from '../storage/documentLanguage';
import type { Locale } from '../i18n/config';

/**
 * Commands exposed by the native EdenText application surface.
 *
 * This deliberately contains commands, not TipTap, ProseMirror, Svelte, or a
 * second document model. Consumers embed the original EdenText UI and ask it
 * to perform the same actions that its own ribbon performs.
 */
export interface NativeEdenTextApi {
  newDocument(): void;
  openFile(): Promise<void>;
  openDocument(source: File | Blob | ArrayBuffer | Uint8Array, filename?: string): Promise<void>;
  save(): Promise<void>;
  saveAs(format: DocumentFormat): Promise<void>;
  exportDocument(format: DocumentFormat | 'pdf'): Promise<void>;
  setUiLocale(locale: Locale): void;
  setDocumentLanguage(language: DocumentLanguage): void;
  focus(): void;
}

export interface NativeEdenTextAppProps {
  /** Initial chrome language. The native UI picker remains the source of truth. */
  initialUiLocale?: Locale;
  /** Initial spell-check/export language for the current document. */
  initialDocumentLanguage?: DocumentLanguage;
  /** Start with the native application's blank-document command after mount. */
  initialNewDocument?: boolean;
  /** Optional base URL for native logo/icon assets when the package is self-hosted. */
  assetBaseUrl?: string;
  onReady?: (api: NativeEdenTextApi) => void;
}
