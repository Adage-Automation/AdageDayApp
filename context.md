# Adage Day app: project context and local guide

This is a small, static website for Adage Day. Its pages are ordinary HTML files;
there is no build step, backend server, or `package.json`. Firebase provides the
shared live results and announcements, and Firebase Authentication protects the
admin sign-in.

For the deeper Firebase setup and hosting notes, see [LIVE_SCORES.md](LIVE_SCORES.md).

## Run it on your computer

You can edit and preview the app locally without pushing anything to GitHub or
changing the deployed website:

1. Open this project folder in VS Code.
2. Open **Terminal → New Terminal**. The terminal must be in the project root
   (the folder containing `index.html` and `admin.html`).
3. Start Python's built-in web server:

   ```powershell
   py -m http.server 8080
   ```

   If `py` is not recognized, try `python -m http.server 8080`. If neither
   command works, install Python or use another local static-file server.
4. Open these addresses in your browser:

   - Main site: <http://localhost:8080/>
   - Admin page: <http://localhost:8080/admin.html>
   - Live results: <http://localhost:8080/live_status.html>
   - Announcements: <http://localhost:8080/announcements.html>
   - Schedule: <http://localhost:8080/schedule.html>
5. To stop the server, return to the terminal and press **Ctrl+C**.

Do not double-click an HTML file to open it as `file://...`. The app uses
JavaScript ES modules, which browsers block from loading that way. A local HTTP
server fixes that.

### Important: local admin uses the shared Firebase project

Running the site on `localhost` only keeps your **code changes** local. The
Firebase settings in [static/js/firebase-config.js](static/js/firebase-config.js)
point to the app's configured Firebase project, so the local admin page connects
to the same Firebase Authentication and Firestore data as the deployed site.

- You need an existing Firebase admin account to sign in; the page does not
  create accounts.
- Saving a result, posting an announcement, or deleting an announcement from
  localhost changes shared Firestore data. It can therefore appear on the live
  website immediately. Do not use the real admin page to experiment with writes
  unless you are authorized and intend to change the shared data.
- For isolated write-testing, this repository does not currently configure a
  Firebase Emulator or a separate development Firebase project. Those would
  need to be set up deliberately.
- If Firebase Auth rejects `localhost` as an unauthorized domain, a Firebase
  project administrator must allow `localhost` in Authentication's authorized
  domains. Do not change project settings if you do not have permission.

The admin page itself can be opened locally without deploying, but logging in
still requires the right account and Firebase access. Merely viewing the
sign-in screen does not require making a GitHub change.

### Making and seeing a code change

1. Edit the relevant `.html`, `.js`, or other asset in VS Code and save it.
2. Leave the local server running.
3. Refresh the matching `localhost` page in the browser. If a change seems
   stuck, use **Ctrl+F5** for a hard refresh. The service worker can cache
   files on pages that register it; if needed, clear this local site's data or
   its service worker in browser DevTools.
4. Check the browser DevTools console (**F12 → Console**) for JavaScript or
   Firebase errors.

Local previewing does not push, commit, or deploy files. Only changes later
committed/pushed to the configured hosting branch can update the deployed
website. If you also use the local admin page to write to Firestore, those data
changes are separate from Git and may still affect the deployed site.

## How the app is connected

```text
HTML page
  └─ loads its page-specific JavaScript module
       ├─ Firebase init → Firebase config → Firestore / Authentication
       └─ shared event/team data or shared announcement rendering
```

The pages and scripts are connected like this:

| File | What it does |
| --- | --- |
| [index.html](index.html) | Home page, event countdown, navigation, and latest-announcement preview. Loads `announcements-feed.js`. |
| [message.html](message.html) | Managing Director message page. |
| [schedule.html](schedule.html) | Event schedule. The home page links to specific days/sections using URL query parameters such as `?day=2&section=sportsSchedule`. |
| [rules.html](rules.html) | Event guidelines. |
| [contacts.html](contacts.html) | Contact information and phone/WhatsApp links. |
| [guest.html](guest.html) | Outstation/guest information. |
| [live_status.html](live_status.html) | Public live results, prize-distribution table, and prize leaderboard. Loads `live-status.js`. |
| [announcements.html](announcements.html) | Public list of announcements. Loads `announcements-feed.js`. |
| [admin.html](admin.html) | Admin sign-in, score entry, and announcement management. Loads `admin.js`; it is not linked in the public navigation, so open it by its direct URL. |
| [static/js/adage-data.js](static/js/adage-data.js) | Shared team names/colors, legacy team-name mapping, four place definitions, event list, and prize distribution. The admin and live-results pages both use it. |
| [static/js/firebase-config.js](static/js/firebase-config.js) | Firebase web-app configuration: tells the SDK which Firebase project to use. It is not a place to put passwords or private server credentials. |
| [static/js/firebase-init.js](static/js/firebase-init.js) | Initializes Firebase and exports the shared Firestore database (`db`) and Authentication (`auth`) objects. |
| [static/js/admin.js](static/js/admin.js) | Handles admin sign-in/out, loads saved scores, saves results, and posts/deletes announcements. |
| [static/js/live-status.js](static/js/live-status.js) | Listens for result changes in Firestore and renders event winners and the leaderboard. |
| [static/js/announcements-feed.js](static/js/announcements-feed.js) | Loads and renders announcements for the home and announcements pages. |
| [firestore.rules](firestore.rules) | Firestore read/write rules. They allow public reads and currently allow writes to any signed-in Firebase user; they do not check for a separate admin role. Only trusted users should have Firebase accounts with sign-in access. |
| [manifest.json](manifest.json), [sw.js](sw.js), [static/js/install-prompt.js](static/js/install-prompt.js) | PWA metadata, service-worker caching, and the install prompt on supported browsers. |
| [LIVE_SCORES.md](LIVE_SCORES.md) | Existing detailed Firebase setup, live-score data model, and deployment notes. |

Most page-to-page navigation is plain HTML links such as `href="schedule.html"`.
Styles are mainly written in each HTML page, with Tailwind CSS, Google Fonts,
and Material Icons loaded from external CDNs. Because those styles/fonts come
from the internet, an offline preview may look different even if the page files
are available.

## How live data flows

### Scores

1. `admin.html` loads `admin.js`; the admin page checks Firebase Authentication.
2. After sign-in, `admin.js` uses the event list in `adage-data.js` to build
   score-entry forms and reads existing documents from Firestore's `results`
   collection.
3. Pressing **Save** writes the selected first/second/third/fourth-place teams
   and configured prize amounts to the document for that event.
4. `live-status.js` listens to the `results` collection. It updates the public
   winners table, prize-distribution table, and team totals; tied prize money is
   split evenly between the teams tied for a place.

### Announcements

1. The admin page writes title, message, category, and creation time to the
   `announcements` collection.
2. The home page shows the two newest announcements; `announcements.html`
   shows the full list.
3. Both public pages use `announcements-feed.js`, which listens for changes and
   escapes announcement text before displaying it.

Firestore listeners update open pages without a manual refresh. Public pages
can read these collections without signing in; writes require Firebase sign-in
under the current rules.

## Useful basics before changing things

- **HTML** controls page structure and links. Start there when changing a
  page's text, sections, or navigation.
- **CSS/Tailwind classes** control appearance. Most visual styles are in the
  page's `<style>` block and its Tailwind utility classes.
- **JavaScript** adds behavior. The `static/js` modules handle Firebase,
  live-updating data, and admin actions. A `<script type="module">` can import
  other JavaScript modules.
- **Shared data belongs in one place.** Change the team/event lists in
  `adage-data.js` rather than editing only the admin or results page; both use
  the shared list.
- **Firestore is not the same as the website files.** Editing HTML/JS changes
  the app code; using the admin form changes database content.
- **Firebase rules are the access control.** The web config is visible to
  browsers by design. Do not rely on hiding it to secure the data; permissions
  are enforced by Firestore rules and Firebase Authentication.
- **This project has no compile step.** For the usual HTML/CSS/JS changes,
  save and reload the page served over localhost. Keep file and folder names
  and capitalization consistent in links and imports.

If you are changing Firebase setup, score data, hosting, or the service worker,
read [LIVE_SCORES.md](LIVE_SCORES.md) as well. It has additional setup and
deployment-specific cautions.
