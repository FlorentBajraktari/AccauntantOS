import React from "react";
import InvoiceModule from "@/components/InvoiceModule";

export default function Payables() {
  return (
    <InvoiceModule
      type="payables"
      partyField="supplier"
      title="Accounts Payable"
      subtitle="Track supplier invoices, aging and overdue balances"
      excelKey="ap_aging"
    />
  );
}
