import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calculator, Loader2, ShieldCheck, FileSpreadsheet, TrendingUp } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const { login, registerWithInvite, requestPasswordReset, confirmPasswordReset, formatApiErrorDetail } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", inviteToken: "", resetToken: "" });
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setInfo(""); setLoading(true);
    try {
      let authResult = null;
      if (mode === "login") authResult = await login(form.email, form.password);
      else if (mode === "register") authResult = await registerWithInvite(form.name, form.email, form.password, form.inviteToken);
      else if (mode === "forgot") {
        const data = await requestPasswordReset(form.email);
        setInfo(data.reset_token ? `Reset token: ${data.reset_token}` : (data.message || "If the account exists, reset instructions were issued."));
        setForm({ ...form, resetToken: data.reset_token || form.resetToken, password: "" });
        setMode("reset");
        return;
      } else if (mode === "reset") {
        await confirmPasswordReset(form.resetToken, form.password);
        setInfo("Password updated. You can sign in now.");
        setMode("login");
        setForm({ name: "", email: form.email, password: "", inviteToken: "", resetToken: "" });
        return;
      }
      navigate(authResult?.role === "client" ? "/portal" : "/dashboard");
    } catch (e) {
      setError(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      {/* Left brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden bg-slate-900">
        <img
          src="https://images.unsplash.com/photo-1462556791646-c201b8241a94"
          alt="Architecture"
          className="absolute inset-0 h-full w-full object-cover opacity-25"
        />
        <div className="relative z-10 flex items-center gap-3 text-white">
          <div className="h-10 w-10 rounded-md bg-primary flex items-center justify-center">
            <Calculator className="h-6 w-6" strokeWidth={1.8} />
          </div>
          <div>
            <p className="font-display text-xl font-bold">AccountantOS</p>
            <p className="text-xs text-slate-300">Accounting Operations Platform</p>
          </div>
        </div>
        <div className="relative z-10 text-white">
          <h1 className="font-display text-4xl font-bold leading-tight max-w-md">
            {t("login.heroTitle")}
          </h1>
          <p className="mt-4 text-slate-300 max-w-md text-sm leading-relaxed">
            {t("login.heroDesc")}
          </p>
          <div className="mt-8 space-y-3">
            {[
              { icon: FileSpreadsheet, t: t("login.f1") },
              { icon: TrendingUp, t: t("login.f2") },
              { icon: ShieldCheck, t: t("login.f3") },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-slate-200">
                <f.icon className="h-4 w-4 text-primary" /> {f.t}
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10 text-xs text-slate-400">© 2026 AccountantOS · Zürich, Switzerland</div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="h-9 w-9 rounded-md bg-primary flex items-center justify-center">
              <Calculator className="h-5 w-5 text-white" />
            </div>
            <span className="font-display font-bold text-lg">AccountantOS</span>
          </div>
          <h2 className="font-display text-2xl font-bold text-slate-900">
            {mode === "login" ? t("login.welcome") : mode === "register" ? t("login.createTitle") : mode === "forgot" ? "Reset your password" : "Choose a new password"}
          </h2>
          <p className="text-sm text-slate-500 mt-1 mb-6">
            {mode === "login" ? t("login.subtitle") : mode === "register" ? "Use an invitation token if your firm requires invite-only onboarding." : mode === "forgot" ? "Enter your email to request a password reset token." : "Paste the reset token and choose a new password."}
          </p>

          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <div>
                <Label htmlFor="name">{t("login.fullName")}</Label>
                <Input id="name" data-testid="name-input" value={form.name} required
                  onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Accountant" className="mt-1" />
              </div>
            )}
            <div>
              <Label htmlFor="email">{t("login.email")}</Label>
              <Input id="email" type="email" data-testid="email-input" value={form.email} required
                onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@firm.ch" className="mt-1" />
            </div>
            {mode === "register" && (
              <div>
                <Label htmlFor="inviteToken">Invitation Token</Label>
                <Input id="inviteToken" data-testid="invite-token-input" value={form.inviteToken}
                  onChange={(e) => setForm({ ...form, inviteToken: e.target.value })} placeholder="Optional in development / required for invite-only onboarding" className="mt-1" />
              </div>
            )}
            {mode === "reset" && (
              <div>
                <Label htmlFor="resetToken">Reset Token</Label>
                <Input id="resetToken" data-testid="reset-token-input" value={form.resetToken} required
                  onChange={(e) => setForm({ ...form, resetToken: e.target.value })} placeholder="Paste your reset token" className="mt-1" />
              </div>
            )}
            <div>
              <Label htmlFor="password">{mode === "reset" ? "New Password" : t("login.password")}</Label>
              <Input id="password" type="password" data-testid="password-input" value={form.password} required
                onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" className="mt-1" />
            </div>
            {info && <p className="text-sm text-emerald-700" data-testid="auth-info">{info}</p>}
            {error && <p className="text-sm text-red-600" data-testid="auth-error">{error}</p>}
            <Button type="submit" disabled={loading} data-testid="submit-auth-btn"
              className="w-full h-10 transition-all duration-200 hover:-translate-y-[1px]">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "login" ? t("login.signIn") : mode === "register" ? t("login.createAccount") : mode === "forgot" ? "Request reset token" : "Update password"}
            </Button>
          </form>

          <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-500">
            <button data-testid="toggle-auth-mode" onClick={() => { setMode(mode === "register" ? "login" : "register"); setError(""); setInfo(""); }} className="text-primary font-medium hover:underline">
              {mode === "register" ? t("login.signIn") : t("login.createAccount")}
            </button>
            <button onClick={() => { setMode(mode === "forgot" ? "login" : "forgot"); setError(""); setInfo(""); }} className="text-primary font-medium hover:underline">
              {mode === "forgot" ? t("login.signIn") : "Forgot password?"}
            </button>
            {mode === "reset" && (
              <button onClick={() => { setMode("login"); setError(""); setInfo(""); }} className="text-primary font-medium hover:underline">
                Back to sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
