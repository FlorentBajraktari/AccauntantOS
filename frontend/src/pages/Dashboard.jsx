import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2, ListTodo, FileWarning, AlertTriangle, Receipt, TrendingUp,
  FileText, CalendarClock, Plus, Upload, FileSpreadsheet, ArrowRight,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area,
} from "recharts";
import { api } from "@/lib/api";
import { chf, fmtDate, daysUntil } from "@/lib/format";
import { useI18n } from "@/i18n/I18nContext";
import { PageHeader, StatCard, Card, Loading, StatusBadge, EmptyState } from "@/components/common";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const navigate = useNavigate();
  const { t } = useI18n();

  useEffect(() => {
    api.get("/dashboard").then((r) => setData(r.data)).catch(() => { });
  }, []);

  if (!data) return <Loading label={t("common.loading")} />;

  const stats = [
    { label: t("dashboard.companies"), value: data.total_companies, icon: Building2, tone: "brand", testid: "stat-companies", go: "/companies" },
    { label: t("dashboard.pendingTasks"), value: data.pending_tasks, icon: ListTodo, tone: "amber", testid: "stat-tasks", go: "/month-end" },
    { label: t("dashboard.missingDocs"), value: data.missing_documents, icon: FileWarning, tone: "red", testid: "stat-missing", go: "/documents" },
    { label: t("dashboard.overdueInvoices"), value: data.overdue_invoices, icon: AlertTriangle, tone: "red", testid: "stat-overdue", sub: chf(data.overdue_amount), go: "/payables" },
    { label: t("dashboard.openVat"), value: data.open_vat_deadlines, icon: Receipt, tone: "brand", testid: "stat-vat", go: "/vat" },
    { label: t("dashboard.monthlyRevenue"), value: chf(data.monthly_revenue), icon: TrendingUp, tone: "green", testid: "stat-revenue", go: "/reports" },
  ];

  return (
    <div>
      <PageHeader
        title={t("dashboard.title")}
        subtitle={t("dashboard.subtitle")}
        actions={
          <>
            <Button variant="outline" data-testid="quick-add-company" onClick={() => navigate("/companies?new=1")}>
              <Plus className="h-4 w-4 mr-1" /> {t("common.company")}
            </Button>
            <Button data-testid="quick-excel" onClick={() => navigate("/excel")}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> {t("nav.excel")}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {stats.map((s, i) => (
          <button
            key={s.label}
            type="button"
            onClick={() => s.go && navigate(s.go)}
            data-testid={`${s.testid}-link`}
            style={{ animationDelay: `${i * 60}ms` }}
            className="text-left group rounded-md animate-fade-up focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 cursor-pointer"
          >
            <StatCard {...s} clickable />
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-slate-800">{t("dashboard.revVsExp")}</h3>
            <span className="text-xs text-slate-400">{t("dashboard.last6")} · CHF</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.monthly_series} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={70}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => chf(v)} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Bar dataKey="revenue" name="Revenue" fill="hsl(220 100% 50%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="font-display font-semibold text-slate-800 mb-1">{t("dashboard.profitLoss")}</h3>
          <p className="text-xs text-slate-400 mb-3">{t("dashboard.cumulative")}</p>
          <p className={`text-3xl font-display font-bold tabular-nums ${data.profit_loss >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {chf(data.profit_loss)}
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={data.monthly_series}>
              <defs>
                <linearGradient id="pl" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(220 100% 50%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(220 100% 50%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" hide />
              <Tooltip formatter={(v) => chf(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="profit" stroke="hsl(220 100% 50%)" strokeWidth={2} fill="url(#pl)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-slate-800 flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> {t("dashboard.recentDocs")}
            </h3>
            <button className="text-xs text-primary hover:underline flex items-center gap-1" onClick={() => navigate("/documents")}>
              {t("common.viewAll")} <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          {data.recent_documents.length === 0 ? (
            <EmptyState icon={FileText} title={t("dashboard.noDocs")} desc={t("dashboard.noDocsDesc")} />
          ) : (
            <div className="space-y-2">
              {data.recent_documents.map((d) => (
                <div key={d.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0" data-testid="recent-doc-row">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{d.name}</p>
                    <p className="text-xs text-slate-400">{d.category} · {fmtDate(d.date)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-slate-700">{chf(d.amount)}</span>
                    <StatusBadge status={d.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-slate-800 flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" /> {t("dashboard.upcoming")}
            </h3>
          </div>
          {data.upcoming_deadlines.length === 0 ? (
            <EmptyState icon={CalendarClock} title={t("dashboard.noDeadlines")} />
          ) : (
            <div className="space-y-2">
              {data.upcoming_deadlines.map((d) => {
                const days = daysUntil(d.due_date);
                return (
                  <div key={d.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0" data-testid="deadline-row">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{d.title}</p>
                      <p className="text-xs text-slate-400">{d.type} · {fmtDate(d.due_date)}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${days <= 3 ? "bg-red-50 text-red-600" : days <= 10 ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500"}`}>
                      {days <= 0 ? t("common.due") : `${days} ${t("common.days")}`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
