import Constants from 'expo-constants';

// Service ini bertugas menghubungkan frontend dengan backend untuk proses registrasi dan login.
const BACKEND_URL =
  // Lebih disarankan menggunakan variabel dari expo config agar bisa diubah sesuai environment (dev, staging, prod).
  (Constants.expoConfig?.extra as any)?.BACKEND_URL ||
  // Alternatif fallback jika variabel di atas tidak tersedia, misalnya saat testing lokal.
  process.env.BACKEND_URL ||
  'https://habittrackerv2-production.up.railway.app';

// Fungsi ini mengirim data registrasi ke backend dan mengembalikan respons hasil pendaftaran.
export async function registerUser(username: string, password: string) {
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
