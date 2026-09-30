# `src/lib/components/`

All Svelte UI lives here. `App.svelte` owns app-level state; `Editor.svelte` mounts TipTap
and owns pagination wiring, zoom, floating toolbars, and the header/footer layer.

`Editor.svelte` exposes `editor`, `tick`, `currentPage`, and `numPages` as bindable props.
Toolbar components use `tick` to react to TipTap transactions rather than subscribing to
ProseMirror directly. Keep app-owned state flowing into `Editor.svelte` through its props.

Only one view may measure and paginate in split or page-grid layouts. Plugin decorations
shared by multiple views must create their DOM in a widget factory, never reuse one node.
`chromeMode` selects one of the modern toolbar island or `ribbon/`; both use
`activeEditor`/`activeTick` and only one mounts at a time.
Under the zh-Hans UI both size boxes list and accept the named sizes (字号, `utils/fontSize.ts`).

Keep `pageBreaks.ts`, `Editor.svelte`, and `editor.css` layout constants aligned. Zoom is a
CSS transform on `.paper`, while pagination always measures at 100%; reserve its scaled
footprint with `.paper-scaler` rather than changing the layout scale.

Read `docs/architecture/components.md` before changing component data flow, pagination
settling, split/grid views, zoom, headers/footers, review UI, templates, or debug tooling.
Read the focused architecture document for ribbon, pagination, frames, tables, formatting,
formulas, or notes before changing those areas.
- Modal `<dialog>`s move by their `<h2>` title via `dragDialogs()` (`utils/dragWindow.ts`), modeless windows via `use:dragWindow`.
