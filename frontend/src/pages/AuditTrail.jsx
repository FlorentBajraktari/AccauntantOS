import React, { useEffect, useState } from "react";
import { History, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { PageHeader, Card, Loading, EmptyState, TableShell } from "@/components/common";
import CompanySelect from "@/components/CompanySelect";
import { useI18n } from "@/i18n/I18nContext";

const ACTION_LABEL = {
  document_uploaded: "Document uploaded", document_reviewed: "Document reviewed",
  document_ocr: "AI extraction", invoice_booked: "Invoice booked",
  payment_marked_paid: "Payment marked paid", report_exported: "Report exported",
  excel_imported: "Excel imported", user_login: "User login",
  settings_changed: "Settings changed", company_created: "Company created",
  company_updated: "Company updated", company_deleted: "Company deleted",
  document_updated: "Document updated", payable_created: "Payable created",
  receivable_created: "Receivable created",
};

export default function AuditTrail() {
  const { t } = useI18n();
  const [companies, setCompanies] = useState([]);
  const [company, setCompany] = useState("all");
  const [logs, setLogs] = useState(null);

  const load = () => {
    const q = company !== "all" ? `?company_id=${company}` : "";
    return api.get(`/audit${q}`).then((r) => setLogs(r.data));
  };
  useEffect(() => { api.get("/companies").then((r) => setCompanies(r.data)); }, []);
  useEffect(() => { load(); }, [company]);

  const cname = (id) => companies.find((c) => c.id === id)?.name || "—";

  if (!logs) return <Loading label="Loading audit trail" />;

  return (
    <div>
      <PageHeader title={t("pages.audit.title")} subtitle={t("pages.audit.subtitle")} />
      <div className="mb-4"><CompanySelect value={company} onChange={setCompany} companies={companies} /></div>

      {logs.length === 0 ? (
        <Card className="p-6"><EmptyState icon={History} title="No activity yet" /></Card>
      ) : (
        <TableShell testid="audit-table" head={[
          { label: "Time" }, { label: "User" }, { label: "Action" }, { label: "Detail" }, { label: "Company" },
        ]}>
          {logs.map((l) => (
            <tr key={l.id} className="hover:bg-slate-50 transition-colors" data-testid="audit-row">
              <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{fmtDateTime(l.timestamp)}</td>
              <td className="px-4 py-3 text-slate-700">{l.user}</td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-1.5 text-sm text-slate-800">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" /> {ACTION_LABEL[l.action] || l.action}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-600">{l.detail}</td>
              <td className="px-4 py-3 text-slate-500">{l.company_id ? cname(l.company_id) : "—"}</td>
            </tr>
          ))}
        </TableShell>
      )}
    </div>
  );
}
