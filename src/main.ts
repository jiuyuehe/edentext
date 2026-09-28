import { mount } from 'svelte';
import App from './App.svelte';
import './styles/global.css';
import { startNativeApp } from './lib/native/bootstrap';
import { startTabPresence, pruneOldDocuments } from './lib/storage/docScope';
import { dragDialogs } from './lib/utils/dragWindow';

// This tab holds its document while it lives; the ones no tab has held for a while
// and that fell out of the newest few are dropped here.
startTabPresence();
void pruneOldDocuments();

dragDialogs();

// Apply the same native theme/chrome bootstrap used by the Vue host.
startNativeApp();

// Offline support (public/sw.js). Not in dev, where a worker would serve the cached
// build over the one being edited.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
    });
}

// Drop the static crawler copy (index.html) — mount() appends instead of replacing
document.getElementById('static-intro')?.remove();

const app = mount(App, { target: document.getElementById('app')! });

export default app;
