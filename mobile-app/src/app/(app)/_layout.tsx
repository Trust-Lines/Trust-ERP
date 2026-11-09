import { Stack } from 'expo-router';
import { UI } from '@/ui/theme';

// Everything behind sign-in (the root layout only mounts this group with a session).
export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: UI.surface } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
    </Stack>
  );
}
