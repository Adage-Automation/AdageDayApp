# Live Scores & Announcements — Architecture & Setup

## The problem (2025)

Last year's results on `live_status.html` (and the announcement cards on `index.html` /
`announcements.html`) were hardcoded directly in the HTML — any update meant editing a
file, committing, and redeploying. Hosting was also on Render's free tier, which spins
its container down when idle and rate-limits requests — during the event this meant the
app went unreachable right when people needed it most.

## What changed for 2026

Two separate problems, two separate fixes:

1. **Hosting** → static hosting (GitHub Pages / Cloudflare Pages). These are CDNs serving
   plain files, not a server process that sleeps or gets rate-limited at this traffic scale.
   There is no container to spin down.
2. **Score & announcement updates** → **Firebase Firestore**. A managed, serverless
   database (Google's infra, not a free-tier container either). Reading data is free up
   to 50,000 reads/day and writes up to 20,000/day — a few hundred people checking a
   results or announcements page over a weekend doesn't get close to that.

Neither piece has anything that "goes to sleep" or "runs out of requests" the way Render's
free web service did.

## The pieces

```
static/js/adage-data.js         — shared list of TEAMS and EVENTS (single source of truth)
static/js/firebase-config.js    — your Firebase project's public config (fill in once)
static/js/firebase-init.js      — initializes the Firebase SDK, exports db + auth
static/js/live-status.js        — live_status.html: listens to Firestore, renders results live
static/js/announcements-feed.js — index.html + announcements.html: renders the live announcement feed
static/js/admin.js              — admin page: sign-in + score entry + post/delete announcements
admin.html                      — the admin UI (not linked from public nav — bookmark it)
live_status.html                — public results page (unchanged visually, data source changed)
announcements.html              — public announcements page (data source changed)
firestore.rules                 — security rules: anyone can read, only signed-in users can write
```

### Data model

One Firestore collection, `results`, one document per event (doc ID = event id from
`adage-data.js`, e.g. `"1km"`, `"football"`). Each document looks like:

```json
{
  "first":  { "teams": ["Red Bull"], "money": 50000 },
  "second": { "teams": ["Alpine"],   "money": 30000 },
  "third":  { "teams": ["McLaren"],  "money": 20000 }
}
```

`teams` is an array because places can tie (e.g. two teams sharing 1st) — the leaderboard
math splits that place's prize money evenly across however many teams are listed, same
logic the 2025 version used, just driven by Firestore instead of hardcoded `data-team`
attributes.

### Announcements data model

A second collection, `announcements`, one auto-ID document per announcement:

```json
{
  "title": "Mandatory Reporting Time",
  "body": "Reach the ground by 5:00 AM on 29th Nov.",
  "category": "important",
  "createdAt": <Firestore server timestamp>
}
```

`category` is one of `"important" | "reminder" | "general"` — it drives the badge color
on the public pages. `index.html` shows the 2 most recent (via `renderAnnouncements(id, { max: 2 })`);
`announcements.html` shows all of them, newest first. Both use the same
`static/js/announcements-feed.js` module so the rendering logic only exists once.

Titles/bodies are free text typed by whoever's signed into `admin.html`, so
`announcements-feed.js` escapes them before inserting into the page — this is the one
place in the app where admin-entered text isn't from a fixed list (unlike team names),
so it's the one place that needs that guard.

### Why Firestore over Firebase's other options

- **Realtime Database** (Firebase's older sibling) would work too, but Firestore has
  better structured queries and is the one Google recommends for new projects.
- **Google Sheets + a fetch()** was considered — simpler mentally, but either needs a
  public proxy service (another thing that can go down, same class of risk as last
  year's Render outage) or exposing an API key for a real Sheets API call with no
  real-time updates.
- **Supabase** is solid but free-tier projects pause after a week of inactivity — fine
  between events, but means remembering to "wake it up" beforehand. Firestore has no
  such pause.

### Why a separate `admin.html` instead of editing Firestore by hand

Firestore has no built-in UI meant for non-technical users to safely punch in results
or post updates during a live event. `admin.html` is one small gated page with two
sections: score entry (check off winning team(s) per place, type the prize amount, hit
Save) and announcements (title, message, category, Post — plus a Delete button per
existing announcement). Every write shows up on the public pages within a second via
Firestore's real-time listeners (`onSnapshot`) — no refresh needed on anyone's screen.

---

## One-time setup

Follow these in order. Budget ~30-45 minutes, one-time, done well before the event.

### 1. Create the Firebase project

1. Go to https://console.firebase.google.com and sign in with a Google account (use
   one that whoever maintains this app next year can also access — e.g. a shared
   company Google account, not a personal one).
2. Click **Add project**.
3. Name it something like `adage-day-2026` → Continue.
4. Disable Google Analytics for this project (not needed) → Create project.
5. Wait for it to finish provisioning → Continue.

### 2. Turn on Firestore (the database)

1. In the left sidebar: **Build → Firestore Database**.
2. Click **Create database**.
3. Choose a location close to your users (e.g. `asia-south1` for India) — this
   **cannot be changed later**, so pick carefully.
4. Start in **production mode** (we'll paste our own rules in step 5).
5. Click **Create**.

### 3. Turn on Authentication (so only approved people can enter scores)

1. Left sidebar: **Build → Authentication → Get started**.
2. Under **Sign-in method**, click **Email/Password**, enable it, Save.
3. Go to the **Users** tab → **Add user**.
4. Add one entry per person who'll be on score-entry duty during the event
   (or a single shared login if that's simpler — e.g.
   `scores@adage-automation.com` with a password you share verbally with the team).
5. Repeat for as many admins as you want. You can add/remove users here any time,
   no code changes needed.

### 4. Register the web app and get your config

1. Left sidebar: click the **gear icon → Project settings**.
2. Scroll to **Your apps** → click the **`</>`** (Web) icon.
3. Give it a nickname (e.g. `adage-day-web`) → **Register app**.
   (You can skip the "Firebase Hosting" checkbox — we're using GitHub Pages instead.)
4. It will show a `firebaseConfig` object like:
   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "adage-day-2026.firebaseapp.com",
     projectId: "adage-day-2026",
     storageBucket: "adage-day-2026.appspot.com",
     messagingSenderId: "...",
     appId: "...",
   };
   ```
5. Open `static/js/firebase-config.js` in this repo and replace the `YOUR_...`
   placeholders with these exact values. Save the file.
   (This is safe to commit — it's a public identifier, not a secret. Real access
   control is the rules file in the next step.)

### 5. Apply the security rules

1. Back in **Firestore Database → Rules** tab.
2. Delete whatever's there and paste in the full contents of `firestore.rules`
   from this repo.
3. Click **Publish**.
4. Sanity check: anyone should be able to *read* `live_status.html`'s data, but
   only a signed-in user (one you added in step 3) can *write* through `admin.html`.

### 6. Test it locally before deploying

Opening `admin.html` by double-clicking the file (`file://...`) will **not** work —
browsers block ES module imports over `file://`. Serve it over a local HTTP server
first:

```bash
cd AdageDayApp
python -m http.server 8080
# then open http://localhost:8080/admin.html
```

Walk through once:
1. Sign in with one of the admin users from step 3.
2. Tick a team as winner for one event, enter a prize amount, click **Save**.
3. Post a test announcement (title + message + category), click **Post**.
4. Open `http://localhost:8080/live_status.html`, `index.html`, and `announcements.html`
   in other tabs — confirm the score, leaderboard, and announcement all appear without
   a page refresh.
5. Open them in an incognito window too, to confirm it works for a signed-out viewer.
6. Back in `admin.html`, click **Delete** on the test announcement to clean it up.

If nothing shows up: open the browser console (F12) on both pages and check for errors
— most common causes are a typo in `firebase-config.js` or the rules not published yet.

### 7. Deploy (static hosting — no server, nothing to sleep or rate-limit)

**Option A — GitHub Pages (simplest, you're already on GitHub):**
1. Merge/push this branch's work to the branch you want live (e.g. `main`).
2. On GitHub: repo → **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **Deploy from a branch**.
4. Pick the branch (e.g. `main`) and folder `/ (root)` → Save.
5. GitHub gives you a URL like `https://<username>.github.io/AdageDayApp/` —
   that's your live site. `admin.html` lives at `.../admin.html`.

**Option B — Cloudflare Pages (unlimited free bandwidth, also simple):**
1. https://dash.cloudflare.com → **Workers & Pages → Create → Pages → Connect to Git**.
2. Pick this GitHub repo and branch.
3. Leave build settings blank (it's a static site, no build step) → Deploy.

Either way: no server process, no free-tier container to spin down — this is the
piece that fixes last year's "app became unreachable" problem.

### 8. Day-of-event checklist

- [ ] Bookmark `admin.html`'s URL on the phone/laptop of whoever is entering scores
      and/or posting announcements.
- [ ] Confirm each admin's login works (test the night before, not during the event).
- [ ] Share the public `live_status.html` and `announcements.html` URLs wherever
      results/updates are expected (big screen, WhatsApp group, etc.).
- [ ] Optional: clear out any test data entered during step 6 before the real event
      starts (open `admin.html`, uncheck teams / zero out amounts / delete test
      announcements, Save).

## Next year

Everything above only needs to be redone if you create a *new* Firebase project.
If you're reusing the same one, next year's setup is just: clear out last year's
`results` and `announcements` documents (or let `admin.html` overwrite/delete them),
update `TEAMS`/`EVENTS` in `static/js/adage-data.js` if they change, and redeploy.
