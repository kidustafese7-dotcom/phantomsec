# Phantom Book

A real Firebase-powered book library using:
- Firebase Email/Password Authentication
- Firebase Realtime Database
- Firebase Storage
- Public free/premium book cards
- Search and category filtering
- Admin-only publishing
- Device PDF upload
- Built-in browser PDF reader
- Responsive glassmorphism / 3D UI

## 1. Firebase setup

Use the Firebase project from `app.js`.

In Firebase Console:
1. Authentication → Sign-in method → enable Email/Password.
2. Authentication → Users → create your admin user manually.
   There is intentionally NO public sign-up page.
3. Open that user and copy its UID.
4. In `app.js`, The project is already locked to the authorized admin UID:
   `OZ5sD1Lz8NNDJXoDifhfRxtQpKX2`

Do not change this UID unless you intentionally want to change the administrator.
5. In `database-rules.json`, replace the same placeholder with the UID.
6. In `storage.rules`, replace the same placeholder with the UID.
7. Realtime Database → Rules → paste `database-rules.json`.
8. Storage → Rules → paste `storage.rules`.

## 2. Run the website

Do not open `index.html` with `file://`.
Use a local web server, for example VS Code Live Server, or:

Python:
    python -m http.server 5500

Then open:
    http://localhost:5500

## 3. Admin

There is exactly ONE administrator account: the Firebase Authentication user you create manually.

There is NO public signup page.

Admin login:
    http://localhost:5500/login

After successful Firebase authentication, the app sends the admin to:
    http://localhost:5500/admin

If an unauthenticated person manually types `/admin`, the app immediately shows the login page and does not show the publishing panel.

If a non-admin Firebase account somehow exists, the app signs it out and refuses admin access.

The frontend checks the admin UID, but Firebase Security Rules are the actual security boundary. Even if someone modifies the JavaScript, Firebase will reject unauthorized database/storage writes.

## 4. Important behavior

All books, including Premium books, are visible as cards and can be read because no payment/access-control system was requested.

"Premium" here is a category/label. If you want premium books to require payment or a paid-user entitlement, add a payment/auth entitlement system and change the Storage read rules accordingly.

## 5. Deploy

You can deploy with Firebase Hosting, Netlify, Vercel, GitHub Pages (with the Firebase web SDK), or any static hosting service. HTTPS is recommended/required for production authentication flows.
