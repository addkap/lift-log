/** Make a unique id. crypto.randomUUID only exists on https/localhost, so keep a fallback
 *  (it matters when testing on a phone over http://192.168.x.x). */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}
