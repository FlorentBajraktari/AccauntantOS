import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Building2, Plus, Pencil, Trash2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { PageHeader, Card, Loading, EmptyState, StatusBadge } from "@/components/common";
import { useI18n } from "@/i18n/I18nContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const EMPTY = {
  name: "", legal_form: "GmbH", address: "", uid_vat: "", contact_person: "",
  email: "", phone: "", fiscal_year: "Jan - Dec", vat_status: "VAT Registered",
  accounting_method: "Accrual", notes: "",
};

export default function Companies() {
  const { t } = useI18n();
  const [companies, setCompanies] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const shouldOpenCreate = useMemo(() => searchParams.get("new") === "1", [searchParams]);

  const load = () => api.get("/companies").then((r) => setCompanies(r.data));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (shouldOpenCreate && !open) {
      setForm(EMPTY);
      setEditing(null);
      setOpen(true);
    }
  }, [open, shouldOpenCreate]);

  const clearCreateParam = () => {
    if (!shouldOpenCreate) return;
    const next = new URLSearchParams(searchParams);
    next.delete("new");
    setSearchParams(next, { replace: true });
  };

  const handleOpenChange = (nextOpen) => {
    setOpen(nextOpen);
    if (!nextOpen) clearCreateParam();
  };

  const openCreate = () => { setForm(EMPTY); setEditing(null); setOpen(true); clearCreateParam(); };
  const openEdit = (c) => { setForm(c); setEditing(c.id); setOpen(true); };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Company name is required"); return; }
    try {
      if (editing) await api.put(`/companies/${editing}`, form);
      else await api.post("/companies", form);
      toast.success(editing ? "Company updated" : "Company created");
      setOpen(false);
      clearCreateParam();
      load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const doDelete = async () => {
    try {
      await api.delete(`/companies/${deleteId}`);
      toast.success("Company deleted"); setDeleteId(null); load();
    } catch (e) { toast.error("Delete failed"); }
  };

  if (!companies) return <Loading label="Loading companies" />;

  const field = (k, label, type = "input") => (
    <div>
      <Label htmlFor={k}>{label}</Label>
      {type === "textarea" ? (
        <Textarea id={k} data-testid={`company-${k}`} value={form[k] || ""} className="mt-1"
          onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
      ) : (
        <Input id={k} data-testid={`company-${k}`} value={form[k] || ""} className="mt-1"
          onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
      )}
    </div>
  );

  const sel = (k, label, options) => (
    <div>
      <Label>{label}</Label>
      <Select value={form[k]} onValueChange={(v) => setForm({ ...form, [k]: v })}>
        <SelectTrigger className="mt-1" data-testid={`company-${k}`}><SelectValue /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );

  return (
    <div>
      <PageHeader
        title={t("pages.companies.title")}
        subtitle={`${companies.length} ${t("pages.companies.subtitle")}`}
        actions={<Button data-testid="add-company-btn" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> {t("common.add")}</Button>}
      />

      {companies.length === 0 ? (
        <Card className="p-6"><EmptyState icon={Building2} title="No companies yet"
          desc="Add your first client company to start managing their books."
          action={<Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Add Company</Button>} /></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {companies.map((c) => (
            <Card key={c.id} className="p-5 group transition-all duration-200 hover:shadow-md hover:-translate-y-[1px]" data-testid="company-card">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-md bg-primary/10 flex items-center justify-center text-primary font-display font-bold">
                    {c.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-display font-semibold text-slate-900 leading-tight">{c.name}</p>
                    <p className="text-xs text-slate-400">{c.legal_form} · {c.uid_vat || "No UID"}</p>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(c)} data-testid="edit-company-btn" className="p-1.5 rounded hover:bg-slate-100 text-slate-500"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => setDeleteId(c.id)} data-testid="delete-company-btn" className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="mt-4 space-y-1 text-sm text-slate-600">
                <p>{c.contact_person || "—"}</p>
                <p className="text-slate-400 text-xs">{c.email || "no email"} · {c.phone || "no phone"}</p>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <StatusBadge status={c.vat_status === "VAT Registered" ? "reviewed" : "pending"} />
                <button onClick={() => navigate(`/companies/${c.id}`)} data-testid="open-company-btn"
                  className="text-sm text-primary font-medium flex items-center gap-1 hover:gap-2 transition-all">
                  Open <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Company" : "New Company"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the company profile, accounting defaults, and contact details."
                : "Add a new client company with the basic profile and accounting settings."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field("name", "Company Name *")}
            {sel("legal_form", "Legal Form", ["GmbH", "AG", "Sàrl", "SA", "Einzelfirma", "Kollektivgesellschaft"])}
            {field("uid_vat", "UID / VAT Number")}
            {field("contact_person", "Contact Person")}
            {field("email", "Email")}
            {field("phone", "Phone")}
            {field("fiscal_year", "Fiscal Year")}
            {sel("vat_status", "VAT Status", ["VAT Registered", "Not Registered", "Flat Rate"])}
            {sel("accounting_method", "Accounting Method", ["Accrual", "Cash"])}
            <div className="sm:col-span-2">{field("address", "Address")}</div>
            <div className="sm:col-span-2">{field("notes", "Notes", "textarea")}</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} data-testid="save-company-btn">{editing ? "Save Changes" : "Create Company"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this company?</AlertDialogTitle>
            <AlertDialogDescription>This removes the company and all its documents, invoices and tasks. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} data-testid="confirm-delete-btn" className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
