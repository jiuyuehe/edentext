import en from '../i18n/locales/en';

// Bounds reflect a large office document while keeping one browser tab responsive.
export const IMPORT_LIMITS = {
  compressedBytes: 128 * 1024 * 1024,
  zipEntries: 10_000,
  zipEntryBytes: 64 * 1024 * 1024,
  zipTotalBytes: 256 * 1024 * 1024,
  zipCompressionRatio: 1_000,
  xmlPartBytes: 32 * 1024 * 1024,
  xmlNodes: 1_000_000,
  xmlDepth: 512,
  mediaPartBytes: 64 * 1024 * 1024,
  textRunChars: 100_000,
  tableSpan: 1_000,
  chartPoints: 100_000,
  convertedImagePixels: 40_000_000,
  convertedImageBytes: 160 * 1024 * 1024,
} as const;

export class ImportLimitError extends Error {
  constructor(message: string) { super(message); this.name = 'ImportLimitError'; }
}

/** A complete decimal integer within an inclusive safe range, otherwise null. */
export function boundedInt(value: string | null | undefined, min: number, max: number): number | null {
  if (!value || !/^-?\d+$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= min && n <= max ? n : null;
}

export function parseImportXml(xml: string, format: 'odt' | 'docx'): Document {
  // An entity declaration is what makes XML unsafe; an external subset declares nothing
  // a DOM parser resolves, and an embedded formula object from an older office suite
  // names a MathML DTD, so that doctype is dropped instead of refusing the file.
  if (/<!ENTITY\b/i.test(xml) || /<!DOCTYPE[^[>]*\[/i.test(xml)) throw new Error(en.importError[`${format}Unsafe` as const]);
  xml = xml.replace(/^((?:\s|<\?[\s\S]*?\?>|<!--[\s\S]*?-->)*)<!DOCTYPE[^[>]*>/i, '$1');
  let depth = 0;
  let nodes = 0;
  for (let at = xml.indexOf('<'); at >= 0; at = xml.indexOf('<', at + 1)) {
    const next = xml[at + 1];
    if (next === '!') {
      const end = xml.startsWith('<!--', at) ? xml.indexOf('-->', at + 4)
        : xml.startsWith('<![CDATA[', at) ? xml.indexOf(']]>', at + 9) : at;
      if (end < 0) throw new Error(en.importError[`${format}Malformed` as const]);
      at = end + 2;
      continue;
    }
    if (next === '?') continue;
    if (next === '/') { depth--; continue; }
    const close = xml.indexOf('>', at + 1);
    if (close < 0 || ++nodes > IMPORT_LIMITS.xmlNodes || ++depth > IMPORT_LIMITS.xmlDepth) {
      throw new Error(en.importError[`${format}TooComplex` as const]);
    }
    if (xml[close - 1] === '/') depth--;
  }
  if (depth !== 0) throw new Error(en.importError[`${format}Malformed` as const]);
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error(en.importError[`${format}Malformed` as const]);
  return doc;
}
