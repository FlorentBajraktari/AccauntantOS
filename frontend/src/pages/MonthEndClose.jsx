import React, { useEffect, useState } from "react";
import { CheckSquare, Download, Plus } from "lucide-react";
import { toast } from "sonner";
import { api, downloadFile, formatApiErrorDetail } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { PageHeader, Card, Loading, EmptyState, StatusBadge, Toolbar } from "@/components/common";
import CompanySelect from "@/components/CompanySelect";
import { useI18n } from "@/i18n/I18nContext";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUSES = ["pending", "in_progress", "completed", "blocked"];

export default function MonthEndClose() {
  const { t } = useI18n();
  const [companies, setCompanies] = useState([]);
  const [company, setCompany] = useState("all");
  const [items, setItems] = useState(null);

  const load = () => {
    const q = company !== "all" ? `?company_id=${company}` : "";
    return api.get(`/checklist${q}`).then((r) => setItems(r.data));
  };
  useEffect(() => { api.get("/companies").then((r) => setCompanies(r.data)); }, []);
  useEffect(() => { load(); }, [company]);

  const cname = (id) => companies.find((c) => c.id === id)?.name || "—";

  const update = async (item, patch) => {
    await api.put(`/checklist/${item.id}`, { ...item, ...patch });
    load();
  };

  const exportExcel = () => {
    const q = company !== "all" ? `?company_id=${company}` : "";
    toast.promise(downloadFile(`/excel/download/month_end_close${q}`, "month_end_close.xlsx"),
      { loading: "Generating…", success: "Downloaded", error: "Failed" });
  };

  if (!items) return <Loading label="Loading checklist" />;

  // group by company
  const groups = {};
  items.forEach((it) => { (groups[it.company_id] = groups[it.company_id] || []).push(it); });

  return (
    <div>
      <PageHeader title={t("pages.monthEnd.title")} subtitle={t("pages.monthEnd.subtitle")}
        actions={<Button variant="outline" data-testid="export-checklist-btn" onClick={exportExcel}><Download className="h-4 w-4 mr-1" /> {t("common.export")}</Button>}
      />
      <Toolbar><CompanySelect value={company} onChange={setCompany} companies={companies} /></Toolbar>

      {items.length === 0 ? (
        <Card className="p-6"><EmptyState icon={CheckSquare} title="No checklist items" /></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Object.entries(groups).map(([cid, list]) => {
            const done = list.filter((i) => i.status === "completed").length;
            const pct = Math.round((done / list.length) * 100);
            return (
              <Card key={cid} className="p-5" data-testid="close-group">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-display font-semibold text-slate-800">{cname(cid)}</h3>
                  <span className="text-xs text-slate-500">{done}/{list.length} · {list[0]?.period}</span>
                </div>
                <Progress value={pct} className="h-2 mb-4" />
                <div className="space-y-1">
                  {list.map((it) => (
                    <div key={it.id} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0" data-testid="checklist-item">
                      <Checkbox
                        checked={it.status === "completed"}
                        data-testid="checklist-checkbox"
                        onCheckedChange={(c) => update(it, { status: c ? "completed" : "pending" })}
                      />
                      <span className={`flex-1 text-sm ${it.status === "completed" ? "line-through text-slate-400" : "text-slate-700"}`}>{it.task}</span>
                      <Select value={it.status} onValueChange={(v) => update(it, { status: v })}>
                        <SelectTrigger className="h-7 w-[130px] border-0 p-0 shadow-none"><StatusBadge status={it.status} /></SelectTrigger>
                        <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
