// ---------------------------------------------------------------------------
// OneDrive sync settings.
//
// Paste your Microsoft "Application (client) ID" between the quotes below.
// You get it from the free app registration described in README.md.
// It is not a secret (it is visible to anyone who opens the site).
// ---------------------------------------------------------------------------
export const MS_CLIENT_ID: string = '339a83cd-d197-4a3e-9474-12cf7a11b019';

/** The only file this app ever reads or writes in the family folder. */
export const DATA_FILE_NAME = 'lift-log-data.json';

/**
 * The one Microsoft Graph permission we ask for. For personal Microsoft accounts it covers the
 * user's own OneDrive and folders shared with them. (openid, profile and offline_access are added
 * automatically so we can show who is signed in and stay signed in.)
 */
export const GRAPH_SCOPES = ['Files.ReadWrite'];
