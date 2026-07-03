# AccountantOS

AccountantOS is a full-stack accounting operations workspace with a React frontend and a FastAPI backend backed by MongoDB. The product covers client companies, document intake, mock OCR, payables, receivables, bank reconciliation, VAT workflows, month-end close, reports, Excel exports, and a client portal.

## Repository Layout

- `frontend/`: React 19 application built with Create React App and CRACO.
- `backend/`: FastAPI API server, MongoDB access, seeded demo data, Excel export helpers, and OCR mock logic.
- `backend/tests/`: end-to-end API tests.
- `tests/`: top-level Python package placeholder.

## Prerequisites

- Node.js 18+ with Yarn 1.x
- Python 3.10+
- A local MongoDB instance reachable over `mongodb://127.0.0.1:27017`

## Environment Files

Copy the example files and adjust values as needed.

- `backend/.env.example` -> `backend/.env`
- `frontend/.env.example` -> `frontend/.env`

The backend listen address is configured in `backend/.env` with `BACKEND_HOST` and `BACKEND_PORT`.
Use a `JWT_SECRET` that is at least 32 bytes long. If `backend/.env` keeps `JWT_SECRET=GENERATE_LOCAL_SECRET` or the value is too short, the backend will generate a machine-local 64-hex-character secret on startup and persist it into `backend/.env`.

Production should set `APP_ENV=production` and then provide a real `JWT_SECRET` plus explicit `CORS_ORIGINS`. In production mode, self-registration is disabled by default, demo data seeding is disabled by default, admin passwords are not reset on startup unless explicitly enabled, and auth cookies are marked `secure`.
Set `ADMIN_PASSWORD` to a real secret before any production startup. The example file intentionally uses `CHANGE_ME`, and production mode will refuse to boot with that placeholder or any password shorter than 12 characters.

## Backend Setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn server:app --reload --host $env:BACKEND_HOST --port $env:BACKEND_PORT
```

The backend will seed an admin user and demo data on first startup.

## Frontend Setup

```powershell
cd frontend
yarn install
yarn start
```

The frontend expects the backend URL from `REACT_APP_BACKEND_URL`.

## Start Both Services

From the repository root, run:

```powershell
.\start-dev.ps1
```

The helper reads `BACKEND_HOST` and `BACKEND_PORT` from `backend/.env`, starts the backend with those values, and points the frontend at that backend in a separate PowerShell window.

## Production Operations

- Use `APP_ENV=production` with explicit `JWT_SECRET`, `ADMIN_PASSWORD`, `CORS_ORIGINS`, and `DEFAULT_TENANT_ID` values.
- Health endpoints are available at `/api/health/live` and `/api/health/ready`.
- See `PRODUCTION_CHECKLIST.md` for deployment hardening, backups, monitoring, and go-live steps.
- Use `backup-mongodb.ps1` as a scheduled MongoDB dump/export helper on Windows hosts.

## Tests

Backend tests read `REACT_APP_BACKEND_URL` from the environment first, then fall back to `frontend/.env` for local runs.

```powershell
cd backend
pytest
```

## Notes

- OCR is deterministic and local-only by default.
- CORS defaults are configured for local development at `http://localhost:3000` and `http://127.0.0.1:3000`.
- This repository no longer depends on private preview tooling or hidden workspace metadata.
