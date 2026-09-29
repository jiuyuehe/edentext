import type { DocumentFormat } from '../storage/documentName';
import type { DocumentLanguage } from '../storage/documentLanguage';
import type { Locale } from '../i18n/config';
import type { NativeEdenTextApi } from '../native/types';

/** Props for the thin Vue host around the original EdenText application. */
export interface EdentextEditorProps {
  /** EdenText chrome language; the native language picker remains available. */
  locale?: Locale;
  /** Default language of the document content and spell checker. */
  documentLanguage?: DocumentLanguage;
  /** Run the native New command once the original editor has mounted. */
  initialNewDocument?: boolean;
  /** Hide native file commands and forward the Save shortcut to the host. */
  embedded?: boolean;
  /** Active author for comments, revisions and exported metadata. */
  author?: string;
  /** Base URL containing the package's runtime assets when hosted separately. */
  assetBaseUrl?: string;
}

/**
 * The public Vue API is a command surface over native EdenText. It intentionally
 * does not expose TipTap, ProseMirror, Svelte, or a second content model.
 */
export interface EdentextEditorApi extends NativeEdenTextApi {
  /** Unmounts the native EdenText application from the Vue host. */
  destroy(): void;
}

export type UiLocale = Locale;
export type { DocumentFormat, DocumentLanguage, NativeEdenTextApi };
