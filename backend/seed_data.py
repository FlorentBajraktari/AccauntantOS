"""Rich sample data seeding for AccountantOS."""
from datetime import datetime, timezone, timedelta


def default_settings():
    return {
        "id": "global",
        "firm_name": "Helvetia Accounting Partners AG",
        "firm_address": "Bahnhofstrasse 42, 8001 Zürich",
        "firm_email": "office@helvetia-accounting.ch",
        "firm_phone": "+41 44 123 45 67",
        "accountant_name": "Firm Admin",
        "currency": "CHF",
        "fiscal_year": "Jan - Dec",
        "vat_rates": [8.1, 2.6, 3.8],
        "country": "Switzerland",
        "document_categories": ["Invoice", "Receipt", "Bank Statement", "Payroll", "Contract", "Tax Document", "Other"],
        "excel_preferences": {"currency_format": "CHF", "date_format": "DD.MM.YYYY", "include_instructions": True},
        "notifications": {"email_deadlines": True, "email_missing_docs": True, "weekly_summary": True},
    }


def _d(offset_days):
    return (datetime.now(timezone.utc) + timedelta(days=offset_days)).date().isoformat()


async def seed(db, new_id, now_iso):
    if await db.companies.count_documents({}) > 0:
        return

    await db.settings.update_one({"id": "global"}, {"$set": default_settings()}, upsert=True)

    companies_def = [
        {"name": "Alpine Tech Solutions GmbH", "legal_form": "GmbH", "address": "Technoparkstrasse 1, 8005 Zürich",
         "uid_vat": "CHE-123.456.789 MWST", "contact_person": "Markus Weber", "email": "m.weber@alpinetech.ch",
         "phone": "+41 44 200 10 20", "vat_status": "VAT Registered", "accounting_method": "Accrual"},
        {"name": "Léman Bistro Sàrl", "legal_form": "Sàrl", "address": "Rue du Rhône 12, 1204 Genève",
         "uid_vat": "CHE-987.654.321 MWST", "contact_person": "Sophie Dubois", "email": "sophie@lemanbistro.ch",
         "phone": "+41 22 300 40 50", "vat_status": "VAT Registered", "accounting_method": "Cash"},
        {"name": "Bergland Consulting AG", "legal_form": "AG", "address": "Marktgasse 8, 3011 Bern",
         "uid_vat": "CHE-456.789.123 MWST", "contact_person": "Andreas Müller", "email": "a.mueller@bergland.ch",
         "phone": "+41 31 500 60 70", "vat_status": "VAT Registered", "accounting_method": "Accrual"},
        {"name": "Ticino Design Studio", "legal_form": "Einzelfirma", "address": "Via Nassa 5, 6900 Lugano",
         "uid_vat": "CHE-321.654.987", "contact_person": "Elena Rossi", "email": "elena@ticinodesign.ch",
         "phone": "+41 91 700 80 90", "vat_status": "Not Registered", "accounting_method": "Cash"},
    ]
    companies = []
    for c in companies_def:
        doc = {"id": new_id(), "fiscal_year": "Jan - Dec", "notes": "", "created_at": now_iso(), **c}
        companies.append(doc)
    await db.companies.insert_many([dict(c) for c in companies])

    suppliers = ["Swisscom AG", "Migros", "SBB CFF FFS", "Die Post AG", "UBS Switzerland AG", "Digitec Galaxus AG"]
    customers = ["Novartis AG", "Roche Holding", "Nestlé Suisse", "Credit Suisse", "ABB Schweiz", "Logitech Europe"]
    categories = ["Invoice", "Receipt", "Bank Statement", "Payroll", "Contract", "Tax Document"]
    statuses = ["uploaded", "reviewed", "booked", "rejected"]

    docs, pays, recvs, tasks, deadlines, questions, banks, months, audits = [], [], [], [], [], [], [], [], []

    for ci, comp in enumerate(companies):
        cid = comp["id"]
        # documents
        for i in range(6):
            amt = round(500 + i * 340 + ci * 120, 2)
            docs.append({"id": new_id(), "company_id": cid,
                         "name": f"{categories[i % len(categories)]}_{2025}_{i+1:03d}.pdf",
                         "category": categories[i % len(categories)], "date": _d(-(i * 22) - 3),
                         "amount": amt, "vat_amount": round(amt * 0.081, 2),
                         "counterparty": suppliers[i % len(suppliers)],
                         "status": statuses[i % len(statuses)], "notes": "", "uploaded_by": "Firm Admin",
                         "ocr": None, "created_at": now_iso()})
        # payables
        for i in range(5):
            amt = round(800 + i * 450 + ci * 200, 2)
            due_off = [-20, -5, 3, 15, 30][i]
            pays.append({"id": new_id(), "company_id": cid, "supplier": suppliers[i % len(suppliers)],
                         "invoice_number": f"AP-{ci}{i}-{2025}", "invoice_date": _d(-(i * 28) - 2),
                         "due_date": _d(due_off), "amount": amt, "vat": round(amt * 0.081, 2),
                         "payment_status": ["paid", "unpaid", "unpaid", "partial", "unpaid"][i],
                         "payment_method": "Bank Transfer", "notes": "", "created_at": now_iso()})
        # receivables
        for i in range(5):
            amt = round(1500 + i * 900 + ci * 400, 2)
            due_off = [-15, -3, 7, 20, 45][i]
            recvs.append({"id": new_id(), "company_id": cid, "customer": customers[i % len(customers)],
                          "invoice_number": f"AR-{ci}{i}-{2025}", "invoice_date": _d(-(i * 26) - 4),
                          "due_date": _d(due_off), "amount": amt, "vat": round(amt * 0.081, 2),
                          "payment_status": ["paid", "paid", "unpaid", "unpaid", "overdue"][i],
                          "notes": "", "created_at": now_iso()})
        # tasks (workflow)
        wf = ["Missing Documents", "Uploaded", "In Review", "Booked", "Needs Correction"]
        for i in range(4):
            tasks.append({"id": new_id(), "company_id": cid, "title": f"Bookkeeping — {wf[i]} batch",
                          "status": wf[i], "assigned_to": "Firm Admin", "due_date": _d(i * 4 - 2),
                          "notes": "", "created_at": now_iso()})
        # deadlines
        deadlines.append({"id": new_id(), "company_id": cid, "title": "Q4 VAT Filing", "type": "VAT",
                          "due_date": _d(12 + ci * 2), "status": "open", "created_at": now_iso()})
        deadlines.append({"id": new_id(), "company_id": cid, "title": "Payroll submission", "type": "Payroll",
                          "due_date": _d(-3 + ci), "status": "open", "created_at": now_iso()})
        deadlines.append({"id": new_id(), "company_id": cid, "title": "Annual Tax Filing", "type": "Tax",
                          "due_date": _d(60 + ci * 5), "status": "open", "created_at": now_iso()})
        # questions
        questions.append({"id": new_id(), "company_id": cid,
                          "question": "Please confirm the business purpose of the Digitec purchase on 12.05.",
                          "document_id": None, "status": "open", "answer": "", "created_at": now_iso()})
        questions.append({"id": new_id(), "company_id": cid,
                          "question": "Is the Swisscom invoice a recurring monthly subscription?",
                          "document_id": None, "status": "answered", "answer": "Yes, monthly business plan.",
                          "created_at": now_iso()})
        # bank transactions
        for i in range(6):
            banks.append({"id": new_id(), "company_id": cid, "date": _d(-i * 3 - 1),
                          "description": f"{'Payment ' + suppliers[i % len(suppliers)] if i % 2 else 'Deposit ' + customers[i % len(customers)]}",
                          "reference": f"REF-{ci}{i}", "amount": round((-1 if i % 2 else 1) * (600 + i * 220), 2),
                          "matched": i % 3 == 0, "matched_invoice": None, "created_at": now_iso()})
        # month-end checklist
        checklist_items = ["Bank reconciliation completed", "AP reviewed", "AR reviewed", "VAT reviewed",
                           "Payroll reviewed", "Reports generated", "Client approval received"]
        for i, item in enumerate(checklist_items):
            months.append({"id": new_id(), "company_id": cid, "period": "2025-12", "task": item,
                           "status": ["completed", "completed", "in_progress", "pending", "pending", "pending", "pending"][i],
                           "assigned_to": "Firm Admin", "due_date": _d(5), "notes": "", "created_at": now_iso()})

    for i in range(8):
        audits.append({"id": new_id(), "user": "Firm Admin", "action": ["document_uploaded", "invoice_booked", "payment_marked_paid", "report_exported"][i % 4],
                       "entity": "document", "detail": f"Sample activity #{i+1}",
                       "company_id": companies[i % len(companies)]["id"],
                       "timestamp": (datetime.now(timezone.utc) - timedelta(hours=i * 3)).isoformat()})

    await db.documents.insert_many(docs)
    await db.payables.insert_many(pays)
    await db.receivables.insert_many(recvs)
    await db.tasks.insert_many(tasks)
    await db.deadlines.insert_many(deadlines)
    await db.questions.insert_many(questions)
    await db.bank_transactions.insert_many(banks)
    await db.month_end.insert_many(months)
    await db.audit_logs.insert_many(audits)
