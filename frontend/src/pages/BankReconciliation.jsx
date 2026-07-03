import React, { useCallback, useEffect, useRef, useState } from "react";
import { Landmark, Upload, Link2, Link2Off, Download, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { api, downloadFile } from "@/lib/api";
import { chf, fmtDate } from "@/lib/format";
import { PageHeader, Card, Loading, EmptyState, StatCard, TableShell, StatusBadge, Toolbar } from "@/components/common";
import CompanySelect from "@/components/CompanySelect";
import { useI18n } from "@/i18n/I18nContext";
import { Button } from "@/components/ui/button";

export default function BankReconciliation() {
  const { t } = useI18n();
  const [companies, setCompanies] = useState([]);
  const [company, setCompany] = useState("all");
  const [report, setReport] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const load = useCallback(() => {
    const q = company !== "all" ? `?company_id=${company}` : "";
    return api.get(`/bank-transactions/report/reconciliation${q}`).then((r) => setReport(r.data));
  }, [company]);
  useEffect(() => { api.get("/companies").then((r) => setCompanies(r.data)); }, []);
  useEffect(() => { load(); }, [load]);

  const cname = (id) => companies.find((c) => c.id === id)?.name || "—";

  const onUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (company === "all") { toast.error("Select a specific company first"); return; }
    setUploading(true);
    const fd = new FormData();
    fd.append("company_id", company);
    fd.append("file", file);
    try {
      const { data } = await api.post("/bank-transactions/import", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`Imported ${data.imported} transactions`);
      load();
    } catch (e) { toast.error("Import failed"); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const toggle = async (tx) => { await api.post(`/bank-transactions/${tx.id}/match`); load(); };

  const exportExcel = () => {
    const q = company !== "all" ? `?company_id=${company}` : "";
    toast.promise(downloadFile(`/excel/download/bank_reconciliation${q}`, "bank_reconciliation.xlsx"),
      { loading: "Generating…", success: "Downloaded", error: "Failed" });
  };

  if (!report) return <Loading label="Loading bank reconciliation" />;

  return (
    <div>
      <PageHeader title={t("pages.bank.title")} subtitle={t("pages.bank.subtitle")}
        actions={
          <>
            <input type="file" accept=".csv" ref={fileRef} onChange={onUpload} className="hidden" data-testid="csv-file-input" />
            <Button variant="outline" data-testid="import-csv-btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />} Import CSV
            </Button>
            <Button variant="outline" data-testid="export-recon-btn" onClick={exportExcel}><Download className="h-4 w-4 mr-1" /> Export</Button>
          </>
        }
      />
      <Toolbar>
        <CompanySelect value={company} onChange={setCompany} companies={companies} />
        <span className="text-xs text-slate-400">CSV columns supported: date, description, reference, amount</span>
      </Toolbar>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Matched" value={report.matched_count} icon={CheckCircle2} tone="green" testid="stat-matched" />
        <StatCard label="Unmatched" value={report.unmatched_count} icon={XCircle} tone="amber" testid="stat-unmatched" />
        <StatCard label="Matched Total" value={chf(report.matched_total)} tone="green" />
        <StatCard label="Difference" value={chf(report.difference)} icon={Landmark} tone={report.difference === 0 ? "green" : "red"} testid="stat-difference" />
      </div>

      {report.transactions.length === 0 ? (
        <Card className="p-6"><EmptyState icon={Landmark} title="No transactions" desc="Import a bank statement CSV to begin reconciliation." /></Card>
      ) : (
        <TableShell testid="bank-table" title={t("nav.bank")} icon={Landmark} count={report.transactions.length} head={[
          { label: "Date" }, { label: "Description" }, { label: "Company" }, { label: "Reference" },
          { label: "Amount", right: true }, { label: "Status" }, { label: "", right: true },
        ]}>
          {report.transactions.map((t) => (
            <tr key={t.id} className="hover:bg-slate-50 transition-colors" data-testid="bank-row">
              <td className="px-4 py-3 text-slate-600">{fmtDate(t.date)}</td>
              <td className="px-4 py-3 font-medium text-slate-800">{t.description}</td>
              <td className="px-4 py-3 text-slate-600">{cname(t.company_id)}</td>
              <td className="px-4 py-3 text-slate-500 font-mono text-xs">{t.reference}</td>
              <td className={`px-4 py-3 text-right font-mono ${t.amount < 0 ? "text-red-600" : "text-emerald-600"}`}>{chf(t.amount)}</td>
              <td className="px-4 py-3"><StatusBadge status={t.matched ? "matched" : "unmatched"} /></td>
              <td className="px-4 py-3 text-right">
                <Button size="sm" variant={t.matched ? "outline" : "default"} className="h-7" data-testid="match-btn" onClick={() => toggle(t)}>
                  {t.matched ? <><Link2Off className="h-3.5 w-3.5 mr-1" /> Unmatch</> : <><Link2 className="h-3.5 w-3.5 mr-1" /> Match</>}
                </Button>
              </td>
            </tr>
          ))}
        </TableShell>
      )}
    </div>
  );
}
