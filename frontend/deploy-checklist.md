# Jungle Bet — Production Deployment Checklist

This guide covers end-to-end steps to deploy the **Jungle Bet** frontend and connect it to the production FastAPI/Railway backend (`https://jungle-bet-platform-production.up.railway.app`).

---

## 1. Pre-Deployment Verification

- [ ] Verify all legal & compliance components are present:
  - `src/components/legal/TermsOfService.tsx` (includes **Currency Conversion & Exchange Rates / FX Spread Clause** & **No Arbitrage Clause**)
  - `src/components/legal/PrivacyPolicy.tsx` (includes **Google Drive integration** & **18+ Age Verification**)
  - `src/components/legal/ResponsibleGaming.tsx` (includes **18+ Age Limit**, **Addiction Warning**, & **Self-Exclusion**)
  - `src/components/compliance/ComplianceGate.tsx` (blocks all routes including deep-links until all 3 checkboxes are checked)
  - `src/components/security/AgeVerificationGate.tsx` (enforces 18+ popup on first visit)
- [ ] Run a local production build test inside `/frontend`:
  ```bash
  cd frontend
  npm install
  npm run build
  ```
- [ ] Confirm `dist/` is generated cleanly with minified JS and CSS bundles.

---

## 2. Steps to Push to GitHub

1. **Check Git Status & Ignore Sensitive Files:**
   Ensure `.env` and `node_modules/` are listed in `.gitignore` (commit `env.production.example` instead of raw secrets).
   ```bash
   git status
   ```

2. **Stage All Frontend & Compliance Changes:**
   ```bash
   git add frontend/
   git commit -m "feat(frontend): add legal docs with FX spread clause, compliance gate, 18+ security gate, and prod build config"
   ```

3. **Link Remote Repository (if not already linked) & Push:**
   ```bash
   # Verify existing remote
   git remote -v

   # Or add your GitHub repository remote
   git remote add origin https://github.com/<your-org>/jungle-bet-platform.git

   # Push to main branch
   git branch -M main
   git push -u origin main
   ```

---

## 3. Steps to Connect to Vercel or Railway

### Option A: Deploying Frontend to Vercel (Recommended for React/Vite SPA)

1. Log in to [Vercel](https://vercel.com) and click **Add New... → Project**.
2. Import your GitHub repository (`jungle-bet-platform`).
3. Configure the **Project Settings**:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
4. Add SPA Rewrite Rule (if needed for deep-linking `/wallet`, `/betting`, `/terms`):
   Create `vercel.json` in `frontend/` with:
   ```json
   {
     "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
   }
   ```
5. Click **Deploy**.

### Option B: Deploying Frontend + Backend on Railway

1. Log in to [Railway](https://railway.app) and open your **Jungle Bet** project.
2. Click **+ New → GitHub Repo** and select your repository.
3. In the service **Settings**:
   - Set **Root Directory** to `/frontend`.
   - Set **Build Command** to `npm install && npm run build`.
   - Set **Start Command** to `npx vite preview --host 0.0.0.0 --port $PORT`.
4. Under **Networking**, click **Generate Domain** to expose the public HTTPS URL.

---

## 4. Setting Environment Variables in Hosting Provider

Copy the keys from `env.production.example` into your hosting provider's Environment Variables dashboard:

| Variable Name | Production Value | Description |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `https://jungle-bet-platform-production.up.railway.app` | Production FastAPI backend URL |
| `VITE_ENV` | `production` | Enables production runtime mode |

### In Vercel:
1. Go to **Project → Settings → Environment Variables**.
2. Add `VITE_API_BASE_URL` = `https://jungle-bet-platform-production.up.railway.app` (select **Production**, **Preview**, and **Development**).
3. Add `VITE_ENV` = `production`.
4. Trigger a **Redeploy** from the **Deployments** tab so Vite embeds the variables at build time.

### In Railway:
1. Click on your Frontend service → **Variables** tab.
2. Click **RAW Editor** and paste the contents of `env.production.example`:
   ```env
   VITE_API_BASE_URL=https://jungle-bet-platform-production.up.railway.app
   VITE_ENV=production
   ```
3. Railway will automatically rebuild and redeploy the service with the updated variables.

---

## 5. Post-Deployment Smoke Test

- [ ] Open the deployed URL in an incognito window.
- [ ] Confirm the **18+ Age Verification Gate** (`Are you 18 or older?`) appears first and blocks underage access if "No" is clicked.
- [ ] Click "Yes, I am 18+" and confirm the **Compliance Gate** modal appears even when navigating directly to `/wallet` or `/betting`.
- [ ] Confirm the **Accept All & Enter Platform** button remains disabled until all 3 checkboxes (Terms + FX Spread Clause, Privacy Policy, Responsible Gaming) are checked.
- [ ] Refresh the page and verify acceptance state persists in `localStorage`.
