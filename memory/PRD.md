# AccountantOS — Product Requirements Document

## Original Problem Statement
Build a professional full-stack SaaS accounting operations platform (AccountantOS) for accountants and bookkeeping firms managing multiple companies. Reduce manual Excel work, organize documents, track deadlines, support bookkeeping workflows, generate modern Excel reports. Swiss/CHF locale.

## User Choices
- Auth: JWT email/password
- OCR: real LLM (gpt-4o via Emergent key) with rule-based fallback
- Scope: all 19 modules
- Locale: CHF + Swiss VAT (8.1% / 2.6% / 3.8%)
- Rich seed data

## Architecture
- Backend: FastAPI + MongoDB (motor). Modular server.py + ocr.py + excel_export.py + seed_data.py. JWT auth (httpOnly cookie + bearer). All routes under /api.
- Frontend: React 19 + React Router + Tailwind + shadcn/ui + recharts. AuthContext, sidebar Layout, 14 pages.
- Excel: openpyxl — 14 styled templates (headers, frozen panes, filters, currency/date formats, totals, dropdowns, instructions sheet).
- Design: Swiss high-contrast light theme, brand #0055FF, Chivo + IBM Plex Sans.

## User Personas
- Accountants / bookkeepers managing multiple client companies
- Small accounting offices, finance administrators

## Implemented (2026-07-02) — MVP complete
- Auth (login/register/logout/me), seeded admin
- Dashboard: 6 KPI cards, revenue/expense chart, P&L, recent docs, upcoming deadlines
- Companies: CRUD + detail page with 7 tabs (docs/payables/receivables/tasks/deadlines/questions/activity)
- Documents: CRUD, status workflow, auto review-task on upload, LLM OCR extraction
- Accounts Payable & Receivable: CRUD, aging reports (5 buckets), supplier/customer balances, Excel export
- Bank Reconciliation: CSV import, match/unmatch, reconciliation summary
- VAT: Swiss VAT summary (output/input/balance), configurable rates
- Month-End Close: per-company checklist with progress + status
- Excel Center: 14 downloadable templates (data-backed where applicable)
- Reports: P&L, expense-by-category, revenue-by-client, balance sheet, cash flow + Excel export
- Client Portal: documents, missing docs, questions (answerable), deadlines
- Audit Trail: action log with company filter
- Settings: firm profile, VAT rates, categories, notifications, Excel prefs
- Global Search (companies/documents/payables/receivables)
- Verified: 37/37 backend tests, 100% frontend flows

## Backlog / Next Tasks
- P1: Real file upload + object storage for documents (currently metadata + name)
- P1: Deadline management dedicated page (currently surfaced on dashboard/portal/company)
- P1: Questions dedicated management page for accountants (create questions)
- P2: Partial (PATCH) updates on entities; pagination on list endpoints
- P2: Brute-force lockout + explicit CORS origin for cookie auth in production
- P2: Swap mock OCR for Azure/Google/AWS/Tesseract via ocr.extract_document
- P2: Excel IMPORT parsing (beyond bank CSV) into ledgers
