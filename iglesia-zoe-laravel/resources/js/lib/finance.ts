/** One expense as the Gastos and Finanzas pages receive it (Expense::row on the server). */
export type ExpenseRow = { id: string; spent_on: string; category: string; detail: string; amount: number; by: string; receipt: string | null; is_pdf: boolean };
