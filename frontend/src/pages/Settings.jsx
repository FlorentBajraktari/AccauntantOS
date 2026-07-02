import React, { useEffect, useState } from "react";
import { Settings as SettingsIcon, Save, Building2, Receipt, Bell } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { PageHeader, Card, Loading } from "@/components/common";
import { useI18n } from "@/i18n/I18nContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export default function Settings() {
  const { t } = useI18n();
  const [s, setS] = useState(null);

  useEffect(() => { api.get("/settings").then((r) => setS(r.data)); }, []);

  const save = async () => {
    await api.put("/settings", s);
    toast.success("Settings saved");
  };

  if (!s) return <Loading label="Loading settings" />;

  const field = (k, label) => (
    <div>
      <Label>{label}</Label>
      <Input data-testid={`setting-${k}`} value={s[k] || ""} className="mt-1" onChange={(e) => setS({ ...s, [k]: e.target.value })} />
    </div>
  );

  const toggle = (k, label) => (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-slate-700">{label}</span>
      <Switch checked={!!s.notifications?.[k]} data-testid={`notif-${k}`}
        onCheckedChange={(v) => setS({ ...s, notifications: { ...s.notifications, [k]: v } })} />
    </div>
  );

  return (
    <div>
      <PageHeader title={t("pages.settings.title")} subtitle={t("pages.settings.subtitle")}
        actions={<Button data-testid="save-settings-btn" onClick={save}><Save className="h-4 w-4 mr-1" /> {t("common.saveChanges")}</Button>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h3 className="font-display font-semibold text-slate-800 flex items-center gap-2 mb-4"><Building2 className="h-4 w-4 text-primary" /> Accounting Firm</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field("firm_name", "Firm Name")}
            {field("accountant_name", "Accountant")}
            {field("firm_email", "Email")}
            {field("firm_phone", "Phone")}
            <div className="sm:col-span-2">{field("firm_address", "Address")}</div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-display font-semibold text-slate-800 flex items-center gap-2 mb-4"><Receipt className="h-4 w-4 text-primary" /> Fiscal & VAT</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field("currency", "Currency")}
            {field("fiscal_year", "Fiscal Year")}
            {field("country", "Country")}
          </div>
          <div className="mt-4">
            <Label>VAT Rates (%)</Label>
            <div className="flex gap-2 mt-2">
              {(s.vat_rates || []).map((r, i) => (
                <Input key={i} type="number" value={r} className="w-24 font-mono" data-testid={`vat-rate-${i}`}
                  onChange={(e) => { const arr = [...s.vat_rates]; arr[i] = Number(e.target.value); setS({ ...s, vat_rates: arr }); }} />
              ))}
            </div>
          </div>
          <div className="mt-4">
            <Label>Document Categories</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {(s.document_categories || []).map((c) => <Badge key={c} variant="secondary">{c}</Badge>)}
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-display font-semibold text-slate-800 flex items-center gap-2 mb-4"><Bell className="h-4 w-4 text-primary" /> Notifications</h3>
          <div className="divide-y divide-slate-100">
            {toggle("email_deadlines", "Email me about upcoming deadlines")}
            {toggle("email_missing_docs", "Notify on missing documents")}
            {toggle("weekly_summary", "Send weekly summary report")}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-display font-semibold text-slate-800 flex items-center gap-2 mb-4"><SettingsIcon className="h-4 w-4 text-primary" /> Excel Export Preferences</h3>
          <div className="space-y-2 text-sm text-slate-600">
            <div className="flex justify-between py-2 border-b border-slate-100"><span>Currency format</span><span className="font-mono">{s.excel_preferences?.currency_format}</span></div>
            <div className="flex justify-between py-2 border-b border-slate-100"><span>Date format</span><span className="font-mono">{s.excel_preferences?.date_format}</span></div>
            <div className="flex items-center justify-between py-2">
              <span>Include instructions sheet</span>
              <Switch checked={!!s.excel_preferences?.include_instructions} data-testid="excel-instructions-toggle"
                onCheckedChange={(v) => setS({ ...s, excel_preferences: { ...s.excel_preferences, include_instructions: v } })} />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
