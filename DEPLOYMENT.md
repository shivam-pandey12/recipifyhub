# RecipifyHub Deployment Checklist

## Required Environment Variables

Set these in your hosting provider, not in GitHub:

- `NODE_ENV=production`
- `MONGODB_URI`
- `SESSION_SECRET`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_WEB_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `TRUST_PROXY=true`
- `CORS_ORIGINS=https://your-domain.com`

Use `recipifyhub/.env.example` as the full template.

## Build And Start

From the app folder:

```bash
cd recipifyhub
npm ci
npm start
```

From the repository root:

```bash
npm --prefix recipifyhub ci
npm --prefix recipifyhub start
```

## Health Check

Use this endpoint for hosting health checks:

```text
/api/health
```

## Firebase Auth

Google login uses Firebase Authentication directly. In Firebase Console:

1. Enable Authentication > Sign-in method > Google.
2. Add your deployed domain in Authentication > Settings > Authorized domains.
3. Keep Firebase Admin credentials only in the host environment.

## GitHub Push Safety

Before pushing:

```bash
git status
git add .gitignore Procfile render.yaml DEPLOYMENT.md recipifyhub
git commit -m "Prepare RecipifyHub for production hosting"
git push
```

Never commit `recipifyhub/.env`, service-account JSON files, `node_modules`, or logs.
