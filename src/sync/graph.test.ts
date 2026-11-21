import { describe, expect, it } from 'vitest';
import { emptyData } from './merge';
import { NeedsAuthError, encodeSharingUrl, listFolders, makeGraphRemote, resolveSharingLink, type FetchFn } from './graph';

const token = async () => 'TOKEN';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** A fake fetch that records every request and answers from a function. */
function fakeFetch(answer: (url: string, init: RequestInit) => Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn: FetchFn = async (url, init = {}) => { calls.push({ url, init }); return answer(url, init); };
  return { fn, calls };
}
const folder = { driveId: 'D1', itemId: 'F1', name: 'Family' };

describe('sharing link encoding', () => {
  it('matches Microsoft\'s documented algorithm (u! + unpadded base64url)', () => {
    const url = 'https://1drv.ms/f/s!Abc?e=xyz+/=';
    expect(encodeSharingUrl(url)).toBe('u!aHR0cHM6Ly8xZHJ2Lm1zL2YvcyFBYmM_ZT14eXorLz0'); // computed independently with Node's Buffer
    expect(encodeSharingUrl(url)).not.toMatch(/[=+/]/);
  });
});

describe('folder picker', () => {
  it('lists folders only, and points shortcuts at the other person\'s drive', async () => {
    const f = fakeFetch(() => json({ value: [
      { id: 'a', name: 'Zebra', folder: {}, parentReference: { driveId: 'D1' } },
      { id: 'secret.docx', name: 'Taxes.docx', parentReference: { driveId: 'D1' } },              // a file: dropped
      { id: 's1', name: 'Family (shared)', remoteItem: { id: 'R9', folder: {}, parentReference: { driveId: 'D2' } } },
    ] }));
    const list = await listFolders(token, null, f.fn);
    expect(list).toEqual([
      { driveId: 'D2', itemId: 'R9', name: 'Family (shared)' },
      { driveId: 'D1', itemId: 'a', name: 'Zebra' },
    ]);
    expect(f.calls[0].url).toContain('/me/drive/root/children');
    expect((f.calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer TOKEN');
  });
  it('lists inside a chosen folder', async () => {
    const f = fakeFetch(() => json({ value: [] }));
    await listFolders(token, { driveId: 'D1', itemId: 'F1' }, f.fn);
    expect(f.calls[0].url).toContain('/drives/D1/items/F1/children');
  });
});

describe('sharing link', () => {
  it('resolves a shared folder to its drive and item ids, asking to redeem the link', async () => {
    const f = fakeFetch(() => json({ id: 'FOLDER', name: 'Family', folder: {}, parentReference: { driveId: 'OWNER' } }));
    expect(await resolveSharingLink(token, ' https://1drv.ms/f/abc ', f.fn)).toEqual({ driveId: 'OWNER', itemId: 'FOLDER', name: 'Family' });
    expect(f.calls[0].url).toContain('/shares/u!');
    expect((f.calls[0].init.headers as Record<string, string>).Prefer).toBe('redeemSharingLink');
  });
  it('rejects a single file and non-links with friendly messages', async () => {
    const file = fakeFetch(() => json({ id: 'X', name: 'a.txt', parentReference: { driveId: 'O' } }));
    await expect(resolveSharingLink(token, 'https://1drv.ms/f/abc', file.fn)).rejects.toThrow('not a folder');
    await expect(resolveSharingLink(token, 'hello', file.fn)).rejects.toThrow('https://');
    const denied = fakeFetch(() => json({}, 403));
    await expect(resolveSharingLink(token, 'https://1drv.ms/f/abc', denied.fn)).rejects.toThrow('could not open that link');
  });
});

describe('data file', () => {
  it('only ever touches lift-log-data.json by name, and reads the eTag before the contents', async () => {
    const data = { ...emptyData(), savedAt: 5 };
    const f = fakeFetch((url) => {
      if (url.includes(':/lift-log-data.json?')) return json({ id: 'FILE1', eTag: '"E1"', size: 50 });
      if (url.endsWith('/items/FILE1/content')) return new Response(JSON.stringify(data));
      return json({}, 500);
    });
    const r = await makeGraphRemote(folder, token, f.fn).read();
    expect(r.etag).toBe('"E1"');
    expect(r.data?.app).toBe('lift-log');
    expect(f.calls.map((c) => c.url.replace('https://graph.microsoft.com/v1.0', ''))).toEqual([
      '/drives/D1/items/F1:/lift-log-data.json?$select=id,eTag,size',
      '/drives/D1/items/FILE1/content',
    ]);
  });
  it('a missing file means "create it"; an unreachable folder is an error', async () => {
    const missing = fakeFetch((url) => (url.includes(':/lift-log-data.json') ? json({}, 404) : json({ id: 'F1' })));
    expect(await makeGraphRemote(folder, token, missing.fn).read()).toEqual({ etag: null, data: null });
    const gone = fakeFetch(() => json({}, 404));
    await expect(makeGraphRemote(folder, token, gone.fn).read()).rejects.toThrow('could not be found');
  });
  it('upload uses If-Match with the eTag; creating uses conflictBehavior=fail; 412/409 mean conflict', async () => {
    const f = fakeFetch(() => json({}, 200));
    await makeGraphRemote(folder, token, f.fn).write(emptyData(), '"E1"');
    expect((f.calls[0].init.headers as Record<string, string>)['If-Match']).toBe('"E1"');
    expect(f.calls[0].init.method).toBe('PUT');
    await makeGraphRemote(folder, token, f.fn).write(emptyData(), null);
    expect(f.calls[1].url).toContain('conflictBehavior=fail');
    expect((f.calls[1].init.headers as Record<string, string>)['If-Match']).toBeUndefined();

    const conflict = fakeFetch(() => json({}, 412));
    expect(await makeGraphRemote(folder, token, conflict.fn).write(emptyData(), '"E1"')).toBe('conflict');
    const exists = fakeFetch(() => json({}, 409));
    expect(await makeGraphRemote(folder, token, exists.fn).write(emptyData(), null)).toBe('conflict');
  });
  it('a 401 becomes NeedsAuthError (so the app shows "Tap to sync")', async () => {
    const f = fakeFetch(() => json({}, 401));
    await expect(makeGraphRemote(folder, token, f.fn).read()).rejects.toBeInstanceOf(NeedsAuthError);
  });
});
