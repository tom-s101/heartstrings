# Heartstrings — Deploy & Test Guide

This walks you from zero to a live URL you and Lyka can open on two phones.
Three services, all with free tiers: **Supabase** (database + auth + realtime + the
AI function), **Netlify** (hosts the website), and the **Anthropic API** (the question
generator). Budget ~30–40 minutes the first time.

You'll do four things:
1. Set up Supabase (database, function, secret)
2. Run the app locally to confirm it works
3. Push to GitHub + deploy on Netlify
4. Configure auth URLs, then test with two devices

---

## 0. Install the tools you need (one time)

- **Node.js 18+** — https://nodejs.org (the "LTS" download). Verify: `node -v`
- **Git** — https://git-scm.com . Verify: `git -v`
- **Supabase CLI** — https://supabase.com/docs/guides/cli . Verify: `supabase -v`
- A **GitHub** account, a **Netlify** account, a **Supabase** account, and an
  **Anthropic API key** from https://console.anthropic.com (Billing → add a little credit).

Put all the project files (this folder) somewhere on your computer and open a terminal in it.

---

## 1. Supabase setup

### 1a. Create the project
1. Go to https://supabase.com → **New project**.
2. Name it (e.g. `heartstrings`), set a database password (save it), pick a region near you.
3. Wait ~2 min for it to provision.

### 1b. Grab your keys
In the dashboard: **Project Settings → API**. Copy these two:
- **Project URL** (looks like `https://abcd1234.supabase.co`)
- **anon public** key (a long string)

### 1c. Create the database tables
Easiest path — the SQL editor:
1. Left sidebar → **SQL Editor → New query**.
2. Open `supabase/migrations/0001_init.sql` from this project, copy everything, paste, click **Run**.
3. Repeat for `0002_join_code_and_score.sql`, then `0003_creative_state.sql` — **in that order**.

You should see "Success" each time. (If you prefer the CLI, see the note at the bottom.)

### 1d. Link the CLI to your project (for deploying the functions)
In your terminal, in the project folder:
```bash
supabase login            # opens a browser to authorize
supabase link --project-ref YOUR_PROJECT_REF
```
Your **project ref** is the `abcd1234` part of your Project URL (also shown in
Project Settings → General).

### 1e. Add the Anthropic key as a server secret
```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-real-key
```
This key lives only on the server — it is never in the website code, so it can't leak.

### 1f. Deploy the edge functions
```bash
supabase functions deploy generate-question
supabase functions deploy ai-assist
supabase functions deploy turn-credentials
```
(`turn-credentials` works with no extra setup — see step 1f-bis if the Photo Booth's
long-distance video call is laggy or won't connect and you want to add a TURN server.)

### 1f-bis. (Optional) Add a TURN server for smoother Photo Booth video
The Photo Booth's long-distance video call is real peer-to-peer WebRTC. Out of the box
it only has public **STUN** servers, which help two devices find each other but can't
help if either side is behind a NAT/firewall that blocks a direct connection outright
(common on mobile data / CGNAT, some corporate wifi) — and even when it does connect,
the direct route your two ISPs pick isn't always the fastest one. A **TURN** server
fixes both: it relays the call when a direct connection isn't possible, and picks a
route nearest to each of you.

1. Free account: https://www.metered.ca/tools/openrelay/
2. In the dashboard, go to **TURN Server** (left sidebar) → click **"Generate Your
   First Credential"** (or **Add Credential** if you already have one).
3. Once it's created, click **"Show ICE Servers Array"** on that credential — it
   shows a JSON array like:
   ```json
   [
     { "urls": "stun:stun.relay.metered.ca:80" },
     { "urls": "turn:global.relay.metered.ca:80", "username": "...", "credential": "..." },
     { "urls": "turn:global.relay.metered.ca:80?transport=tcp", "username": "...", "credential": "..." },
     { "urls": "turn:global.relay.metered.ca:443", "username": "...", "credential": "..." },
     { "urls": "turns:global.relay.metered.ca:443?transport=tcp", "username": "...", "credential": "..." }
   ]
   ```
   Copy the whole thing (as one line works fine).
4. Paste it straight into a secret — no domain/app-name lookup needed:
   ```bash
   supabase secrets set METERED_ICE_SERVERS_JSON='[{"urls":"stun:stun.relay.metered.ca:80"},{"urls":"turn:global.relay.metered.ca:80","username":"...","credential":"..."}]'
   supabase functions deploy turn-credentials
   ```
That's it — no client code changes. The free tier covers 20GB/month of relayed video,
which is generous for two people.

(There's also a fancier option — `METERED_APP_NAME` + `METERED_API_KEY` instead of
`METERED_ICE_SERVERS_JSON` — that fetches fresh credentials from Metered on every call
instead of reusing one static set. Not necessary unless you want that.)

### 1g. Turn OFF email confirmation for now (so testing is instant)
**Authentication → Sign In / Providers → Email**: turn **"Confirm email" OFF**, Save.
(You can turn it back on later for real launch. With it off, you can sign up and use
the app immediately without clicking a confirmation link.)

---

## 2. Run it locally first (catch problems before deploying)

In the project folder:
```bash
npm install
```
Create a file named `.env` (copy from `.env.example`) and fill in your two keys:
```
VITE_SUPABASE_URL=https://abcd1234.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...your-anon-key
```
Then:
```bash
npm run dev
```
Open the printed URL (usually http://localhost:5173).

**Quick local test:** sign up with any email + password → you should land on the
"Find your room" screen. Enter a room name + a code, pick a side, step inside. Try
generating a question (confirms the Anthropic function works). To see sync, open a
**second browser window** (or an incognito window), sign up as a second account, join
the **same room name + same code**, pick the other side — the presence pill should say
"both here" and actions should mirror across the two windows.

If questions don't generate, see Troubleshooting below before deploying.

---

## 3. Deploy the website on Netlify

### 3a. Put the code on GitHub
```bash
git init
git add .
git commit -m "Heartstrings"
```
Create a new empty repo on github.com, then (copy the commands GitHub shows you):
```bash
git remote add origin https://github.com/YOUR_USER/heartstrings.git
git branch -M main
git push -u origin main
```
(Your `.env` is gitignored, so your keys are NOT uploaded — good.)

### 3b. Connect Netlify
1. https://app.netlify.com → **Add new site → Import an existing project → GitHub** →
   pick your repo.
2. Netlify auto-reads `netlify.toml`, so build command (`npm run build`) and publish
   dir (`dist`) are already set. Click **Deploy**.
3. After it builds, add your keys: **Site configuration → Environment variables → Add**:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key
4. **Trigger a redeploy** (Deploys → Trigger deploy → Deploy site) so the build picks up
   the variables.
5. You'll get a URL like `https://heartstrings-xyz.netlify.app`. (Optional: rename it
   under Site configuration → Change site name.)

---

## 4. Point Supabase auth at your live URL

**Authentication → URL Configuration**:
- **Site URL**: your Netlify URL (e.g. `https://heartstrings-xyz.netlify.app`)
- **Redirect URLs**: add the same URL with `/**` (e.g. `https://heartstrings-xyz.netlify.app/**`)

Save. (This matters for magic links and session redirects.)

---

## 5. Test with two devices 🎉

1. Open the Netlify URL on **your phone** → sign up → create room `our-corner` with code
   `lyka2026` → pick **His side**.
2. Send Lyka the URL. She signs up → same room `our-corner`, same code `lyka2026` →
   picks **Her side**.
3. Start a video call separately (FaceTime/Messenger/etc.) and play:
   - **Questions** → Classic or Game modes; tap answers and watch them match live.
   - **Drawing → Studio** → try Paint Your Partner (draw at the same time, hit reveal).
   - **Creative** → write a line each in Story Weaver.
   - Flip **feel** to the trophy (Game Night) to turn on scoring.

If both of you see "both here" and actions mirror, you're fully live.

---

## Troubleshooting

- **Questions won't generate / spinner sticks ~18s then a fallback appears**
  The `generate-question` function or the key isn't set. Check:
  `supabase functions list` shows both functions; re-run `supabase secrets set ANTHROPIC_API_KEY=...`;
  confirm your Anthropic account has credit. Logs: Supabase dashboard → Edge Functions → logs.
- **"wrong code" when joining** — the code must be identical on both sides (case-sensitive).
  The first person to use a room name sets its code.
- **Stuck on a loading heart / blank page** — your `.env` (local) or Netlify env vars are
  missing/incorrect. Double-check both values and redeploy.
- **Sign-up seems to do nothing** — email confirmation is probably ON; either check email
  for the link, or turn confirmation OFF (step 1g) for testing.
- **Realtime not syncing** — make sure all three migrations ran (the realtime publication is
  added in `0001`). Re-run them if unsure; they're safe to re-run.
- **Changed code, site didn't update** — Netlify redeploys on every `git push`; for env-var
  changes you must trigger a manual redeploy.
- **Photo Booth video is laggy / choppy / stuck on "connecting video…"** — see step 1f-bis
  above and add a free TURN server. Without one, the call only has STUN, which some
  networks (mobile data especially) can't complete a direct connection over at all — the
  booth falls back to sending occasional photos instead of real video in that case.

### CLI alternative for step 1c
If you linked the CLI (1d) you can run all migrations at once instead of pasting:
```bash
supabase db push
```

### Costs
All three have free tiers that comfortably cover two people testing. The only metered cost
is Anthropic usage per generated question/letter, which is fractions of a cent each on the
Haiku model the functions use.
