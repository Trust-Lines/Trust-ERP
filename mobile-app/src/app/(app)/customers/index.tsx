// Müşteriler — GET /api/customers (CUSTOMER_READ_ROLES), T-Lines' real end customers.
import { useState } from 'react';
import { router } from 'expo-router';
import { useApi } from '@/lib/useApi';
import { Back, Chip, Empty, ErrorView, Field, Header, Ico, Li, List, Loading, Screen } from '@/ui/kit';

interface Customer { id: string; name: string; code: string | null; industry: string | null; email: string | null; phone: string | null; status: string | null }

export default function Customers() {
  const [q, setQ] = useState('');
  const res = useApi<{ customers: Customer[] }>('/api/customers');
  const needle = q.trim().toLocaleLowerCase('tr-TR');
  const rows = (res.data?.customers ?? []).filter(c => !needle || `${c.name} ${c.code ?? ''}`.toLocaleLowerCase('tr-TR').includes(needle));
  return (
    <Screen onRefresh={res.reload} refreshing={res.refreshing}>
      <Back label="Geri" />
      <Header title="Müşteriler" />
      <Field icon="search" placeholder="Müşteri ara…" value={q} onChangeText={setQ} />
      {res.loading ? <Loading /> : res.error ? <ErrorView message={res.error} onRetry={res.reload} /> : rows.length === 0 ? (
        <Empty icon="building" tone="i" title="Müşteri yok" />
      ) : (
        <List>
          {rows.map(c => (
            <Li key={c.id} left={<Ico name="building" />} title={c.name} sub={[c.code, c.industry].filter(Boolean).join(' · ') || undefined}
              right={c.status ? <Chip label={c.status} tone={c.status === 'active' ? 'g' : 'n'} /> : undefined}
              chevron onPress={() => router.push({ pathname: '/customers/[id]', params: { id: c.id } })} />
          ))}
        </List>
      )}
    </Screen>
  );
}
