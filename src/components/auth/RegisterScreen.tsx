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
import { registerUser, validateToken } from '../../services/authService';
import { useAuthStore } from '../../store/useAuthStore';

type Props = {
  onSwitchToLogin: () => void;
};

export function RegisterScreen({ onSwitchToLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();

  async function handleRegister() {
    if (!username.trim() || !password.trim() || !confirmPassword.trim()) {
      Alert.alert('Kesalahan', 'Silakan lengkapi semua bidang');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Kesalahan', 'Password tidak cocok');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Kesalahan', 'Password harus minimal 6 karakter');
      return;
    }

    setLoading(true);
    try {
      const result = await registerUser(username, password);
      
      if (result.success) {
        // Verify token immediately
        const validation = await validateToken(result.token);
        if (validation.success) {
          setAuth(result.userId, result.username, result.token);
          Alert.alert('Berhasil', `Selamat datang, ${result.username}!`);
        }
      }
    } catch (error: any) {
      Alert.alert('Gagal Daftar', error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.formCard}>
          <Text style={styles.title}>Buat Akun</Text>
          <Text style={styles.subtitle}>Bergabung dengan komunitas habit tracker</Text>

          <TextInput
            style={styles.input}
            placeholder="Pilih username"
            placeholderTextColor="#999"
            value={username}
            onChangeText={setUsername}
            editable={!loading}
          />

          <TextInput
            style={styles.input}
            placeholder="Password (min. 6 karakter)"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
          />

          <TextInput
            style={styles.input}
            placeholder="Konfirmasi password"
            placeholderTextColor="#999"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            editable={!loading}
          />

          <Pressable
            style={[styles.registerButton, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.registerButtonText}>Buat Akun</Text>
            )}
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>atau</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            style={styles.loginLink}
            onPress={onSwitchToLogin}
            disabled={loading}
          >
            <Text style={styles.loginLinkText}>Sudah punya akun? <Text style={styles.loginLinkBold}>Masuk</Text></Text>
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
  registerButton: {
    backgroundColor: '#4C9A2A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8
  },
  buttonDisabled: {
    opacity: 0.6
  },
  registerButtonText: {
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
  loginLink: {
    alignItems: 'center',
    paddingVertical: 8
  },
  loginLinkText: {
    color: '#6B7280',
    fontSize: 14
  },
  loginLinkBold: {
    color: '#2563EB',
    fontWeight: '700'
  }
});
