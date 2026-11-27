# Seating / standing plan PDFs

Easiest: upload each PDF on the admin page's **Plans** tab, which works from a phone
with no code push. The upload is stored in Firestore (see static/js/plan-files.js),
it replaces the file here, and uploading again replaces it for everyone.

Fallback: a PDF committed here with exactly this name is used when nothing has
been uploaded for that plan:

- day1-seating.pdf: Game Night (Day 1)
- day2-standing.pdf: Photoshoot (Day 2)
- day2-seating.pdf: Awards Night (Day 2)
- day3-seating.pdf: Gala Night (Day 3)

Either way, each plan stays hidden on the Schedule page until its opening time
(default 1 hour before reporting; change it on the admin Plans tab). See PLANS in
static/js/adage-data.js.
