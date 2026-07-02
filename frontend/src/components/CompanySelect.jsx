import React from "react";
import { useI18n } from "@/i18n/I18nContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function CompanySelect({ value, onChange, companies, includeAll = true, testid = "company-filter" }) {
  const { t } = useI18n();
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[220px] bg-white" data-testid={testid}>
        <SelectValue placeholder={t("common.selectCompany")} />
      </SelectTrigger>
      <SelectContent>
        {includeAll && <SelectItem value="all">{t("common.allCompanies")}</SelectItem>}
        {companies.map((c) => (
          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
