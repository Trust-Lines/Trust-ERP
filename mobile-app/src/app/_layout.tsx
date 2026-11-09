import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts, InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold, InstrumentSans_700Bold,
} from '@expo-google-fonts/instrument-sans';
import { AuthProvider, useAuth } from '@/lib/auth';
import { AppLock } from '@/lib/lock';
import { UI } from '@/ui/theme';

function RootStack() {
  const { ready, session } = useAuth();
  if (!ready) return <View style={{ flex: 1, backgroundColor: UI.ink }} />;
  const signedIn = !!session;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: UI.surface } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" />
        <Stack.Screen name="forgot-password" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold, InstrumentSans_700Bold });
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: UI.ink }} />;
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="auto" />
        <AppLock><RootStack /></AppLock>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
