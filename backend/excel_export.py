"""Professional Excel template generation using openpyxl.

Produces styled workbooks (headers, frozen panes, auto-filters, currency &
date formats, totals, summary + instructions sheets, validation dropdowns).
"""
import io
from datetime import datetime
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side, NamedStyle
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter

BRAND = "0055FF"
DARK = "0F172A"
LIGHT = "F1F5F9"
WHITE = "FFFFFF"

_thin = Side(style="thin", color="E2E8F0")
BORDER = Border(left=_thin, right=_thin, top=_thin, bottom=_thin)
CURRENCY_FMT = '#,##0.00 "CHF"'
DATE_FMT = "DD.MM.YYYY"
PCT_FMT = '0.0"%"'


def _style_header(ws, headers, row=1):
    fill = PatternFill("solid", fgColor=DARK)
    font = Font(name="Calibri", bold=True, color=WHITE, size=11)
    for c, title in enumerate(headers, start=1):
        cell = ws.cell(row=row, column=c, value=title)
        cell.fill = fill
        cell.font = font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = BORDER
    ws.row_dimensions[row].height = 26


def _autosize(ws, headers, extra=4):
    for c, title in enumerate(headers, start=1):
        ws.column_dimensions[get_column_letter(c)].width = max(14, len(str(title)) + extra)


def _title_block(ws, title, subtitle, ncols):
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=min(ncols, 6))
    t = ws.cell(row=1, column=1, value=title)
    t.font = Font(name="Calibri", bold=True, size=18, color=BRAND)
    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=min(ncols, 6))
    s = ws.cell(row=2, column=1, value=subtitle)
    s.font = Font(name="Calibri", size=10, italic=True, color="475569")
    ws.row_dimensions[1].height = 24


def _instructions_sheet(wb, name, lines):
    ws = wb.create_sheet("Instructions")
    ws.sheet_view.showGridLines = False
    ws.column_dimensions["A"].width = 4
    ws.column_dimensions["B"].width = 100
    ws.cell(row=1, column=2, value=f"{name} — Instructions").font = Font(bold=True, size=16, color=BRAND)
    ws.cell(row=2, column=2, value="AccountantOS — Professional Accounting Platform").font = Font(size=10, italic=True, color="475569")
    r = 4
    for line in lines:
        cell = ws.cell(row=r, column=2, value=f"•  {line}")
        cell.font = Font(size=11, color=DARK)
        cell.alignment = Alignment(wrap_text=True)
        r += 1
    ws.cell(row=r + 1, column=2, value=f"Generated: {datetime.now().strftime('%d.%m.%Y %H:%M')}").font = Font(size=9, italic=True, color="94A3B8")


# (title, subtitle, headers, [column formats], totals_columns, instructions)
TEMPLATES = {
    "chart_of_accounts": {
        "title": "Chart of Accounts", "sub": "Swiss KMU standard account structure",
        "headers": ["Account No.", "Account Name", "Type", "Category", "VAT Code", "Opening Balance", "Notes"],
        "fmt": {6: CURRENCY_FMT}, "totals": [], "dropdowns": {3: ["Asset", "Liability", "Equity", "Revenue", "Expense"]},
        "instructions": ["Fill in your account numbers following the Swiss KMU chart.", "Use the Type dropdown to classify each account.", "Opening Balance is in CHF.", "Do not delete the header row."],
    },
    "trial_balance": {
        "title": "Trial Balance", "sub": "Debit / Credit balances by account",
        "headers": ["Account No.", "Account Name", "Debit", "Credit", "Balance"],
        "fmt": {3: CURRENCY_FMT, 4: CURRENCY_FMT, 5: CURRENCY_FMT}, "totals": [3, 4, 5], "dropdowns": {},
        "instructions": ["Enter debit and credit balances per account.", "Total debits must equal total credits.", "Balance column = Debit - Credit."],
    },
    "general_ledger": {
        "title": "General Ledger", "sub": "Chronological posting journal",
        "headers": ["Date", "Account No.", "Description", "Reference", "Debit", "Credit", "Running Balance"],
        "fmt": {1: DATE_FMT, 5: CURRENCY_FMT, 6: CURRENCY_FMT, 7: CURRENCY_FMT}, "totals": [5, 6], "dropdowns": {},
        "instructions": ["Post each transaction on a new row in date order.", "Every entry must have a matching debit and credit.", "Use the Reference column for document numbers."],
    },
    "ap_aging": {
        "title": "Accounts Payable Aging", "sub": "Outstanding supplier invoices by age bucket",
        "headers": ["Supplier", "Invoice No.", "Invoice Date", "Due Date", "Total", "Current", "1-30", "31-60", "61-90", "90+"],
        "fmt": {3: DATE_FMT, 4: DATE_FMT, 5: CURRENCY_FMT, 6: CURRENCY_FMT, 7: CURRENCY_FMT, 8: CURRENCY_FMT, 9: CURRENCY_FMT, 10: CURRENCY_FMT},
        "totals": [5, 6, 7, 8, 9, 10], "dropdowns": {},
        "instructions": ["Aging buckets are days past due.", "Totals row summarises exposure per bucket.", "Review 90+ column urgently."],
    },
    "ar_aging": {
        "title": "Accounts Receivable Aging", "sub": "Outstanding customer invoices by age bucket",
        "headers": ["Customer", "Invoice No.", "Invoice Date", "Due Date", "Total", "Current", "1-30", "31-60", "61-90", "90+"],
        "fmt": {3: DATE_FMT, 4: DATE_FMT, 5: CURRENCY_FMT, 6: CURRENCY_FMT, 7: CURRENCY_FMT, 8: CURRENCY_FMT, 9: CURRENCY_FMT, 10: CURRENCY_FMT},
        "totals": [5, 6, 7, 8, 9, 10], "dropdowns": {},
        "instructions": ["Aging buckets are days past due.", "Follow up on overdue balances.", "Send reminders for 30+ day items."],
    },
    "vat_summary": {
        "title": "VAT Summary", "sub": "Swiss VAT reconciliation (default rates 8.1% / 2.6% / 3.8%)",
        "headers": ["Period", "Taxable Revenue", "Output VAT", "Deductible Expenses", "Input VAT", "VAT Balance", "Status"],
        "fmt": {2: CURRENCY_FMT, 3: CURRENCY_FMT, 4: CURRENCY_FMT, 5: CURRENCY_FMT, 6: CURRENCY_FMT},
        "totals": [2, 3, 4, 5, 6], "dropdowns": {7: ["Draft", "Filed", "Paid"]},
        "instructions": ["Output VAT = VAT collected on sales.", "Input VAT = VAT paid on purchases.", "VAT Balance = Output VAT - Input VAT (payable if positive)."],
    },
    "bank_reconciliation": {
        "title": "Bank Reconciliation", "sub": "Match bank statement lines to booked entries",
        "headers": ["Date", "Description", "Reference", "Bank Amount", "Book Amount", "Difference", "Status"],
        "fmt": {1: DATE_FMT, 4: CURRENCY_FMT, 5: CURRENCY_FMT, 6: CURRENCY_FMT}, "totals": [4, 5, 6],
        "dropdowns": {7: ["Matched", "Unmatched", "Review"]},
        "instructions": ["Import your bank statement lines here.", "Difference should be 0 when fully reconciled.", "Mark each line Matched or Unmatched."],
    },
    "month_end_close": {
        "title": "Month-End Close Checklist", "sub": "Standard close procedure",
        "headers": ["Task", "Assigned To", "Due Date", "Status", "Notes"],
        "fmt": {3: DATE_FMT}, "totals": [], "dropdowns": {4: ["Pending", "In Progress", "Completed", "Blocked"]},
        "instructions": ["Complete each task before closing the period.", "Assign an owner and due date to every item.", "Do not close until all items are Completed."],
    },
    "expense_tracker": {
        "title": "Expense Tracker", "sub": "Categorised business expenses",
        "headers": ["Date", "Supplier", "Category", "Description", "Net", "VAT", "Gross", "Payment Method"],
        "fmt": {1: DATE_FMT, 5: CURRENCY_FMT, 6: CURRENCY_FMT, 7: CURRENCY_FMT}, "totals": [5, 6, 7],
        "dropdowns": {8: ["Bank Transfer", "Credit Card", "Cash", "Direct Debit"]},
        "instructions": ["Log every business expense.", "Gross = Net + VAT.", "Keep receipts for all entries."],
    },
    "revenue_tracker": {
        "title": "Revenue Tracker", "sub": "Sales income by client",
        "headers": ["Date", "Customer", "Invoice No.", "Description", "Net", "VAT", "Gross", "Status"],
        "fmt": {1: DATE_FMT, 5: CURRENCY_FMT, 6: CURRENCY_FMT, 7: CURRENCY_FMT}, "totals": [5, 6, 7],
        "dropdowns": {8: ["Draft", "Sent", "Paid", "Overdue"]},
        "instructions": ["Record all revenue transactions.", "Gross = Net + VAT.", "Update Status as invoices are paid."],
    },
    "payroll_preparation": {
        "title": "Payroll Preparation", "sub": "Monthly employee payroll",
        "headers": ["Employee", "Gross Salary", "AHV/IV/EO", "ALV", "Pension (BVG)", "Net Salary", "Notes"],
        "fmt": {2: CURRENCY_FMT, 3: CURRENCY_FMT, 4: CURRENCY_FMT, 5: CURRENCY_FMT, 6: CURRENCY_FMT},
        "totals": [2, 3, 4, 5, 6], "dropdowns": {},
        "instructions": ["Enter gross salary and social deductions.", "Net Salary = Gross - deductions.", "Swiss social contributions: AHV/IV/EO, ALV, BVG."],
    },
    "profit_loss": {
        "title": "Profit & Loss Statement", "sub": "Income statement",
        "headers": ["Line Item", "Category", "Current Period", "Prior Period", "Variance"],
        "fmt": {3: CURRENCY_FMT, 4: CURRENCY_FMT, 5: CURRENCY_FMT}, "totals": [3, 4, 5],
        "dropdowns": {2: ["Revenue", "COGS", "Operating Expense", "Other"]},
        "instructions": ["List revenue then expenses.", "Net Profit = Revenue - Expenses.", "Variance = Current - Prior."],
    },
    "balance_sheet": {
        "title": "Balance Sheet", "sub": "Statement of financial position",
        "headers": ["Line Item", "Section", "Current Period", "Prior Period"],
        "fmt": {3: CURRENCY_FMT, 4: CURRENCY_FMT}, "totals": [3, 4],
        "dropdowns": {2: ["Assets", "Liabilities", "Equity"]},
        "instructions": ["Assets = Liabilities + Equity.", "Group items by section.", "Ensure the balance sheet balances."],
    },
    "cash_flow": {
        "title": "Cash Flow Statement", "sub": "Sources and uses of cash",
        "headers": ["Line Item", "Activity", "Amount"],
        "fmt": {3: CURRENCY_FMT}, "totals": [3],
        "dropdowns": {2: ["Operating", "Investing", "Financing"]},
        "instructions": ["Classify each flow by activity.", "Net Cash Flow = sum of all activities.", "Reconcile to opening/closing cash."],
    },
}


def build_template(key: str, rows: list | None = None) -> bytes:
    """Build a styled workbook for the given template key with optional data rows."""
    spec = TEMPLATES[key]
    headers = spec["headers"]
    wb = Workbook()
    ws = wb.active
    ws.title = spec["title"][:31]
    ws.sheet_view.showGridLines = False

    _title_block(ws, spec["title"], spec["sub"], len(headers))
    header_row = 4
    _style_header(ws, headers, row=header_row)
    _autosize(ws, headers)

    rows = rows or []
    start = header_row + 1
    for r_idx, row in enumerate(rows, start=start):
        for c_idx, title in enumerate(headers, start=1):
            val = row.get(title) if isinstance(row, dict) else None
            cell = ws.cell(row=r_idx, column=c_idx, value=val)
            cell.border = BORDER
            if c_idx in spec["fmt"]:
                cell.number_format = spec["fmt"][c_idx]

    # Ensure at least 30 empty formatted rows for manual entry
    total_rows = max(len(rows), 30)
    for r_idx in range(start, start + total_rows):
        for c_idx in range(1, len(headers) + 1):
            cell = ws.cell(row=r_idx, column=c_idx)
            cell.border = BORDER
            if c_idx in spec["fmt"] and cell.value is None:
                cell.number_format = spec["fmt"][c_idx]

    data_end = start + total_rows - 1

    # Totals row
    if spec["totals"]:
        trow = data_end + 1
        tc = ws.cell(row=trow, column=1, value="TOTAL")
        tc.font = Font(bold=True, color=WHITE)
        tc.fill = PatternFill("solid", fgColor=BRAND)
        for c_idx in range(2, len(headers) + 1):
            cell = ws.cell(row=trow, column=c_idx)
            cell.fill = PatternFill("solid", fgColor=BRAND)
            if c_idx in spec["totals"]:
                col = get_column_letter(c_idx)
                cell.value = f"=SUM({col}{start}:{col}{data_end})"
                cell.number_format = spec["fmt"].get(c_idx, CURRENCY_FMT)
                cell.font = Font(bold=True, color=WHITE)

    # Data validation dropdowns
    for col_idx, options in spec.get("dropdowns", {}).items():
        dv = DataValidation(type="list", formula1='"' + ",".join(options) + '"', allow_blank=True)
        ws.add_data_validation(dv)
        col = get_column_letter(col_idx)
        dv.add(f"{col}{start}:{col}{data_end}")

    # Freeze panes below header, enable auto-filter
    ws.freeze_panes = ws.cell(row=start, column=1)
    ws.auto_filter.ref = f"A{header_row}:{get_column_letter(len(headers))}{data_end}"

    _instructions_sheet(wb, spec["title"], spec["instructions"])

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()


def list_templates():
    return [{"key": k, "title": v["title"], "description": v["sub"]} for k, v in TEMPLATES.items()]
