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
  const project = path.match(/^\/projects\/([0-9a-f-]{36})(\/.*)?$/i);
  if (project) return router.push({ pathname: '/projects/[id]', params: { id: project[1]! } });
  const customer = path.match(/^\/customers\/([0-9a-f-]{36})$/i);
  if (customer) return router.push({ pathname: '/customers/[id]', params: { id: customer[1]! } });
  const native: Record<string, Parameters<typeof router.push>[0]> = {
    '/qc': '/qc', '/approvals': '/approvals', '/projects': '/projects', '/notifications': '/notifications',
    '/expenses': '/expenses', '/customers': '/customers', '/suppliers': '/suppliers', '/team': '/team',
    '/hr': '/hr/requests', '/hr/requests': '/hr/approvals', '/my-tasks': '/tasks', '/tlines-pm/installation': '/installations',
  };
  if (native[path]) return router.push(native[path]);
  void Linking.openURL(`${API_URL}${href}`);
}
