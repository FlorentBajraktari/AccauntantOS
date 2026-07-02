import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calculator, Loader2, ShieldCheck, FileSpreadsheet, TrendingUp } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const { login, register, formatApiErrorDetail } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "admin@accountantos.ch", password: "Admin123!" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      if (mode === "login") await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
      navigate("/dashboard");
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
            Less Excel chaos.<br />More clarity for your clients.
          </h1>
          <p className="mt-4 text-slate-300 max-w-md text-sm leading-relaxed">
            Manage multiple companies, organize documents, track deadlines and generate professional Swiss Excel reports — all in one workspace.
          </p>
          <div className="mt-8 space-y-3">
            {[
              { icon: FileSpreadsheet, t: "14 professional Excel templates" },
              { icon: TrendingUp, t: "Live dashboards & VAT preparation" },
              { icon: ShieldCheck, t: "Audit trail on every action" },
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
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="text-sm text-slate-500 mt-1 mb-6">
            {mode === "login" ? "Sign in to your accounting workspace" : "Start managing your clients today"}
          </p>

          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <div>
                <Label htmlFor="name">Full name</Label>
                <Input id="name" data-testid="name-input" value={form.name} required
                  onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Accountant" className="mt-1" />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" data-testid="email-input" value={form.email} required
                onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@firm.ch" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" data-testid="password-input" value={form.password} required
                onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" className="mt-1" />
            </div>
            {error && <p className="text-sm text-red-600" data-testid="auth-error">{error}</p>}
            <Button type="submit" disabled={loading} data-testid="submit-auth-btn"
              className="w-full h-10 transition-all duration-200 hover:-translate-y-[1px]">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="text-sm text-slate-500 mt-6 text-center">
            {mode === "login" ? "New to AccountantOS? " : "Already have an account? "}
            <button
              data-testid="toggle-auth-mode"
              onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
              className="text-primary font-medium hover:underline"
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
          {mode === "login" && (
            <div className="mt-6 rounded-md bg-slate-50 border border-slate-200 p-3 text-xs text-slate-500">
              <span className="font-medium text-slate-600">Demo login:</span> admin@accountantos.ch / Admin123!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
