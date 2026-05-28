# Forma — Setup Guide

Your personal health tracker. Data lives in your Google Drive.
Works offline, no subscription, no server.

---

## What you'll need

- A Google account (for OAuth + Drive storage)
- Free hosting: GitHub Pages, Netlify, or Vercel
- ~10 minutes

---

## Step 1 — Generate the icons

Open `generate-icons.html` in your browser (just double-click it).
Download all 3 PNGs and save them in the same folder as `index.html`:
- `icon-192.png`
- `icon-512.png`  
- `icon-maskable.png`

Also duplicate `icon-192.png` and rename the copy to `icon-180.png`
(used for the iPhone home screen icon).

---

## Step 2 — Get a Google OAuth Client ID (free, ~5 mins)

### 2a. Create a Google Cloud project
1. Go to https://console.cloud.google.com
2. Click the project dropdown at the top → **New Project**
3. Name it "Forma" → Create

### 2b. Enable the Drive API
1. Go to **APIs & Services → Library**
2. Search "Google Drive API" → click it → **Enable**

### 2c. Configure OAuth consent screen
1. Go to **APIs & Services → OAuth consent screen**
2. Select **External** → Create
3. Fill in:
   - App name: `Forma`
   - User support email: your email
   - Developer contact: your email
4. Click **Save and Continue** through the rest (no need to add scopes here)
5. On the "Test users" page, add your own Gmail address
6. Click **Save and Continue** → **Back to Dashboard**

### 2d. Create credentials
1. Go to **APIs & Services → Credentials**
2. Click **+ Create Credentials → OAuth 2.0 Client ID**
3. Application type: **Web application**
4. Name: `Forma PWA`
5. Under **Authorised JavaScript origins**, add your hosting URL:
   - For GitHub Pages: `https://YOURUSERNAME.github.io`
   - For Netlify: `https://your-site-name.netlify.app`
   - For local testing: `http://localhost:8080`
6. Click **Create**
7. Copy the **Client ID** (looks like `1234567890-abc123.apps.googleusercontent.com`)

---

## Step 3 — Add your Client ID to the app

Open `index.html` in a text editor and find this line near the top:

```javascript
const CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
```

Replace it with your actual Client ID:

```javascript
const CLIENT_ID = '1234567890-abc123.apps.googleusercontent.com';
```

Save the file.

---

## Step 4 — Host the files

You need HTTPS hosting for PWAs to work. Both options below are free.

### Option A — GitHub Pages (recommended)

1. Create a new GitHub repository (can be private)
2. Upload these files:
   - `index.html`
   - `manifest.json`
   - `sw.js`
   - `icon-192.png`
   - `icon-512.png`
   - `icon-maskable.png`
   - `icon-180.png`
3. Go to **Settings → Pages**
4. Source: **Deploy from a branch** → Branch: `main` → Folder: `/ (root)`
5. Click **Save** — your URL will be `https://YOURUSERNAME.github.io/REPONAME`

Go back to Google Cloud Console and add this full URL to **Authorised JavaScript origins**:
`https://YOURUSERNAME.github.io`  
(just the origin, no `/REPONAME` path — this covers all pages on your GitHub Pages domain)

### Option B — Netlify

1. Go to https://app.netlify.com → **Add new site → Deploy manually**
2. Drag your project folder onto the upload area
3. Your site gets a URL like `https://random-name.netlify.app`
4. Add that origin to Google Cloud Console

---

## Step 5 — Add to iPhone home screen

1. Open the app URL in **Safari** on your iPhone (must be Safari, not Chrome)
2. Tap the **Share** button (square with arrow pointing up)
3. Scroll down and tap **Add to Home Screen**
4. Tap **Add** in the top right

The app now appears on your home screen, opens full-screen with no browser UI,
and works offline. It looks and feels like a native app.

---

## How your data is stored

- All data is saved as `forma-data.json` in your Google Drive **App Data folder**
- This folder is hidden — you can't see it in regular Drive, it's private to Forma
- Data is also cached in your browser's `localStorage` for instant offline access
- Syncs automatically ~2.5 seconds after any change
- The ↑ / cloud icon in the top-right corner shows sync status

---

## Troubleshooting

**"Setup required" banner on sign-in screen**  
→ You haven't replaced `YOUR_GOOGLE_CLIENT_ID` yet. See Step 3.

**"Sign in" button does nothing**  
→ The Google script might still be loading. Wait 5 seconds and try again.

**Sign-in opens then immediately closes**  
→ Your hosting URL isn't in Authorised JavaScript origins in Google Cloud Console. Add it exactly (no trailing slash).

**"Sync failed" error after signing in**  
→ The Drive API might not be enabled. Go to Google Cloud Console → APIs & Library → Google Drive API → Enable.

**After adding to home screen, sign-in doesn't work**  
→ Known iOS PWA limitation with OAuth popups. Sign in from Safari first (not the standalone home screen icon), then switch to the home screen version — your session will carry over.

**Wants me to sign in again after a while**  
→ Google tokens expire after 1 hour. Just tap "Continue with Google" again — it's instant since you're already signed into Google.

---

## Local development (optional)

If you want to test locally before deploying:

```bash
# Python 3
python3 -m http.server 8080

# Node.js
npx serve .
```

Open http://localhost:8080 in your browser.
Add `http://localhost:8080` to Authorised JavaScript origins in Google Cloud Console.

---

## Files in this folder

| File | Purpose |
|------|---------|
| `index.html` | The complete app (all code is here) |
| `manifest.json` | PWA metadata (name, icons, theme) |
| `sw.js` | Service worker (offline caching) |
| `generate-icons.html` | Open in browser to download app icons |
| `icon-*.png` | App icons (generated from generate-icons.html) |
