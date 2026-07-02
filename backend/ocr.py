"""Mock OCR / AI extraction.

Uses the Emergent LLM key (OpenAI gpt-4o) to produce a smart, structured
extraction from a document's filename + category. Designed so the
`extract_document` function can later be swapped for Azure Document
Intelligence, Google Document AI, AWS Textract, or Tesseract.
"""
import os
import json
import random
import re
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
    date = (datetime.now(timezone.utc) - timedelta(days=rnd.randint(1, 60))).date().isoformat()
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
    """Return structured OCR-style extraction for a document.

    Attempts an LLM extraction first; falls back to deterministic rules.
    """
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        return _rule_based(filename, category)
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage

        system = (
            "You are an OCR document-extraction engine for a Swiss accounting platform. "
            "Given a document filename, category and notes, produce a REALISTIC structured "
            "extraction as if you read a Swiss business invoice/receipt. Respond ONLY with a "
            "single JSON object with keys: invoice_number, supplier, date (YYYY-MM-DD), "
            "total_amount (number CHF), vat_amount (number), vat_rate (8.1|2.6|3.8), "
            "currency (CHF), iban (Swiss IBAN), suggested_category, confidence (0-1). "
            "No markdown, no commentary."
        )
        chat = LlmChat(api_key=api_key, session_id=f"ocr-{filename}", system_message=system).with_model("openai", "gpt-4o")
        msg = UserMessage(text=f"Filename: {filename}\nCategory: {category}\nNotes: {notes}\nExtract now.")
        resp = await chat.send_message(msg)
        text = resp if isinstance(resp, str) else str(resp)
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            return _rule_based(filename, category)
        data = json.loads(match.group(0))
        data["engine"] = "llm-gpt-4o"
        data.setdefault("currency", "CHF")
        data.setdefault("confidence", 0.9)
        return data
    except Exception:
        return _rule_based(filename, category)
