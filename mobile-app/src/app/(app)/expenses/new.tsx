// 013 · Masraf fişi — POST /api/expenses (EXPENSE_WRITE_ROLES; the API answers 403 for others).
// Receipt photo upload needs a Dropbox endpoint — next slice.
import { useState } from 'react';
import { Alert as RNAlert } from 'react-native';
import { router } from 'expo-router';
import { api } from '@/lib/api';
import { CURRENCIES, EXPENSE_CATEGORY_TR } from '@/features/finance';
import { Back, Btn, Choice, Field, Lbl, Note, Screen, Title } from '@/ui/kit';

const today = () => new Date().toISOString().slice(0, 10);

export default function NewExpense() {
  const [category, setCategory] = useState('other');
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>('USD');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const value = Number(amount.replace(',', '.'));
  const valid = Number.isFinite(value) && value > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date);

  async function save() {
    setBusy(true);
    try {
      await api('/api/expenses', { method: 'POST', body: { category, currency, amount: value, expense_date: date, description: description.trim() || null } });
      router.back();
    } catch (e) {
      RNAlert.alert('Kaydedilemedi', e instanceof Error ? e.message : 'Tekrar dene.');
    } finally { setBusy(false); }
  }

  return (
    <Screen sticky={<Btn label="Masrafı kaydet" onPress={save} loading={busy} disabled={!valid} style={{ flex: 0 }} />}>
      <Back label="Masraflar" />
      <Title title="Yeni masraf" />
      <Lbl>Kategori</Lbl>
      <Choice value={category} onChange={setCategory} items={Object.entries(EXPENSE_CATEGORY_TR).map(([key, label]) => ({ key, label }))} />
      <Lbl>Para birimi</Lbl>
      <Choice value={currency} onChange={setCurrency} items={CURRENCIES.map(c => ({ key: c, label: c }))} />
      <Field label="Tutar" placeholder="0,00" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
      <Field label="Tarih (YYYY-AA-GG)" value={date} onChangeText={setDate} autoCorrect={false} />
      <Field label="Açıklama" placeholder="Ne için?" value={description} onChangeText={setDescription} multiline />
      <Note>Fiş fotoğrafı yükleme bir sonraki sürümde.</Note>
    </Screen>
  );
}
