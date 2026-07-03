"""Mock OCR extraction.

Provides deterministic structured extraction from a document filename and
category. The implementation is local-only so the project can run without
external AI services or private package dependencies.
"""
import random
from datetime import datetime, timezone, timedelta

SWISS_SUPPLIERS = [
    "Swisscom AG", "Migros Genossenschaft", "SBB CFF FFS", "Coop Genossenschaft",
    "Die Post AG", "Zurich Insurance", "UBS Switzerland AG", "Helvetia Versicherungen",
    "Manor AG", "Digitec Galaxus AG",
]
CATEGORY_KEYWORDS = {
    "invoice": "Invoice", "receipt": "Receipt", "bank": "Bank Statement",
    "payroll": "Payroll", "contract": "Contract", "tax": "Tax Document",
}


def _rule_based(filename: str, category: str) -> dict:
    """Deterministic fallback extraction (no external API)."""
    seed = sum(ord(c) for c in (filename or "doc"))
    rnd = random.Random(seed)
    total = round(rnd.uniform(120, 8500), 2)
    vat_rate = rnd.choice([8.1, 2.6, 3.8])
    vat_amount = round(total - total / (1 + vat_rate / 100), 2)
    date = (datetime.now(timezone.utc) -
            timedelta(days=rnd.randint(1, 60))).date().isoformat()
    supplier = rnd.choice(SWISS_SUPPLIERS)
    guessed = category
    for k, v in CATEGORY_KEYWORDS.items():
        if k in (filename or "").lower():
            guessed = v
            break
    return {
        "invoice_number": f"INV-{rnd.randint(10000, 99999)}",
        "supplier": supplier,
        "date": date,
        "total_amount": total,
        "vat_amount": vat_amount,
        "vat_rate": vat_rate,
        "currency": "CHF",
        "iban": f"CH{rnd.randint(10,99)} 0076 2011 6238 {rnd.randint(1000,9999)} 1",
        "suggested_category": guessed,
        "confidence": round(rnd.uniform(0.82, 0.98), 2),
        "engine": "rule-based-mock",
    }


async def extract_document(filename: str, category: str, notes: str = "") -> dict:
    """Return structured OCR-style extraction for a document."""
    return _rule_based(filename, category)
