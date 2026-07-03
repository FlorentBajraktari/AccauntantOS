import React, { useCallback, useEffect, useState } from "react";
import { Settings as SettingsIcon, Save, Building2, Receipt, Bell } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { PageHeader, Card, Loading } from "@/components/common";
import { useI18n } from "@/i18n/I18nContext";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export default function Settings() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [s, setS] = useState(null);
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [invites, setInvites] = useState([]);
  const [auditSummary, setAuditSummary] = useState(null);
  const [inviteForm, setInviteForm] = useState({ email: "", role: "client", company_id: "" });
  const [issuedToken, setIssuedToken] = useState("");
  const [resetToken, setResetToken] = useState("");

  const loadAdmin = useCallback(async () => {
    if (user?.role !== "admin") return;
    const [usersRes, invitesRes, auditRes, companiesRes] = await Promise.all([
      api.get("/admin/users"),
      api.get("/admin/invitations"),
      api.get("/admin/audit/summary"),
      api.get("/companies"),
    ]);
    setUsers(usersRes.data);
    setInvites(invitesRes.data);
    setAuditSummary(auditRes.data);
    setCompanies(companiesRes.data);
  }, [user?.role]);

  useEffect(() => {
    api.get("/settings").then((r) => setS(r.data));
    loadAdmin().catch(() => { });
  }, [loadAdmin]);

  const save = async () => {
    await api.put("/settings", s);
    toast.success("Settings saved");
  };

  const createInvite = async () => {
    const payload = {
      email: inviteForm.email,
      role: inviteForm.role,
      company_ids: inviteForm.company_id ? [inviteForm.company_id] : [],
    };
    const { data } = await api.post("/admin/invitations", payload);
    setIssuedToken(data.token);
    setInviteForm({ email: "", role: "client", company_id: "" });
    toast.success("Invitation created");
    await loadAdmin();
  };

  const revokeInvite = async (inviteId) => {
    await api.delete(`/admin/invitations/${inviteId}`);
    toast.success("Invitation revoked");
    await loadAdmin();
  };

  const generateResetToken = async (userId) => {
    const { data } = await api.post(`/admin/users/${userId}/password-reset`);
    setResetToken(data.reset_token);
    toast.success("Password reset token created");
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

        {user?.role === "admin" && (
          <Card className="p-5 lg:col-span-2">
            <h3 className="font-display font-semibold text-slate-800 mb-4">Admin Controls</h3>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-slate-800 mb-2">Invite User</h4>
                  <div className="space-y-3">
                    <div>
                      <Label>Email</Label>
                      <Input value={inviteForm.email} className="mt-1" onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} />
                    </div>
                    <div>
                      <Label>Role</Label>
                      <select value={inviteForm.role} className="mt-1 w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                        onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}>
                        <option value="client">Client</option>
                        <option value="accountant">Accountant</option>
                      </select>
                    </div>
                    <div>
                      <Label>Company Access</Label>
                      <select value={inviteForm.company_id} className="mt-1 w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                        onChange={(e) => setInviteForm({ ...inviteForm, company_id: e.target.value })}>
                        <option value="">All firm companies</option>
                        {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                      </select>
                    </div>
                    <Button onClick={createInvite}>Create Invitation</Button>
                    {issuedToken && (
                      <div className="rounded-md bg-slate-50 border border-slate-200 p-3 text-xs break-all">
                        <p className="font-medium text-slate-700 mb-1">Invitation Token</p>
                        <p>{issuedToken}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-slate-800 mb-2">Pending Invitations</h4>
                  <div className="space-y-2 max-h-64 overflow-auto">
                    {invites.filter((invite) => !invite.accepted_at && !invite.revoked_at).map((invite) => (
                      <div key={invite.id} className="rounded-md border border-slate-200 p-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-800">{invite.email}</p>
                            <p className="text-xs text-slate-400">{invite.role} · expires {invite.expires_at?.slice(0, 10)}</p>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => revokeInvite(invite.id)}>Revoke</Button>
                        </div>
                      </div>
                    ))}
                    {invites.filter((invite) => !invite.accepted_at && !invite.revoked_at).length === 0 && (
                      <p className="text-sm text-slate-400">No pending invitations.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4 xl:col-span-2">
                <div>
                  <h4 className="font-medium text-slate-800 mb-2">Users</h4>
                  <div className="space-y-2 max-h-72 overflow-auto">
                    {users.map((item) => (
                      <div key={item.id} className="rounded-md border border-slate-200 p-3 text-sm flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-800">{item.name}</p>
                          <p className="text-xs text-slate-400">{item.email} · {item.role} · {item.active ? "active" : "inactive"}</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => generateResetToken(item.id)}>Reset Password</Button>
                      </div>
                    ))}
                  </div>
                  {resetToken && (
                    <div className="rounded-md bg-slate-50 border border-slate-200 p-3 mt-3 text-xs break-all">
                      <p className="font-medium text-slate-700 mb-1">Latest Reset Token</p>
                      <p>{resetToken}</p>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="font-medium text-slate-800 mb-2">Recent Admin Audit</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                    <div className="rounded-md border border-slate-200 p-3">
                      <p className="text-xs text-slate-400">Active Users</p>
                      <p className="text-lg font-semibold text-slate-800">{auditSummary?.active_users ?? 0}</p>
                    </div>
                    <div className="rounded-md border border-slate-200 p-3">
                      <p className="text-xs text-slate-400">Pending Invites</p>
                      <p className="text-lg font-semibold text-slate-800">{auditSummary?.pending_invites ?? 0}</p>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-auto">
                    {(auditSummary?.recent_audit || []).map((entry) => (
                      <div key={entry.id} className="rounded-md border border-slate-200 p-3 text-sm">
                        <p className="font-medium text-slate-800">{entry.action}</p>
                        <p className="text-xs text-slate-500">{entry.detail}</p>
                        <p className="text-[11px] text-slate-400 mt-1">{entry.timestamp?.replace("T", " ").slice(0, 19)}</p>
                      </div>
                    ))}
                    {(auditSummary?.recent_audit || []).length === 0 && <p className="text-sm text-slate-400">No recent audit entries.</p>}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
