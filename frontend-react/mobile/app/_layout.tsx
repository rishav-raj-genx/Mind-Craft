import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';

import { GlobalAlertProvider } from '@/components/GlobalAlertProvider';
import { useColorScheme } from '@/components/useColorScheme';
import { palette, radii } from '@/constants/theme';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { useRouter, useSegments } from 'expo-router';

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <View style={styles.errorScreen}>
      <View style={styles.errorCard}>
        <Text style={styles.errorKicker}>Mindcraft</Text>
        <Text style={styles.errorTitle}>Oops, something went wrong</Text>
        <Text style={styles.errorMessage}>
          The app hit an unexpected screen error, but your phone is safe. Reload and we’ll try again.
        </Text>
        <Text style={styles.errorDetail} numberOfLines={2}>{error.message}</Text>
        <Pressable onPress={retry} style={styles.errorButton}>
          <Text style={styles.errorButtonText}>Reload App</Text>
        </Pressable>
      </View>
    </View>
  );
}

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { currentUser, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    
    if (!currentUser && !inAuthGroup) {
      // Redirect to the login page.
      router.replace('/(auth)/login');
    } else if (currentUser && inAuthGroup) {
      // Redirect away from the login page.
      router.replace('/(tabs)');
    }
  }, [currentUser, loading, segments, router]);

  return (
    <GlobalAlertProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        </Stack>
      </ThemeProvider>
    </GlobalAlertProvider>
  );
}

const styles = StyleSheet.create({
  errorScreen: {
    flex: 1,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorCard: {
    width: '100%',
    borderRadius: 32,
    backgroundColor: '#FFE9E2',
    padding: 24,
    alignItems: 'center',
    shadowColor: '#201A2E',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  errorKicker: {
    color: '#E44D35',
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  errorTitle: {
    color: palette.ink,
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
  },
  errorMessage: {
    color: palette.muted,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 10,
  },
  errorDetail: {
    color: '#9B3B2F',
    marginTop: 12,
    textAlign: 'center',
  },
  errorButton: {
    marginTop: 22,
    backgroundColor: palette.ink,
    borderRadius: radii.pill,
    paddingHorizontal: 24,
    paddingVertical: 13,
  },
  errorButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
  },
});
