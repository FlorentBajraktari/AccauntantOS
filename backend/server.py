"""AccountantOS backend — FastAPI + MongoDB.

Modular accounting operations platform: companies, documents (mock OCR),
bookkeeping workflow, AP/AR, bank reconciliation, VAT, month-end close,
Excel center, reports, client portal, questions, deadlines, audit trail,
settings, global search.
"""
import seed_data
import ocr as ocr_mod
import excel_export
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from motor.motor_asyncio import AsyncIOMotorClient
from starlette.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File, Form
import bcrypt
import hashlib
import jwt
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import logging
import secrets
import uuid
import io
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
ENV_PATH = ROOT_DIR / ".env"
JWT_SECRET_PLACEHOLDER = "GENERATE_LOCAL_SECRET"
ADMIN_PASSWORD_PLACEHOLDER = "CHANGE_ME"
DEFAULT_TENANT_ID = os.environ.get("DEFAULT_TENANT_ID", "default-tenant")
PASSWORD_RESET_TOKEN_TTL_HOURS = 1
INVITE_TOKEN_TTL_DAYS = 7
COMPANY_SCOPED_COLLECTIONS = {
    "documents", "payables", "receivables", "tasks", "deadlines",
    "questions", "month_end", "vat_returns", "bank_transactions", "audit_logs",
}
TENANT_SCOPED_COLLECTIONS = COMPANY_SCOPED_COLLECTIONS | {
    "companies", "settings", "invitations", "password_reset_tokens"}
ALLOWED_ROLES = {"admin", "accountant", "client"}


def persist_env_value(path: Path, key: str, value: str) -> None:
    lines = []
    if path.exists():
        lines = path.read_text(encoding="utf-8").splitlines()

    prefix = f"{key}="
    updated = False
    next_lines = []
    for line in lines:
        if line.startswith(prefix):
            next_lines.append(f"{prefix}{value}")
            updated = True
        else:
            next_lines.append(line)

    if not updated:
        next_lines.append(f"{prefix}{value}")

    path.write_text("\n".join(next_lines) + "\n", encoding="utf-8")


def env_flag(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def app_env() -> str:
    return os.environ.get("APP_ENV", "development").strip().lower() or "development"


def is_production() -> bool:
    return app_env() == "production"


def ensure_jwt_secret() -> str:
    current = os.environ.get("JWT_SECRET", "").strip()
    if current and current != JWT_SECRET_PLACEHOLDER and len(current) >= 32:
        return current

    if is_production():
        raise RuntimeError(
            "JWT_SECRET must be explicitly set to a value at least 32 bytes long when APP_ENV=production."
        )

    generated = secrets.token_hex(32)
    persist_env_value(ENV_PATH, "JWT_SECRET", generated)
    os.environ["JWT_SECRET"] = generated
    logging.getLogger("accountantos").warning(
        "Generated a local JWT secret in backend/.env because JWT_SECRET was missing, too short, or set to the bootstrap placeholder."
    )
    return generated


def ensure_admin_credentials() -> None:
    admin_email = os.environ.get("ADMIN_EMAIL", "").strip()
    admin_pw = os.environ.get("ADMIN_PASSWORD", "")
    if not admin_email:
        raise RuntimeError("ADMIN_EMAIL must be set.")

    if is_production() and (not admin_pw.strip() or admin_pw == ADMIN_PASSWORD_PLACEHOLDER or len(admin_pw) < 12):
        raise RuntimeError(
            "ADMIN_PASSWORD must be explicitly set to a non-placeholder value with at least 12 characters when APP_ENV=production."
        )


load_dotenv(ENV_PATH)
ensure_jwt_secret()
ensure_admin_credentials()


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
        if is_production():
            raise RuntimeError(
                "CORS_ORIGINS must list explicit allowed origins when APP_ENV=production."
            )
        return [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def allow_self_registration() -> bool:
    return env_flag("ALLOW_SELF_REGISTRATION", default=not is_production())


def seed_demo_data_enabled() -> bool:
    return env_flag("SEED_DEMO_DATA", default=not is_production())


def reset_admin_password_on_startup() -> bool:
    return env_flag("RESET_ADMIN_PASSWORD_ON_STARTUP", default=not is_production())


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except Exception:
        return None


def is_expired(value: Optional[str]) -> bool:
    dt = parse_iso_datetime(value)
    return dt is None or dt <= datetime.now(timezone.utc)


def new_id():
    return str(uuid.uuid4())


def new_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def clean(doc):
    if doc and "_id" in doc:
        doc.pop("_id", None)
    return doc


def normalize_company_ids(value) -> list[str]:
    if not value:
        return []
    seen = set()
    normalized = []
    for item in value:
        if not item or item in seen:
            continue
        seen.add(item)
        normalized.append(item)
    return normalized


def serialize_user(user: dict) -> dict:
    user = clean(dict(user))
    user.pop("password_hash", None)
    user["tenant_id"] = user.get("tenant_id") or DEFAULT_TENANT_ID
    user["company_ids"] = normalize_company_ids(user.get("company_ids"))
    user["role"] = user.get("role", "accountant")
    user["active"] = user.get("active", True)
    return user


def tenant_id_for_user(user: dict) -> str:
    return user.get("tenant_id") or DEFAULT_TENANT_ID


def is_admin_user(user: dict) -> bool:
    return user.get("role") == "admin"


def is_client_user(user: dict) -> bool:
    return user.get("role") == "client"


def require_admin_user(user: dict) -> None:
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Admin access required")


def require_staff_user(user: dict) -> None:
    if is_client_user(user):
        raise HTTPException(status_code=403, detail="Staff access required")


def scoped_query(coll: str, user: dict, query: Optional[dict] = None) -> dict:
    scoped = dict(query or {})
    if coll in TENANT_SCOPED_COLLECTIONS:
        scoped["tenant_id"] = tenant_id_for_user(user)

    if is_client_user(user):
        allowed_company_ids = normalize_company_ids(user.get("company_ids"))
        if coll == "companies":
            company_filter = scoped.get("id")
            if company_filter and company_filter not in allowed_company_ids:
                raise HTTPException(
                    status_code=403, detail="Forbidden company access")
            if not company_filter:
                scoped["id"] = {"$in": allowed_company_ids or ["__none__"]}
        elif coll in COMPANY_SCOPED_COLLECTIONS:
            company_filter = scoped.get("company_id")
            if isinstance(company_filter, str):
                if company_filter not in allowed_company_ids:
                    raise HTTPException(
                        status_code=403, detail="Forbidden company access")
            elif isinstance(company_filter, dict) and "$in" in company_filter:
                scoped["company_id"] = {"$in": [
                    cid for cid in company_filter["$in"] if cid in allowed_company_ids] or ["__none__"]}
            else:
                scoped["company_id"] = {
                    "$in": allowed_company_ids or ["__none__"]}
    return scoped


async def find_one_scoped(coll: str, user: dict, query: dict):
    return await db[coll].find_one(scoped_query(coll, user, query), {"_id": 0})


async def get_company_or_404(user: dict, company_id: str):
    company = await find_one_scoped("companies", user, {"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


async def validate_company_assignments(user: dict, company_ids: list[str]) -> list[str]:
    normalized = normalize_company_ids(company_ids)
    if not normalized:
        return []
    found = await db.companies.find(
        scoped_query("companies", user, {"id": {"$in": normalized}}),
        {"_id": 0, "id": 1},
    ).to_list(len(normalized))
    found_ids = {item["id"] for item in found}
    missing = [cid for cid in normalized if cid not in found_ids]
    if missing:
        raise HTTPException(
            status_code=400, detail=f"Unknown company assignments: {', '.join(missing)}")
    return normalized


async def create_password_reset_token(user: dict, target_user: dict, issued_by: Optional[dict] = None, expires_in_hours: int = PASSWORD_RESET_TOKEN_TTL_HOURS):
    token = new_token()
    token_doc = {
        "id": new_id(),
        "tenant_id": tenant_id_for_user(user),
        "user_id": target_user["id"],
        "email": target_user["email"],
        "token_hash": hash_token(token),
        "created_at": now_iso(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=expires_in_hours)).isoformat(),
        "used_at": None,
        "issued_by": issued_by.get("id") if issued_by else None,
    }
    await db.password_reset_tokens.insert_one(token_doc)
    await log_audit(issued_by or target_user, "password_reset_requested", "user", f"Password reset requested for {target_user['email']}")
    return token, token_doc


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
        user = serialize_user(user)
        if not user.get("active", True):
            raise HTTPException(
                status_code=403, detail="User account is inactive")
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
        "tenant_id": tenant_id_for_user(user) if user else DEFAULT_TENANT_ID,
    })


# ---------------------------------------------------------------- models
class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str
    invite_token: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class InviteIn(BaseModel):
    email: EmailStr
    name: Optional[str] = ""
    role: str = "client"
    company_ids: list[str] = Field(default_factory=list)
    expires_in_days: int = INVITE_TOKEN_TTL_DAYS


class UserAdminUpdateIn(BaseModel):
    role: Optional[str] = None
    company_ids: Optional[list[str]] = None
    active: Optional[bool] = None


class PasswordResetRequestIn(BaseModel):
    email: EmailStr


class PasswordResetConfirmIn(BaseModel):
    token: str
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


class NotificationSettingsIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    email_deadlines: bool = True
    email_missing_docs: bool = True
    weekly_summary: bool = True


class ExcelPreferencesIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    currency_format: str = "CHF"
    date_format: str = "DD.MM.YYYY"
    include_instructions: bool = True


class SettingsIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    firm_name: str = "Helvetia Accounting Partners AG"
    firm_address: str = "Bahnhofstrasse 42, 8001 Zürich"
    firm_email: str = "office@helvetia-accounting.ch"
    firm_phone: str = "+41 44 123 45 67"
    accountant_name: str = "Firm Admin"
    currency: str = "CHF"
    fiscal_year: str = "Jan - Dec"
    vat_rates: list[float] = Field(default_factory=lambda: [8.1, 2.6, 3.8])
    country: str = "Switzerland"
    document_categories: list[str] = Field(default_factory=lambda: [
                                           "Invoice", "Receipt", "Bank Statement", "Payroll", "Contract", "Tax Document", "Other"])
    excel_preferences: ExcelPreferencesIn = Field(
        default_factory=ExcelPreferencesIn)
    notifications: NotificationSettingsIn = Field(
        default_factory=NotificationSettingsIn)


def normalize_settings_doc(settings_doc: Optional[dict] = None):
    defaults = seed_data.default_settings()
    settings_doc = settings_doc or {}
    merged = {**defaults, **settings_doc}
    merged["notifications"] = {
        **defaults["notifications"], **(settings_doc.get("notifications") or {})}
    merged["excel_preferences"] = {
        **defaults["excel_preferences"], **(settings_doc.get("excel_preferences") or {})}
    model = SettingsIn.model_validate(merged)
    return {"id": "global", **model.model_dump()}


# ---------------------------------------------------------------- auth routes
def set_auth_cookie(response: Response, token: str):
    response.set_cookie("access_token", token, httponly=True, secure=is_production(),
                        samesite="lax", max_age=604800, path="/")


@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")

    invite = None
    role = "accountant"
    tenant_id = DEFAULT_TENANT_ID
    company_ids = []

    if body.invite_token:
        invite = await db.invitations.find_one({"token_hash": hash_token(body.invite_token)}, {"_id": 0})
        if not invite or invite.get("revoked_at") or invite.get("accepted_at") or is_expired(invite.get("expires_at")):
            raise HTTPException(
                status_code=400, detail="Invitation is invalid or expired")
        if invite["email"].lower() != email:
            raise HTTPException(
                status_code=400, detail="Invitation email does not match")
        role = invite.get("role", "client")
        tenant_id = invite.get("tenant_id") or DEFAULT_TENANT_ID
        company_ids = normalize_company_ids(invite.get("company_ids"))
    elif not allow_self_registration():
        raise HTTPException(
            status_code=403, detail="Self-registration is disabled")

    uid = new_id()
    user = {"id": uid, "name": body.name, "email": email,
            "password_hash": hash_password(body.password), "role": role,
            "tenant_id": tenant_id, "company_ids": company_ids, "active": True,
            "created_at": now_iso()}
    await db.users.insert_one(user)
    if invite:
        await db.invitations.update_one({"id": invite["id"]}, {"$set": {"accepted_at": now_iso(), "accepted_user_id": uid}})
    token = create_access_token(uid, email)
    set_auth_cookie(response, token)
    await log_audit(user, "user_registered", "user", f"{email} registered")
    return {**serialize_user(user), "token": token}


@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(
            status_code=401, detail="Invalid email or password")
    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="User account is inactive")
    token = create_access_token(user["id"], email)
    set_auth_cookie(response, token)
    await log_audit(user, "user_login", "user", f"{email} logged in")
    return {**serialize_user(user), "token": token}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"message": "Logged out"}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return serialize_user(user)


@api.post("/auth/password-reset/request")
async def request_password_reset(body: PasswordResetRequestIn):
    email = body.email.lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        return {"message": "If that account exists, reset instructions were issued."}
    user = serialize_user(user)
    token, _ = await create_password_reset_token(user, user)
    result = {"message": "If that account exists, reset instructions were issued."}
    if not is_production():
        result["reset_token"] = token
    return result


@api.post("/auth/password-reset/confirm")
async def confirm_password_reset(body: PasswordResetConfirmIn):
    token_doc = await db.password_reset_tokens.find_one({"token_hash": hash_token(body.token)}, {"_id": 0})
    if not token_doc or token_doc.get("used_at") or is_expired(token_doc.get("expires_at")):
        raise HTTPException(
            status_code=400, detail="Reset token is invalid or expired")
    user = await db.users.find_one({"id": token_doc["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(body.password)}})
    await db.password_reset_tokens.update_one({"id": token_doc["id"]}, {"$set": {"used_at": now_iso()}})
    await log_audit(serialize_user(user), "password_reset_confirmed", "user", f"Password reset completed for {user['email']}")
    return {"message": "Password updated"}


@api.get("/admin/users")
async def admin_list_users(user: dict = Depends(get_current_user)):
    require_admin_user(user)
    users = await db.users.find({"tenant_id": tenant_id_for_user(user)}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [serialize_user(item) for item in users]


@api.put("/admin/users/{uid}")
async def admin_update_user(uid: str, body: UserAdminUpdateIn, user: dict = Depends(get_current_user)):
    require_admin_user(user)
    target = await db.users.find_one({"id": uid, "tenant_id": tenant_id_for_user(user)}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    updates = {}
    if body.role is not None:
        if body.role not in ALLOWED_ROLES:
            raise HTTPException(status_code=400, detail="Invalid role")
        updates["role"] = body.role
    if body.company_ids is not None:
        updates["company_ids"] = await validate_company_assignments(user, body.company_ids)
    if body.active is not None:
        updates["active"] = body.active
    if updates:
        await db.users.update_one({"id": uid}, {"$set": updates})
        await log_audit(user, "user_updated", "user", f"Updated user {target['email']}")
    updated = await db.users.find_one({"id": uid}, {"_id": 0})
    return serialize_user(updated)


@api.get("/admin/invitations")
async def admin_list_invitations(user: dict = Depends(get_current_user)):
    require_admin_user(user)
    invites = await db.invitations.find({"tenant_id": tenant_id_for_user(user)}, {"_id": 0, "token_hash": 0}).sort("created_at", -1).to_list(500)
    return invites


@api.post("/admin/invitations")
async def admin_create_invitation(body: InviteIn, user: dict = Depends(get_current_user)):
    require_admin_user(user)
    role = body.role.strip().lower()
    if role not in ALLOWED_ROLES - {"admin"}:
        raise HTTPException(
            status_code=400, detail="Invitations may only create accountant or client users")
    company_ids = await validate_company_assignments(user, body.company_ids)
    token = new_token()
    invite = {
        "id": new_id(),
        "tenant_id": tenant_id_for_user(user),
        "email": body.email.lower(),
        "name": body.name or "",
        "role": role,
        "company_ids": company_ids,
        "token_hash": hash_token(token),
        "created_at": now_iso(),
        "created_by": user["id"],
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=max(1, body.expires_in_days))).isoformat(),
        "accepted_at": None,
        "revoked_at": None,
    }
    await db.invitations.insert_one(invite)
    await log_audit(user, "invite_created", "invitation", f"Created invitation for {invite['email']}")
    return {**clean(dict(invite)), "token": token, "token_hash": None}


@api.delete("/admin/invitations/{invite_id}")
async def admin_revoke_invitation(invite_id: str, user: dict = Depends(get_current_user)):
    require_admin_user(user)
    res = await db.invitations.update_one(
        {"id": invite_id, "tenant_id": tenant_id_for_user(
            user), "accepted_at": None},
        {"$set": {"revoked_at": now_iso()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Invitation not found")
    await log_audit(user, "invite_revoked", "invitation", f"Revoked invitation {invite_id}")
    return {"message": "revoked"}


@api.post("/admin/users/{uid}/password-reset")
async def admin_generate_password_reset(uid: str, user: dict = Depends(get_current_user)):
    require_admin_user(user)
    target = await db.users.find_one({"id": uid, "tenant_id": tenant_id_for_user(user)}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    token, token_doc = await create_password_reset_token(user, serialize_user(target), issued_by=user, expires_in_hours=24)
    return {"message": "Reset token created", "reset_token": token, "expires_at": token_doc["expires_at"]}


@api.get("/admin/audit/summary")
async def admin_audit_summary(user: dict = Depends(get_current_user)):
    require_admin_user(user)
    logs = await find_list("audit_logs", user, sort_field="timestamp", limit=50)
    users = await db.users.count_documents({"tenant_id": tenant_id_for_user(user), "active": True})
    pending_invites = await db.invitations.count_documents({"tenant_id": tenant_id_for_user(user), "accepted_at": None, "revoked_at": None})
    return {"active_users": users, "pending_invites": pending_invites, "recent_audit": logs[:20]}


# ---------------------------------------------------------------- helpers for CRUD
async def find_list(coll, user: dict, query=None, sort_field="created_at", limit=1000):
    cur = db[coll].find(scoped_query(coll, user, query), {"_id": 0}).sort(
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
    return await find_list("companies", user)


@api.get("/companies/{cid}")
async def get_company(cid: str, user: dict = Depends(get_current_user)):
    return await get_company_or_404(user, cid)


@api.get("/companies/{cid}/overview")
async def company_overview(cid: str, user: dict = Depends(get_current_user)):
    require_staff_user(user)
    company = await get_company_or_404(user, cid)
    return {
        "company": company,
        "documents": await find_list("documents", user, {"company_id": cid}),
        "payables": await find_list("payables", user, {"company_id": cid}),
        "receivables": await find_list("receivables", user, {"company_id": cid}),
        "tasks": await find_list("tasks", user, {"company_id": cid}),
        "deadlines": await find_list("deadlines", user, {"company_id": cid}, "due_date"),
        "questions": await find_list("questions", user, {"company_id": cid}),
        "activity": await find_list("audit_logs", user, {"company_id": cid}, "timestamp", 30),
    }


@api.post("/companies")
async def create_company(body: CompanyIn, user: dict = Depends(get_current_user)):
    require_staff_user(user)
    doc = {"id": new_id(), **body.model_dump(),
           "tenant_id": tenant_id_for_user(user), "created_at": now_iso()}
    await db.companies.insert_one(doc)
    await log_audit(user, "company_created", "company", f"Created {body.name}", doc["id"])
    return clean(doc)


@api.put("/companies/{cid}")
async def update_company(cid: str, body: CompanyIn, user: dict = Depends(get_current_user)):
    require_staff_user(user)
    res = await db.companies.update_one(scoped_query("companies", user, {"id": cid}), {"$set": body.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(404, "Company not found")
    await log_audit(user, "company_updated", "company", f"Updated {body.name}", cid)
    return await find_one_scoped("companies", user, {"id": cid})


@api.delete("/companies/{cid}")
async def delete_company(cid: str, user: dict = Depends(get_current_user)):
    require_staff_user(user)
    company = await get_company_or_404(user, cid)
    await db.companies.delete_one({"id": cid, "tenant_id": company["tenant_id"]})
    for coll in [
        "documents",
        "payables",
        "receivables",
        "tasks",
        "deadlines",
        "questions",
        "bank_transactions",
        "month_end",
        "vat_returns",
        "audit_logs",
    ]:
        await db[coll].delete_many({"company_id": cid, "tenant_id": company["tenant_id"]})
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
    return await find_list("documents", user, q)


@api.post("/documents")
async def create_document(body: DocumentIn, user: dict = Depends(get_current_user)):
    require_staff_user(user)
    await get_company_or_404(user, body.company_id)
    doc = {"id": new_id(), **body.model_dump(), "uploaded_by": user["name"],
           "tenant_id": tenant_id_for_user(user),
           "date": body.date or now_iso()[:10], "ocr": None, "created_at": now_iso()}
    await db.documents.insert_one(doc)
    # auto-create review task
    await db.tasks.insert_one({
        "id": new_id(), "company_id": body.company_id, "tenant_id": tenant_id_for_user(user),
        "title": f"Review document: {body.name}", "status": "In Review",
        "assigned_to": user["name"], "due_date": (datetime.now(timezone.utc) + timedelta(days=3)).date().isoformat(),
        "notes": "Auto-created on upload", "created_at": now_iso(),
    })
    await log_audit(user, "document_uploaded", "document", f"Uploaded {body.name}", body.company_id)
    return clean(doc)


@api.post("/documents/{doc_id}/ocr")
async def run_ocr(doc_id: str, user: dict = Depends(get_current_user)):
    require_staff_user(user)
    doc = await find_one_scoped("documents", user, {"id": doc_id})
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
    await db.documents.update_one(scoped_query("documents", user, {"id": doc_id}), {"$set": update})
    await log_audit(user, "document_ocr", "document", f"OCR extracted for {doc['name']}", doc["company_id"])
    return result


@api.put("/documents/{doc_id}")
async def update_document(doc_id: str, body: DocumentIn, user: dict = Depends(get_current_user)):
    require_staff_user(user)
    await get_company_or_404(user, body.company_id)
    res = await db.documents.update_one(scoped_query("documents", user, {"id": doc_id}), {"$set": body.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(404, "Document not found")
    await log_audit(user, "document_updated", "document", f"Updated {body.name} → {body.status}", body.company_id)
    return await find_one_scoped("documents", user, {"id": doc_id})


@api.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, user: dict = Depends(get_current_user)):
    require_staff_user(user)
    await db.documents.delete_one(scoped_query("documents", user, {"id": doc_id}))
    return {"message": "deleted"}


# ---------------------------------------------------------------- generic entity factory
def register_crud(path, coll, model, label, audit_name):
    @api.get(f"/{path}", name=f"list_{path}")
    async def _list(company_id: Optional[str] = None, user: dict = Depends(get_current_user)):
        q = {"company_id": company_id} if company_id else {}
        return await find_list(coll, user, q)

    @api.post(f"/{path}", name=f"create_{path}")
    async def _create(body: model, user: dict = Depends(get_current_user)):
        require_staff_user(user)
        company_id = body.model_dump().get("company_id")
        if company_id:
            await get_company_or_404(user, company_id)
        doc = {"id": new_id(), **body.model_dump(),
               "tenant_id": tenant_id_for_user(user), "created_at": now_iso()}
        await db[coll].insert_one(doc)
        await log_audit(user, f"{audit_name}_created", label, f"Created {label}", company_id)
        return clean(doc)

    @api.put(f"/{path}/{{item_id}}", name=f"update_{path}")
    async def _update(item_id: str, body: model, user: dict = Depends(get_current_user)):
        require_staff_user(user)
        company_id = body.model_dump().get("company_id")
        if company_id:
            await get_company_or_404(user, company_id)
        res = await db[coll].update_one(scoped_query(coll, user, {"id": item_id}), {"$set": body.model_dump()})
        if res.matched_count == 0:
            raise HTTPException(404, f"{label} not found")
        await log_audit(user, f"{audit_name}_updated", label, f"Updated {label}", company_id)
        return await find_one_scoped(coll, user, {"id": item_id})

    @api.delete(f"/{path}/{{item_id}}", name=f"delete_{path}")
    async def _delete(item_id: str, user: dict = Depends(get_current_user)):
        require_staff_user(user)
        await db[coll].delete_one(scoped_query(coll, user, {"id": item_id}))
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
    require_staff_user(user)
    q = {"company_id": company_id} if company_id else {}
    items = await find_list("payables", user, q)
    # supplier balances
    balances = {}
    for it in items:
        if it.get("payment_status") != "paid":
            balances[it["supplier"]] = round(balances.get(
                it["supplier"], 0) + (it.get("amount", 0) or 0) + (it.get("vat", 0) or 0), 2)
    return {"aging": build_aging(items), "supplier_balances": balances, "items": items}


@api.get("/receivables/report/aging")
async def receivables_aging(company_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    require_staff_user(user)
    q = {"company_id": company_id} if company_id else {}
    items = await find_list("receivables", user, q)
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
    require_staff_user(user)
    await get_company_or_404(user, company_id)
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
            "id": new_id(), "company_id": company_id, "tenant_id": tenant_id_for_user(user),
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
    require_staff_user(user)
    tx = await find_one_scoped("bank_transactions", user, {"id": tx_id})
    if not tx:
        raise HTTPException(404, "Transaction not found")
    matched = not tx.get("matched")
    await db.bank_transactions.update_one(scoped_query("bank_transactions", user, {"id": tx_id}), {"$set": {"matched": matched, "matched_invoice": invoice_number}})
    return {"matched": matched}


@api.get("/bank-transactions/report/reconciliation")
async def reconciliation_report(company_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    require_staff_user(user)
    q = {"company_id": company_id} if company_id else {}
    txs = await find_list("bank_transactions", user, q, "date")
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
    require_staff_user(user)
    q = {"company_id": company_id} if company_id else {}
    receivables = await find_list("receivables", user, q)
    payables = await find_list("payables", user, q)
    output_vat = round(sum(r.get("vat", 0) or 0 for r in receivables), 2)
    input_vat = round(sum(p.get("vat", 0) or 0 for p in payables), 2)
    taxable_revenue = round(
        sum(r.get("amount", 0) or 0 for r in receivables), 2)
    deductible = round(sum(p.get("amount", 0) or 0 for p in payables), 2)
    returns = await find_list("vat_returns", user, q, "period")
    return {
        "output_vat": output_vat, "input_vat": input_vat,
        "vat_balance": round(output_vat - input_vat, 2),
        "taxable_revenue": taxable_revenue, "deductible_expenses": deductible,
        "rates": [8.1, 2.6, 3.8], "country": "Switzerland", "returns": returns,
    }


# ---------------------------------------------------------------- dashboard
@api.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    require_staff_user(user)
    companies = await find_list("companies", user)
    documents = await find_list("documents", user)
    payables = await find_list("payables", user)
    receivables = await find_list("receivables", user)
    tasks = await find_list("tasks", user)
    deadlines = await find_list("deadlines", user, None, "due_date")

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
    require_staff_user(user)
    q = {"company_id": company_id} if company_id else {}
    receivables = await find_list("receivables", user, q)
    payables = await find_list("payables", user, q)
    revenue = round(sum(r.get("amount", 0) or 0 for r in receivables), 2)
    expenses = round(sum(p.get("amount", 0) or 0 for p in payables), 2)

    if report_type == "profit-loss":
        return {"revenue": revenue, "expenses": expenses, "net_profit": round(revenue - expenses, 2),
                "gross_margin": round((revenue - expenses) / revenue * 100, 1) if revenue else 0}
    if report_type == "expense-by-category":
        from collections import defaultdict
        cat = defaultdict(float)
        docs = await find_list("documents", user, q)
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
    require_staff_user(user)
    q = {"company_id": company_id} if company_id else {}
    return await find_list("audit_logs", user, q, "timestamp", 200)


# ---------------------------------------------------------------- settings
@api.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    require_staff_user(user)
    s = await find_one_scoped("settings", user, {"id": "global"})
    normalized = normalize_settings_doc(s)
    normalized["tenant_id"] = tenant_id_for_user(user)
    if s != normalized:
        await db.settings.replace_one(scoped_query("settings", user, {"id": "global"}), normalized, upsert=True)
    return normalized


@api.put("/settings")
async def update_settings(body: SettingsIn, user: dict = Depends(get_current_user)):
    require_staff_user(user)
    normalized = {"id": "global", "tenant_id": tenant_id_for_user(
        user), **body.model_dump()}
    await db.settings.replace_one(scoped_query("settings", user, {"id": "global"}), normalized, upsert=True)
    await log_audit(user, "settings_changed", "settings", "Updated firm settings")
    return normalized


# ---------------------------------------------------------------- global search
@api.get("/search")
async def search(q: str, user: dict = Depends(get_current_user)):
    if not q or len(q) < 1:
        return {"results": []}
    rx = {"$regex": q, "$options": "i"}
    results = []
    for c in await db.companies.find(scoped_query("companies", user, {"name": rx}), {"_id": 0}).limit(5).to_list(5):
        results.append(
            {"type": "company", "id": c["id"], "title": c["name"], "subtitle": c.get("legal_form", "")})
    for d in await db.documents.find(scoped_query("documents", user, {"name": rx}), {"_id": 0}).limit(5).to_list(5):
        results.append(
            {"type": "document", "id": d["id"], "title": d["name"], "subtitle": d.get("category", "")})
    for p in await db.payables.find(scoped_query("payables", user, {"$or": [{"supplier": rx}, {"invoice_number": rx}]}), {"_id": 0}).limit(5).to_list(5):
        results.append({"type": "payable", "id": p["id"], "title": p["supplier"], "subtitle": p.get(
            "invoice_number", "")})
    for r in await db.receivables.find(scoped_query("receivables", user, {"$or": [{"customer": rx}, {"invoice_number": rx}]}), {"_id": 0}).limit(5).to_list(5):
        results.append({"type": "receivable", "id": r["id"], "title": r["customer"], "subtitle": r.get(
            "invoice_number", "")})
    return {"results": results}


# ---------------------------------------------------------------- excel center
@api.get("/excel/templates")
async def excel_templates(user: dict = Depends(get_current_user)):
    require_staff_user(user)
    return {"templates": excel_export.list_templates()}


@api.get("/excel/download/{key}")
async def excel_download(key: str, company_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    require_staff_user(user)
    if key not in excel_export.TEMPLATES:
        raise HTTPException(404, "Template not found")
    rows = await build_report_rows(key, company_id, user)
    data = excel_export.build_template(key, rows)
    await log_audit(user, "report_exported", "excel", f"Exported {key}", company_id)
    filename = f"{key}_{datetime.now().strftime('%Y%m%d')}.xlsx"
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


async def build_report_rows(key, company_id, user):
    """Populate certain templates with live data."""
    q = {"company_id": company_id} if company_id else {}
    if key == "ap_aging":
        items = await find_list("payables", user, q)
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
        items = await find_list("receivables", user, q)
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
        items = await find_list("payables", user, q)
        return [{"Date": p.get("invoice_date"), "Supplier": p.get("supplier"), "Category": "Expense",
                 "Description": p.get("invoice_number"), "Net": p.get("amount", 0), "VAT": p.get("vat", 0),
                 "Gross": (p.get("amount", 0) or 0) + (p.get("vat", 0) or 0),
                 "Payment Method": p.get("payment_method", "")} for p in items]
    if key == "revenue_tracker":
        items = await find_list("receivables", user, q)
        return [{"Date": r.get("invoice_date"), "Customer": r.get("customer"), "Invoice No.": r.get("invoice_number"),
                 "Description": "Sales invoice", "Net": r.get("amount", 0), "VAT": r.get("vat", 0),
                 "Gross": (r.get("amount", 0) or 0) + (r.get("vat", 0) or 0),
                 "Status": r.get("payment_status", "")} for r in items]
    if key == "bank_reconciliation":
        items = await find_list("bank_transactions", user, q, "date")
        return [{"Date": t.get("date"), "Description": t.get("description"), "Reference": t.get("reference"),
                 "Bank Amount": t.get("amount"), "Book Amount": t.get("amount") if t.get("matched") else 0,
                 "Difference": 0 if t.get("matched") else t.get("amount"),
                 "Status": "Matched" if t.get("matched") else "Unmatched"} for t in items]
    if key == "month_end_close":
        items = await find_list("month_end", user, q)
        return [{"Task": m.get("task"), "Assigned To": m.get("assigned_to"), "Due Date": m.get("due_date"),
                 "Status": m.get("status", "").title(), "Notes": m.get("notes")} for m in items]
    return None


# ---------------------------------------------------------------- client portal
@api.get("/portal/{cid}")
async def portal(cid: str, user: dict = Depends(get_current_user)):
    company = await get_company_or_404(user, cid)
    return {
        "company": company,
        "documents": await find_list("documents", user, {"company_id": cid}),
        "missing": [t for t in await find_list("tasks", user, {"company_id": cid}) if t.get("status") == "Missing Documents"],
        "questions": await find_list("questions", user, {"company_id": cid}),
        "deadlines": await find_list("deadlines", user, {"company_id": cid}, "due_date"),
    }


# ---------------------------------------------------------------- health/startup
@api.get("/")
async def root():
    return {"message": "AccountantOS API", "status": "ok"}


@api.get("/health/live")
async def health_live():
    return {"status": "live", "env": app_env()}


@api.get("/health/ready")
async def health_ready():
    try:
        await db.command("ping")
    except Exception as exc:
        raise HTTPException(
            status_code=503, detail=f"Database not ready: {exc}")
    return {"status": "ready", "env": app_env()}


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
    tenant_id = os.environ.get("DEFAULT_TENANT_ID", DEFAULT_TENANT_ID)
    await db.users.create_index("email", unique=True)
    await db.users.create_index([("tenant_id", 1), ("role", 1)])
    await db.invitations.create_index("token_hash", unique=True)
    await db.password_reset_tokens.create_index("token_hash", unique=True)
    for coll in ["companies", "documents", "payables", "receivables", "tasks",
                 "deadlines", "questions", "bank_transactions", "audit_logs"]:
        await db[coll].create_index("company_id")
    for coll in TENANT_SCOPED_COLLECTIONS:
        await db[coll].create_index("tenant_id")
    # seed admin
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_pw = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({"id": new_id(), "name": "Firm Admin", "email": admin_email,
                                   "password_hash": hash_password(admin_pw), "role": "admin", "tenant_id": tenant_id,
                                   "company_ids": [], "active": True,
                                   "created_at": now_iso()})
    else:
        updates = {"tenant_id": existing.get("tenant_id") or tenant_id, "company_ids": normalize_company_ids(
            existing.get("company_ids")), "active": existing.get("active", True)}
        if reset_admin_password_on_startup() and not verify_password(admin_pw, existing["password_hash"]):
            updates["password_hash"] = hash_password(admin_pw)
        await db.users.update_one({"email": admin_email}, {"$set": updates})
    # seed demo data
    if seed_demo_data_enabled():
        await seed_data.seed(db, new_id, now_iso)
    await db.users.update_many({"tenant_id": {"$exists": False}}, {"$set": {"tenant_id": tenant_id}})
    await db.users.update_many({"company_ids": {"$exists": False}}, {"$set": {"company_ids": []}})
    await db.users.update_many({"active": {"$exists": False}}, {"$set": {"active": True}})
    for coll in TENANT_SCOPED_COLLECTIONS:
        await db[coll].update_many({"tenant_id": {"$exists": False}}, {"$set": {"tenant_id": tenant_id}})
    logger.info("AccountantOS startup complete")


@app.on_event("shutdown")
async def shutdown():
    client.close()
