# `src/lib/import/`

This directory imports ODF and DOCX into the TipTap schema; `imageFormats.ts` is shared.
Password-protected files are decrypted before either importer runs.

`importLimits.ts` bounds ZIP input to 128 MiB compressed, 10,000 entries, 32 MiB XML parts,
64 MiB media parts, 64 MiB other entries, 256 MiB total expansion, and a 1000:1 ratio before
extraction; it rejects over-budget archives and XML declaring entities. A doctype naming
only an external DTD is dropped and the part read — old formula objects carry one — and a
part an embedded object points at never fails the document, only its own frame.
TIFF conversion also rejects more than 100 frames, 40 million pixels, or 160 MiB decoded RGBA
before it allocates an image buffer; unsupported images retain the importer's placeholder path.

ODF is parsed directly from `content.xml` and `styles.xml`; the library reader loses
structures the editor needs. Choose the importer from the extension, but retry the other
format after a failed parse so renamed files still open. Return unsupported content as
warnings where it can be safely flattened or omitted.

`StyleResolver` resolves named and automatic ODF styles through their parent chains;
`DocxStyles` provides the equivalent DOCX resolution. Keep only values that differ from
the resolved named style as direct formatting. Values equal to LibreOffice-compatible
editor defaults must remain implicit, or each round trip accumulates formatting.

Fit imported content to the editor schema without changing its semantic role: paragraph,
heading, list, table, frame, note, and field paths have separate constraints. Keep ODF and
DOCX behavior aligned unless the formats expose an unavoidable difference.
`repairContent.ts` checks the imported body against the schema on open; content it rejects is
refitted and reported as a warning. It is a safety net: an importer still emits valid structure.

Both formats carry western, asian and complex-script text properties side by side. The
**font** is read as a pair: `fontFamily` from the western slot, `fontFamilyAsian` from the
asian one (`style:font-name-asian`, `w:rFonts w:eastAsia`), on every run whatever its script,
each suppressed against its own half of the style chain (`fonts`/`asianFonts`). Size, weight
and slant still come from the set the run's own characters belong to (`scriptProps`,
`ASIAN_SCRIPT_RE`), per ODF text node; DOCX has no asian size or weight, and its
complex-script set is not read. The default style's asian font is dropped where it is the
western one or the language's Han default (`dropDefaultAsianFont`) — what an export writes back
unasked. The **language** is a pair the same way: `lang` from `fo:language`/`w:val`,
`langAsian` from `style:language-asian`/`w:eastAsia`, each suppressed against its own default
(`BlockDefaults.lang`/`langAsian`); DOCX's `RunProps` keeps them apart (`langEastAsia`) so a
run naming one inherits the other. The document's main language is the asian default where
the body is mostly East Asian (`mainOfPair`, `mostlyAsian`), the other one `languageOther`.

A header/footer zone converts through the body's block converter (`'zone'` kind, a
`zone` ctx flag), so a **text box** anchored in one keeps its PAGE field — what Word's
page-number gallery puts there, on every page of the document.

The `sectionBreak` marker is **ordinal** — the editor counts the blocks carrying it to
index the header/footer sets — and only a paragraph, a heading, a table or an index
carries it (`SECTION_CARRIERS`, the types `pageBreak.ts` gives the attr to). A group opening
with anything else is not modelled as a section at all and its set is dropped with it:
marking a later block would leave two sections on one page, and dropping only the marker
would shift every section after it onto the page setup of the one before.
`tests/corpus/17-sections.docx` (opening with a heading), `18-table-sections.docx` (with a
table) and `19-index-sections.docx` (with an index) hold the shapes that have to keep
working. A section can also **end inside a block-level `w:sdt`**: Word wraps an index in
one and puts the `sectPr` on the control's own last paragraph, where a walk of the body's
children never reaches it (`closingSectPr`). Missing it merges two sections, so the index
keeps the page setup of the section before and opens on its page rather than a new one.

ODF keeps a section's master page on the **first thing on its page**, which for a table is
its own table style and for an index its first body paragraph — both probed against
LibreOffice's own conversion. So `masterPageOf` walks the table family too, and naming a
master is a page break there as it is on a paragraph.

Direct paragraph properties beat the numbering level's: a list item's own `w:ind w:left`
is the list's indent, and a table's `w:tblW w:type="pct"` its width as a share of the
section's text width — the grid is only the columns' weights there, and reading it as a
width collapses a full-width table to a few millimetres.

`utils/shapePresets.json` is generated (`scripts/make-shape-presets.mjs`, MPL-2.0 from LibreOffice): never edit it by hand.

Read `docs/architecture/import.md` before changing parsing, style resolution, default
suppression, image conversion, headers/footers, or format-specific edge cases. Read the
focused architecture document for tables, frames, formulas, formatting, notes, or encryption.

Exercise `npm test` for importer changes; use `npm run test:lo` for format I/O changes.
