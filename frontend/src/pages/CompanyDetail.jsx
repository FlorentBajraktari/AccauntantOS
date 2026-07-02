import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Building2, FileText, ArrowDownCircle, ArrowUpCircle, ListTodo,
  CalendarClock, MessageSquareText, History, Mail, Phone, MapPin, Users2,
} from "lucide-react";
import { api } from "@/lib/api";
import { chf, fmtDate, fmtDateTime } from "@/lib/format";
import { PageHeader, Card, Loading, EmptyState, StatusBadge, TableShell, StatCard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function CompanyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => { api.get(`/companies/${id}/overview`).then((r) => setData(r.data)).catch(() => navigate("/companies")); }, [id]);

  if (!data) return <Loading label="Loading company" />;
  const c = data.company;
  const outstandingAP = data.payables.filter((p) => p.payment_status !== "paid").reduce((s, p) => s + (p.amount || 0) + (p.vat || 0), 0);
  const outstandingAR = data.receivables.filter((r) => r.payment_status !== "paid").reduce((s, r) => s + (r.amount || 0) + (r.vat || 0), 0);

  return (
    <div>
      <button onClick={() => navigate("/companies")} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-4" data-testid="back-btn">
        <ArrowLeft className="h-4 w-4" /> Back to Companies
      </button>

      <Card className="p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="h-16 w-16 rounded-md bg-primary/10 flex items-center justify-center text-primary font-display font-bold text-xl">
            {c.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold text-slate-900" data-testid="company-name">{c.name}</h1>
            <p className="text-sm text-slate-500">{c.legal_form} · {c.uid_vat || "No UID"} · {c.accounting_method}</p>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-sm text-slate-600">
              {c.contact_person && <span className="flex items-center gap-1"><Users2 className="h-3.5 w-3.5 text-slate-400" /> {c.contact_person}</span>}
              {c.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5 text-slate-400" /> {c.email}</span>}
              {c.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5 text-slate-400" /> {c.phone}</span>}
              {c.address && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-slate-400" /> {c.address}</span>}
            </div>
          </div>
          <StatusBadge status={c.vat_status === "VAT Registered" ? "reviewed" : "pending"} />
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Documents" value={data.documents.length} icon={FileText} tone="brand" />
        <StatCard label="Open Payables" value={chf(outstandingAP)} icon={ArrowDownCircle} tone="amber" />
        <StatCard label="Open Receivables" value={chf(outstandingAR)} icon={ArrowUpCircle} tone="green" />
        <StatCard label="Open Tasks" value={data.tasks.filter((t) => t.status !== "Completed").length} icon={ListTodo} tone="slate" />
      </div>

      <Tabs defaultValue="documents">
        <TabsList className="mb-4 flex-wrap h-auto">
          <TabsTrigger value="documents" data-testid="tab-documents">Documents</TabsTrigger>
          <TabsTrigger value="payables" data-testid="tab-payables">Payables</TabsTrigger>
          <TabsTrigger value="receivables" data-testid="tab-receivables">Receivables</TabsTrigger>
          <TabsTrigger value="tasks" data-testid="tab-tasks">Tasks</TabsTrigger>
          <TabsTrigger value="deadlines" data-testid="tab-deadlines">Deadlines</TabsTrigger>
          <TabsTrigger value="questions" data-testid="tab-questions">Questions</TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="documents">
          {data.documents.length === 0 ? <Card className="p-6"><EmptyState icon={FileText} title="No documents" /></Card> : (
            <TableShell head={[{ label: "Name" }, { label: "Category" }, { label: "Date" }, { label: "Amount", right: true }, { label: "Status" }]}>
              {data.documents.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50"><td className="px-4 py-3 font-medium text-slate-800">{d.name}</td>
                  <td className="px-4 py-3 text-slate-600">{d.category}</td><td className="px-4 py-3 text-slate-600">{fmtDate(d.date)}</td>
                  <td className="px-4 py-3 text-right font-mono">{chf(d.amount)}</td><td className="px-4 py-3"><StatusBadge status={d.status} /></td></tr>
              ))}
            </TableShell>
          )}
        </TabsContent>

        <TabsContent value="payables">
          <InvTable items={data.payables} party="supplier" />
        </TabsContent>
        <TabsContent value="receivables">
          <InvTable items={data.receivables} party="customer" />
        </TabsContent>

        <TabsContent value="tasks">
          {data.tasks.length === 0 ? <Card className="p-6"><EmptyState icon={ListTodo} title="No tasks" /></Card> : (
            <TableShell head={[{ label: "Task" }, { label: "Assigned" }, { label: "Due" }, { label: "Status" }]}>
              {data.tasks.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50"><td className="px-4 py-3 text-slate-800">{t.title}</td>
                  <td className="px-4 py-3 text-slate-600">{t.assigned_to}</td><td className="px-4 py-3 text-slate-600">{fmtDate(t.due_date)}</td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td></tr>
              ))}
            </TableShell>
          )}
        </TabsContent>

        <TabsContent value="deadlines">
          {data.deadlines.length === 0 ? <Card className="p-6"><EmptyState icon={CalendarClock} title="No deadlines" /></Card> : (
            <TableShell head={[{ label: "Deadline" }, { label: "Type" }, { label: "Due" }, { label: "Status" }]}>
              {data.deadlines.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50"><td className="px-4 py-3 text-slate-800">{d.title}</td>
                  <td className="px-4 py-3 text-slate-600">{d.type}</td><td className="px-4 py-3 text-slate-600">{fmtDate(d.due_date)}</td>
                  <td className="px-4 py-3"><StatusBadge status={d.status} /></td></tr>
              ))}
            </TableShell>
          )}
        </TabsContent>

        <TabsContent value="questions">
          {data.questions.length === 0 ? <Card className="p-6"><EmptyState icon={MessageSquareText} title="No questions" /></Card> : (
            <div className="space-y-3">
              {data.questions.map((q) => (
                <Card key={q.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-slate-700">{q.question}</p><StatusBadge status={q.status} />
                  </div>
                  {q.answer && <p className="text-xs text-emerald-700 mt-2 bg-emerald-50 rounded p-2">↳ {q.answer}</p>}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity">
          {data.activity.length === 0 ? <Card className="p-6"><EmptyState icon={History} title="No activity" /></Card> : (
            <Card className="p-5">
              <div className="space-y-3">
                {data.activity.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 pb-3 border-b border-slate-100 last:border-0">
                    <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />
                    <div><p className="text-sm text-slate-800">{a.detail}</p><p className="text-xs text-slate-400">{a.user} · {fmtDateTime(a.timestamp)}</p></div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InvTable({ items, party }) {
  if (items.length === 0) return <Card className="p-6"><EmptyState icon={FileText} title={`No ${party === "supplier" ? "payables" : "receivables"}`} /></Card>;
  return (
    <TableShell head={[{ label: party === "supplier" ? "Supplier" : "Customer" }, { label: "Invoice" }, { label: "Due" }, { label: "Amount", right: true }, { label: "Status" }]}>
      {items.map((it) => (
        <tr key={it.id} className="hover:bg-slate-50"><td className="px-4 py-3 font-medium text-slate-800">{it[party]}</td>
          <td className="px-4 py-3 text-slate-500 font-mono text-xs">{it.invoice_number}</td><td className="px-4 py-3 text-slate-600">{fmtDate(it.due_date)}</td>
          <td className="px-4 py-3 text-right font-mono">{chf((it.amount || 0) + (it.vat || 0))}</td><td className="px-4 py-3"><StatusBadge status={it.payment_status} /></td></tr>
      ))}
    </TableShell>
  );
}
