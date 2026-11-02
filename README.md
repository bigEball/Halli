# halli website

Professional, responsive website for Hair by Halli J (Halli Miller), Logan, Utah.

## Run locally

From this folder, run `npm start`, then open http://localhost:4173.
No dependency installation or build is required. Change the port with `PORT=4174 npm start`.

## Content and photos

All eight photographs were downloaded from the public portfolio at https://www.instagram.com/hairby.hallij/ on November 2, 2026. The site uses locally saved assets, not expiring Instagram image links. Profile, salon, specialties, booking destination, and prices came from the profile and its Pricing highlight. Descriptive marketing copy is adapted for this website; no testimonials or qualifications were invented.

Color: blonding/foil work $110+, lived-in color/lowlights $100+, all-over color/root retouch $80+, toner/gloss $45+. Extensions: free consultation; customized pricing, hair priced separately. Cuts: women $40, dry trim $25, men $30, children 10 and under $20, wash/style $30, special occasion $50+. Men's neck shave add-on $7; children's shampoo add-on $5.

Booking links go to https://www.vagaro.com/thehairstudiosalonandspa as listed in her Instagram bio. Visitors select Halli in the salon booking flow. Instagram links open her actual profile or the source photo post. No appointment is created by the local website itself.

## Files

- `dist/index.html`: copy and page structure
- `dist/styles.css`: responsive design
- `dist/app.js`: mobile navigation, keyboard-accessible service tabs, photo viewer
- `dist/assets/`: downloaded Instagram photography and favicon
- `server.mjs`: localhost-only static server

Google Fonts is optional; serif and sans-serif system fallbacks work offline. No analytics or public deployment. The local admin editor stores content in JSON files; no database is required.

Salon address verified from https://www.instagram.com/thehairstudio_salon/: 120 E. 200 N., Logan, UT. The website includes a directions link.

## Website editor

Start with `HALLI_ADMIN_PASSWORD=your-password npm start` (without it, nobody can sign in). Then open http://localhost:4173/admin or use the discreet Admin link at the very bottom of the page.

Choose a section on the left, edit its words/links/photos, and click **Save changes**. The preview updates while editing. Services, photos, FAQs, and new-client steps can be added, removed, and reordered. Colors, fonts, overall text size, section visibility, and section order are editable. Upload JPG, PNG, WebP, or GIF images up to 10 MB. Image fit and focal point controls help position photos naturally.

Saved edits live in `data/content.json`; uploaded photos live in `data/uploads/`. Both survive server restarts. Each save keeps the prior content in `data/content.backup.json`. Download/restore JSON backups from the editor; copy the uploads folder too when moving the project. JSON backups contain the photo links, not the image files themselves.

The password is checked on the server. Sessions use an HttpOnly cookie, expire after 12 hours, and end when the server restarts. Mutations require a session and CSRF token. The server stays bound to 127.0.0.1 for local use.

Run `npm test` for isolated authentication, validation, upload, backup, and restart persistence checks. Tests use their own temporary content folder and do not modify the website’s saved content.

The About section incorporates Halli’s supplied introduction (Washington hometown, Utah as a second home, crafting/shopping/new experiences, love of foil work), updated to reflect the current salon role. TikTok is https://www.tiktok.com/@hairby.hallij, using the handle supplied by the user.

Phone: 425-395-5021. The phone-number field in Social & salon details updates all call links, including the mobile bottom bar. Call links use the +1 country code for US numbers.

Images include compressed full-size JPEGs plus 720px responsive alternatives. Original Instagram downloads are preserved in `original-photos/`. The initial hero photo uses responsive sources; below-the-fold photos load lazily.

## Deployment (Cloudflare)

Live at https://hairbyhallij.com and https://www.hairbyhallij.com as a Cloudflare Worker (`worker.mjs`) serving `dist/` with the editor API. Content, sessions, and uploaded photos live in the `HALLI_KV` Workers KV namespace (see `wrangler.jsonc`). `server.mjs` is still the local-only version.

- Deploy: `npx wrangler login` once, then `npx wrangler deploy`.
- Admin password: stored as the Worker secret `HALLI_ADMIN_PASSWORD`. Change it with `npx wrangler secret put HALLI_ADMIN_PASSWORD`.
- Edit the live site at https://hairbyhallij.com/admin.
