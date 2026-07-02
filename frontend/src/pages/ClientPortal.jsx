import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  Search, FileText, MessageSquareText, CalendarClock, AlertTriangle, Send,
  Mail, Phone, MapPin, Users2, Building2, CheckCircle2, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useI18n } from "@/i18n/I18nContext";
import { chf, fmtDate, daysUntil } from "@/lib/format";
import { PageHeader, Card, Loading, EmptyState, StatusBadge } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ClientPortal() {
  const { t } = useI18n();
  const { id } = useParams();
  const [companies, setCompanies] = useState([]);
  const [company, setCompany] = useState(id || "");
  const [data, setData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [query, setQuery] = useState("");

  useEffect(() => {
    api.get("/companies").then((r) => {
      setCompanies(r.data);
      if (!company && r.data.length) setCompany(r.data[0].id);
    });
  }, []);
  useEffect(() => { if (company) { setData(null); api.get(`/portal/${company}`).then((r) => setData(r.data)); } }, [company]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? companies.filter((c) => c.name.toLowerCase().includes(q) || (c.contact_person || "").toLowerCase().includes(q)) : companies;
  }, [companies, query]);

  const answer = async (que) => {
    const a = answers[que.id];
    if (!a) return;
    await api.put(`/questions/${que.id}`, { ...que, answer: a, status: "answered" });
    toast.success(t("cp.answered"));
    api.get(`/portal/${company}`).then((r) => setData(r.data));
  };

  const openQuestions = data ? data.questions.filter((q) => q.status === "open").length : 0;

  return (
    <div>
      <PageHeader title={t("pages.portal.title")} subtitle={t("pages.portal.subtitle")} />

      {/* Client picker */}
      <Card className="p-4 mb-6">
        <div className="relative max-w-md mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input data-testid="portal-client-search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={t("cp.search")} className="pl-9 h-10 bg-slate-50 border-slate-200" />
        </div>
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-400 py-3">{t("cp.none")}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((c) => {
              const active = c.id === company;
              return (
                <button
                  key={c.id}
                  data-testid="portal-client-card"
                  onClick={() => setCompany(c.id)}
                  className={`flex items-center gap-3 p-3 rounded-md border text-left transition-all duration-200 ${
                    active ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-slate-200 hover:border-primary/40 hover:bg-slate-50"
                  }`}
                >
                  <div className={`h-9 w-9 rounded-md flex items-center justify-center font-display font-bold text-sm ${active ? "bg-primary text-white" : "bg-slate-100 text-slate-600"}`}>
                    {c.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{c.name}</p>
                    <p className="text-xs text-slate-400 truncate">{c.legal_form}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {!company ? (
        <Card className="p-6"><EmptyState icon={Users2} title={t("cp.pick")} desc={t("cp.pickDesc")} /></Card>
      ) : !data ? (
        <Loading label={t("common.loading")} />
      ) : (
        <>
          {/* Client header */}
          <Card className="p-6 mb-6 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent pointer-events-none" />
            <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="h-16 w-16 rounded-lg bg-primary text-white flex items-center justify-center font-display font-bold text-2xl shrink-0">
                {data.company.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-display text-2xl font-bold text-slate-900" data-testid="portal-company-name">{data.company.name}</h2>
                <div className="flex flex-wrap gap-x-5 gap-y-1 mt-1 text-sm text-slate-600">
                  {data.company.contact_person && <span className="flex items-center gap-1"><Users2 className="h-3.5 w-3.5 text-slate-400" /> {data.company.contact_person}</span>}
                  {data.company.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5 text-slate-400" /> {data.company.email}</span>}
                  {data.company.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5 text-slate-400" /> {data.company.phone}</span>}
                  {data.company.address && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-slate-400" /> {data.company.address}</span>}
                </div>
              </div>
            </div>
            {/* stat chips */}
            <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
              <StatChip icon={FileText} label={t("cp.docs")} value={data.documents.length} tone="bg-blue-50 text-blue-600" />
              <StatChip icon={AlertTriangle} label={t("cp.missing")} value={data.missing.length} tone="bg-red-50 text-red-600" />
              <StatChip icon={MessageSquareText} label={`${openQuestions} ${t("cp.open")}`} value={data.questions.length} tone="bg-amber-50 text-amber-600" />
              <StatChip icon={CalendarClock} label={t("cp.deadlines")} value={data.deadlines.length} tone="bg-emerald-50 text-emerald-600" />
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Section icon={FileText} title={`${t("cp.docs")} (${data.documents.length})`}>
              {data.documents.length === 0 ? <EmptyState icon={FileText} title={t("cp.docs")} /> : (
                <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
                  {data.documents.map((d) => (
                    <div key={d.id} className="flex items-center justify-between py-2.5 px-2 rounded-md hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0" data-testid="portal-doc">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-8 w-8 rounded-md bg-slate-100 flex items-center justify-center shrink-0"><FileText className="h-4 w-4 text-slate-500" /></div>
                        <div className="min-w-0"><p className="text-sm font-medium text-slate-800 truncate">{d.name}</p><p className="text-xs text-slate-400">{d.category} · {fmtDate(d.date)}</p></div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0"><span className="text-sm font-mono text-slate-600">{chf(d.amount)}</span><StatusBadge status={d.status} /></div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section icon={AlertTriangle} title={`${t("cp.missing")} (${data.missing.length})`} accent="text-red-500">
              {data.missing.length === 0 ? <EmptyState icon={CheckCircle2} title={t("cp.allReceived")} desc={t("cp.allReceivedDesc")} /> : (
                <div className="space-y-2">
                  {data.missing.map((tk) => (
                    <div key={tk.id} className="flex items-center justify-between py-2.5 px-3 rounded-md bg-red-50/50 border border-red-100">
                      <span className="text-sm text-slate-700">{tk.title}</span><StatusBadge status="missing documents" />
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section icon={MessageSquareText} title={t("cp.questions")}>
              {data.questions.length === 0 ? <EmptyState icon={MessageSquareText} title={t("cp.noQuestions")} /> : (
                <div className="space-y-3">
                  {data.questions.map((que) => (
                    <div key={que.id} className="rounded-md border border-slate-200 p-3 hover:border-slate-300 transition-colors" data-testid="portal-question">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-slate-700">{que.question}</p><StatusBadge status={que.status} />
                      </div>
                      {que.answer ? <p className="text-xs text-emerald-700 mt-2 bg-emerald-50 rounded p-2">↳ {que.answer}</p> : (
                        <div className="flex gap-2 mt-2">
                          <Input placeholder={t("cp.answerPh")} className="h-9" data-testid="answer-input"
                            value={answers[que.id] || ""} onChange={(e) => setAnswers({ ...answers, [que.id]: e.target.value })} />
                          <Button size="sm" className="h-9" data-testid="submit-answer-btn" onClick={() => answer(que)}><Send className="h-3.5 w-3.5" /></Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section icon={CalendarClock} title={t("cp.deadlines")}>
              {data.deadlines.length === 0 ? <EmptyState icon={CalendarClock} title={t("cp.noDeadlines")} /> : (
                <div className="space-y-1">
                  {data.deadlines.map((d) => {
                    const days = daysUntil(d.due_date);
                    return (
                      <div key={d.id} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                        <div className="flex items-center gap-2.5"><div className="h-8 w-8 rounded-md bg-slate-100 flex items-center justify-center"><Clock className="h-4 w-4 text-slate-500" /></div>
                          <div><p className="text-sm font-medium text-slate-800">{d.title}</p><p className="text-xs text-slate-400">{d.type} · {fmtDate(d.due_date)}</p></div></div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${days <= 3 ? "bg-red-50 text-red-600" : days <= 10 ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500"}`}>
                          {days <= 0 ? t("common.due") : `${days} ${t("common.days")}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>
          </div>
        </>
      )}
    </div>
  );
}

function StatChip({ icon: Icon, label, value, tone }) {
  return (
    <div className="flex items-center gap-3 bg-white/70 backdrop-blur rounded-md border border-slate-200 px-3 py-2.5">
      <div className={`h-9 w-9 rounded-md flex items-center justify-center ${tone}`}><Icon className="h-4 w-4" strokeWidth={1.6} /></div>
      <div><p className="text-lg font-display font-bold text-slate-900 leading-none tabular-nums">{value}</p><p className="text-xs text-slate-500 mt-0.5">{label}</p></div>
    </div>
  );
}

function Section({ icon: Icon, title, accent = "text-primary", children }) {
  return (
    <Card className="p-5">
      <h3 className="font-display font-semibold text-slate-800 flex items-center gap-2 mb-4">
        <Icon className={`h-4 w-4 ${accent}`} /> {title}
      </h3>
      {children}
    </Card>
  );
}
