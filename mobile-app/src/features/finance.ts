// GET/POST /api/expenses (lib/expenses/config.ts).
export interface Expense {
  id: string; category: string; description: string | null; currency: string; amount: number;
  expense_date: string | null; project_id: string | null; supplier_id: string | null; is_paid: boolean; created_at: string;
}
export type Totals = Record<string, { total: number; paid: number; unpaid: number }>;
export const EXPENSE_CATEGORY_TR: Record<string, string> = {
  customs: 'Gümrük', logistics: 'Lojistik', office: 'Ofis', travel: 'Seyahat', salary: 'Maaş', rent: 'Kira',
  utilities: 'Faturalar', marketing: 'Pazarlama', tax: 'Vergi', other: 'Diğer',
};
export const CURRENCIES = ['USD', 'TL', 'EUR'] as const;
export const money = (n: number, cur: string) =>
  `${n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${cur === 'TL' ? '₺' : cur === 'EUR' ? '€' : '$'}`;
