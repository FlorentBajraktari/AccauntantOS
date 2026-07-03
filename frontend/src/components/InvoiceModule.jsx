import React, { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Download, AlertTriangle, Wallet, Users } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail, downloadFile } from "@/lib/api";
import { chf, fmtDate, daysUntil } from "@/lib/format";
import { PageHeader, Card, Loading, EmptyState, StatusBadge, StatCard, TableShell, Toolbar } from "@/components/common";
import CompanySelect from "@/components/CompanySelect";
import { useI18n } from "@/i18n/I18nContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const PAY_STATUS = ["unpaid", "partial", "paid", "overdue"];

export default function InvoiceModule({ type, partyField, title, subtitle, excelKey }) {
  const isAP = type === "payables";
  const { t } = useI18n();
  const [companies, setCompanies] = useState([]);
  const [company, setCompany] = useState("all");
  const [report, setReport] = useState(null);
  const [open, setOpen] = useState(false);
  const blank = {
    company_id: "", [partyField]: "", invoice_number: "", invoice_date: new Date().toISOString().slice(0, 10),
    due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), amount: 0, vat: 0,
    payment_status: "unpaid", payment_method: "Bank Transfer", notes: "",
  };
  const [form, setForm] = useState(blank);

  const load = useCallback(() => {
    const q = company !== "all" ? `?company_id=${company}` : "";
    return api.get(`/${type}/report/aging${q}`).then((r) => setReport(r.data));
  }, [company, type]);
  useEffect(() => { api.get("/companies").then((r) => setCompanies(r.data)); }, []);
  useEffect(() => { load(); }, [load]);

  const cname = (id) => companies.find((c) => c.id === id)?.name || "—";
  const balances = report ? (isAP ? report.supplier_balances : report.customer_balances) : {};

  const create = async () => {
    if (!form.company_id || !form[partyField]) { toast.error("Company and " + partyField + " are required"); return; }
    try {
      await api.post(`/${type}`, { ...form, amount: Number(form.amount), vat: Number(form.vat) });
      toast.success("Invoice added"); setOpen(false); setForm(blank); load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const setStatus = async (item, payment_status) => {
    await api.put(`/${type}/${item.id}`, { ...item, payment_status });
    toast.success(`Marked ${payment_status}`); load();
  };
  const del = async (id) => { await api.delete(`/${type}/${id}`); toast.success("Deleted"); load(); };

  const exportExcel = () => {
    const q = company !== "all" ? `?company_id=${company}` : "";
    toast.promise(downloadFile(`/excel/download/${excelKey}${q}`, `${excelKey}.xlsx`), {
      loading: "Generating Excel…", success: "Excel downloaded", error: "Export failed",
    });
  };

  if (!report) return <Loading label={`Loading ${title}`} />;
  const a = report.aging;

  return (
    <div>
      <PageHeader title={t(`pages.${type}.title`)} subtitle={t(`pages.${type}.subtitle`)}
        actions={
          <>
            <Button variant="outline" data-testid="export-aging-btn" onClick={exportExcel}><Download className="h-4 w-4 mr-1" /> {t("invoice.exportAging")}</Button>
            <Button data-testid="add-invoice-btn" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> {t("invoice.addInvoice")}</Button>
          </>
        }
      />

      <Toolbar>
        <CompanySelect value={company} onChange={setCompany} companies={companies} />
      </Toolbar>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard label={t("invoice.outstanding")} value={chf(a.total)} icon={Wallet} tone="brand" testid="stat-outstanding" />
        <StatCard label={t("invoice.current")} value={chf(a.current)} tone="green" />
        <StatCard label={`1-30 ${t("common.days")}`} value={chf(a.b1_30)} tone="amber" />
        <StatCard label={`31-60 ${t("common.days")}`} value={chf(a.b31_60)} tone="amber" />
        <StatCard label={`61-90 ${t("common.days")}`} value={chf(a.b61_90)} tone="red" />
        <StatCard label={`90+ ${t("common.days")}`} value={chf(a.b90)} icon={AlertTriangle} tone="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {report.items.length === 0 ? (
            <Card className="p-6"><EmptyState icon={Wallet} title={t("invoice.noInvoices")} desc="" /></Card>
          ) : (
            <TableShell testid={`${type}-table`} title={t(`pages.${type}.title`)} icon={Wallet} count={report.items.length} head={[
              { label: isAP ? "Supplier" : "Customer" }, { label: "Invoice" }, { label: "Company" },
              { label: "Due" }, { label: "Amount", right: true }, { label: "Status" }, { label: "", right: true },
            ]}>
              {report.items.map((it) => {
                const overdue = it.payment_status !== "paid" && daysUntil(it.due_date) < 0;
                return (
                  <tr key={it.id} className="hover:bg-slate-50 transition-colors" data-testid="invoice-row">
                    <td className="px-4 py-3 font-medium text-slate-800">{it[partyField]}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">{it.invoice_number}</td>
                    <td className="px-4 py-3 text-slate-600">{cname(it.company_id)}</td>
                    <td className={`px-4 py-3 ${overdue ? "text-red-600 font-medium" : "text-slate-600"}`}>{fmtDate(it.due_date)}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">{chf((it.amount || 0) + (it.vat || 0))}</td>
                    <td className="px-4 py-3">
                      <Select value={it.payment_status} onValueChange={(v) => setStatus(it, v)}>
                        <SelectTrigger className="h-7 w-[110px] border-0 p-0 shadow-none" data-testid="payment-status-select"><StatusBadge status={overdue && it.payment_status === "unpaid" ? "overdue" : it.payment_status} /></SelectTrigger>
                        <SelectContent>{PAY_STATUS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3 text-right"><button onClick={() => del(it.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                );
              })}
            </TableShell>
          )}
        </div>

        <Card className="p-5 h-fit">
          <h3 className="font-display font-semibold text-slate-800 flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-primary" /> {isAP ? t("invoice.supplierBalances") : t("invoice.customerBalances")}
          </h3>
          {Object.keys(balances).length === 0 ? (
            <p className="text-sm text-slate-400">No open balances.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(balances).sort((x, y) => y[1] - x[1]).map(([name, bal]) => (
                <div key={name} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <span className="text-sm text-slate-700">{name}</span>
                  <span className="text-sm font-mono font-medium text-slate-900">{chf(bal)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New {isAP ? "Supplier" : "Customer"} Invoice</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Company</Label>
              <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v })}>
                <SelectTrigger className="mt-1" data-testid="inv-company"><SelectValue placeholder="Select company" /></SelectTrigger>
                <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label className="capitalize">{partyField}</Label><Input data-testid="inv-party" value={form[partyField]} className="mt-1" onChange={(e) => setForm({ ...form, [partyField]: e.target.value })} /></div>
            <div><Label>Invoice No.</Label><Input data-testid="inv-number" value={form.invoice_number} className="mt-1" onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} /></div>
            <div>
              <Label>Payment Status</Label>
              <Select value={form.payment_status} onValueChange={(v) => setForm({ ...form, payment_status: v })}>
                <SelectTrigger className="mt-1" data-testid="inv-status"><SelectValue /></SelectTrigger>
                <SelectContent>{PAY_STATUS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Invoice Date</Label><Input type="date" data-testid="inv-date" value={form.invoice_date} className="mt-1" onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} /></div>
            <div><Label>Due Date</Label><Input type="date" data-testid="inv-due" value={form.due_date} className="mt-1" onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
            <div><Label>Amount (CHF)</Label><Input type="number" data-testid="inv-amount" value={form.amount} className="mt-1" onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div><Label>VAT (CHF)</Label><Input type="number" data-testid="inv-vat" value={form.vat} className="mt-1" onChange={(e) => setForm({ ...form, vat: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} data-testid="save-invoice-btn">Add Invoice</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
