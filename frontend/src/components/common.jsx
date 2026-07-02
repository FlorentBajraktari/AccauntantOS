import React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6 animate-fade-up">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900" data-testid="page-title">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = "", ...props }) {
  return (
    <div className={`bg-white border border-slate-200 rounded-md shadow-sm ${className}`} {...props}>
      {children}
    </div>
  );
}

const TONES = {
  brand: "bg-primary/10 text-primary",
  green: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-red-50 text-red-600",
  slate: "bg-slate-100 text-slate-600",
};

export function StatCard({ label, value, icon: Icon, tone = "slate", sub, testid }) {
  return (
    <Card className="p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-[1px]" data-testid={testid}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wide uppercase text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-display font-bold text-slate-900 tabular-nums">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
        </div>
        {Icon && (
          <div className={`h-10 w-10 rounded-md flex items-center justify-center ${TONES[tone]}`}>
            <Icon className="h-5 w-5" strokeWidth={1.5} />
          </div>
        )}
      </div>
    </Card>
  );
}

const STATUS_MAP = {
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  reviewed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  booked: "bg-blue-50 text-blue-700 border-blue-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  answered: "bg-blue-50 text-blue-700 border-blue-200",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  matched: "bg-emerald-50 text-emerald-700 border-emerald-200",
  uploaded: "bg-slate-100 text-slate-700 border-slate-200",
  unpaid: "bg-amber-50 text-amber-700 border-amber-200",
  partial: "bg-amber-50 text-amber-700 border-amber-200",
  pending: "bg-slate-100 text-slate-700 border-slate-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  "in review": "bg-blue-50 text-blue-700 border-blue-200",
  open: "bg-amber-50 text-amber-700 border-amber-200",
  overdue: "bg-red-50 text-red-700 border-red-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  "needs correction": "bg-red-50 text-red-700 border-red-200",
  "missing documents": "bg-red-50 text-red-700 border-red-200",
  draft: "bg-slate-100 text-slate-700 border-slate-200",
};

export function StatusBadge({ status }) {
  const key = String(status || "").toLowerCase();
  const cls = STATUS_MAP[key] || "bg-slate-100 text-slate-700 border-slate-200";
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {String(status || "").replace(/_/g, " ")}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, desc, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="empty-state">
      {Icon && (
        <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <Icon className="h-7 w-7 text-slate-400" strokeWidth={1.5} />
        </div>
      )}
      <h3 className="font-display text-lg font-semibold text-slate-800">{title}</h3>
      {desc && <p className="text-sm text-slate-500 mt-1 max-w-sm">{desc}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Loading({ label = "Loading" }) {
  return (
    <div className="flex items-center justify-center py-20 text-slate-400">
      <Loader2 className="h-5 w-5 animate-spin mr-2" /> {label}…
    </div>
  );
}

export function TableShell({ head, children, testid }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid={testid}>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {head.map((h, i) => (
                <th
                  key={i}
                  className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${
                    h.right ? "text-right" : "text-left"
                  }`}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">{children}</tbody>
        </table>
      </div>
    </Card>
  );
}
