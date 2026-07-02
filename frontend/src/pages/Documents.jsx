import React, { useEffect, useState } from "react";
import { FileText, Plus, Sparkles, Trash2, Loader2, Filter } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { chf, fmtDate } from "@/lib/format";
import { PageHeader, Card, Loading, EmptyState, StatusBadge, TableShell, Toolbar } from "@/components/common";
import CompanySelect from "@/components/CompanySelect";
import { useI18n } from "@/i18n/I18nContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const CATS = ["Invoice", "Receipt", "Bank Statement", "Payroll", "Contract", "Tax Document", "Other"];
const STATUSES = ["uploaded", "reviewed", "booked", "rejected"];

export default function Documents() {
  const { t } = useI18n();
  const [companies, setCompanies] = useState([]);
  const [docs, setDocs] = useState(null);
  const [company, setCompany] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [ocrDoc, setOcrDoc] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [form, setForm] = useState({ company_id: "", name: "", category: "Invoice", amount: 0, vat_amount: 0, counterparty: "", status: "uploaded", notes: "" });

  const load = () => {
    let url = "/documents";
    const params = [];
    if (company !== "all") params.push(`company_id=${company}`);
    if (statusFilter !== "all") params.push(`status=${statusFilter}`);
    if (params.length) url += "?" + params.join("&");
    return api.get(url).then((r) => setDocs(r.data));
  };

  useEffect(() => { api.get("/companies").then((r) => setCompanies(r.data)); }, []);
  useEffect(() => { load(); }, [company, statusFilter]);

  const cname = (id) => companies.find((c) => c.id === id)?.name || "—";

  const create = async () => {
    if (!form.company_id) { toast.error("Select a company"); return; }
    if (!form.name.trim()) { toast.error("Document name required"); return; }
    try {
      await api.post("/documents", { ...form, amount: Number(form.amount), vat_amount: Number(form.vat_amount) });
      toast.success("Document added · review task created");
      setOpen(false); setForm({ ...form, name: "", amount: 0, vat_amount: 0, counterparty: "", notes: "" });
      load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const runOcr = async (doc) => {
    setOcrDoc(doc); setOcrLoading(true);
    try {
      const { data } = await api.post(`/documents/${doc.id}/ocr`);
      setOcrDoc({ ...doc, ocr: data });
      toast.success("AI extraction complete");
      load();
    } catch (e) { toast.error("OCR failed"); setOcrDoc(null); }
    finally { setOcrLoading(false); }
  };

  const changeStatus = async (doc, status) => {
    await api.put(`/documents/${doc.id}`, { ...doc, status });
    toast.success(`Marked ${status}`); load();
  };

  const del = async (id) => { await api.delete(`/documents/${id}`); toast.success("Deleted"); load(); };

  if (!docs) return <Loading label="Loading documents" />;

  return (
    <div>
      <PageHeader
        title={t("pages.documents.title")}
        subtitle={t("pages.documents.subtitle")}
        actions={<Button data-testid="add-document-btn" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> {t("common.add")}</Button>}
      />

      <Toolbar>
        <CompanySelect value={company} onChange={setCompany} companies={companies} />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] bg-white" data-testid="status-filter"><Filter className="h-4 w-4 mr-1 text-slate-400" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.allStatuses")}</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </Toolbar>

      {docs.length === 0 ? (
        <Card className="p-6"><EmptyState icon={FileText} title="No documents" desc="Add a document to trigger a review task and AI extraction." /></Card>
      ) : (
        <TableShell testid="documents-table" title={t("nav.documents")} icon={FileText} count={docs.length} head={[
          { label: "Document" }, { label: "Company" }, { label: "Category" }, { label: "Date" },
          { label: "Amount", right: true }, { label: "VAT", right: true }, { label: "Status" }, { label: "Actions", right: true },
        ]}>
          {docs.map((d) => (
            <tr key={d.id} className="hover:bg-slate-50 transition-colors" data-testid="document-row">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-400" />
                  <div>
                    <p className="font-medium text-slate-800">{d.name}</p>
                    {d.ocr && <p className="text-[11px] text-primary">✓ AI extracted ({d.ocr.engine})</p>}
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-slate-600">{cname(d.company_id)}</td>
              <td className="px-4 py-3 text-slate-600">{d.category}</td>
              <td className="px-4 py-3 text-slate-600">{fmtDate(d.date)}</td>
              <td className="px-4 py-3 text-right font-mono text-slate-700">{chf(d.amount)}</td>
              <td className="px-4 py-3 text-right font-mono text-slate-500">{chf(d.vat_amount)}</td>
              <td className="px-4 py-3">
                <Select value={d.status} onValueChange={(v) => changeStatus(d, v)}>
                  <SelectTrigger className="h-7 w-[120px] border-0 p-0 shadow-none" data-testid="doc-status-select">
                    <StatusBadge status={d.status} />
                  </SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                </Select>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <Button size="sm" variant="outline" className="h-7" data-testid="run-ocr-btn" onClick={() => runOcr(d)}>
                    <Sparkles className="h-3.5 w-3.5 mr-1 text-primary" /> Extract
                  </Button>
                  <button onClick={() => del(d.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              </td>
            </tr>
          ))}
        </TableShell>
      )}

      {/* Add document dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Document</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Company</Label>
              <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v })}>
                <SelectTrigger className="mt-1" data-testid="doc-company-select"><SelectValue placeholder="Select company" /></SelectTrigger>
                <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>File name</Label><Input data-testid="doc-name" value={form.name} className="mt-1" placeholder="invoice_2025_001.pdf" onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="mt-1" data-testid="doc-category"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Amount (CHF)</Label><Input type="number" data-testid="doc-amount" value={form.amount} className="mt-1" onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div><Label>VAT (CHF)</Label><Input type="number" data-testid="doc-vat" value={form.vat_amount} className="mt-1" onChange={(e) => setForm({ ...form, vat_amount: e.target.value })} /></div>
              <div className="col-span-2"><Label>Supplier / Customer</Label><Input data-testid="doc-counterparty" value={form.counterparty} className="mt-1" onChange={(e) => setForm({ ...form, counterparty: e.target.value })} /></div>
              <div className="col-span-2"><Label>Notes</Label><Textarea data-testid="doc-notes" value={form.notes} className="mt-1" onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} data-testid="save-document-btn">Add Document</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* OCR result dialog */}
      <Dialog open={!!ocrDoc} onOpenChange={() => setOcrDoc(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> AI Extraction</DialogTitle></DialogHeader>
          {ocrLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-500"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Extracting fields…</div>
          ) : ocrDoc?.ocr ? (
            <div className="space-y-2" data-testid="ocr-result">
              {[
                ["Invoice Number", ocrDoc.ocr.invoice_number], ["Supplier", ocrDoc.ocr.supplier],
                ["Date", fmtDate(ocrDoc.ocr.date)], ["Total Amount", chf(ocrDoc.ocr.total_amount)],
                ["VAT Amount", chf(ocrDoc.ocr.vat_amount)], ["VAT Rate", `${ocrDoc.ocr.vat_rate}%`],
                ["Currency", ocrDoc.ocr.currency], ["IBAN", ocrDoc.ocr.iban],
                ["Suggested Category", ocrDoc.ocr.suggested_category],
                ["Confidence", `${Math.round((ocrDoc.ocr.confidence || 0) * 100)}%`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-2 border-b border-slate-100 text-sm">
                  <span className="text-slate-500">{k}</span>
                  <span className="font-medium text-slate-800 font-mono">{v}</span>
                </div>
              ))}
              <p className="text-xs text-slate-400 pt-2">Engine: {ocrDoc.ocr.engine} · Fields applied to document.</p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
