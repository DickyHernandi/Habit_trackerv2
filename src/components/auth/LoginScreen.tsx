import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';
import { loginUser, validateToken } from '../../services/authService';
import { useAuthStore } from '../../store/useAuthStore';

type Props = {
  onSwitchToRegister: () => void;
};

export function LoginScreen({ onSwitchToRegister }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();

  async function handleLogin() {
    console.log('[LoginScreen] handleLogin called', { username });
    if (!username.trim() || !password.trim()) {
      Alert.alert('Kesalahan', 'Silakan masukkan username dan password');
      return;
    }

    setLoading(true);
    try {
      const result = await loginUser(username, password);
      console.log('[LoginScreen] loginUser result', result);
      
      if (result.success) {
        // Verify token immediately
        const validation = await validateToken(result.token);
        console.log('[LoginScreen] validateToken result', validation);
        if (validation.success) {
          setAuth(result.userId, result.username, result.token);
        }
      }
    } catch (error: any) {
      console.error('[LoginScreen] login failed', error);
      Alert.alert('Gagal Masuk', error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.formCard}>
          <Text style={styles.title}>Selamat Datang Kembali</Text>
          <Text style={styles.subtitle}>Masuk ke akun Anda</Text>

          <TextInput
            style={styles.input}
            placeholder="Nama pengguna"
            placeholderTextColor="#999"
            value={username}
            onChangeText={setUsername}
            editable={!loading}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
          />

          <Pressable
            style={[styles.loginButton, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.loginButtonText}>Masuk</Text>
            )}
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>atau</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            style={styles.signupLink}
            onPress={onSwitchToRegister}
            disabled={loading}
          >
            <Text style={styles.signupLinkText}>Belum punya akun? <Text style={styles.signupLinkBold}>Daftar</Text></Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    justifyContent: 'center'
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20
  },
  formCard: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    marginBottom: 14
  },
  loginButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8
  },
  buttonDisabled: {
    opacity: 0.6
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700'
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    gap: 12
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB'
  },
  dividerText: {
    color: '#9CA3AF',
    fontSize: 12
  },
  signupLink: {
    alignItems: 'center',
    paddingVertical: 8
  },
  signupLinkText: {
    color: '#6B7280',
    fontSize: 14
  },
  signupLinkBold: {
    color: '#2563EB',
    fontWeight: '700'
  }
});
