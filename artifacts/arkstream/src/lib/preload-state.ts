/**
 * Module-level ready signal for the preloader.
 * Home page calls markAppReady() when all three sections finish loading.
 * Preloader subscribes via subscribeReady().
 */

type Listener = () => void;
let _ready = false;
const _listeners: Listener[] = [];

export function markAppReady() {
  if (_ready) return;
  _ready = true;
  _listeners.splice(0).forEach(fn => fn());
}

export function subscribeReady(fn: Listener): () => void {
  if (_ready) {
    fn();
    return () => {};
  }
  _listeners.push(fn);
  return () => {
    const i = _listeners.indexOf(fn);
    if (i >= 0) _listeners.splice(i, 1);
  };
}

export function isAppReady() {
  return _ready;
}
