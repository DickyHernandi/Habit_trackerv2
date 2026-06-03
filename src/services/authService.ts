const BACKEND_URL =
  process.env.BACKEND_URL ||
  'https://habittrackerv2-production.up.railway.app';

export async function registerUser(username: string, password: string) {
  try {
    const response = await fetch(`${BACKEND_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    return data; // { success, token, userId, username }
  } catch (error) {
    throw error;
  }
}

export async function loginUser(username: string, password: string) {
  try {
    const response = await fetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    return data; // { success, token, userId, username }
  } catch (error) {
    throw error;
  }
}

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
      throw new Error(data.error || 'Token validation failed');
    }

    return data; // { success, userId, username }
  } catch (error) {
    throw error;
  }
}
