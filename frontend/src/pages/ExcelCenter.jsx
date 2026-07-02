import React, { useEffect, useState, useMemo } from "react";
import {
  FileSpreadsheet, Download, Search, BarChart3, BookOpen, ArrowLeftRight, Landmark,
  Settings2, ListTree, Scale, ArrowDownCircle, ArrowUpCircle, Receipt, CheckSquare,
  TrendingDown, TrendingUp, Users, Waves, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { api, downloadFile } from "@/lib/api";
import { useI18n } from "@/i18n/I18nContext";
import { PageHeader, Card, Loading, EmptyState } from "@/components/common";
import CompanySelect from "@/components/CompanySelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CATEGORY_META = {
  "Financial Statements": { icon: BarChart3, tone: "bg-blue-50 text-blue-600" },
  "Ledgers & Accounts": { icon: BookOpen, tone: "bg-violet-50 text-violet-600" },
  "Payables & Receivables": { icon: ArrowLeftRight, tone: "bg-amber-50 text-amber-600" },
  "VAT & Bank": { icon: Landmark, tone: "bg-emerald-50 text-emerald-600" },
  Operations: { icon: Settings2, tone: "bg-rose-50 text-rose-600" },
};
const CATEGORY_ORDER = ["Financial Statements", "Ledgers & Accounts", "Payables & Receivables", "VAT & Bank", "Operations"];

const TPL_ICON = {
  "list-tree": ListTree, scale: Scale, "book-open": BookOpen, "arrow-down-circle": ArrowDownCircle,
  "arrow-up-circle": ArrowUpCircle, receipt: Receipt, landmark: Landmark, "check-square": CheckSquare,
  "trending-down": TrendingDown, "trending-up": TrendingUp, users: Users, "bar-chart-3": BarChart3, waves: Waves,
};

export default function ExcelCenter() {
  const { t } = useI18n();
  const [templates, setTemplates] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [company, setCompany] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    api.get("/excel/templates").then((r) => setTemplates(r.data.templates));
    api.get("/companies").then((r) => setCompanies(r.data));
  }, []);

  const download = (key, title) => {
    const q = company !== "all" ? `?company_id=${company}` : "";
    toast.promise(downloadFile(`/excel/download/${key}${q}`, `${key}.xlsx`),
      { loading: `Generating ${title}…`, success: `${title} downloaded`, error: "Export failed" });
  };

  const grouped = useMemo(() => {
    if (!templates) return {};
    const q = query.trim().toLowerCase();
    const filtered = q
      ? templates.filter((t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
      : templates;
    return filtered.reduce((acc, t) => {
      (acc[t.category] = acc[t.category] || []).push(t);
      return acc;
    }, {});
  }, [templates, query]);

  if (!templates) return <Loading label={t("common.loading")} />;

  const cats = CATEGORY_ORDER.filter((c) => grouped[c]?.length);
  const selectedCompany = companies.find((c) => c.id === company);

  return (
    <div>
      <PageHeader title={t("pages.excel.title")} subtitle={t("pages.excel.subtitle")} />

      {/* Toolbar */}
      <Card className="p-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
              <FileSpreadsheet className="h-5 w-5 text-primary" strokeWidth={1.6} />
            </div>
            <div>
              <p className="font-semibold text-slate-800">{templates.length} templates</p>
              <p className="text-xs text-slate-400">Styled · frozen panes · filters · instructions</p>
            </div>
          </div>
          <div className="relative flex-1 max-w-sm lg:ml-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input data-testid="excel-search" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates…" className="pl-9 h-9 bg-slate-50 border-slate-200" />
          </div>
          <div className="lg:ml-auto flex items-center gap-2">
            <CompanySelect value={company} onChange={setCompany} companies={companies} />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {selectedCompany
            ? `Data-backed templates will auto-fill with ${selectedCompany.name}'s records.`
            : "Select a company to auto-fill data-backed templates (AP/AR, VAT, Bank, P&L…)."}
        </div>
      </Card>

      {cats.length === 0 ? (
        <Card className="p-6"><EmptyState icon={FileSpreadsheet} title="No templates found" desc="Try a different search term." /></Card>
      ) : (
        <div className="space-y-8">
          {cats.map((cat) => {
            const meta = CATEGORY_META[cat] || { icon: FileSpreadsheet, tone: "bg-slate-100 text-slate-600" };
            const CatIcon = meta.icon;
            return (
              <section key={cat} data-testid="excel-category">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className={`h-8 w-8 rounded-md flex items-center justify-center ${meta.tone}`}>
                    <CatIcon className="h-[18px] w-[18px]" strokeWidth={1.6} />
                  </div>
                  <h3 className="font-display font-semibold text-slate-800">{cat}</h3>
                  <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{grouped[cat].length}</span>
                  <div className="flex-1 h-px bg-slate-200 ml-2" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {grouped[cat].map((tpl) => {
                    const Icon = TPL_ICON[tpl.icon] || FileSpreadsheet;
                    return (
                      <Card key={tpl.key} className="p-5 flex flex-col group transition-all duration-200 hover:shadow-md hover:-translate-y-[2px] hover:border-primary/40" data-testid="excel-template-card">
                        <div className="flex items-start justify-between">
                          <div className="h-11 w-11 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                            <Icon className="h-5 w-5 text-primary" strokeWidth={1.6} />
                          </div>
                          <FileSpreadsheet className="h-4 w-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                        </div>
                        <h4 className="font-display font-semibold text-slate-800 leading-tight mt-4">{tpl.title}</h4>
                        <p className="text-xs text-slate-500 mt-1 flex-1 leading-relaxed">{tpl.description}</p>
                        <Button variant="outline" className="mt-4 w-full h-9 transition-all group-hover:bg-primary group-hover:text-white group-hover:border-primary"
                          data-testid={`download-${tpl.key}`} onClick={() => download(tpl.key, tpl.title)}>
                          <Download className="h-4 w-4 mr-1.5" /> {t("common.download")} .xlsx
                        </Button>
                      </Card>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
