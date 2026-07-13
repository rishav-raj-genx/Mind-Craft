import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { palette, radii } from '../../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGlobalAlert } from '@/components/GlobalAlertProvider';
import { api } from '@/services/api';
import Logo from '@/components/Logo';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [college, setCollege] = useState('');
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState('');
  const [teaches, setTeaches] = useState('');
  const [learns, setLearns] = useState('');
  
  const [loading, setLoading] = useState(false);
  const { registerWithEmail } = useAuth();
  const { showAlert } = useGlobalAlert();
  const router = useRouter();

  const handleSignup = async () => {
    if (!email || !password || !name || !college || !department || !year || !teaches || !learns) {
      showAlert({ type: 'warning', title: 'Missing details', message: 'Please fill out all fields.' });
      return;
    }
    
    setLoading(true);
    try {
      // 1. Create user in Firebase Auth
      const userCredential = await registerWithEmail(email, password);
      const user = userCredential.user;

      // 2. Register user in Backend
      await api.post('/user/register', {
        uid: user.uid,
        email: user.email,
        name: name.trim(),
        college: college.trim(),
        department: department.trim(),
        year: year.trim(),
        teaches: teaches.split(',').map(s => s.trim()).filter(Boolean),
        learns: learns.split(',').map(s => s.trim()).filter(Boolean),
        photoUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`,
      });

      router.replace('/(tabs)');
    } catch (err: any) {
      showAlert({ type: 'error', title: 'Signup failed', message: err.message });
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
            <Logo size={80} showWordmark />
            <Text style={styles.subtitle}>Create your profile to find study mates.</Text>
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

            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor={palette.muted}
              value={name}
              onChangeText={setName}
            />

            <TextInput
              style={styles.input}
              placeholder="College Name"
              placeholderTextColor={palette.muted}
              value={college}
              onChangeText={setCollege}
            />

            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.flex1]}
                placeholder="Department (e.g. CSE)"
                placeholderTextColor={palette.muted}
                value={department}
                onChangeText={setDepartment}
              />
              <TextInput
                style={[styles.input, styles.flex1]}
                placeholder="Year (e.g. 1st)"
                placeholderTextColor={palette.muted}
                value={year}
                onChangeText={setYear}
              />
            </View>

            <TextInput
              style={styles.input}
              placeholder="Skills to Teach (comma separated)"
              placeholderTextColor={palette.muted}
              value={teaches}
              onChangeText={setTeaches}
            />

            <TextInput
              style={styles.input}
              placeholder="Skills to Learn (comma separated)"
              placeholderTextColor={palette.muted}
              value={learns}
              onChangeText={setLearns}
            />

            <TouchableOpacity 
              style={styles.loginButton} 
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.loginButtonText}>{loading ? 'Creating Account...' : 'Sign Up'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Log In</Text>
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
    paddingTop: 48,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  subtitle: {
    fontSize: 16,
    color: palette.muted,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
  form: {
    gap: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  flex1: {
    flex: 1,
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
    marginBottom: 32,
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
