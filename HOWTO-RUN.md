# How to Run RecipifyHub with MongoDB Integration

This guide explains how to run the RecipifyHub application with MongoDB integration for pre-stored recipe and restaurant data, while Firebase handles accounts and user-created data.

## Prerequisites

- Node.js installed (v20 or higher)
- NPM package manager
- MongoDB Atlas account
- Firebase project with Authentication and Firestore enabled

## Setup Instructions

1. Go to the app folder and install dependencies:

```bash
cd recipifyhub
npm install
```

2. Create `.env` from `.env.example` and set your MongoDB/Firebase secrets there. Do not commit `.env`.

```bash
cp .env.example .env
```

3. Start the server:

**Windows:**
```bash
start-server.bat
```

**Linux/Mac:**
```bash
chmod +x start-server.sh
./start-server.sh
```

4. Open your browser and navigate to:

```text
http://localhost:3000/profile.html
```

5. Log in with your account credentials to view saved recipes, viewing history, meal plans, ratings, and your own recipes.

## Features Implemented

- MongoDB retrieval for pre-stored recipe and restaurant data
- Firebase Auth for email/password and Google login
- Firestore storage for profiles, user recipes, saved data, history, comments, ratings, and meal plans
- Health check at `/api/health`
- Production-ready session and cookie settings
- Login redirect handling when accessing profile from other pages

## Troubleshooting

If you encounter any issues:

1. Run `npm run check` from the `recipifyhub` folder.
2. Check the server console for error messages.
3. Verify that MongoDB Atlas is accessible from your network.
4. Verify Firebase authorized domains include `localhost` and your deployed domain.
5. Clear your browser cache and cookies.
6. Restart the server.

## Database Collections

MongoDB is used for pre-stored recipe and restaurant data. Firebase/Firestore is used for account-owned user data.
