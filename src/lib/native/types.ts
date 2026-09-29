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
  /** Replace the current document for a host-managed open; failures reject instead of showing an alert. */
  replaceDocument(source: File | Blob | ArrayBuffer | Uint8Array, filename: string): Promise<void>;
  save(): Promise<void>;
  saveAs(format: DocumentFormat): Promise<void>;
  exportDocument(format: DocumentFormat | 'pdf'): Promise<void>;
  /** Build an export in memory without opening a file picker or downloading it. */
  exportDocumentBytes(format: DocumentFormat): Promise<Uint8Array>;
  /** Set the active author's name for comments, revisions and exported metadata. */
  setAuthor(name: string): void;
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
  /** Render without native file actions; Ctrl/Cmd+S is forwarded to the host. */
  embedded?: boolean;
  /** Active editor identity used for comments, revisions and exported metadata. */
  author?: string;
  /** Base URL containing package runtime assets, including dictionaries and thesauri. */
  assetBaseUrl?: string;
  /** Theme is applied to this editor host instead of the document root. */
  themeTarget?: HTMLElement;
  /** Called when the embedded UI requests a host save. */
  onSaveRequest?: () => void;
  onReady?: (api: NativeEdenTextApi) => void;
}
