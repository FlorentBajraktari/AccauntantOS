import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function CompanySelect({ value, onChange, companies, includeAll = true, testid = "company-filter" }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[220px] bg-white" data-testid={testid}>
        <SelectValue placeholder="Select company" />
      </SelectTrigger>
      <SelectContent>
        {includeAll && <SelectItem value="all">All Companies</SelectItem>}
        {companies.map((c) => (
          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
