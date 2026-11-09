import { Linking } from 'react-native';
import { router } from 'expo-router';
import { API_URL } from './api';

/**
 * Opens a platform link (my-day / notification hrefs are web paths). Screens that exist in the
 * app open natively; everything else opens the same page on the web.
 */
export function openHref(href: string) {
  const path = href.split('?')[0]!;
  const container = path.match(/^\/logistics\/([0-9a-f-]{36})$/i);
  if (container) return router.push({ pathname: '/containers/[id]', params: { id: container[1]! } });
  if (path === '/logistics') return router.push('/containers');
  if (path === '/qc') return router.push('/qc');
  if (path === '/approvals') return router.push('/approvals');
  void Linking.openURL(`${API_URL}${href}`);
}
