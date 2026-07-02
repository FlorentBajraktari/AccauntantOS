import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Users, FileText, MessageSquareText, CalendarClock, AlertTriangle, Download, Send } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { chf, fmtDate } from "@/lib/format";
import { PageHeader, Card, Loading, EmptyState, StatusBadge } from "@/components/common";
import CompanySelect from "@/components/CompanySelect";
import { useI18n } from "@/i18n/I18nContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ClientPortal() {
  const { t } = useI18n();
  const { id } = useParams();
  const [companies, setCompanies] = useState([]);
  const [company, setCompany] = useState(id || "");
  const [data, setData] = useState(null);
  const [answers, setAnswers] = useState({});

  useEffect(() => {
    api.get("/companies").then((r) => {
      setCompanies(r.data);
      if (!company && r.data.length) setCompany(r.data[0].id);
    });
  }, []);
  useEffect(() => { if (company) api.get(`/portal/${company}`).then((r) => setData(r.data)); }, [company]);

  const answer = async (que) => {
    const a = answers[que.id];
    if (!a) return;
    await api.put(`/questions/${que.id}`, { ...que, answer: a, status: "answered" });
    toast.success("Answer submitted");
    api.get(`/portal/${company}`).then((r) => setData(r.data));
  };

  return (
    <div>
      <PageHeader title={t("pages.portal.title")} subtitle={t("pages.portal.subtitle")} />
      <div className="mb-4">
        <CompanySelect value={company} onChange={setCompany} companies={companies} includeAll={false} />
      </div>

      {!data ? <Loading label="Loading portal" /> : (
        <>
          <Card className="p-5 mb-6 bg-gradient-to-r from-primary/5 to-transparent">
            <h2 className="font-display text-xl font-bold text-slate-900">{data.company.name}</h2>
            <p className="text-sm text-slate-500">{data.company.address} · {data.company.email}</p>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-5">
              <h3 className="font-display font-semibold text-slate-800 flex items-center gap-2 mb-4"><FileText className="h-4 w-4 text-primary" /> Documents ({data.documents.length})</h3>
              {data.documents.length === 0 ? <EmptyState icon={FileText} title="No documents" /> : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {data.documents.map((d) => (
                    <div key={d.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0" data-testid="portal-doc">
                      <div><p className="text-sm font-medium text-slate-800">{d.name}</p><p className="text-xs text-slate-400">{d.category} · {fmtDate(d.date)}</p></div>
                      <div className="flex items-center gap-2"><span className="text-sm font-mono text-slate-600">{chf(d.amount)}</span><StatusBadge status={d.status} /></div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5">
              <h3 className="font-display font-semibold text-slate-800 flex items-center gap-2 mb-4"><AlertTriangle className="h-4 w-4 text-red-500" /> Missing Documents ({data.missing.length})</h3>
              {data.missing.length === 0 ? <EmptyState icon={FileText} title="All documents received" desc="Nothing outstanding right now." /> : (
                <div className="space-y-2">
                  {data.missing.map((t) => (
                    <div key={t.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                      <span className="text-sm text-slate-700">{t.title}</span><StatusBadge status="missing documents" />
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5">
              <h3 className="font-display font-semibold text-slate-800 flex items-center gap-2 mb-4"><MessageSquareText className="h-4 w-4 text-primary" /> Questions</h3>
              {data.questions.length === 0 ? <EmptyState icon={MessageSquareText} title="No questions" /> : (
                <div className="space-y-3">
                  {data.questions.map((que) => (
                    <div key={que.id} className="rounded-md border border-slate-200 p-3" data-testid="portal-question">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-slate-700">{que.question}</p><StatusBadge status={que.status} />
                      </div>
                      {que.answer ? <p className="text-xs text-emerald-700 mt-2 bg-emerald-50 rounded p-2">↳ {que.answer}</p> : (
                        <div className="flex gap-2 mt-2">
                          <Input placeholder="Type your answer…" className="h-8" data-testid="answer-input"
                            value={answers[que.id] || ""} onChange={(e) => setAnswers({ ...answers, [que.id]: e.target.value })} />
                          <Button size="sm" className="h-8" data-testid="submit-answer-btn" onClick={() => answer(que)}><Send className="h-3.5 w-3.5" /></Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5">
              <h3 className="font-display font-semibold text-slate-800 flex items-center gap-2 mb-4"><CalendarClock className="h-4 w-4 text-primary" /> Deadlines</h3>
              {data.deadlines.length === 0 ? <EmptyState icon={CalendarClock} title="No deadlines" /> : (
                <div className="space-y-2">
                  {data.deadlines.map((d) => (
                    <div key={d.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                      <div><p className="text-sm font-medium text-slate-800">{d.title}</p><p className="text-xs text-slate-400">{d.type}</p></div>
                      <span className="text-sm text-slate-600">{fmtDate(d.due_date)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
