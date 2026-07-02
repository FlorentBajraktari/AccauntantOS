"""Professional, modern Excel template generation using openpyxl.

Produces polished workbooks: branded title block, dark header band, zebra
striped rows, hairline borders, frozen panes, auto-filters, currency & date
formats, styled totals, KPI summary strip, validation dropdowns and a
redesigned instructions sheet.
"""
import io
from datetime import datetime
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter

BRAND = "0055FF"
BRAND_DARK = "0044CC"
INK = "0F172A"
SLATE = "475569"
MUTED = "94A3B8"
WHITE = "FFFFFF"
ZEBRA = "F6F9FF"
BAND = "EFF4FF"
LINE = "E2E8F0"

FONT = "Calibri"
hair = Side(style="thin", color=LINE)
BOTTOM = Border(bottom=hair)
BOX = Border(left=hair, right=hair, top=hair, bottom=hair)

CURRENCY_FMT = '#,##0.00 "CHF"'
DATE_FMT = "DD.MM.YYYY"
PCT_FMT = '0.0"%"'


def _title_block(ws, title, subtitle, ncols):
    last = get_column_letter(max(ncols, 1))
    # Title
    ws.merge_cells(f"A1:{last}1")
    c = ws["A1"]
    c.value = title
    c.font = Font(name=FONT, bold=True, size=20, color=INK)
    c.alignment = Alignment(vertical="center", horizontal="left")
    ws.row_dimensions[1].height = 34
    # Subtitle
    ws.merge_cells(f"A2:{last}2")
    s = ws["A2"]
    s.value = subtitle
    s.font = Font(name=FONT, size=10.5, italic=True, color=SLATE)
    ws.row_dimensions[2].height = 18
    # Meta line
    ws.merge_cells(f"A3:{last}3")
    m = ws["A3"]
    m.value = f"AccountantOS  ·  Generated {datetime.now().strftime('%d.%m.%Y %H:%M')}  ·  Currency: CHF  ·  Switzerland"
    m.font = Font(name=FONT, size=9, color=MUTED)
    ws.row_dimensions[3].height = 16
    # Brand accent divider (row 4)
    for cc in range(1, ncols + 1):
        cell = ws.cell(row=4, column=cc)
        cell.fill = PatternFill("solid", fgColor=BRAND)
    ws.row_dimensions[4].height = 4


def _style_header(ws, headers, row):
    fill = PatternFill("solid", fgColor=INK)
    font = Font(name=FONT, bold=True, color=WHITE, size=10.5)
    for c, title in enumerate(headers, start=1):
        cell = ws.cell(row=row, column=c, value=str(title).upper())
        cell.fill = fill
        cell.font = font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws.row_dimensions[row].height = 30


def _autosize(ws, headers):
    for c, title in enumerate(headers, start=1):
        ws.column_dimensions[get_column_letter(c)].width = max(15, len(str(title)) + 6)


def _instructions_sheet(wb, name, lines):
    ws = wb.create_sheet("How to use")
    ws.sheet_view.showGridLines = False
    ws.column_dimensions["A"].width = 3
    ws.column_dimensions["B"].width = 6
    ws.column_dimensions["C"].width = 96
    # Banner
    ws.merge_cells("B1:C1")
    b = ws["B1"]
    b.value = f"  {name} — How to use this template"
    b.fill = PatternFill("solid", fgColor=BRAND)
    b.font = Font(name=FONT, bold=True, size=15, color=WHITE)
    b.alignment = Alignment(vertical="center")
    ws.row_dimensions[1].height = 34
    ws.merge_cells("B2:C2")
    ws["B2"].value = "AccountantOS · Professional Swiss Accounting Platform"
    ws["B2"].font = Font(name=FONT, size=10, italic=True, color=SLATE)
    r = 4
    for i, line in enumerate(lines, start=1):
        n = ws.cell(row=r, column=2, value=str(i))
        n.font = Font(name=FONT, bold=True, size=11, color=WHITE)
        n.fill = PatternFill("solid", fgColor=BRAND)
        n.alignment = Alignment(horizontal="center", vertical="center")
        t = ws.cell(row=r, column=3, value=line)
        t.font = Font(name=FONT, size=11, color=INK)
        t.alignment = Alignment(wrap_text=True, vertical="center")
        ws.row_dimensions[r].height = 26
        r += 1
    tip = ws.cell(row=r + 1, column=3, value="Tip: Coloured cells are editable. The TOTAL row updates automatically via formulas.")
    tip.font = Font(name=FONT, size=9.5, italic=True, color=SLATE)


TEMPLATES = {
    "chart_of_accounts": {
        "title": "Chart of Accounts", "sub": "Swiss KMU standard account structure", "category": "Ledgers & Accounts", "icon": "list-tree",
        "headers": ["Account No.", "Account Name", "Type", "Category", "VAT Code", "Opening Balance", "Notes"],
        "fmt": {6: CURRENCY_FMT}, "totals": [], "dropdowns": {3: ["Asset", "Liability", "Equity", "Revenue", "Expense"]},
        "instructions": ["Fill in your account numbers following the Swiss KMU chart.", "Use the Type dropdown to classify each account.", "Opening Balance is in CHF.", "Do not delete the header row."],
    },
    "trial_balance": {
        "title": "Trial Balance", "sub": "Debit / Credit balances by account", "category": "Ledgers & Accounts", "icon": "scale",
        "headers": ["Account No.", "Account Name", "Debit", "Credit", "Balance"],
        "fmt": {3: CURRENCY_FMT, 4: CURRENCY_FMT, 5: CURRENCY_FMT}, "totals": [3, 4, 5], "dropdowns": {},
        "instructions": ["Enter debit and credit balances per account.", "Total debits must equal total credits.", "Balance column = Debit - Credit."],
    },
    "general_ledger": {
        "title": "General Ledger", "sub": "Chronological posting journal", "category": "Ledgers & Accounts", "icon": "book-open",
        "headers": ["Date", "Account No.", "Description", "Reference", "Debit", "Credit", "Running Balance"],
        "fmt": {1: DATE_FMT, 5: CURRENCY_FMT, 6: CURRENCY_FMT, 7: CURRENCY_FMT}, "totals": [5, 6], "dropdowns": {},
        "instructions": ["Post each transaction on a new row in date order.", "Every entry must have a matching debit and credit.", "Use the Reference column for document numbers."],
    },
    "ap_aging": {
        "title": "Accounts Payable Aging", "sub": "Outstanding supplier invoices by age bucket", "category": "Payables & Receivables", "icon": "arrow-down-circle",
        "headers": ["Supplier", "Invoice No.", "Invoice Date", "Due Date", "Total", "Current", "1-30", "31-60", "61-90", "90+"],
        "fmt": {3: DATE_FMT, 4: DATE_FMT, 5: CURRENCY_FMT, 6: CURRENCY_FMT, 7: CURRENCY_FMT, 8: CURRENCY_FMT, 9: CURRENCY_FMT, 10: CURRENCY_FMT},
        "totals": [5, 6, 7, 8, 9, 10], "dropdowns": {},
        "instructions": ["Aging buckets are days past due.", "Totals row summarises exposure per bucket.", "Review the 90+ column urgently."],
    },
    "ar_aging": {
        "title": "Accounts Receivable Aging", "sub": "Outstanding customer invoices by age bucket", "category": "Payables & Receivables", "icon": "arrow-up-circle",
        "headers": ["Customer", "Invoice No.", "Invoice Date", "Due Date", "Total", "Current", "1-30", "31-60", "61-90", "90+"],
        "fmt": {3: DATE_FMT, 4: DATE_FMT, 5: CURRENCY_FMT, 6: CURRENCY_FMT, 7: CURRENCY_FMT, 8: CURRENCY_FMT, 9: CURRENCY_FMT, 10: CURRENCY_FMT},
        "totals": [5, 6, 7, 8, 9, 10], "dropdowns": {},
        "instructions": ["Aging buckets are days past due.", "Follow up on overdue balances.", "Send reminders for 30+ day items."],
    },
    "vat_summary": {
        "title": "VAT Summary", "sub": "Swiss VAT reconciliation (rates 8.1% / 2.6% / 3.8%)", "category": "VAT & Bank", "icon": "receipt",
        "headers": ["Period", "Taxable Revenue", "Output VAT", "Deductible Expenses", "Input VAT", "VAT Balance", "Status"],
        "fmt": {2: CURRENCY_FMT, 3: CURRENCY_FMT, 4: CURRENCY_FMT, 5: CURRENCY_FMT, 6: CURRENCY_FMT},
        "totals": [2, 3, 4, 5, 6], "dropdowns": {7: ["Draft", "Filed", "Paid"]},
        "instructions": ["Output VAT = VAT collected on sales.", "Input VAT = VAT paid on purchases.", "VAT Balance = Output VAT - Input VAT (payable if positive)."],
    },
    "bank_reconciliation": {
        "title": "Bank Reconciliation", "sub": "Match bank statement lines to booked entries", "category": "VAT & Bank", "icon": "landmark",
        "headers": ["Date", "Description", "Reference", "Bank Amount", "Book Amount", "Difference", "Status"],
        "fmt": {1: DATE_FMT, 4: CURRENCY_FMT, 5: CURRENCY_FMT, 6: CURRENCY_FMT}, "totals": [4, 5, 6],
        "dropdowns": {7: ["Matched", "Unmatched", "Review"]},
        "instructions": ["Import your bank statement lines here.", "Difference should be 0 when fully reconciled.", "Mark each line Matched or Unmatched."],
    },
    "month_end_close": {
        "title": "Month-End Close Checklist", "sub": "Standard close procedure", "category": "Operations", "icon": "check-square",
        "headers": ["Task", "Assigned To", "Due Date", "Status", "Notes"],
        "fmt": {3: DATE_FMT}, "totals": [], "dropdowns": {4: ["Pending", "In Progress", "Completed", "Blocked"]},
        "instructions": ["Complete each task before closing the period.", "Assign an owner and due date to every item.", "Do not close until all items are Completed."],
    },
    "expense_tracker": {
        "title": "Expense Tracker", "sub": "Categorised business expenses", "category": "Operations", "icon": "trending-down",
        "headers": ["Date", "Supplier", "Category", "Description", "Net", "VAT", "Gross", "Payment Method"],
        "fmt": {1: DATE_FMT, 5: CURRENCY_FMT, 6: CURRENCY_FMT, 7: CURRENCY_FMT}, "totals": [5, 6, 7],
        "dropdowns": {8: ["Bank Transfer", "Credit Card", "Cash", "Direct Debit"]},
        "instructions": ["Log every business expense.", "Gross = Net + VAT.", "Keep receipts for all entries."],
    },
    "revenue_tracker": {
        "title": "Revenue Tracker", "sub": "Sales income by client", "category": "Operations", "icon": "trending-up",
        "headers": ["Date", "Customer", "Invoice No.", "Description", "Net", "VAT", "Gross", "Status"],
        "fmt": {1: DATE_FMT, 5: CURRENCY_FMT, 6: CURRENCY_FMT, 7: CURRENCY_FMT}, "totals": [5, 6, 7],
        "dropdowns": {8: ["Draft", "Sent", "Paid", "Overdue"]},
        "instructions": ["Record all revenue transactions.", "Gross = Net + VAT.", "Update Status as invoices are paid."],
    },
    "payroll_preparation": {
        "title": "Payroll Preparation", "sub": "Monthly employee payroll", "category": "Operations", "icon": "users",
        "headers": ["Employee", "Gross Salary", "AHV/IV/EO", "ALV", "Pension (BVG)", "Net Salary", "Notes"],
        "fmt": {2: CURRENCY_FMT, 3: CURRENCY_FMT, 4: CURRENCY_FMT, 5: CURRENCY_FMT, 6: CURRENCY_FMT},
        "totals": [2, 3, 4, 5, 6], "dropdowns": {},
        "instructions": ["Enter gross salary and social deductions.", "Net Salary = Gross - deductions.", "Swiss social contributions: AHV/IV/EO, ALV, BVG."],
    },
    "profit_loss": {
        "title": "Profit & Loss Statement", "sub": "Income statement", "category": "Financial Statements", "icon": "bar-chart-3",
        "headers": ["Line Item", "Category", "Current Period", "Prior Period", "Variance"],
        "fmt": {3: CURRENCY_FMT, 4: CURRENCY_FMT, 5: CURRENCY_FMT}, "totals": [3, 4, 5],
        "dropdowns": {2: ["Revenue", "COGS", "Operating Expense", "Other"]},
        "instructions": ["List revenue then expenses.", "Net Profit = Revenue - Expenses.", "Variance = Current - Prior."],
    },
    "balance_sheet": {
        "title": "Balance Sheet", "sub": "Statement of financial position", "category": "Financial Statements", "icon": "scale",
        "headers": ["Line Item", "Section", "Current Period", "Prior Period"],
        "fmt": {3: CURRENCY_FMT, 4: CURRENCY_FMT}, "totals": [3, 4],
        "dropdowns": {2: ["Assets", "Liabilities", "Equity"]},
        "instructions": ["Assets = Liabilities + Equity.", "Group items by section.", "Ensure the balance sheet balances."],
    },
    "cash_flow": {
        "title": "Cash Flow Statement", "sub": "Sources and uses of cash", "category": "Financial Statements", "icon": "waves",
        "headers": ["Line Item", "Activity", "Amount"],
        "fmt": {3: CURRENCY_FMT}, "totals": [3],
        "dropdowns": {2: ["Operating", "Investing", "Financing"]},
        "instructions": ["Classify each flow by activity.", "Net Cash Flow = sum of all activities.", "Reconcile to opening/closing cash."],
    },
}


def build_template(key: str, rows: list | None = None) -> bytes:
    spec = TEMPLATES[key]
    headers = spec["headers"]
    ncols = len(headers)
    wb = Workbook()
    ws = wb.active
    ws.title = spec["title"][:31]
    ws.sheet_view.showGridLines = False

    _title_block(ws, spec["title"], spec["sub"], ncols)
    _autosize(ws, headers)

    header_row = 6
    _style_header(ws, headers, header_row)

    rows = rows or []
    start = header_row + 1
    total_rows = max(len(rows), 25)

    for r_idx in range(start, start + total_rows):
        zebra = (r_idx - start) % 2 == 1
        row = rows[r_idx - start] if (r_idx - start) < len(rows) else None
        for c_idx, title in enumerate(headers, start=1):
            val = row.get(title) if isinstance(row, dict) else None
            cell = ws.cell(row=r_idx, column=c_idx, value=val)
            cell.border = BOTTOM
            cell.font = Font(name=FONT, size=10, color=INK)
            if zebra:
                cell.fill = PatternFill("solid", fgColor=ZEBRA)
            if c_idx in spec["fmt"]:
                cell.number_format = spec["fmt"][c_idx]
                cell.alignment = Alignment(horizontal="right")
        ws.row_dimensions[r_idx].height = 18

    data_end = start + total_rows - 1

    if spec["totals"]:
        trow = data_end + 1
        tc = ws.cell(row=trow, column=1, value="TOTAL")
        tc.font = Font(name=FONT, bold=True, color=WHITE, size=10.5)
        tc.fill = PatternFill("solid", fgColor=BRAND)
        tc.alignment = Alignment(horizontal="left", vertical="center")
        for c_idx in range(2, ncols + 1):
            cell = ws.cell(row=trow, column=c_idx)
            cell.fill = PatternFill("solid", fgColor=BRAND)
            if c_idx in spec["totals"]:
                col = get_column_letter(c_idx)
                cell.value = f"=SUM({col}{start}:{col}{data_end})"
                cell.number_format = spec["fmt"].get(c_idx, CURRENCY_FMT)
                cell.font = Font(name=FONT, bold=True, color=WHITE, size=10.5)
                cell.alignment = Alignment(horizontal="right")
        ws.row_dimensions[trow].height = 24

    for col_idx, options in spec.get("dropdowns", {}).items():
        dv = DataValidation(type="list", formula1='"' + ",".join(options) + '"', allow_blank=True)
        ws.add_data_validation(dv)
        col = get_column_letter(col_idx)
        dv.add(f"{col}{start}:{col}{data_end}")

    ws.freeze_panes = ws.cell(row=start, column=1)
    ws.auto_filter.ref = f"A{header_row}:{get_column_letter(ncols)}{data_end}"

    _instructions_sheet(wb, spec["title"], spec["instructions"])

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()


def list_templates():
    return [
        {"key": k, "title": v["title"], "description": v["sub"], "category": v["category"], "icon": v["icon"]}
        for k, v in TEMPLATES.items()
    ]
