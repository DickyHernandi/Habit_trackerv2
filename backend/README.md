# Habit Tracker Backend

Simple Node.js + Express backend for user authentication.

## Setup

1. **Get Firebase Service Account Key**
   - Go to Firebase Console > Project Settings > Service Accounts
   - Click "Generate New Private Key"
   - Save as `serviceAccountKey.json` in this backend folder

2. **Install Dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Create .env file**
   ```bash
   cp .env.example .env
   ```
   Then update `.env` with:
   - `JWT_SECRET` - any secure random string
   - `FIREBASE_PROJECT_ID` - your Firebase project ID
   - `PORT` - default is 3000

4. **Run the server**
   ```bash
   npm start        # Production
   npm run dev      # Development (auto-reload)
   ```

## API Endpoints

### Register
```
POST /auth/register
Body: { "username": "john", "password": "password123" }
Response: { "success": true, "token": "...", "userId": "...", "username": "john" }
```

### Login
```
POST /auth/login
Body: { "username": "john", "password": "password123" }
Response: { "success": true, "token": "...", "userId": "...", "username": "john" }
```

### Validate Token
```
POST /auth/validate
Headers: { "Authorization": "Bearer <token>" }
Response: { "success": true, "userId": "...", "username": "john" }
```

## Notes

- Usernames are stored in lowercase (case-insensitive)
- Passwords are hashed with bcryptjs
- Tokens expire after 30 days
- Users created in two collections: `auth_users` (for auth) and `users` (for app data)
