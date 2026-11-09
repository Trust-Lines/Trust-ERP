// 029 · Masraflar / 099 · muhasebe onayı — GET /api/expenses (EXPENSE_READ_ROLES), totals per currency;
// tapping a row marks it paid / unpaid (PATCH, EXPENSE_WRITE_ROLES).
import { useState } from 'react';
import { Alert as RNAlert, View } from 'react-native';
import { api } from '@/lib/api';
import { router } from 'expo-router';
import { useApi } from '@/lib/useApi';
import { dayShort } from '@/lib/format';
import { EXPENSE_CATEGORY_TR, money, type Expense, type Totals } from '@/features/finance';
import { Back, Chip, Empty, ErrorView, Header, Ico, Li, List, Loading, Note, Screen, Seg, Stat } from '@/ui/kit';
import { C } from '@/ui/theme';

export default function Expenses() {
  const q = useApi<{ expenses: Expense[]; totals: Totals; schemaError?: string }>('/api/expenses');
  const [tab, setTab] = useState<'unpaid' | 'paid' | 'all'>('unpaid');
  const all = q.data?.expenses ?? [];
  const rows = tab === 'all' ? all : all.filter(e => (tab === 'paid') === e.is_paid);
  const usd = q.data?.totals?.USD;

  return (
    <Screen onRefresh={q.reload} refreshing={q.refreshing}>
      <Back label="Geri" />
      <Header title="Masraflar" icon="plus" iconLabel="Yeni masraf" onIcon={() => router.push('/expenses/new')} />
      {q.loading ? <Loading /> : q.error ? <ErrorView message={q.error} onRetry={q.reload} /> : (
        <>
          {usd ? (
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <Stat value={money(usd.unpaid, 'USD')} label="Ödenmemiş" color={C.warningD} />
              <Stat value={money(usd.paid, 'USD')} label="Ödendi" color={C.successD} />
            </View>
          ) : null}
          <Seg value={tab} onChange={setTab} items={[
            { key: 'unpaid', label: 'Ödenmemiş', count: all.filter(e => !e.is_paid).length },
            { key: 'paid', label: 'Ödendi' }, { key: 'all', label: 'Tümü' },
          ]} />
          {q.data?.schemaError ? <Note>{q.data.schemaError}</Note> : null}
          {rows.length === 0 ? <Empty icon="receipt" tone="a" title="Masraf yok" /> : (
            <List>
              {rows.map(e => (
                <Li key={e.id} left={<Ico name="receipt" tone={e.is_paid ? 'g' : 'a'} />}
                  title={e.description || EXPENSE_CATEGORY_TR[e.category] || e.category}
                  sub={`${EXPENSE_CATEGORY_TR[e.category] ?? e.category} · ${dayShort(e.expense_date ?? e.created_at)}`}
                  onPress={() => RNAlert.alert(e.is_paid ? 'Ödenmedi olarak işaretle?' : 'Ödendi olarak işaretle?', money(Number(e.amount), e.currency), [
                    { text: 'Vazgeç', style: 'cancel' },
                    { text: 'Onayla', onPress: () => api(`/api/expenses/${e.id}`, { method: 'PATCH', body: { is_paid: !e.is_paid } })
                      .then(() => q.reload()).catch(err => RNAlert.alert('Kaydedilemedi', err instanceof Error ? err.message : '')) },
                  ])}
                  right={<View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Chip label={money(Number(e.amount), e.currency)} tone={e.is_paid ? 'g' : 'a'} />
                  </View>} />
              ))}
            </List>
          )}
        </>
      )}
    </Screen>
  );
}
