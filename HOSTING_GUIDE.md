# RecipifyHub Hosting Guide

This project is a Node/Express app, so it needs Node hosting. Do not use GitHub Pages by itself because GitHub Pages can only serve static files and cannot run `server.js`.

## Recommended Path: Render

Render is the smoothest path for this repo because `render.yaml` is already included at the repository root.

### 1. Push To GitHub

From `C:\MH HORIOZN\recipifyhub`:

```powershell
git status --ignored --short
git add .
git commit -m "Prepare RecipifyHub for production hosting"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

Before pushing, confirm these are ignored:

```text
recipifyhub/.env
recipifyhub/node_modules/
*.log
```

### 2. Create The Render Service

1. Open Render.
2. Choose New > Blueprint.
3. Connect your GitHub repository.
4. Render should detect `render.yaml` from the repository root.
5. Create/apply the Blueprint.

The existing `render.yaml` uses:

```yaml
rootDir: recipifyhub
buildCommand: npm ci
startCommand: npm start
healthCheckPath: /api/health
```

### 3. Add Environment Variables In Render

Set these in the Render service dashboard. Do not put real values in GitHub.

```env
NODE_ENV=production
TRUST_PROXY=true
MONGODB_URI=your-mongodb-atlas-uri
SESSION_SECRET=long-random-secret
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY=your-private-key-with-\n-newlines
FIREBASE_WEB_API_KEY=your-firebase-web-api-key
FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
CORS_ORIGINS=https://your-render-domain.onrender.com
```

If you later connect a custom domain, update `CORS_ORIGINS` to that custom domain too:

```env
CORS_ORIGINS=https://your-render-domain.onrender.com,https://your-custom-domain.com
```

### 4. Firebase Console Setup

In Firebase Console:

1. Authentication > Sign-in method > enable Email/Password.
2. Authentication > Sign-in method > enable Google.
3. Authentication > Settings > Authorized domains.
4. Add:

```text
localhost
your-render-domain.onrender.com
your-custom-domain.com
```

Without this, hosted Google login can fail with `auth/unauthorized-domain`.

### 5. MongoDB Atlas Setup

In MongoDB Atlas:

1. Make sure the database user in `MONGODB_URI` has read access to the pre-stored recipe databases.
2. Network Access should allow your host. For a first deployment smoke test, `0.0.0.0/0` is common, but tighten it later if your hosting provider gives stable outbound IPs.
3. Keep pre-stored recipe data in MongoDB. User accounts/new recipes/saved data stay in Firebase.

### 6. Verify Deployment

After Render deploys, open:

```text
https://your-render-domain.onrender.com/api/health
```

Expected:

```json
{
  "success": true,
  "status": "ok",
  "mongoConnected": true,
  "firebaseConfigured": true
}
```

Then test:

1. Home/search pages load.
2. Google login opens a Firebase popup.
3. Email/password registration creates a Firebase user.
4. Create a recipe and confirm it appears in My Recipes.
5. Fetch pre-stored recipes from MongoDB.

## Alternative: Railway

Railway also works well for this app.

### Railway Settings

Use these commands/settings:

```text
Root directory: recipifyhub
Build command: npm ci
Start command: npm start
Health path: /api/health
```

Set the same environment variables as Render. Railway provides `PORT` automatically, and this server already reads `process.env.PORT`.

After Railway gives you a domain, add that domain to:

- `CORS_ORIGINS`
- Firebase Authentication authorized domains

## Alternative: Any Node Host

For any Node host, the universal setup is:

```bash
cd recipifyhub
npm ci
npm start
```

The host must provide:

- Node 20 or newer
- A public HTTPS domain
- Environment variables
- A dynamic `PORT` variable, or support for port `3000`

## Important Notes

- Do not deploy to GitHub Pages only. This app needs Express routes for auth, recipes, Firebase session creation, and MongoDB fetching.
- Do not commit `.env`.
- Do not commit Firebase service-account JSON files.
- Do not commit `node_modules`.
- If Google login works locally but not hosted, check Firebase authorized domains first.
- If login works but sessions disappear after refresh, check `NODE_ENV=production`, `TRUST_PROXY=true`, and HTTPS.
- If pre-stored recipes do not load, check `MONGODB_URI` and MongoDB Atlas Network Access.

## Useful Links

- Render Blueprint YAML: https://render.com/docs/blueprint-spec
- Render Infrastructure as Code: https://render.com/docs/infrastructure-as-code/
- Railway environment variables: https://docs.railway.com/variables
- Railway build/deploy: https://docs.railway.com/build-deploy
- Firebase authorized domains: https://support.google.com/firebase/answer/6400741?hl=en
