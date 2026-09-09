# ORION

**See the whole repository. Know what a change will touch.**

ORION analyses a software repository (Python + JavaScript/TypeScript), builds a
graph of files, classes, functions, and dependencies, then lets you:

- read an **onboarding briefing** (clusters, god nodes, suggested reading order)
- explore an interactive **architecture map**
- simulate **change impact** — the blast radius of editing a file or symbol

This is a major-project implementation of repository cartography: structure,
relationships, and impact in one tool.

## Quick start

You need Python 3.11+ (3.14 works), Node 20+, and `git` on PATH.

```powershell
# backend
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

```powershell
# frontend (second terminal)
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Click **Analyze Northstar**
for the built-in demo corpus, or paste a public Git URL.

## Demo story (Northstar)

`samples/northstar` is a tiny shop backend. `auth/session.py` is a god module —
orders, permissions, and login routes all depend on it.

1. Analyze Northstar
2. Open **Briefing** — session and `db.py` rank as high-leverage files
3. Open **Impact**, search `session.py`
4. Confirm `orders/service.py` is in the blast radius; `orders/payments.py` is not

## How it works

1. Ingest a git clone, zip, or bundled sample
2. Walk source files (skips `node_modules`, venvs, build output)
3. Extract symbols and edges
   - Python via the standard `ast` module
   - JS/TS via a conservative import/function extractor
4. Build a directed graph (NetworkX), cluster with Louvain, rank with PageRank
5. Impact = reverse BFS over `imports` / `calls` / `inherits` from a seed

Edges are tagged `extracted`, `inferred`, or `unresolved` (third-party imports).

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | liveness |
| GET | `/api/samples` | bundled corpora |
| POST | `/api/projects/sample` | analyse Northstar |
| POST | `/api/projects/git` | `{ "url": "https://…" }` |
| POST | `/api/projects/zip` | multipart zip |
| GET | `/api/projects/{id}` | status + log |
| GET | `/api/projects/{id}/briefing` | onboarding report |
| GET | `/api/projects/{id}/graph` | nodes + edges |
| POST | `/api/projects/{id}/impact` | `{ "seed", "depth" }` |

## Tests

```powershell
cd backend
python -m pytest -q
```

## Deploy (Vercel UI + Render API)

ORION is a split deploy: the React app on **Vercel**, the FastAPI analyzer on **Render**.

```
browser  →  Vercel (frontend)  →  Render (FastAPI + git clone + SQLite)
```

You need a **GitHub repo** first. Render deploys from GitHub; Vercel can too.

```powershell
cd "C:\Users\Vashi\Desktop\Projects\major project 22"
git init
git add .
git commit -m "ORION: repository cartography MVP"
gh repo create orion-analyzer --private --source=. --remote=origin --push
```

### 1. Render — Web Service (not Blueprint)

In the Render dashboard choose **New → Web Service**. Do **not** use Blueprint.

Connect `Vasy420/CodeAtlas`, then fill the form **exactly** like this:

| Field | Value |
|---|---|
| **Name** | `codeatlas-api` (any name is fine) |
| **Language** | Python 3 |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| **Instance type** | Free |

Environment variables (optional but recommended):

| Key | Value |
|---|---|
| `PYTHON_VERSION` | `3.12.8` |

After the first deploy: **Settings → Health Check Path** → `/api/health`

Click **Deploy Web Service**. When it is live, open:

`https://YOUR-SERVICE.onrender.com/api/health`

You want `{"ok": true, "name": "ORION"}`. Copy that base URL for Vercel as `VITE_API_URL`.

If the build fails with “Could not find app”, the Root Directory is wrong — it must be `backend`, not blank.

Free Render web services sleep after idle. The first request after sleep takes ~30s.

SQLite lives on the instance disk. On the free plan that disk is **ephemeral** (analyses vanish on restart). That is fine for a demo.

### 2. Vercel — UI

1. [vercel.com/new](https://vercel.com/new) → import the same GitHub repo
2. **Root Directory:** `frontend` (important — this is a monorepo)
3. Framework Preset: Vite
4. Environment variable:
   - Name: `VITE_API_URL`
   - Value: `https://orion-api.onrender.com` (no trailing slash)
5. Deploy

If you already deployed once without `VITE_API_URL`, add the env var and **redeploy**. Vite inlines it at build time.

### 3. CORS

`*.vercel.app` is already allowed. If you add a custom domain, set `CORS_ORIGINS` on Render to that origin, e.g. `https://orion.yourdomain.com`, then restart the API.

### Local still works

Leave `VITE_API_URL` unset. Vite proxies `/api` to `http://127.0.0.1:8000`.

## Limits (intentional)

- Dynamic Python (`getattr`, plugin registries) is not fully resolved
- Call graphs are best-effort, not a sound compiler analysis
- Private GitHub repos: upload a zip instead of cloning
- Very large monorepos are capped at 5,000 files

Those limits belong in the report: honesty about static analysis is part of the contribution.
