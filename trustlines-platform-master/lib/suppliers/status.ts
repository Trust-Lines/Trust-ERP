import { invoiceStatusFor } from './config';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function syncInvoiceStatus(admin: any, invoiceId: string | null | undefined): Promise<void> {
  if (!invoiceId) return;
  const { data: inv } = await admin.from('supplier_invoices').select('amount').eq('id', invoiceId).maybeSingle();
  if (!inv) return;
  const { data: pays } = await admin.from('supplier_payments').select('amount').eq('invoice_id', invoiceId).is('deleted_at', null);
  const paid = (pays ?? []).reduce((s: number, p: { amount: number }) => s + (Number(p.amount) || 0), 0);
  const status = invoiceStatusFor(Number(inv.amount) || 0, paid);
  await admin.from('supplier_invoices').update({ status }).eq('id', invoiceId);
}
