# EdenText Vue Demo

This is a Vue 3 host demo that consumes the local `edentext-vue` package through
the same package entry used by npm consumers. It includes a dialog modeled on the
cloud-drive flow: open a local DOCX, create an empty document, export DOCX bytes,
and hand the result to a simulated host save.

```bash
# From the repository root
npm run build:lib
npm run demo:vue
```

The demo's predev/prebuild hooks copy the package dictionaries and thesauri into
its `public/assets` directory. Open the printed Vite URL and choose an existing DOCX
or create a new one. Saving downloads the edited file to stand in for the host's
upload-version and upload-new-file API calls.
