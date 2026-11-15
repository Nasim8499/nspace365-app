# NsPace — AI agent workspace with Visa Automate

A working, self-contained React + Vite + TypeScript app: multi-agent chat, automations,
artifacts, memory, and a full **Visa Automate** pipeline for a visa agency, plus an
**applicant dashboard** with role-based access.

Liquid-glass white UI (iOS system palette + pastel aurora), PWA installable, dark mode,
responsive down to 390 px.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # dist/ (static, deployable anywhere)
npm run preview    # serve the production build
```

## Run it in Docker (AI agent preview included)

```bash
npm run docker:up        # build + serve  ->  http://localhost:8080
npm run docker:dev       # hot-reload dev server  ->  http://localhost:3000
npm run docker:down      # stop

# optional: local models so the agent preview streams with no API keys
docker compose --profile local-llm up -d
docker exec -it nspace-ollama ollama pull llama3.2
```

* `Dockerfile` — multi-stage: `node:20-alpine` build → `nginx:1.27-alpine` serve, gzip, immutable asset
  caching, SPA fallback, healthcheck.
* `docker-compose.yml` — `app` (production image on :8080), `dev` (profile `dev`), `ollama`
  (profile `local-llm`).
* The image is the same static build you can push to Vercel/Netlify/Railway or package with Capacitor.

## Agent live preview

Every agent card on `/agents` has **Preview**: a drawer showing its system prompt and the skills wired
into it, plus a real streaming run through the same model router as chat (stop button, model badge,
fallback). No keys needed — the on-device engine answers — and with a key it calls the real model.

## Roles

| Role | Sees | How to sign in |
| --- | --- | --- |
| Applicant | Only their own visa cases, documents and agent tasks | Auth screen → **Applicant** tab |
| Agency admin | Every case, every upload, every agent run | Auth screen → **Agency admin** tab + agency access code (default `NSPACE-365`, changeable in code under `settings.adminCode`) |

* Email sign-in works offline out of the box (accounts stored in the local workspace).
* **Google sign-in** is implemented with Google Identity Services. Paste an OAuth Web
  client ID in the auth screen (or `settings.googleClientId`) and the real Google button
  renders, verifies the ID token, and signs the user in with their existing role.
* Access rules live in `src/lib/store.tsx` (`canSeeCase`, `visibleCases`). On one device
  each profile keeps its own workspace, so an applicant's browser never holds another
  applicant's file. For multi-device isolation move the data layer to a real backend with
  row-level security (see "Going multi-device" below).

## Applicant dashboard (`/dashboard`)

* Stat tiles: cases, awaiting staff review, filed, documents, open agent tasks.
* **Cases**: token, applicant, destination, agent-progress bar, document count, owner (admin only).
* **Documents**: upload passports, bank statements, employment and travel proof onto a case;
  kinds are auto-detected from the filename; removable per document.
* **Agent tasks**: the 7-step pipeline per case with done / in progress / queued state and the
  agent responsible for each step.
* **AI intake**: describe the case in plain language, attach notes, and the model returns
  extracted details, missing documents, recommended next steps and risk flags. One click turns
  the brief into a real case with the destination and purpose pre-detected.

## Visa Automate pipeline (`/visa`)

1. **Passport intake** — paste the two MRZ lines (or use the sample). The parser verifies every
   ICAO 9303 check digit and shows the parsed identity plus any error before you continue.
2. **Extract & validate** — real rules for all 8 jurisdictions: passport validity margin,
   sponsor gate (Singapore Form V39A), insurance, funds floor per day, trip coherence,
   identity/contact completeness, prior refusal disclosure. PASS / WARN / BLOCK per rule.
3. **PDF dossier** — a genuine generated PDF (A4, paginated, %PDF-1.4, real xref) containing
   bio sheet, mission cover letter, day-by-day itinerary, audit table, refusal defence; the
   Markdown twin is saved as a versioned artifact.
4. **Portal hand-off** — every applicant field mapped to the destination portal's own field
   keys (19 fields for Australia), with the official portal link.
5. **Live apply** — the browser pane types each field with a live status feed, and **halts
   before submit/payment**.
6. **Staff review** — side-by-side passport vs filled portal, explicit approval, stamped
   reference number (e.g. `AU-2026-184942`), full run log.

## Knowledge base

`src/lib/knowledge.ts` — Australia, Serbia, Russia, Türkiye, Singapore, Malaysia, Saudi Arabia,
Bahrain: portal URL, form name, fee, processing time, validity rule, required documents,
sponsor gate, refusal clause and the defence clauses used in the dossier.
`src/lib/skills.ts` — 10 built-in skills wired to 5 new visa agents in the agent store.

## AI models

`src/lib/llm.ts` is a quota-aware router: Llama 4 Scout (Groq), Mistral Small 3 (Mistral),
gpt-oss-120b (OpenRouter), GPT-4o / GPT-4o mini (OpenAI), Gemini (configurable model id).
No key → an on-device demo engine answers so every screen still works. Add keys in **Me → Models**
and the same screens call the real models with automatic fallback. "Free & unlimited" is not a
thing any paid API offers; the fallback chain is what removes the "limit reached" wall.

## Going multi-device (production)

1. `supabase db` schema: `profiles(id, email, role)`, `cases(id, owner_id, token, country, stage, payload jsonb)`,
   `documents(id, case_id, storage_path, kind)`, `tasks(id, case_id, state, agent)`.
2. Enable RLS: `owner_id = auth.uid()` for applicants, `role = 'admin'` policy for staff.
3. Swap the localStorage store in `src/lib/store.tsx` for the Supabase client; the UI is unchanged.
4. Google sign-in: same client ID, `redirect_uri` → your deployed domain.
5. Deploy `dist/` to Vercel/Netlify, or wrap with Capacitor for the stores
   (`npx cap add ios` / `android`, then follow the App Store privacy + IAP checklist).

## CI

`ci/github-actions-build.yml` is a ready build workflow (install → typecheck → build → upload dist).
Copy it to `.github/workflows/build.yml` in your GitHub repo. The connector token that pushed this repo
has no `workflow` scope, so that one file has to be added from the GitHub web UI (or with a PAT that
carries `workflow`).

## Honest limits

* The live-run pane is a faithful, scripted rehearsal of the portal: real field mapping, real
  typing order, real halt + approval, real run log. Driving a genuine Chromium session on
  immi.homeaffairs.gov.au / evisa.gov.tr needs a server-side automation worker with the
  applicant's portal credentials — that is a deployment task, not a browser one.
* Portal fees, processing times and forms change; each dossier footer says to re-verify.
* Google sign-in requires your own OAuth client ID; the button explains how to add it.

## Firebase backend (Auth + Firestore)

The app runs on Firebase Authentication and Cloud Firestore when a web-app config is
present, and falls back to its local-first store when it is not.

- **Project:** `proud-structure-514302-s2`
- **Auth:** email/password (with verification email) and Google sign-in
- **Firestore layout:** `users/{uid}` profile plus `conversations`, `artifacts`, `memories`,
  `visaCases` and `automations` subcollections, locked to their owner by `firestore.rules`

### Configure

Copy `.env.example` to `.env` and fill in the web-app values from
Firebase console → Project settings → Your apps → Web app → SDK setup:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=proud-structure-514302-s2.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=proud-structure-514302-s2
VITE_FIREBASE_STORAGE_BUCKET=proud-structure-514302-s2.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

On Firebase Hosting the config is also picked up from the reserved
`/__/firebase/init.json`, so a hosted build needs no `.env` values at all.

### Deploy

```bash
npm run build
npx firebase-tools deploy --only hosting,firestore:rules,auth
```

`firebase.json` carries the hosting rewrites, the Firestore rules target and the auth
provider block (email/password + Google). Add every serving domain under
Authentication → Settings → Authorized domains (`localhost`, `*.web.app`,
`nspace-six.vercel.app`).
