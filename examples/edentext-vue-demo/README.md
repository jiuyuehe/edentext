# EdenText Vue Demo

This is a standalone Vue 3 demo that consumes the local `edentext-vue` package
through the same package entry used by npm consumers.

```bash
npm install --no-package-lock
npm run dev
```

From the repository root, the equivalent command is:

```bash
npm run demo:vue
```

Open the printed Vite URL. The demo renders only the Vue host and the native
EdenText application. Its original Ribbon, editor, pagination and status bar
are visible, and `initial-new-document` starts with an empty document.
