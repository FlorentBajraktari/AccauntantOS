import React, { useEffect, useState } from "react";
import { FileSpreadsheet, Download, Info } from "lucide-react";
import { toast } from "sonner";
import { api, downloadFile } from "@/lib/api";
import { PageHeader, Card, Loading } from "@/components/common";
import CompanySelect from "@/components/CompanySelect";
import { useI18n } from "@/i18n/I18nContext";
import { Button } from "@/components/ui/button";

export default function ExcelCenter() {
  const { t } = useI18n();
  const [templates, setTemplates] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [company, setCompany] = useState("all");

  useEffect(() => {
    api.get("/excel/templates").then((r) => setTemplates(r.data.templates));
    api.get("/companies").then((r) => setCompanies(r.data));
  }, []);

  const download = (key, title) => {
    const q = company !== "all" ? `?company_id=${company}` : "";
    toast.promise(downloadFile(`/excel/download/${key}${q}`, `${key}.xlsx`),
      { loading: `Generating ${title}…`, success: `${title} downloaded`, error: "Export failed" });
  };

  if (!templates) return <Loading label="Loading Excel templates" />;

  return (
    <div>
      <PageHeader title={t("pages.excel.title")} subtitle={t("pages.excel.subtitle")} />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <CompanySelect value={company} onChange={setCompany} companies={companies} />
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Info className="h-3.5 w-3.5" /> Data-backed templates auto-fill with the selected company's records.
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {templates.map((t) => (
          <Card key={t.key} className="p-5 flex flex-col group transition-all duration-200 hover:shadow-md hover:-translate-y-[1px]" data-testid="excel-template-card">
            <div className="h-10 w-10 rounded-md bg-emerald-50 flex items-center justify-center mb-3">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" strokeWidth={1.5} />
            </div>
            <h3 className="font-display font-semibold text-slate-800 leading-tight">{t.title}</h3>
            <p className="text-xs text-slate-500 mt-1 flex-1">{t.description}</p>
            <Button variant="outline" className="mt-4 w-full transition-all group-hover:bg-primary group-hover:text-white group-hover:border-primary"
              data-testid={`download-${t.key}`} onClick={() => download(t.key, t.title)}>
              <Download className="h-4 w-4 mr-1" /> Download
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
