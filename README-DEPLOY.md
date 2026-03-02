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

## Option 3: Vercel

```bash
cd ~/code/fc_planner/fantasy-fc-tracker
vercel --prod
```

Add to `vercel.json`:
```json
{
  "cleanUrls": true,
  "trailingSlash": false,
  "rewrites": [
    { "source": "/", "destination": "/data/fantasy-fc-tracker.html" }
  ]
}
```

**Live URL**: `https://fantasy-fc-tracker.vercel.app`

---

## Quick Test (Local)

```bash
cd ~/code/fc_planner/fantasy-fc-tracker/data
python3 -m http.server 8000
# Visit: http://localhost:8000/fantasy-fc-tracker.html
```
