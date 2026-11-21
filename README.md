# Lift Log

A very simple gym workout log, built for one person to use on an iPhone and for family to view. It is an installable web app (PWA) with big text, big buttons, and a number keypad.

- **Log a workout:** pick Lower / Upper / Full, tap Start, enter reps (weights are prefilled), tap Finish.
- **Smart weights:** the app suggests the next weight from the last workout (details under "How the weight suggestion works").
- **History and Summary:** fix old workouts, see workouts per week, and weight/volume charts per exercise.
- **Works with no signal.** Everything saves on the phone first.
- **OneDrive sync:** a background copy goes to one file in a shared family OneDrive folder, so you can both see the same log.

It is a static website: there is no server to run or pay for.

---

## 1. Run it on your computer

You need **Node.js 20 or newer** (check with `node -v`).

```bash
cd ~/Projects/lift-log
npm install        # first time only
npm run dev        # test copy at http://localhost:5173
npm test           # runs the automatic tests
npm run build      # builds the real site into the "dist" folder
npm run preview    # serves the built site at http://localhost:4173
```

Keep this folder **out of OneDrive / iCloud synced folders**: `node_modules` has tens of thousands of files and chokes sync.

`npm run dev` also prints a `Network:` address. Open it on a phone on the same Wi-Fi to try the app (logging works; installing and OneDrive sign-in need the https site from step 2).

---

## 2. Put it on the internet (free): GitHub Pages

GitHub Pages hosts the site for free with https (needed for installing and sign-in). A ready-made workflow in `.github/workflows/deploy.yml` builds and publishes it every time you push.

**One-time setup**

1. On GitHub, click **New repository**. Name it `lift-log`, choose **Public**, and leave "Add a README" and the other boxes **unticked**. (Free GitHub Pages needs a public repository. The repository contains only code: workouts live in OneDrive, and the Microsoft client ID is public by design.)
2. In the new repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Back in a terminal, send the code up (replace `YOUR-USERNAME`):

   ```bash
   cd ~/Projects/lift-log
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/lift-log.git
   git push -u origin main
   ```

4. Open the repository's **Actions** tab. When **Deploy to GitHub Pages** shows a green tick (about a minute), your site is live at:

   `https://YOUR-USERNAME.github.io/lift-log/`

   (If the first run failed because Pages was not switched on yet, do step 2, then open the failed run and click **Re-run all jobs**.)

The workflow runs the tests first, so a broken change never gets published.

**Updating the app later:** make changes, then `git add -A`, `git commit -m "what changed"`, `git push`. The site updates by itself. Phones pick up the new version the next time the app is opened (close it fully and open it again once or twice).

**Other free hosts** (Netlify, Cloudflare): build command `npm run build`, output folder `dist`, and leave `VITE_BASE` unset. Add whatever address they give you to the Microsoft app registration in step 3.

---

## 3. Set up OneDrive sync

### How it works
- The phone's own storage is the source of truth. Logging never waits for OneDrive.
- In the background the app keeps **one file**, `lift-log-data.json`, in the family folder. It never opens, lists, changes or deletes any other file there. (The folder picker shows folder names only.)
- You both open the same site and sign in with your **own** Microsoft accounts. Every workout has an id and a last-changed time; when two copies differ, the newest change wins. Deletions are remembered so they sync too.
- Before every upload the app re-reads the file. If the other person saved at the same moment, it merges their changes in and tries again, so nobody overwrites anybody.
- The bar under the header says **Synced**, **Not synced yet** (tap to sync), or **Tap to sync** (sign-in expired).
- Microsoft sign-ins for web apps expire after about 24 hours, and iPhones can block the quiet re-sign-in. When that happens nothing is lost: the bar says "Tap to sync", workouts keep saving on the phone, and one tap signs in and uploads everything waiting.
- If a phone loses its saved data, sign in and choose the folder again (Settings) and everything is pulled back from OneDrive. If the phone still remembers the folder and is signed in, it pulls on its own before showing the Workout page.

### The permission it asks for
One Microsoft Graph permission: **`Files.ReadWrite`**. For personal Microsoft accounts it covers the signed-in person's own OneDrive and folders shared with them. Microsoft's name for it is, from memory, something like "Have full access to user files"; check the actual sign-in screen the first time and note what it says. It is broader than "one folder" because Microsoft offers no narrower permission that reaches a shared folder on personal accounts. The app's code only touches `lift-log-data.json`.

### Step A: Register the app with Microsoft (free, about 10 minutes, once)
You do this once, as the developer. Your dad does not need to.

1. Go to <https://entra.microsoft.com> (or <https://portal.azure.com>) and sign in with your **personal** Microsoft account.
   - A brand-new personal account often **cannot** sign in there ("user account does not exist in tenant 'Microsoft Services'"), because it has no directory yet. If so, first create a free Azure account with that same Microsoft account at <https://azure.microsoft.com/free> (it asks for a phone number and a card to verify you; the free account is not charged unless you upgrade it). That creates a "Default Directory", and then the sign-in above works. App registrations themselves are free.
2. Open **Entra ID** (or "Microsoft Entra ID") → **App registrations** → **New registration**.
3. Fill in:
   - **Name:** `Lift Log`
   - **Supported account types:** **Personal Microsoft accounts only**
   - **Redirect URI:** platform **Single-page application (SPA)**, value `http://localhost:5173/`
4. Click **Register**, then copy the **Application (client) ID** from the Overview page.
5. Left menu → **Authentication** → under **Single-page application** click **Add URI** and add each of these, then **Save**. Every address must match exactly, including `https`, the port, and the final `/`:
   - `http://localhost:5173/` (already there)
   - `http://localhost:4173/` (for `npm run preview`)
   - `https://YOUR-USERNAME.github.io/lift-log/` (your real site from step 2)
6. Left menu → **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions** → tick **`Files.ReadWrite`** → **Add permissions**. Leave `openid`, `profile` and `offline_access` as they are. No admin approval is needed for personal accounts.
7. Open `src/config.ts` and paste the client ID between the quotes:

   ```ts
   export const MS_CLIENT_ID: string = 'paste-the-id-here';
   ```

8. Commit and push (see "Updating the app later" above) so the live site has the ID. The same client ID works for both of you.

### Step B: Connect the folder
**Your dad (owns the folder, so it is in "My files")**
1. Settings → **Sign in with Microsoft**, and approve the permission screen.
2. Settings → **Choose the data folder** → tap **Use this folder** next to the family folder (tap **Open** to look inside other folders). The app creates `lift-log-data.json` there.

**You (the folder is "Shared with me")**
1. Your dad opens the folder at <https://onedrive.live.com>, clicks **Share**, adds your Microsoft account with **Can edit**, and copies the link (it must be the link for the specific people he chose, with editing allowed).
2. He sends you the link. In the app: Settings → **Sign in with Microsoft**, then **Choose the data folder**, paste the link under **A folder shared with me**, and tap **Use this link**.

Why a pasted link instead of a "Shared with me" list? Microsoft is retiring the API that lists shared items, and it would need a much broader permission.

### Settings and backup
- Settings shows who is signed in, the folder, the last sync time, and a **Sync now** button.
- **Export backup / Import backup** save and restore the same JSON format. Restoring merges; it never wipes what is on the phone.

---

## 4. Put it on your dad's iPhone (Home Screen app)

Do this after the site is live (step 2), because installing needs an https address.

1. On the iPhone, open **Safari** (not another browser) and go to `https://YOUR-USERNAME.github.io/lift-log/`.
2. Tap the **Share** button (a square with an arrow pointing up, at the bottom of the screen).
3. Scroll down the menu and tap **Add to Home Screen**. (If you do not see it, tap **View More** first.)
4. Leave the name as **Lift Log** and tap **Add**.
5. Close Safari. From now on open Lift Log **from the new icon on the Home Screen**. It opens full-screen with no browser bars.
6. Open the app from the icon, go to Settings, and sign in to OneDrive **inside the Home Screen app**.

Why this matters:
- **iOS can delete the saved data of websites that go unused for a while.** Apps installed on the Home Screen are exempt, so install it before logging real workouts.
- **The Home Screen app has its own storage, separate from Safari.** Do all logging and the OneDrive sign-in inside the Home Screen app, not in a Safari tab.
- Settings → **Phone storage** says **Protected** once the phone has agreed to keep the data.

---

## How the weight suggestion works
For an exercise in a saved workout, only the sets at the **heaviest weight** that day count (this ignores light warm-up sets).
- If the best set was **12 or more** reps **and** the average of those sets is **11.5 or more**, the next suggestion is that weight plus the exercise's increment (default 5 lb, changeable in Settings).
- Otherwise the suggestion stays the same weight. It never goes down.
- With no history the weight is left blank.

Examples: `12,12,11` goes up. `12,11` goes up. `12,10,10` stays. `14,9,9` stays.
Suggestions are worked out from saved history each time, never stored, so editing or deleting a past workout changes them automatically. The rule is tested in `src/lib/progression.test.ts`.

---

## Checks to run before trusting it

**Works with no internet**
1. Open the deployed site once with internet.
2. Turn on Airplane Mode and reopen the app. It should load, show a yellow "Offline" notice, and let you log and finish a workout.
3. Turn Airplane Mode off. The bar under the header should change to "Synced" within a few seconds (once OneDrive is connected).

**Two-phone sync:** log a workout on one device; open the app on the other and tap the status bar. The workout should appear. Edit or delete one on either side and sync both.

## Troubleshooting
- **Microsoft says "redirect URI mismatch":** the address in the browser must be listed exactly under Authentication (step 3A.5), with `https`, the port, and the final `/`.
- **Microsoft says the account "does not exist in tenant 'Microsoft Services'" when signing in to Lift Log:** the app registration does not allow personal accounts. In the registration, **Authentication → Supported account types** must include personal Microsoft accounts ("Accounts in any organizational directory and personal Microsoft accounts" or "Personal Microsoft accounts only"). If you use the "any directory and personal" option, the manifest setting `api.requestedAccessTokenVersion` must be `2`. The app's `/consumers` sign-in address stays as it is.
- **"Tap to sync" every day:** normal for a phone that was not opened for more than about a day. Tap it and sign in.
- **Blank page on GitHub Pages:** check the Actions tab for a red run; the site address must end in `/lift-log/` (it follows your repository name).
- **The phone shows an old version:** close the app completely and open it again; the new version installs on the next open.

## Project map
- `src/lib/` rules and calculations: progression, draft editing, statistics, dates (all unit tested)
- `src/store.ts`, `src/db.ts` local database (IndexedDB through Dexie)
- `src/sync/` OneDrive: sign-in (`auth.ts`), Graph calls (`graph.ts`), merge rules (`merge.ts`), sync engine (`engine.ts`)
- `src/pages/`, `src/components/` the screens
- `src/config.ts` the Microsoft client ID goes here
- `scripts/make-icons.mjs` redraws the app icons (`node scripts/make-icons.mjs`)
- `.github/workflows/deploy.yml` the free deploy
