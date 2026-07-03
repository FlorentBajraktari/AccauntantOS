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
