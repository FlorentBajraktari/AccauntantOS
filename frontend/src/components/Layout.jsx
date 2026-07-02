import React, { useState, useEffect, useRef } from "react";
import { NavLink, useNavigate, Outlet } from "react-router-dom";
import {
  LayoutDashboard, Building2, FileText, ArrowDownCircle, ArrowUpCircle, Landmark,
  Receipt, CheckSquare, BarChart3, FileSpreadsheet, Users, Settings, History,
  Search, LogOut, Menu, X, Calculator,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/companies", label: "Companies", icon: Building2 },
  { to: "/documents", label: "Documents", icon: FileText },
  { to: "/payables", label: "Payables", icon: ArrowDownCircle },
  { to: "/receivables", label: "Receivables", icon: ArrowUpCircle },
  { to: "/bank", label: "Bank Reconciliation", icon: Landmark },
  { to: "/vat", label: "VAT", icon: Receipt },
  { to: "/month-end", label: "Month-End Close", icon: CheckSquare },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/excel", label: "Excel Center", icon: FileSpreadsheet },
  { to: "/portal", label: "Client Portal", icon: Users },
  { to: "/audit", label: "Audit Trail", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
];

function GlobalSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef();

  useEffect(() => {
    if (q.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get(`/search?q=${encodeURIComponent(q)}`);
        setResults(data.results);
        setOpen(true);
      } catch (e) {}
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const go = (r) => {
    setOpen(false); setQ("");
    if (r.type === "company") navigate(`/companies/${r.id}`);
    else if (r.type === "document") navigate("/documents");
    else if (r.type === "payable") navigate("/payables");
    else if (r.type === "receivable") navigate("/receivables");
  };

  return (
    <div className="relative w-full max-w-md" ref={ref}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
      <Input
        data-testid="global-search-input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        placeholder="Search companies, documents, invoices…"
        className="pl-9 h-9 bg-slate-50 border-slate-200"
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg overflow-hidden" data-testid="search-results">
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => go(r)}
              className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-50 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-slate-800">{r.title}</p>
                <p className="text-xs text-slate-400">{r.subtitle}</p>
              </div>
              <span className="text-[10px] uppercase tracking-wide text-slate-400">{r.type}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="h-16 flex items-center gap-2 px-5 border-b border-slate-200">
        <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
          <Calculator className="h-5 w-5 text-white" strokeWidth={1.8} />
        </div>
        <div>
          <p className="font-display font-bold text-slate-900 leading-none">AccountantOS</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Accounting Operations</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setMobileOpen(false)}
            data-testid={`nav-${item.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-primary/10 text-primary border-l-2 border-primary"
                  : "text-slate-600 hover:bg-slate-100 border-l-2 border-transparent"
              }`
            }
          >
            <item.icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-slate-200">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
            {(user?.name || "?").slice(0, 1)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{user?.name}</p>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 z-30">
        {sidebar}
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white border-r border-slate-200">{sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 h-16 bg-white/90 backdrop-blur border-b border-slate-200 flex items-center gap-3 px-4 sm:px-6">
          <button className="lg:hidden text-slate-600" onClick={() => setMobileOpen(!mobileOpen)} data-testid="mobile-menu-btn">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={logout}
              data-testid="logout-btn"
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors px-3 py-1.5 rounded-md hover:bg-slate-100"
            >
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>
        <main className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
