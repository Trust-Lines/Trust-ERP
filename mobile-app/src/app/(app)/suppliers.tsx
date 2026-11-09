// Tedarikçiler — GET /api/suppliers (SUPPLIER_READ_ROLES — Trust Lines internal; never tlines_pm).
import { useState } from 'react';
import { useApi } from '@/lib/useApi';
import { Back, Empty, ErrorView, Field, Header, Ico, Li, List, Loading, Screen } from '@/ui/kit';

interface Supplier { id: string; code: string | null; name: string; country: string | null; email: string | null; phone: string | null; is_active: boolean }

export default function Suppliers() {
  const [q, setQ] = useState('');
  const res = useApi<{ suppliers: Supplier[] }>('/api/suppliers');
  const needle = q.trim().toLocaleLowerCase('tr-TR');
  const rows = (res.data?.suppliers ?? []).filter(s => !needle || `${s.name} ${s.code ?? ''}`.toLocaleLowerCase('tr-TR').includes(needle));
  return (
    <Screen onRefresh={res.reload} refreshing={res.refreshing}>
      <Back label="Geri" />
      <Header title="Tedarikçiler" />
      <Field icon="search" placeholder="Tedarikçi ara…" value={q} onChangeText={setQ} />
      {res.loading ? <Loading /> : res.error ? <ErrorView message={res.error} onRetry={res.reload} /> : rows.length === 0 ? (
        <Empty icon="truck" tone="i" title="Tedarikçi yok" />
      ) : (
        <List>
          {rows.map(s => (
            <Li key={s.id} left={<Ico name="truck" tone={s.is_active ? 'i' : 'n'} />} title={`${s.code ? `${s.code} · ` : ''}${s.name}`}
              sub={[s.country, s.phone ?? s.email].filter(Boolean).join(' · ') || undefined} />
          ))}
        </List>
      )}
    </Screen>
  );
}
