# Deploying Fantasy FC Tracker HTML

## Option 1: Cloudflare Pages (Recommended)

### One-time setup:
```bash
npm install -g wrangler
wrangler login
wrangler pages project create fantasy-fc-tracker
```

### Auto-deploy on update:
Add to `update.sh`:
```bash
# Generate HTML
node scripts/generate-html.js

# Deploy to Cloudflare Pages
cp data/fantasy-fc-tracker.html /tmp/fantasy-fc/index.html
wrangler pages deploy /tmp/fantasy-fc --project-name=fantasy-fc-tracker
```

**Live URL**: `https://fantasy-fc-tracker.pages.dev`

---

## Option 2: GitHub Pages

### One-time setup:
```bash
cd ~/code/fc_planner/fantasy-fc-tracker
git init
gh repo create fantasy-fc-tracker --public
git add .
git commit -m "Initial commit"
git push -u origin main

# Enable GitHub Pages (Settings → Pages → Source: main branch, /data folder)
```

### Auto-deploy:
```bash
# In update.sh, after generating HTML:
cd ~/code/fc_planner/fantasy-fc-tracker
git add data/fantasy-fc-tracker.html
git commit -m "Update tracker: $(date)"
git push
```

**Live URL**: `https://yourusername.github.io/fantasy-fc-tracker/fantasy-fc-tracker.html`

---

## Option 3: Vercel (current)

- **Repo:** [github.com/enoteware/fantasy-fc-tracker](https://github.com/enoteware/fantasy-fc-tracker)
- **Live URL:** https://fantasy-fc-tracker.vercel.app  
  Root `/` rewrites to `/index.html`; card images at `/cards/*.webp`.

### If the Vercel project is not linked to Git

If you have a Vercel project that was created without “Import Git Repository” (e.g. CLI or upload), it won’t auto-deploy on push. Link the repo:

1. **Vercel Dashboard** → your project (e.g. **fantasy-fc-tracker**) → **Settings** → **Git**.
2. Click **Connect Git Repository** (or **Edit** if something is already there).
3. Choose **GitHub** and select **enoteware/fantasy-fc-tracker**. Authorize if prompted.
4. Set **Production Branch** to `main`, then **Save**. Future pushes to `main` will trigger deploys.

If you’d rather have one canonical linked project: create a **new** Vercel project via **Add New → Project → Import** from the repo; use that as the live app and delete or ignore the old unlinked project(s).

**When you regenerate the tracker HTML:** copy to `index.html` so the root serves it:
```bash
cp data/fantasy-fc-tracker.html index.html
git add data/fantasy-fc-tracker.html index.html
git commit -m "Update tracker: $(date)"
git push
```

If the live site shows a sign-in page, turn off **Vercel Deployment Protection** for Production in the project’s Settings on Vercel.

---

## Quick Test (Local)

```bash
cd ~/code/fc_planner/fantasy-fc-tracker/data
python3 -m http.server 8000
# Visit: http://localhost:8000/fantasy-fc-tracker.html
```
