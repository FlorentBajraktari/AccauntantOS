import React, { useEffect, useState } from "react";
import { Receipt, Download, ArrowUpRight, ArrowDownRight, Scale } from "lucide-react";
import { toast } from "sonner";
import { api, downloadFile } from "@/lib/api";
import { chf } from "@/lib/format";
import { PageHeader, Card, Loading, StatCard, StatusBadge, TableShell, EmptyState, Toolbar } from "@/components/common";
import CompanySelect from "@/components/CompanySelect";
import { useI18n } from "@/i18n/I18nContext";
import { Button } from "@/components/ui/button";

export default function VAT() {
  const { t } = useI18n();
  const [companies, setCompanies] = useState([]);
  const [company, setCompany] = useState("all");
  const [data, setData] = useState(null);

  const load = () => {
    const q = company !== "all" ? `?company_id=${company}` : "";
    return api.get(`/vat/summary${q}`).then((r) => setData(r.data));
  };
  useEffect(() => { api.get("/companies").then((r) => setCompanies(r.data)); }, []);
  useEffect(() => { load(); }, [company]);

  const exportExcel = () => {
    const q = company !== "all" ? `?company_id=${company}` : "";
    toast.promise(downloadFile(`/excel/download/vat_summary${q}`, "vat_summary.xlsx"),
      { loading: "Generating…", success: "Downloaded", error: "Failed" });
  };

  if (!data) return <Loading label="Loading VAT" />;
  const payable = data.vat_balance >= 0;

  return (
    <div>
      <PageHeader title={t("pages.vat.title")} subtitle={t("pages.vat.subtitle")}
        actions={<Button variant="outline" data-testid="export-vat-btn" onClick={exportExcel}><Download className="h-4 w-4 mr-1" /> {t("common.export")}</Button>}
      />
      <Toolbar>
        <CompanySelect value={company} onChange={setCompany} companies={companies} />
        <div className="flex items-center gap-1.5">
          {data.rates.map((r) => (
            <span key={r} className="text-xs font-medium px-2 py-1 rounded-md bg-primary/10 text-primary font-mono">{r}%</span>
          ))}
          <span className="text-xs text-slate-400 ml-1">standard / reduced / accommodation</span>
        </div>
      </Toolbar>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Output VAT (Sales)" value={chf(data.output_vat)} icon={ArrowUpRight} tone="brand" testid="stat-output-vat" />
        <StatCard label="Input VAT (Purchases)" value={chf(data.input_vat)} icon={ArrowDownRight} tone="green" testid="stat-input-vat" />
        <StatCard label={payable ? "VAT Payable" : "VAT Credit"} value={chf(Math.abs(data.vat_balance))} icon={Scale} tone={payable ? "red" : "green"} testid="stat-vat-balance" />
        <StatCard label="Taxable Revenue" value={chf(data.taxable_revenue)} icon={Receipt} tone="slate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h3 className="font-display font-semibold text-slate-800 mb-4">VAT Calculation</h3>
          <div className="space-y-2 text-sm">
            {[
              ["Taxable Revenue", chf(data.taxable_revenue)],
              ["Output VAT collected", chf(data.output_vat)],
              ["Deductible Expenses", chf(data.deductible_expenses)],
              ["Input VAT paid", chf(data.input_vat)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">{k}</span><span className="font-mono font-medium text-slate-800">{v}</span>
              </div>
            ))}
            <div className="flex justify-between py-3 mt-2 rounded-md bg-slate-50 px-3">
              <span className="font-semibold text-slate-700">{payable ? "VAT Payable to FTA" : "VAT Refund"}</span>
              <span className={`font-mono font-bold ${payable ? "text-red-600" : "text-emerald-600"}`}>{chf(Math.abs(data.vat_balance))}</span>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-display font-semibold text-slate-800 mb-4">VAT Returns</h3>
          {data.returns.length === 0 ? (
            <EmptyState icon={Receipt} title="No VAT returns filed" desc="Filed returns will appear here." />
          ) : (
            <TableShell testid="vat-returns-table" head={[{ label: "Period" }, { label: "Balance", right: true }, { label: "Status" }]}>
              {data.returns.map((r) => (
                <tr key={r.id}><td className="px-4 py-2">{r.period}</td>
                  <td className="px-4 py-2 text-right font-mono">{chf((r.output_vat || 0) - (r.input_vat || 0))}</td>
                  <td className="px-4 py-2"><StatusBadge status={r.status} /></td></tr>
              ))}
            </TableShell>
          )}
        </Card>
      </div>
    </div>
  );
}
