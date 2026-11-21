# Lift Log

A very simple gym workout log (installable web app) for logging workouts and viewing progress.
Everything is saved on the phone first, so it works with no signal. (OneDrive sync: stage 4.)

This README grows as the project does. Deploy and OneDrive setup steps are added in stages 4 and 5.

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
