import { getBackendUrl } from './backendConfig';

// Service ini bertugas menghubungkan frontend dengan backend untuk proses registrasi, login, dan pendaftaran device token.
// URL backend dibaca saat runtime agar bisa diubah tanpa build ulang.
export async function registerUser(username: string, password: string) {
  const BACKEND_URL = await getBackendUrl();
  console.log('[Frontend] registerUser: memanggil backend register', { username, backendUrl: BACKEND_URL });
  try {
    const response = await fetch(`${BACKEND_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();
    console.log('[Frontend] registerUser: response', { status: response.status, data });

    if (!response.ok) {
      throw new Error(data.error || 'Pendaftaran gagal');
    }

    return data; // { success, token, userId, username }
  } catch (error) {
    console.error('[Frontend] registerUser: gagal', error);
    throw error;
  }
}

// Fungsi ini mengirim kredensial login ke backend dan mengembalikan token hasil autentikasi.
export async function loginUser(username: string, password: string) {
  const BACKEND_URL = await getBackendUrl();
  console.log('[Frontend] loginUser: memanggil backend login', { username, backendUrl: BACKEND_URL });
  try {
    const response = await fetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();
    console.log('[Frontend] loginUser: response', { status: response.status, data });

    if (!response.ok) {
      throw new Error(data.error || 'Login gagal');
    }

    return data; // { success, token, userId, username }
  } catch (error) {
    console.error('[Frontend] loginUser: gagal', error);
    throw error;
  }
}

// Fungsi ini memastikan token pengguna masih berlaku sebelum aplikasi lanjut ke halaman yang membutuhkan sesi login.
export async function validateToken(token: string) {
  const BACKEND_URL = await getBackendUrl();
  console.log('[Frontend] validateToken: memanggil backend validate', { backendUrl: BACKEND_URL });
  try {
    const response = await fetch(`${BACKEND_URL}/auth/validate`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Validasi token gagal');
    }

    return data; // { success, userId, username }
  } catch (error) {
    throw error;
  }
}

export function isExpoPushToken(token: string | null | undefined) {
  return typeof token === 'string' && (
    token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[')
  );
}

export async function registerDeviceToken(token: string, authToken: string) {
  const BACKEND_URL = await getBackendUrl();
  const validExpoToken = isExpoPushToken(token);
  console.log('[Frontend] registerDeviceToken: memanggil backend device-token', { token, backendUrl: BACKEND_URL, validExpoToken });

  if (!validExpoToken) {
    const errorMessage = 'Token Expo tidak valid';
    console.warn('[Frontend] registerDeviceToken: skip due to invalid token', { token });
    throw new Error(errorMessage);
  }

  try {
    const response = await fetch(`${BACKEND_URL}/auth/device-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ token })
    });

    const data = await response.json();
    console.log('[Frontend] registerDeviceToken: response', { status: response.status, data });

    if (!response.ok) {
      throw new Error(data.error || 'Gagal mendaftarkan device token');
    }

    return data;
  } catch (error) {
    console.error('[Frontend] registerDeviceToken: gagal', error);
    throw error;
  }
}
