import React, { useEffect, useState } from "react";
import { BarChart3, Download, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import { toast } from "sonner";
import { api, downloadFile } from "@/lib/api";
import { chf } from "@/lib/format";
import { PageHeader, Card, Loading, StatCard, EmptyState } from "@/components/common";
import CompanySelect from "@/components/CompanySelect";
import { useI18n } from "@/i18n/I18nContext";
import { Button } from "@/components/ui/button";

const COLORS = ["hsl(220 100% 50%)", "hsl(160 84% 39%)", "hsl(38 92% 50%)", "hsl(340 82% 52%)", "hsl(262 83% 58%)", "#94a3b8"];

const EXPORTS = [
  { key: "profit_loss", label: "Profit & Loss" },
  { key: "balance_sheet", label: "Balance Sheet" },
  { key: "cash_flow", label: "Cash Flow" },
  { key: "vat_summary", label: "VAT Report" },
  { key: "ap_aging", label: "AP Aging" },
  { key: "ar_aging", label: "AR Aging" },
];

export default function Reports() {
  const { t } = useI18n();
  const [companies, setCompanies] = useState([]);
  const [company, setCompany] = useState("all");
  const [pl, setPl] = useState(null);
  const [byCat, setByCat] = useState([]);
  const [byClient, setByClient] = useState([]);

  const q = () => (company !== "all" ? `?company_id=${company}` : "");
  const load = async () => {
    const [a, b, c] = await Promise.all([
      api.get(`/reports/profit-loss${q()}`),
      api.get(`/reports/expense-by-category${q()}`),
      api.get(`/reports/revenue-by-client${q()}`),
    ]);
    setPl(a.data); setByCat(b.data.data); setByClient(c.data.data);
  };
  useEffect(() => { api.get("/companies").then((r) => setCompanies(r.data)); }, []);
  useEffect(() => { load(); }, [company]);

  const exportExcel = (key) => {
    toast.promise(downloadFile(`/excel/download/${key}${q()}`, `${key}.xlsx`),
      { loading: "Generating…", success: "Downloaded", error: "Failed" });
  };

  if (!pl) return <Loading label="Loading reports" />;

  return (
    <div>
      <PageHeader title={t("pages.reports.title")} subtitle={t("pages.reports.subtitle")} />
      <div className="mb-4"><CompanySelect value={company} onChange={setCompany} companies={companies} /></div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Revenue" value={chf(pl.revenue)} icon={TrendingUp} tone="brand" testid="report-revenue" />
        <StatCard label="Expenses" value={chf(pl.expenses)} icon={TrendingDown} tone="amber" />
        <StatCard label="Net Profit" value={chf(pl.net_profit)} icon={Wallet} tone={pl.net_profit >= 0 ? "green" : "red"} testid="report-profit" />
        <StatCard label="Gross Margin" value={`${pl.gross_margin}%`} icon={BarChart3} tone="slate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="p-5">
          <h3 className="font-display font-semibold text-slate-800 mb-4">Expenses by Category</h3>
          {byCat.length === 0 ? <EmptyState icon={BarChart3} title="No expense data" /> : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={byCat} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(e) => e.name}>
                  {byCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => chf(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card className="p-5">
          <h3 className="font-display font-semibold text-slate-800 mb-4">Revenue by Client</h3>
          {byClient.length === 0 ? <EmptyState icon={BarChart3} title="No revenue data" /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byClient} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} width={100} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => chf(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" fill="hsl(220 100% 50%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="font-display font-semibold text-slate-800 mb-4">Export Reports to Excel</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {EXPORTS.map((e) => (
            <Button key={e.key} variant="outline" className="justify-start h-auto py-3 transition-all hover:-translate-y-[1px]"
              data-testid={`export-${e.key}`} onClick={() => exportExcel(e.key)}>
              <Download className="h-4 w-4 mr-2 text-primary shrink-0" /> <span className="text-xs">{e.label}</span>
            </Button>
          ))}
        </div>
      </Card>
    </div>
  );
}
