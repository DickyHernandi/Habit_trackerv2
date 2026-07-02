import { getBackendUrl } from './backendConfig';

// Service ini bertugas menghubungkan frontend dengan backend untuk proses registrasi dan login.
// URL backend dibaca saat runtime agar bisa diubah tanpa build ulang.
export async function registerUser(username: string, password: string) {
  const BACKEND_URL = await getBackendUrl();
  try {
    const response = await fetch(`${BACKEND_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Pendaftaran gagal');
    }

    return data; // { success, token, userId, username }
  } catch (error) {
    throw error;
  }
}

// Fungsi ini mengirim kredensial login ke backend dan mengembalikan token hasil autentikasi.
export async function loginUser(username: string, password: string) {
  const BACKEND_URL = await getBackendUrl();
  try {
    const response = await fetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login gagal');
    }

    return data; // { success, token, userId, username }
  } catch (error) {
    throw error;
  }
}

// Fungsi ini memastikan token pengguna masih berlaku sebelum aplikasi lanjut ke halaman yang membutuhkan sesi login.
export async function validateToken(token: string) {
  const BACKEND_URL = await getBackendUrl();
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

export async function registerDeviceToken(token: string, authToken: string) {
  const BACKEND_URL = await getBackendUrl();
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

    if (!response.ok) {
      throw new Error(data.error || 'Gagal mendaftarkan device token');
    }

    return data;
  } catch (error) {
    throw error;
  }
}
