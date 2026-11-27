# Samer & Rafca — Bilingual Wedding Invitation App (Next.js)

Luxury simultaneous English (`Cormorant Garamond`, LTR) & Arabic (`Amiri`, RTL) wedding invitation web application built with **Next.js App Router**, ready for **Vercel** hosting and **WhatsApp** link sharing.

---

## Key Features

- **Personalized WhatsApp Invitations (`/?g=<code>`)**:
  - Dynamic OpenGraph (`og:title`, `og:description`, `og:image`) metadata per guest so WhatsApp renders a rich invitation preview card (e.g. `Invitation for Sako & Aimee — Samer & Rafca`).
  - Dynamic `/api/og` luxury card generator out-of-the-box, or upload a custom WhatsApp preview image from `/admin`.
- **Opening Envelope Curtain & Background Music**:
  - Interactive luxury `S & R` envelope curtain unlocks mobile browser audio autoplay when guests tap **Open Invitation • افتح الدعوة**, paired with a floating gold mute/unmute button.
- **Hard RSVP Edit Deadline (`15 December 2026`)**:
  - Enforced on both client and server (`2026-12-15T23:59:59+02:00`). Guests can confirm or update seat counts and wishes anytime before the cutoff.
- **Whish Money Gift Registry Card**:
  - One-tap account number copy (`Copy Number • نسخ الرقم`) and direct Whish payment button, editable or hideable in Admin.
- **Protected Admin Studio (`/admin`)**:
  - Server-verified HTTP-only session cookie (`SamRebecca2027` / `SamRebecca@2027` by default, configurable via environment variables).
  - **Images & Audio Setup**: Upload Hero background image, RSVP background image, WhatsApp preview image, and Wedding MP3/WAV/M4A audio directly from your phone or computer (stored in **Vercel Blob** in production, or `public/uploads/` locally).
  - **Venues & Whish Money**: Edit Ceremony & Dinner Reception bilingual titles, times, venue names, Google Maps links, and Whish details.
  - **Guest Manager & One-Click WhatsApp Sharing**: Create guest codes, track live seat counts, send pre-formatted bilingual WhatsApp invites, and export a 4-sheet `.xlsx` Excel workbook (`Summary Stats`, `All Guests`, `Confirmed`, `Declined & Pending`).

---

## Local Development

```bash
npm install
npm run dev
```

- **Public Invitation**: [http://localhost:3000](http://localhost:3000) (Sample guest: [http://localhost:3000/?g=9j3](http://localhost:3000/?g=9j3))
- **Admin Studio**: [http://localhost:3000/admin](http://localhost:3000/admin)
  - Default Username: `SamRebecca2027`
  - Default Password: `SamRebecca@2027`

Locally, no database or cloud tokens are needed—guest RSVPs & settings save automatically to `data/wedding-db.json` and uploaded media saves to `public/uploads/`.

---

## Deploying to Vercel (`samer-and-rafca.vercel.app`)

1. Push this repository to GitHub (or run `npx vercel --prod`) and import it in Vercel as **`samer-and-rafca`**.
2. In your Vercel Project Dashboard, open the **Storage** tab and connect:
   - **Neon / Vercel Postgres** → automatically injects `DATABASE_URL` (tables `wedding_guests` and `wedding_settings` are created automatically on first request).
   - **Vercel Blob** → automatically injects `BLOB_READ_WRITE_TOKEN` (enables direct browser-to-Blob uploads for high-res photos & MP3 audio files up to 50 MB).
3. *(Optional)* In **Settings → Environment Variables**, set:
   - `NEXT_PUBLIC_SITE_URL=https://samer-and-rafca.vercel.app`
   - `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_SESSION_SECRET`
4. Redeploy once after linking Storage, then sign in at `/admin` to upload your photos & wedding song, add guests, and share links on WhatsApp!
