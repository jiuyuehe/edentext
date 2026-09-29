# Import

`odt.ts` and `styleResolver.ts` import ODF; `docx.ts` and `docxStyles.ts` import DOCX;
`imageFormats.ts` is shared. Password-protected files are decrypted before format dispatch.
See `frames.md`, `tables.md`, `formatting.md`, `formulas.md`, `notes.md`, and `styles.md` for
feature-specific contracts.

## Dispatch and degradation

Choose the importer from the extension, then retry the other format after a failed parse so
renamed files still open. ODF reads `content.xml` and `styles.xml` directly: generic readers
lose structures such as cell blocks, row heights, and list formats. Unsupported content should
be flattened or omitted only where it remains safe, with one actionable warning per kind.

Images are accepted only when the browser can render them. Identify their type by extension and
signature; use a supported alternate embedded representation where one exists. Client-decodable
formats may be converted before synchronous import, while unsupported images retain a warning
instead of a broken node. Embedded fonts load before document content and persist with the
document so subsequent layout and font availability agree.

## Style resolution and defaults

`StyleResolver` and `DocxStyles` resolve named styles, automatic styles, parent chains, default
styles, fonts, list levels, table properties, and page geometry. Keep named file styles separate
from automatic styles and direct node/run properties. A **paragraph** style naming no parent sits
on `Standard`, Writer's default paragraph style, not on the family `style:default-style` below it:
LibreOffice writes a text box's paragraphs on such a style and keeps its own UI locale on the
family default, so resolving past `Standard` gave every box paragraph that locale as direct
formatting — and every run in it the document's own.

For each block and run, build a resolved-style yardstick first. Retain direct formatting only
when it differs from that style or from a compatible editor default. This prevents export-import
cycles from accumulating attributes and requires editor defaults to track LibreOffice behavior:
body font and size, heading values, zero paragraph spacing, list margins, and base colours.

The yardstick depends on where content can carry a named style. Top-level body blocks use their
named style; cell and text-box paragraphs use the default paragraph style; headings retain their
level fallback. List items and cells need their resolved formatting rather than a style name.
Direct vertical spacing remains where CSS or schema rules override the inherited equivalent.

Resolve percentage sizes against the inherited size. Preserve complex-script font and size on
the affected runs. Suppress underline or strike only when its shape and colour match the resolved
style. Language is direct formatting only when it differs from the surrounding paragraph or
document language.

## ODF compatibility

ODF paragraph vertical margins resolve as a pair: when a style names one side, the other may
come from the default style rather than its parent. Preserve that rule when resolving and when
deciding whether an imported value is direct formatting. Contextual spacing becomes an explicit
zero where the editor has no equivalent mode.

Named list styles apply to the outer list; their levels determine bullet or number kind. Import
the definition into the style registry instead of flattening it. A list item's own heading is
chapter numbering, not a nested heading; a following heading remains nested content. Manual
page breaks apply to list paragraphs but not table-cell paragraphs.

Master-page changes open document sections. Read page setup, headers, footers, edge distances,
first-page and left/right variants from the governing master, and calculate content width per
section. An explicit empty master-page name means no change. A left/right master pair represents
mirrored layout; distinguish it from a first-page hand-over.

Header/footer body reach is the rendered zone height plus applicable gap, respecting dynamic
spacing, wrapped content, and internal paragraph spacing. A trailing zone margin does not add
to the reach. Both importers convert a zone with the body's block converter under a `'zone'`
kind: its lists, tables, text boxes and frames keep their structure, page fields become live
atoms anywhere in it (cells and boxes too), other fields keep their cached result, and notes,
comments and revisions are left out. A zone paragraph carries no style name and bakes its
Header/Footer style in, as a cell paragraph does. A frame's x measured from the page edge is
kept against the text column, which is how both exporters write it back.

## DOCX compatibility

Use the default paragraph style and named style chain as the DOCX yardstick. Word's `Normal`
maps to the registry default even if its display name differs. A heading can be identified by
outline level as well as style name, and must never become a list item. WPS repeats the chapter
numbering's `w:numPr` on every heading paragraph; that stays chapter numbering, and where the
heading style carries none, the first heading of a level supplies it. Chapter numbering takes
every list format, the CJK ones included.

Resolve table borders and conditional table-style areas before baking them into cells, because
the editor registry does not retain file table styles. Honor compatibility mode when interpreting
table indentation. A floating table becomes the text-box representation the schema supports.
Resolve theme colours and the theme minor body font before falling back to editor defaults.

Resolve linked numbering through numbering styles; otherwise a list may silently lose its level
definitions. Read section properties per section, including bidi layout, odd/even zones,
page-number format, columns, and header/footer references. A missing reference can mean Word's
link-to-previous behavior, while a present empty part deliberately clears the zone.

## Feature mapping

Map paragraphs, headings, lists, tables, inline content, fields, and frames to their semantic
editor nodes. Keep fields' cached values where the editor cannot recalculate them. Text boxes,
shapes, charts, formulas, bookmarks, cross-references, ruby, bibliography, revisions, notes,
and placeholders have focused mappings in their architecture documents.

Page-anchored frames are out of flow and require page-relative positioning. Floating frames
without free-position support collapse to the nearest supported wrap mode. Charts become static
SVG images because the editor has no chart model. Unknown hyperlinks and nested tables flatten
only with warnings.

## Verification

`tests/roundtrip.test.ts` covers editor export-import. `tests/lo-roundtrip.test.ts` adds a
LibreOffice re-save leg. Run `npm test` for importer changes and `npm run test:lo` for format I/O.
