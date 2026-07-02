import React from "react";
import InvoiceModule from "@/components/InvoiceModule";

export default function Receivables() {
  return (
    <InvoiceModule
      type="receivables"
      partyField="customer"
      title="Accounts Receivable"
      subtitle="Track customer invoices, reminders and outstanding balances"
      excelKey="ar_aging"
    />
  );
}
