import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { I18nProvider } from "@/i18n/I18nContext";
import { Loading } from "@/components/common";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Companies from "@/pages/Companies";
import CompanyDetail from "@/pages/CompanyDetail";
import Documents from "@/pages/Documents";
import Payables from "@/pages/Payables";
import Receivables from "@/pages/Receivables";
import BankReconciliation from "@/pages/BankReconciliation";
import VAT from "@/pages/VAT";
import MonthEndClose from "@/pages/MonthEndClose";
import Reports from "@/pages/Reports";
import ExcelCenter from "@/pages/ExcelCenter";
import ClientPortal from "@/pages/ClientPortal";
import Settings from "@/pages/Settings";
import AuditTrail from "@/pages/AuditTrail";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading || user === null) return <div className="min-h-screen bg-slate-50"><Loading label="Loading workspace" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  const homePath = user?.role === "client" ? "/portal" : "/dashboard";
  return (
    <Routes>
      <Route path="/login" element={user && !loading ? <Navigate to={homePath} replace /> : <Login />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/companies" element={<Companies />} />
        <Route path="/companies/:id" element={<CompanyDetail />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/payables" element={<Payables />} />
        <Route path="/receivables" element={<Receivables />} />
        <Route path="/bank" element={<BankReconciliation />} />
        <Route path="/vat" element={<VAT />} />
        <Route path="/month-end" element={<MonthEndClose />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/excel" element={<ExcelCenter />} />
        <Route path="/portal" element={<ClientPortal />} />
        <Route path="/portal/:id" element={<ClientPortal />} />
        <Route path="/audit" element={<AuditTrail />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to={homePath} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <div className="App">
      <I18nProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
            <Toaster position="top-right" richColors />
          </BrowserRouter>
        </AuthProvider>
      </I18nProvider>
    </div>
  );
}
