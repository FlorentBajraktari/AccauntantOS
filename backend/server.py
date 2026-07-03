"""AccountantOS backend — FastAPI + MongoDB.

Modular accounting operations platform: companies, documents (mock OCR),
bookkeeping workflow, AP/AR, bank reconciliation, VAT, month-end close,
Excel center, reports, client portal, questions, deadlines, audit trail,
settings, global search.
"""
import seed_data
import ocr as ocr_mod
import excel_export
from pydantic import BaseModel, Field, EmailStr
from motor.motor_asyncio import AsyncIOMotorClient
from starlette.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File, Form
import bcrypt
import jwt
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import logging
import uuid
import io
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")


# ---------------------------------------------------------------- DB / app
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="AccountantOS API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("accountantos")

JWT_ALGO = "HS256"


def get_cors_origins() -> list[str]:
    raw = os.environ.get("CORS_ORIGINS", "")
    if not raw.strip() or raw.strip() == "*":
        return [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def new_id():
    return str(uuid.uuid4())


def clean(doc):
    if doc and "_id" in doc:
        doc.pop("_id", None)
    return doc


# ---------------------------------------------------------------- auth utils
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_access_token(uid: str, email: str) -> str:
    payload = {"sub": uid, "email": email, "type": "access",
               "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGO)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(
            token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGO])
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user = clean(user)
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def log_audit(user: dict, action: str, entity: str, detail: str, company_id: str = None):
    await db.audit_logs.insert_one({
        "id": new_id(), "user": user.get("name", "System") if user else "System",
        "action": action, "entity": entity, "detail": detail,
        "company_id": company_id, "timestamp": now_iso(),
    })


# ---------------------------------------------------------------- models
class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class CompanyIn(BaseModel):
    name: str
    legal_form: Optional[str] = "GmbH"
    address: Optional[str] = ""
    uid_vat: Optional[str] = ""
    contact_person: Optional[str] = ""
    email: Optional[str] = ""
    phone: Optional[str] = ""
    fiscal_year: Optional[str] = "Jan - Dec"
    vat_status: Optional[str] = "VAT Registered"
    accounting_method: Optional[str] = "Accrual"
    notes: Optional[str] = ""


class DocumentIn(BaseModel):
    company_id: str
    name: str
    category: str = "Invoice"
    date: Optional[str] = None
    amount: Optional[float] = 0
    vat_amount: Optional[float] = 0
    counterparty: Optional[str] = ""
    status: str = "uploaded"
    notes: Optional[str] = ""


class PayableIn(BaseModel):
    company_id: str
    supplier: str
    invoice_number: str
    invoice_date: str
    due_date: str
    amount: float
    vat: Optional[float] = 0
    payment_status: str = "unpaid"
    payment_method: Optional[str] = "Bank Transfer"
    notes: Optional[str] = ""


class ReceivableIn(BaseModel):
    company_id: str
    customer: str
    invoice_number: str
    invoice_date: str
    due_date: str
    amount: float
    vat: Optional[float] = 0
    payment_status: str = "unpaid"
    notes: Optional[str] = ""


class BankTxIn(BaseModel):
    company_id: str
    date: str
    description: str
    reference: Optional[str] = ""
    amount: float
    matched: bool = False
    matched_invoice: Optional[str] = None


class TaskIn(BaseModel):
    company_id: str
    title: str
    status: str = "Uploaded"
    assigned_to: Optional[str] = ""
    due_date: Optional[str] = None
    notes: Optional[str] = ""


class DeadlineIn(BaseModel):
    company_id: str
    title: str
    type: str = "VAT"
    due_date: str
    status: str = "open"


class QuestionIn(BaseModel):
    company_id: str
    question: str
    document_id: Optional[str] = None
    status: str = "open"
    answer: Optional[str] = ""


class ChecklistItemIn(BaseModel):
    company_id: str
    period: str
    task: str
    status: str = "pending"
    assigned_to: Optional[str] = ""
    due_date: Optional[str] = None
    notes: Optional[str] = ""


class VATReturnIn(BaseModel):
    company_id: str
    period: str
    taxable_revenue: float = 0
    output_vat: float = 0
    deductible_expenses: float = 0
    input_vat: float = 0
    status: str = "Draft"


# ---------------------------------------------------------------- auth routes
def set_auth_cookie(response: Response, token: str):
    response.set_cookie("access_token", token, httponly=True, secure=False,
                        samesite="lax", max_age=604800, path="/")


@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    uid = new_id()
    user = {"id": uid, "name": body.name, "email": email,
            "password_hash": hash_password(body.password), "role": "accountant",
            "created_at": now_iso()}
    await db.users.insert_one(user)
    token = create_access_token(uid, email)
    set_auth_cookie(response, token)
    await log_audit(user, "user_registered", "user", f"{email} registered")
    return {"id": uid, "name": body.name, "email": email, "role": "accountant", "token": token}


@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(
            status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], email)
    set_auth_cookie(response, token)
    await log_audit(user, "user_login", "user", f"{email} logged in")
    return {"id": user["id"], "name": user["name"], "email": email,
            "role": user.get("role", "accountant"), "token": token}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"message": "Logged out"}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"id": user["id"], "name": user["name"], "email": user["email"], "role": user.get("role")}


# ---------------------------------------------------------------- helpers for CRUD
async def find_list(coll, query=None, sort_field="created_at", limit=1000):
    cur = db[coll].find(query or {}, {"_id": 0}).sort(
        sort_field, -1).limit(limit)
    return await cur.to_list(limit)


def days_overdue(due_date: str) -> int:
    try:
        d = datetime.fromisoformat(due_date).date()
    except Exception:
        try:
            d = datetime.strptime(due_date, "%Y-%m-%d").date()
        except Exception:
            return 0
    return (datetime.now(timezone.utc).date() - d).days


# ---------------------------------------------------------------- companies
@api.get("/companies")
async def get_companies(user: dict = Depends(get_current_user)):
    return await find_list("companies")


@api.get("/companies/{cid}")
async def get_company(cid: str, user: dict = Depends(get_current_user)):
    c = await db.companies.find_one({"id": cid}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Company not found")
    return c


@api.get("/companies/{cid}/overview")
async def company_overview(cid: str, user: dict = Depends(get_current_user)):
    company = await db.companies.find_one({"id": cid}, {"_id": 0})
    if not company:
        raise HTTPException(404, "Company not found")
    return {
        "company": company,
        "documents": await find_list("documents", {"company_id": cid}),
        "payables": await find_list("payables", {"company_id": cid}),
        "receivables": await find_list("receivables", {"company_id": cid}),
        "tasks": await find_list("tasks", {"company_id": cid}),
        "deadlines": await find_list("deadlines", {"company_id": cid}, "due_date"),
        "questions": await find_list("questions", {"company_id": cid}),
        "activity": await find_list("audit_logs", {"company_id": cid}, "timestamp", 30),
    }


@api.post("/companies")
async def create_company(body: CompanyIn, user: dict = Depends(get_current_user)):
    doc = {"id": new_id(), **body.model_dump(), "created_at": now_iso()}
    await db.companies.insert_one(doc)
    await log_audit(user, "company_created", "company", f"Created {body.name}", doc["id"])
    return clean(doc)


@api.put("/companies/{cid}")
async def update_company(cid: str, body: CompanyIn, user: dict = Depends(get_current_user)):
    res = await db.companies.update_one({"id": cid}, {"$set": body.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(404, "Company not found")
    await log_audit(user, "company_updated", "company", f"Updated {body.name}", cid)
    return await db.companies.find_one({"id": cid}, {"_id": 0})


@api.delete("/companies/{cid}")
async def delete_company(cid: str, user: dict = Depends(get_current_user)):
    await db.companies.delete_one({"id": cid})
    for coll in ["documents", "payables", "receivables", "tasks", "deadlines", "questions", "bank_transactions"]:
        await db[coll].delete_many({"company_id": cid})
    await log_audit(user, "company_deleted", "company", f"Deleted company {cid}")
    return {"message": "deleted"}


# ---------------------------------------------------------------- documents + OCR
@api.get("/documents")
async def get_documents(company_id: Optional[str] = None, status: Optional[str] = None,
                        category: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {}
    if company_id:
        q["company_id"] = company_id
    if status:
        q["status"] = status
    if category:
        q["category"] = category
    return await find_list("documents", q)


@api.post("/documents")
async def create_document(body: DocumentIn, user: dict = Depends(get_current_user)):
    doc = {"id": new_id(), **body.model_dump(), "uploaded_by": user["name"],
           "date": body.date or now_iso()[:10], "ocr": None, "created_at": now_iso()}
    await db.documents.insert_one(doc)
    # auto-create review task
    company = await db.companies.find_one({"id": body.company_id}, {"_id": 0})
    await db.tasks.insert_one({
        "id": new_id(), "company_id": body.company_id,
        "title": f"Review document: {body.name}", "status": "In Review",
        "assigned_to": user["name"], "due_date": (datetime.now(timezone.utc) + timedelta(days=3)).date().isoformat(),
        "notes": "Auto-created on upload", "created_at": now_iso(),
    })
    await log_audit(user, "document_uploaded", "document", f"Uploaded {body.name}", body.company_id)
    return clean(doc)


@api.post("/documents/{doc_id}/ocr")
async def run_ocr(doc_id: str, user: dict = Depends(get_current_user)):
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Document not found")
    result = await ocr_mod.extract_document(doc["name"], doc.get("category", ""), doc.get("notes", ""))
    update = {"ocr": result}
    if result.get("total_amount"):
        update["amount"] = result["total_amount"]
    if result.get("vat_amount"):
        update["vat_amount"] = result["vat_amount"]
    if result.get("supplier") and not doc.get("counterparty"):
        update["counterparty"] = result["supplier"]
    await db.documents.update_one({"id": doc_id}, {"$set": update})
    await log_audit(user, "document_ocr", "document", f"OCR extracted for {doc['name']}", doc["company_id"])
    return result


@api.put("/documents/{doc_id}")
async def update_document(doc_id: str, body: DocumentIn, user: dict = Depends(get_current_user)):
    res = await db.documents.update_one({"id": doc_id}, {"$set": body.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(404, "Document not found")
    await log_audit(user, "document_updated", "document", f"Updated {body.name} → {body.status}", body.company_id)
    return await db.documents.find_one({"id": doc_id}, {"_id": 0})


@api.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, user: dict = Depends(get_current_user)):
    await db.documents.delete_one({"id": doc_id})
    return {"message": "deleted"}


# ---------------------------------------------------------------- generic entity factory
def register_crud(path, coll, model, label, audit_name):
    @api.get(f"/{path}", name=f"list_{path}")
    async def _list(company_id: Optional[str] = None, user: dict = Depends(get_current_user)):
        q = {"company_id": company_id} if company_id else {}
        return await find_list(coll, q)

    @api.post(f"/{path}", name=f"create_{path}")
    async def _create(body: model, user: dict = Depends(get_current_user)):
        doc = {"id": new_id(), **body.model_dump(), "created_at": now_iso()}
        await db[coll].insert_one(doc)
        await log_audit(user, f"{audit_name}_created", label, f"Created {label}", body.model_dump().get("company_id"))
        return clean(doc)

    @api.put(f"/{path}/{{item_id}}", name=f"update_{path}")
    async def _update(item_id: str, body: model, user: dict = Depends(get_current_user)):
        res = await db[coll].update_one({"id": item_id}, {"$set": body.model_dump()})
        if res.matched_count == 0:
            raise HTTPException(404, f"{label} not found")
        await log_audit(user, f"{audit_name}_updated", label, f"Updated {label}", body.model_dump().get("company_id"))
        return await db[coll].find_one({"id": item_id}, {"_id": 0})

    @api.delete(f"/{path}/{{item_id}}", name=f"delete_{path}")
    async def _delete(item_id: str, user: dict = Depends(get_current_user)):
        await db[coll].delete_one({"id": item_id})
        return {"message": "deleted"}


register_crud("payables", "payables", PayableIn, "payable", "payable")
register_crud("receivables", "receivables",
              ReceivableIn, "receivable", "receivable")
register_crud("tasks", "tasks", TaskIn, "task", "task")
register_crud("deadlines", "deadlines", DeadlineIn, "deadline", "deadline")
register_crud("questions", "questions", QuestionIn, "question", "question")
register_crud("checklist", "month_end", ChecklistItemIn,
              "checklist item", "checklist")
register_crud("vat-returns", "vat_returns", VATReturnIn, "VAT return", "vat")
register_crud("bank-transactions", "bank_transactions",
              BankTxIn, "bank transaction", "bank")


# ---------------------------------------------------------------- payables/receivables aging
def build_aging(items):
    buckets = {"current": 0.0, "b1_30": 0.0,
               "b31_60": 0.0, "b61_90": 0.0, "b90": 0.0}
    total = 0.0
    for it in items:
        if it.get("payment_status") == "paid":
            continue
        amt = (it.get("amount", 0) or 0) + (it.get("vat", 0) or 0)
        total += amt
        od = days_overdue(it.get("due_date", ""))
        if od <= 0:
            buckets["current"] += amt
        elif od <= 30:
            buckets["b1_30"] += amt
        elif od <= 60:
            buckets["b31_60"] += amt
        elif od <= 90:
            buckets["b61_90"] += amt
        else:
            buckets["b90"] += amt
    return {"total": round(total, 2), **{k: round(v, 2) for k, v in buckets.items()}}


@api.get("/payables/report/aging")
async def payables_aging(company_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"company_id": company_id} if company_id else {}
    items = await find_list("payables", q)
    # supplier balances
    balances = {}
    for it in items:
        if it.get("payment_status") != "paid":
            balances[it["supplier"]] = round(balances.get(
                it["supplier"], 0) + (it.get("amount", 0) or 0) + (it.get("vat", 0) or 0), 2)
    return {"aging": build_aging(items), "supplier_balances": balances, "items": items}


@api.get("/receivables/report/aging")
async def receivables_aging(company_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"company_id": company_id} if company_id else {}
    items = await find_list("receivables", q)
    balances = {}
    for it in items:
        if it.get("payment_status") != "paid":
            balances[it["customer"]] = round(balances.get(
                it["customer"], 0) + (it.get("amount", 0) or 0) + (it.get("vat", 0) or 0), 2)
    return {"aging": build_aging(items), "customer_balances": balances, "items": items}


# ---------------------------------------------------------------- bank reconciliation
@api.post("/bank-transactions/import")
async def import_bank_csv(company_id: str = Form(...), file: UploadFile = File(...),
                          user: dict = Depends(get_current_user)):
    content = (await file.read()).decode("utf-8", errors="ignore")
    import csv as _csv
    reader = _csv.DictReader(io.StringIO(content))
    count = 0
    for row in reader:
        low = {k.lower().strip(): v for k, v in row.items() if k}
        amount = low.get("amount") or low.get("betrag") or "0"
        try:
            amount = float(str(amount).replace(",", "").replace("'", ""))
        except Exception:
            amount = 0
        await db.bank_transactions.insert_one({
            "id": new_id(), "company_id": company_id,
            "date": low.get("date") or low.get("datum") or now_iso()[:10],
            "description": low.get("description") or low.get("beschreibung") or low.get("text") or "Transaction",
            "reference": low.get("reference") or low.get("referenz") or "",
            "amount": amount, "matched": False, "matched_invoice": None, "created_at": now_iso(),
        })
        count += 1
    await log_audit(user, "excel_imported", "bank", f"Imported {count} bank transactions", company_id)
    return {"imported": count}


@api.post("/bank-transactions/{tx_id}/match")
async def match_tx(tx_id: str, invoice_number: Optional[str] = None, user: dict = Depends(get_current_user)):
    tx = await db.bank_transactions.find_one({"id": tx_id}, {"_id": 0})
    if not tx:
        raise HTTPException(404, "Transaction not found")
    matched = not tx.get("matched")
    await db.bank_transactions.update_one({"id": tx_id}, {"$set": {"matched": matched, "matched_invoice": invoice_number}})
    return {"matched": matched}


@api.get("/bank-transactions/report/reconciliation")
async def reconciliation_report(company_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"company_id": company_id} if company_id else {}
    txs = await find_list("bank_transactions", q, "date")
    matched = sum(t["amount"] for t in txs if t.get("matched"))
    unmatched = sum(t["amount"] for t in txs if not t.get("matched"))
    return {
        "transactions": txs, "matched_count": sum(1 for t in txs if t.get("matched")),
        "unmatched_count": sum(1 for t in txs if not t.get("matched")),
        "matched_total": round(matched, 2), "unmatched_total": round(unmatched, 2),
        "difference": round(unmatched, 2),
    }


# ---------------------------------------------------------------- VAT
@api.get("/vat/summary")
async def vat_summary(company_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"company_id": company_id} if company_id else {}
    receivables = await find_list("receivables", q)
    payables = await find_list("payables", q)
    output_vat = round(sum(r.get("vat", 0) or 0 for r in receivables), 2)
    input_vat = round(sum(p.get("vat", 0) or 0 for p in payables), 2)
    taxable_revenue = round(
        sum(r.get("amount", 0) or 0 for r in receivables), 2)
    deductible = round(sum(p.get("amount", 0) or 0 for p in payables), 2)
    returns = await find_list("vat_returns", q, "period")
    return {
        "output_vat": output_vat, "input_vat": input_vat,
        "vat_balance": round(output_vat - input_vat, 2),
        "taxable_revenue": taxable_revenue, "deductible_expenses": deductible,
        "rates": [8.1, 2.6, 3.8], "country": "Switzerland", "returns": returns,
    }


# ---------------------------------------------------------------- dashboard
@api.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    companies = await find_list("companies")
    documents = await find_list("documents")
    payables = await find_list("payables")
    receivables = await find_list("receivables")
    tasks = await find_list("tasks")
    deadlines = await find_list("deadlines", None, "due_date")

    pending_tasks = [t for t in tasks if t.get(
        "status") not in ("Completed", "Booked")]
    missing_docs = [t for t in tasks if t.get("status") == "Missing Documents"]
    overdue_invoices = [p for p in payables if p.get(
        "payment_status") != "paid" and days_overdue(p.get("due_date", "")) > 0]
    open_vat = [d for d in deadlines if d.get(
        "type") == "VAT" and d.get("status") == "open"]

    revenue = round(sum(r.get("amount", 0) or 0 for r in receivables), 2)
    expenses = round(sum(p.get("amount", 0) or 0 for p in payables), 2)

    # monthly revenue series (last 6 months)
    from collections import defaultdict
    rev_by_month = defaultdict(float)
    exp_by_month = defaultdict(float)
    for r in receivables:
        m = (r.get("invoice_date") or "")[:7]
        rev_by_month[m] += r.get("amount", 0) or 0
    for p in payables:
        m = (p.get("invoice_date") or "")[:7]
        exp_by_month[m] += p.get("amount", 0) or 0
    months = sorted(set(list(rev_by_month.keys()) +
                    list(exp_by_month.keys())) - {""})[-6:]
    monthly = [{"month": m, "revenue": round(rev_by_month[m], 2), "expenses": round(exp_by_month[m], 2),
                "profit": round(rev_by_month[m] - exp_by_month[m], 2)} for m in months]

    upcoming = [d for d in deadlines if days_overdue(
        d.get("due_date", "")) <= 0][:6]

    return {
        "total_companies": len(companies),
        "pending_tasks": len(pending_tasks),
        "missing_documents": len(missing_docs),
        "overdue_invoices": len(overdue_invoices),
        "open_vat_deadlines": len(open_vat),
        "monthly_revenue": revenue,
        "profit_loss": round(revenue - expenses, 2),
        "total_expenses": expenses,
        "recent_documents": documents[:6],
        "upcoming_deadlines": upcoming,
        "monthly_series": monthly,
        "overdue_amount": round(sum((p.get("amount", 0) or 0) + (p.get("vat", 0) or 0) for p in overdue_invoices), 2),
    }


# ---------------------------------------------------------------- reports
@api.get("/reports/{report_type}")
async def reports(report_type: str, company_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"company_id": company_id} if company_id else {}
    receivables = await find_list("receivables", q)
    payables = await find_list("payables", q)
    revenue = round(sum(r.get("amount", 0) or 0 for r in receivables), 2)
    expenses = round(sum(p.get("amount", 0) or 0 for p in payables), 2)

    if report_type == "profit-loss":
        return {"revenue": revenue, "expenses": expenses, "net_profit": round(revenue - expenses, 2),
                "gross_margin": round((revenue - expenses) / revenue * 100, 1) if revenue else 0}
    if report_type == "expense-by-category":
        from collections import defaultdict
        cat = defaultdict(float)
        docs = await find_list("documents", q)
        for d in docs:
            cat[d.get("category", "Other")] += d.get("amount", 0) or 0
        return {"data": [{"name": k, "value": round(v, 2)} for k, v in cat.items() if v]}
    if report_type == "revenue-by-client":
        from collections import defaultdict
        cli = defaultdict(float)
        for r in receivables:
            cli[r.get("customer", "Unknown")] += r.get("amount", 0) or 0
        return {"data": [{"name": k, "value": round(v, 2)} for k, v in cli.items()]}
    if report_type == "balance-sheet":
        return {"assets": round(revenue * 1.4, 2), "liabilities": round(expenses * 0.9, 2),
                "equity": round(revenue * 1.4 - expenses * 0.9, 2)}
    if report_type == "cash-flow":
        return {"operating": round(revenue - expenses, 2), "investing": round(-expenses * 0.2, 2),
                "financing": round(expenses * 0.1, 2)}
    return {"revenue": revenue, "expenses": expenses}


# ---------------------------------------------------------------- audit trail
@api.get("/audit")
async def get_audit(company_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"company_id": company_id} if company_id else {}
    return await find_list("audit_logs", q, "timestamp", 200)


# ---------------------------------------------------------------- settings
@api.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    s = await db.settings.find_one({"id": "global"}, {"_id": 0})
    if not s:
        s = seed_data.default_settings()
        await db.settings.insert_one(s)
    return s


@api.put("/settings")
async def update_settings(body: dict, user: dict = Depends(get_current_user)):
    body["id"] = "global"
    await db.settings.update_one({"id": "global"}, {"$set": body}, upsert=True)
    await log_audit(user, "settings_changed", "settings", "Updated firm settings")
    return await db.settings.find_one({"id": "global"}, {"_id": 0})


# ---------------------------------------------------------------- global search
@api.get("/search")
async def search(q: str, user: dict = Depends(get_current_user)):
    if not q or len(q) < 1:
        return {"results": []}
    rx = {"$regex": q, "$options": "i"}
    results = []
    for c in await db.companies.find({"name": rx}, {"_id": 0}).limit(5).to_list(5):
        results.append(
            {"type": "company", "id": c["id"], "title": c["name"], "subtitle": c.get("legal_form", "")})
    for d in await db.documents.find({"name": rx}, {"_id": 0}).limit(5).to_list(5):
        results.append(
            {"type": "document", "id": d["id"], "title": d["name"], "subtitle": d.get("category", "")})
    for p in await db.payables.find({"$or": [{"supplier": rx}, {"invoice_number": rx}]}, {"_id": 0}).limit(5).to_list(5):
        results.append({"type": "payable", "id": p["id"], "title": p["supplier"], "subtitle": p.get(
            "invoice_number", "")})
    for r in await db.receivables.find({"$or": [{"customer": rx}, {"invoice_number": rx}]}, {"_id": 0}).limit(5).to_list(5):
        results.append({"type": "receivable", "id": r["id"], "title": r["customer"], "subtitle": r.get(
            "invoice_number", "")})
    return {"results": results}


# ---------------------------------------------------------------- excel center
@api.get("/excel/templates")
async def excel_templates(user: dict = Depends(get_current_user)):
    return {"templates": excel_export.list_templates()}


@api.get("/excel/download/{key}")
async def excel_download(key: str, company_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    if key not in excel_export.TEMPLATES:
        raise HTTPException(404, "Template not found")
    rows = await build_report_rows(key, company_id)
    data = excel_export.build_template(key, rows)
    await log_audit(user, "report_exported", "excel", f"Exported {key}", company_id)
    filename = f"{key}_{datetime.now().strftime('%Y%m%d')}.xlsx"
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


async def build_report_rows(key, company_id):
    """Populate certain templates with live data."""
    q = {"company_id": company_id} if company_id else {}
    if key == "ap_aging":
        items = await find_list("payables", q)
        rows = []
        for p in items:
            if p.get("payment_status") == "paid":
                continue
            amt = (p.get("amount", 0) or 0) + (p.get("vat", 0) or 0)
            od = days_overdue(p.get("due_date", ""))
            rows.append({"Supplier": p["supplier"], "Invoice No.": p.get("invoice_number"),
                         "Invoice Date": p.get("invoice_date"), "Due Date": p.get("due_date"),
                         "Total": amt, "Current": amt if od <= 0 else 0,
                         "1-30": amt if 0 < od <= 30 else 0, "31-60": amt if 30 < od <= 60 else 0,
                         "61-90": amt if 60 < od <= 90 else 0, "90+": amt if od > 90 else 0})
        return rows
    if key == "ar_aging":
        items = await find_list("receivables", q)
        rows = []
        for r in items:
            if r.get("payment_status") == "paid":
                continue
            amt = (r.get("amount", 0) or 0) + (r.get("vat", 0) or 0)
            od = days_overdue(r.get("due_date", ""))
            rows.append({"Customer": r["customer"], "Invoice No.": r.get("invoice_number"),
                         "Invoice Date": r.get("invoice_date"), "Due Date": r.get("due_date"),
                         "Total": amt, "Current": amt if od <= 0 else 0,
                         "1-30": amt if 0 < od <= 30 else 0, "31-60": amt if 30 < od <= 60 else 0,
                         "61-90": amt if 60 < od <= 90 else 0, "90+": amt if od > 90 else 0})
        return rows
    if key == "expense_tracker":
        items = await find_list("payables", q)
        return [{"Date": p.get("invoice_date"), "Supplier": p.get("supplier"), "Category": "Expense",
                 "Description": p.get("invoice_number"), "Net": p.get("amount", 0), "VAT": p.get("vat", 0),
                 "Gross": (p.get("amount", 0) or 0) + (p.get("vat", 0) or 0),
                 "Payment Method": p.get("payment_method", "")} for p in items]
    if key == "revenue_tracker":
        items = await find_list("receivables", q)
        return [{"Date": r.get("invoice_date"), "Customer": r.get("customer"), "Invoice No.": r.get("invoice_number"),
                 "Description": "Sales invoice", "Net": r.get("amount", 0), "VAT": r.get("vat", 0),
                 "Gross": (r.get("amount", 0) or 0) + (r.get("vat", 0) or 0),
                 "Status": r.get("payment_status", "")} for r in items]
    if key == "bank_reconciliation":
        items = await find_list("bank_transactions", q, "date")
        return [{"Date": t.get("date"), "Description": t.get("description"), "Reference": t.get("reference"),
                 "Bank Amount": t.get("amount"), "Book Amount": t.get("amount") if t.get("matched") else 0,
                 "Difference": 0 if t.get("matched") else t.get("amount"),
                 "Status": "Matched" if t.get("matched") else "Unmatched"} for t in items]
    if key == "month_end_close":
        items = await find_list("month_end", q)
        return [{"Task": m.get("task"), "Assigned To": m.get("assigned_to"), "Due Date": m.get("due_date"),
                 "Status": m.get("status", "").title(), "Notes": m.get("notes")} for m in items]
    return None


# ---------------------------------------------------------------- client portal
@api.get("/portal/{cid}")
async def portal(cid: str, user: dict = Depends(get_current_user)):
    company = await db.companies.find_one({"id": cid}, {"_id": 0})
    if not company:
        raise HTTPException(404, "Company not found")
    return {
        "company": company,
        "documents": await find_list("documents", {"company_id": cid}),
        "missing": [t for t in await find_list("tasks", {"company_id": cid}) if t.get("status") == "Missing Documents"],
        "questions": await find_list("questions", {"company_id": cid}),
        "deadlines": await find_list("deadlines", {"company_id": cid}, "due_date"),
    }


# ---------------------------------------------------------------- startup
@api.get("/")
async def root():
    return {"message": "AccountantOS API", "status": "ok"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=get_cors_origins(),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    for coll in ["companies", "documents", "payables", "receivables", "tasks",
                 "deadlines", "questions", "bank_transactions", "audit_logs"]:
        await db[coll].create_index("company_id")
    # seed admin
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_pw = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({"id": new_id(), "name": "Firm Admin", "email": admin_email,
                                   "password_hash": hash_password(admin_pw), "role": "admin",
                                   "created_at": now_iso()})
    elif not verify_password(admin_pw, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_pw)}})
    # seed demo data
    await seed_data.seed(db, new_id, now_iso)
    logger.info("AccountantOS startup complete")


@app.on_event("shutdown")
async def shutdown():
    client.close()
