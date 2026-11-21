# Lift Log

A very simple gym workout log (installable web app) for logging workouts and viewing progress.
Everything is saved on the phone first, so it works with no signal. A background copy goes to a shared OneDrive folder so you can both see the same log.

This README grows as the project does. Deploy steps are added in stage 5.

## Run it on your computer

You need Node.js 20 or newer.

```bash
cd ~/Projects/lift-log
npm install        # first time only
npm run dev        # opens a test copy at http://localhost:5173
npm test           # runs the unit tests
npm run build      # makes the real site in the "dist" folder
npm run preview    # serves the built site at http://localhost:4173
```

Keep this folder out of OneDrive/iCloud-synced folders (`node_modules` has tens of thousands of files).

## Put it on your dad's iPhone (Home Screen app)

Do this **once the site is deployed** (stage 5). Installing needs a secure `https` address.

1. On the iPhone, open **Safari** (not another browser) and go to the Lift Log address.
2. Tap the **Share** button (a square with an arrow pointing up, at the bottom of the screen).
3. Scroll down the menu and tap **Add to Home Screen**. (If you don't see it, tap **View More** first.)
4. Leave the name as **Lift Log** and tap **Add**.
5. Close Safari. From now on open Lift Log **from the new icon on the Home Screen**. It opens full-screen, with no browser bars.

Why this matters:
- **iOS can delete the saved data of websites that go unused for a while (Safari tab data included).** An app installed on the Home Screen is exempt, so install it before logging real workouts.
- **The Home Screen app has its own storage, separate from Safari.** Do all logging, and later the OneDrive sign-in, inside the Home Screen app, not in a Safari tab.
- In **Settings** inside the app, "Phone storage" says **Protected** once the phone has agreed to keep the data.

## Check that it works offline

1. Open the deployed site (or `npm run build && npm run preview`) once with internet, so the app files get saved.
2. Turn on Airplane Mode (on a computer: stop the preview server, or use Chrome DevTools, Network, Offline).
3. Reopen/reload the app. It should still load, show a yellow "Offline" notice, and let you log and finish a workout.

## Making new icons

`node scripts/make-icons.mjs` redraws the icons in `public/icons/`.

## OneDrive sync

### How it works
- The phone's own storage is the source of truth. Logging never waits for OneDrive and works with no signal.
- In the background the app keeps **one file**, `lift-log-data.json`, in the family OneDrive folder. It never opens, lists, changes or deletes any other file there.
- Both of you open the same site and sign in with your **own** Microsoft accounts. Every workout has an id and a last-changed time; when both copies differ, the newest change wins. Deleted workouts are remembered so deletions sync too.
- Before every upload the app re-reads the file. If the other person saved at the same moment, it merges their changes in and tries again, so nobody overwrites anybody.
- The bar under the header says **Synced**, **Not synced yet** (tap to sync), or **Tap to sync** (the sign-in expired).
- Microsoft sign-ins for web apps expire after about 24 hours, and iPhones can block the quiet re-sign-in. Nothing is lost when that happens: the bar says "Tap to sync", workouts keep saving on the phone, and one tap signs in again and uploads everything waiting.
- If a phone ever loses its saved data, sign in, choose the folder again (Settings), and everything is pulled back from OneDrive. If the phone still remembers the folder and is signed in, the app pulls from OneDrive on its own before showing the Workout page.

### The permission it asks for
One Microsoft Graph permission, **`Files.ReadWrite`**. For personal Microsoft accounts this covers the signed-in person's own OneDrive and folders shared with them. In Microsoft's permission list it is called something like "Have full access to user files" (the first sign-in shows the exact wording; it will be written here once confirmed). It is broader than "one folder" because Microsoft offers no narrower permission for shared folders on personal accounts. The app's code only touches `lift-log-data.json`, and the folder picker lists folder names only.

### Step 1: Register the app with Microsoft (free, about 10 minutes, once)
You do this one time, as the developer. Your dad does not need to.

1. Go to <https://entra.microsoft.com> (or <https://portal.azure.com>) and sign in with your **personal** Microsoft account. If it offers to set up a free directory or account, accept; no payment is needed for app registrations.
2. Open **Entra ID** (or "Microsoft Entra ID") → **App registrations** → **New registration**.
3. Fill in:
   - **Name:** `Lift Log`
   - **Supported account types:** choose **Personal Microsoft accounts only**
   - **Redirect URI:** platform **Single-page application (SPA)**, value `http://localhost:5173/` (keep the trailing slash)
4. Click **Register**.
5. On the app's **Overview** page, copy the **Application (client) ID** (a long code with dashes).
6. Left menu → **Authentication** → under **Single-page application**, click **Add URI** and add these too, each with a trailing slash, then **Save**:
   - `http://localhost:4173/` (for `npm run preview`)
   - `https://YOUR-SITE.pages.dev/` (your real address, after deploying in stage 5; add it later when you have it)
7. Left menu → **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions** → tick **`Files.ReadWrite`** → **Add permissions**. (`openid`, `profile` and `offline_access` are fine to leave as they are.) No admin approval is needed for personal accounts.
8. In this project, open `src/config.ts` and paste the client ID between the quotes:
   ```ts
   export const MS_CLIENT_ID: string = 'paste-the-id-here';
   ```
9. Restart `npm run dev` (or rebuild) and open Settings in the app.

The same client ID works for both of you.

### Step 2: Connect the folder
**Your dad (owns the folder, "My files")**
1. Settings → **Sign in with Microsoft**, and approve the permission screen.
2. Settings → **Choose the data folder**, then tap **Use this folder** next to the family folder (tap **Open** to look inside other folders). The app creates `lift-log-data.json` there.

**You (the folder is "Shared with me")**
1. Your dad opens the folder at <https://onedrive.live.com>, clicks **Share**, adds your Microsoft account with **Can edit**, and copies the link (the link must say it is for the people he picked, with edit allowed).
2. He sends you the link. In the app: Settings → **Sign in with Microsoft**, then **Choose the data folder**, paste the link into **A folder shared with me**, and tap **Use this link**.

Why a link and not a list? Microsoft is retiring the API that lists "Shared with me", and a list would need a much broader permission.

### Settings, backup, and trouble
- Settings shows who is signed in, the folder, the last sync time, and a **Sync now** button.
- **Export backup / Import backup** save and restore the same JSON format (restoring merges, it never wipes).
- Redirect URI mismatch error from Microsoft: the address in the browser (including `http`/`https`, the port, and the trailing `/`) must be listed exactly under Authentication in step 1.6.
- "Tap to sync" every day is expected for a phone that was not opened for more than about a day.
