type Pos = { left: number; top: number };

// Drags `win` by `bar` from the press `e` on, clamped to the viewport.
function drag(bar: HTMLElement, win: HTMLElement, e: PointerEvent, onMove: (pos: Pos) => void) {
  const box = win.getBoundingClientRect();
  const dx = e.clientX - box.left;
  const dy = e.clientY - box.top;
  bar.setPointerCapture(e.pointerId);
  const move = (ev: PointerEvent) => {
    onMove({
      left: Math.max(0, Math.min(window.innerWidth - box.width, ev.clientX - dx)),
      top: Math.max(0, Math.min(window.innerHeight - box.height, ev.clientY - dy)),
    });
  };
  const up = () => {
    bar.removeEventListener('pointermove', move);
    bar.removeEventListener('pointerup', up);
  };
  bar.addEventListener('pointermove', move);
  bar.addEventListener('pointerup', up);
}

// Svelte action for the title bar of a modeless window: drags the bar's parent element
// around the viewport and reports the new position, which the window applies as its own
// `left`/`top`. A window that cannot be moved covers the very text it works on.
export function dragWindow(node: HTMLElement, onMove: (pos: Pos) => void) {
  function down(e: PointerEvent) {
    // Capturing the pointer retargets the click to the bar, so a press that started on
    // a button of the bar would never reach it.
    const win = node.parentElement;
    if (e.button !== 0 || !win || (e.target as Element).closest('button')) return;
    drag(node, win, e, onMove);
  }
  node.addEventListener('pointerdown', down);
  return { destroy: () => node.removeEventListener('pointerdown', down) };
}

// Every modal <dialog> moves by its <h2> title, delegated so each dialog needs no code.
// A closed dialog drops the position and opens centred again.
export function dragDialogs() {
  document.addEventListener('pointerdown', (e) => {
    const target = e.target as Element;
    const bar = target.closest?.<HTMLElement>('dialog[open] h2');
    const win = bar?.closest('dialog');
    if (e.button !== 0 || !bar || !win || target.closest('button')) return;
    drag(bar, win, e, ({ left, top }) => {
      Object.assign(win.style, { margin: '0', left: `${left}px`, top: `${top}px`, right: 'auto', bottom: 'auto' });
    });
    win.addEventListener('close', () => {
      for (const p of ['margin', 'left', 'top', 'right', 'bottom']) win.style.removeProperty(p);
    }, { once: true });
  });
}
