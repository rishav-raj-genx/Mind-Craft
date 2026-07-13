import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { palette, radii } from '../../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGlobalAlert } from '@/components/GlobalAlertProvider';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginWithEmail } = useAuth();
  const { showAlert } = useGlobalAlert();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert({ type: 'warning', title: 'Missing details', message: 'Please enter your email and password.' });
      return;
    }
    
    setLoading(true);
    try {
      await loginWithEmail(email, password);
      router.replace('/(tabs)');
    } catch (err: any) {
      showAlert({ type: 'error', title: 'Login failed', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Mindcraft</Text>
            <Text style={styles.subtitle}>Your academic playground awaits.</Text>
          </View>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              placeholderTextColor={palette.muted}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={palette.muted}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.loginButton} 
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.loginButtonText}>{loading ? 'Logging In...' : 'Log In'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Link href="/signup" asChild>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Sign Up</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.surface,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 42,
    fontWeight: '900',
    color: palette.lime,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: palette.muted,
    fontWeight: '700',
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radii.xl,
    padding: 16,
    fontSize: 16,
    color: palette.ink,
    fontWeight: '700',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: -4,
  },
  forgotPasswordText: {
    color: palette.muted,
    fontWeight: '700',
    fontSize: 14,
  },
  loginButton: {
    backgroundColor: palette.lime,
    borderRadius: radii.pill,
    padding: 18,
    alignItems: 'center',
    marginTop: 12,
  },
  loginButtonText: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  footerText: {
    color: palette.muted,
    fontWeight: '700',
    fontSize: 16,
  },
  footerLink: {
    color: palette.limeDeep,
    fontWeight: '900',
    fontSize: 16,
  },
});
