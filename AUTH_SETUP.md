# Authentication Setup - Next Steps

You now have a complete authentication system set up! Here's what's been implemented:

## ✅ Frontend (Expo App)

### New Components
- **AuthModal** (`src/components/auth/AuthModal.tsx`) - Modal that switches between login/register
- **LoginScreen** (`src/components/auth/LoginScreen.tsx`) - User login interface
- **RegisterScreen** (`src/components/auth/RegisterScreen.tsx`) - User registration interface

### New Services & Store
- **authService** (`src/services/authService.ts`) - Communicates with the backend
- **useAuthStore** (`src/store/useAuthStore.ts`) - Global auth state (Zustand)

### App Flow
- On app launch, **AuthModal** appears if user is not authenticated
- Users can register (defaults to register screen) or switch to login
- Session is restored from AsyncStorage on app restart
- **Logout button** added to Profile screen
- Credentials stay encrypted locally until logout/uninstall

## 🚀 Backend (Node.js + Express)

### Setup Instructions

1. **Get Firebase Service Account Key**
   ```bash
   # Go to: Firebase Console > Project Settings > Service Accounts
   # Click "Generate New Private Key"
   # Save the JSON file as: backend/serviceAccountKey.json
   ```

2. **Install Backend Dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Create .env File**
   ```bash
   cp .env.example .env
   ```
   Then edit `.env`:
   ```
   PORT=3000
   JWT_SECRET=your-random-secret-key-here
   FIREBASE_PROJECT_ID=your-firebase-project-id
   NODE_ENV=development
   ```

4. **Run the Backend**
   ```bash
   npm start        # Production
   npm run dev      # Development (auto-reload)
   ```

The server will start on `http://localhost:3000`

## 📱 Frontend Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```
   (Already done - AsyncStorage was added)

2. **Update Backend URL** (if not localhost)
   - Edit `src/services/authService.ts`
   - Change `BACKEND_URL` to match your backend host

3. **Start the App**
   ```bash
   npm start
   ```

## 🔄 How Authentication Works

### Registration Flow
1. User enters username & password
2. Frontend validates input
3. Calls `POST /auth/register` endpoint
4. Backend hashes password with bcryptjs
5. Backend creates user in Firestore (`auth_users` collection)
6. Returns JWT token
7. Token stored in AsyncStorage
8. User is logged in

### Login Flow
1. User enters username & password
2. Frontend calls `POST /auth/login` endpoint
3. Backend finds user by username (case-insensitive)
4. Verifies password with bcryptjs
5. Returns JWT token
6. Token stored in AsyncStorage
7. User is logged in

### Session Persistence
1. On app startup, `restoreSession()` is called
2. Checks AsyncStorage for saved token
3. Validates token with backend
4. If valid, user stays logged in
5. If invalid/expired, user sees login screen

### Logout
1. User clicks logout button in Profile
2. Confirms action via Alert dialog
3. Token removed from AsyncStorage
4. Auth state cleared
5. AuthModal appears again

## 🔐 Security Notes

- **Passwords are hashed** using bcryptjs (10 rounds)
- **Never stored as plaintext**
- **JWT tokens expire** after 30 days
- **Use HTTPS in production** (not localhost)
- **Change JWT_SECRET** to a strong random string in production

## 📊 Database Structure

### Firestore Collections

**auth_users** (for authentication)
```
{
  username: "john" (lowercase)
  password: "<hashed>"
  createdAt: timestamp
  points: 0
  level: 1
  streak: 0
  lastCompletedDate: null
}
```

**users** (for app data - already exists)
```
{
  username: "john"
  points: 0
  level: 1
  streak: 0
  habits: [...]
  achievements: [...]
}
```

## 🐛 Troubleshooting

### Backend won't start
- Check if port 3000 is already in use
- Verify serviceAccountKey.json exists
- Check .env file has correct values

### Login always fails
- Ensure backend is running
- Check username is correct (case-insensitive)
- Verify password is correct
- Check internet connection

### Frontend can't reach backend
- Check backend URL in `authService.ts`
- Make sure backend is running
- Try localhost vs IP address if on different devices

## 🎯 Next Steps

1. Set up backend environment (serviceAccountKey.json, .env)
2. Install backend dependencies
3. Run backend: `npm start`
4. Run frontend app: `npm start`
5. Create account and test login/logout flow
6. Deploy backend to cloud when ready (Heroku, Railway, Render)

---

**Notes:**
- Users are automatically created in both `auth_users` and `users` collections
- Existing habits still belong to the authenticated user
- You can migrate existing data to use the auth system if needed
