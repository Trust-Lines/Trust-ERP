import { Alert, Linking } from 'react-native';
import { api } from '@/lib/api';

/** 042 · opens a document through a temporary Dropbox link (GET /api/files/view — same access check as the web viewer). */
export async function openDoc(documentId: string) {
  try {
    const { link } = await api<{ link: string }>(`/api/files/view?documentId=${documentId}`);
    await Linking.openURL(link);
  } catch (e) {
    Alert.alert('Açılamadı', e instanceof Error ? e.message : '');
  }
}
