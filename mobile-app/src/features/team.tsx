import { View } from 'react-native';
import { initials } from '@/lib/format';
import { T } from '@/ui/kit';
import { C } from '@/ui/theme';

// GET /api/mobile/team.
export interface Person { id: string; full_name: string; email: string; role: string | null; office: string | null; department: string | null; is_active: boolean }

export const Avatar = ({ name, size = 36 }: { name: string; size?: number }) => (
  <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.S600, alignItems: 'center', justifyContent: 'center' }}>
    <T w={700} size={size * 0.36} color={C.white}>{initials(name)}</T>
  </View>
);
