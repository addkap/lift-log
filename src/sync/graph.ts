// Talking to OneDrive through Microsoft Graph.
//
// Safety rules for this file:
//  * The only file ever read or written is lift-log-data.json, addressed by name inside the chosen folder.
//  * Other files in the family folder are never listed, opened, changed or deleted.
//  * The folder picker lists folders only (the response is filtered to folders straight away).

import { DATA_FILE_NAME } from '../config';
import type { FolderRef } from '../types';
import { parseSyncData, type RemoteStore, type SyncData } from './merge';

const BASE = 'https://graph.microsoft.com/v1.0';

/** The sign-in has expired: show "Tap to sync". Nothing is lost. */
export class NeedsAuthError extends Error {
  constructor() {
    super('Sign in again to sync.');
  }
}

export class GraphError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type TokenGetter = () => Promise<string>;
export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;
// (An arrow wrapper: calling fetch as an object method throws "Illegal invocation" in browsers.)
const defaultFetch: FetchFn = (input, init) => fetch(input, init);

async function call(fetchFn: FetchFn, getToken: TokenGetter, path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  const res = await fetchFn(path.startsWith('http') ? path : BASE + path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers as Record<string, string> | undefined) },
  });
  if (res.status === 401) throw new NeedsAuthError();
  return res;
}

function fail(res: Response, doing: string): never {
  if (res.status === 403) throw new GraphError(`OneDrive would not let the app ${doing}. Check the folder is shared with edit access.`, 403);
  if (res.status === 404) throw new GraphError(`The OneDrive folder could not be found while trying to ${doing}.`, 404);
  throw new GraphError(`OneDrive problem (${res.status}) while trying to ${doing}.`, res.status);
}

// ---------------------------------------------------------------- folder picker

export interface FolderChoice extends FolderRef {}

interface GraphItem {
  id: string;
  name: string;
  folder?: unknown;
  parentReference?: { driveId?: string };
  remoteItem?: { id: string; folder?: unknown; parentReference?: { driveId?: string } };
}

/** Where a folder item really lives. A shortcut to a shared folder points at the other person's drive. */
function toFolderChoice(item: GraphItem): FolderChoice | null {
  const target = item.remoteItem ?? item;
  if (!target.folder) return null; // not a folder: dropped immediately, never shown or stored
  const driveId = target.parentReference?.driveId ?? item.parentReference?.driveId;
  if (!driveId) return null;
  return { driveId, itemId: target.id, name: item.name };
}

/** List the folders inside `parent` (or the top of "My files" when parent is null). */
export async function listFolders(
  getToken: TokenGetter,
  parent: { driveId: string; itemId: string } | null,
  fetchFn: FetchFn = defaultFetch,
): Promise<FolderChoice[]> {
  const select = '?$select=id,name,folder,remoteItem,parentReference&$top=200';
  let url: string | null = parent ? `/drives/${parent.driveId}/items/${parent.itemId}/children${select}` : `/me/drive/root/children${select}`;
  const out: FolderChoice[] = [];
  for (let page = 0; url && page < 5; page++) {
    const res = await call(fetchFn, getToken, url);
    if (!res.ok) fail(res, 'list your folders');
    const json = (await res.json()) as { value: GraphItem[]; '@odata.nextLink'?: string };
    for (const item of json.value) {
      const f = toFolderChoice(item);
      if (f) out.push(f);
    }
    url = json['@odata.nextLink'] ?? null;
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Turn a OneDrive sharing link into Graph's "share id": "u!" + unpadded base64url of the link. */
export function encodeSharingUrl(url: string): string {
  const bytes = new TextEncoder().encode(url);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return 'u!' + btoa(bin).replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-');
}

/** Look up the folder behind a sharing link someone sent us, and get durable access to it. */
export async function resolveSharingLink(getToken: TokenGetter, link: string, fetchFn: FetchFn = defaultFetch): Promise<FolderChoice> {
  const url = link.trim();
  if (!/^https:\/\//i.test(url)) throw new Error('That does not look like a link. It should start with https://');
  const res = await call(
    fetchFn,
    getToken,
    `/shares/${encodeSharingUrl(url)}/driveItem?$select=id,name,folder,remoteItem,parentReference`,
    { headers: { Prefer: 'redeemSharingLink' } }, // asks OneDrive to keep this access for us
  );
  if (res.status === 403 || res.status === 404) {
    throw new GraphError('OneDrive could not open that link. Ask for the folder to be shared with your Microsoft account (edit access), then copy the link again.', res.status);
  }
  if (!res.ok) fail(res, 'open that link');
  const folder = toFolderChoice((await res.json()) as GraphItem);
  if (!folder) throw new Error('That link is not a folder. Share the whole family folder, not a single file.');
  return folder;
}

// ---------------------------------------------------------------- the data file

/** Remote store backed by lift-log-data.json inside the chosen folder. */
export function makeGraphRemote(folder: FolderRef, getToken: TokenGetter, fetchFn: FetchFn = defaultFetch): RemoteStore {
  const filePath = `/drives/${folder.driveId}/items/${folder.itemId}:/${DATA_FILE_NAME}`;

  return {
    async read() {
      // Get the file's eTag first, then its contents. If someone writes in between, our eTag is
      // older than the file, so the later upload is refused and we simply merge again.
      const meta = await call(fetchFn, getToken, `${filePath}?$select=id,eTag,size`);
      if (meta.status === 404) {
        // The file is missing... or the folder itself is unreachable. Tell those two apart.
        const folderRes = await call(fetchFn, getToken, `/drives/${folder.driveId}/items/${folder.itemId}?$select=id`);
        if (!folderRes.ok) fail(folderRes, 'open the data folder');
        return { etag: null, data: null };
      }
      if (!meta.ok) fail(meta, 'read the data file');
      const info = (await meta.json()) as { id: string; eTag: string; size?: number };
      if (!info.size) return { etag: info.eTag, data: null }; // empty file: treat as new

      const body = await call(fetchFn, getToken, `/drives/${folder.driveId}/items/${info.id}/content`);
      if (!body.ok) fail(body, 'read the data file');
      return { etag: info.eTag, data: parseSyncData(await body.text()) };
    },

    async write(data: SyncData, etag: string | null) {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      let url = `${filePath}:/content`;
      if (etag) headers['If-Match'] = etag; // only replace the version we merged with
      else url += '?@microsoft.graph.conflictBehavior=fail'; // only create if nobody else just did
      const res = await call(fetchFn, getToken, url, { method: 'PUT', headers, body: JSON.stringify(data) });
      if (res.status === 412 || res.status === 409) return 'conflict';
      if (!res.ok) fail(res, 'save the data file');
      return 'ok';
    },
  };
}
