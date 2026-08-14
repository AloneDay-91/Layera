const STORAGE_UPDATED_EVENT = "filecloud:storage-updated";

export function notifyStorageUpdated() {
  window.dispatchEvent(new Event(STORAGE_UPDATED_EVENT));
}

export function onStorageUpdated(callback: () => void) {
  window.addEventListener(STORAGE_UPDATED_EVENT, callback);
  return () => window.removeEventListener(STORAGE_UPDATED_EVENT, callback);
}
