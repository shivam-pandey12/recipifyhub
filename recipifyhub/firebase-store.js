const admin = require('firebase-admin');
const axios = require('axios');

const FIREBASE_AUTH_BASE_URL = 'https://identitytoolkit.googleapis.com/v1';
const USER_RECIPE_COLLECTION = 'user_recipes';

let firebaseRuntime = null;

function defaultPreferences() {
  return {
    measurement: 'metric',
    temperature: 'celsius',
    skillLevel: 'intermediate',
    diet: []
  };
}

function getFirebasePrivateKey() {
  return (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
}

function getServiceAccountCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
  }

  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: getFirebasePrivateKey()
    });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return admin.credential.applicationDefault();
  }

  return null;
}

function initializeFirebase() {
  if (firebaseRuntime) {
    return firebaseRuntime;
  }

  try {
    const credential = getServiceAccountCredential();
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;

    if (!credential) {
      firebaseRuntime = {
        configured: false,
        error: 'Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY, or GOOGLE_APPLICATION_CREDENTIALS.'
      };
      return firebaseRuntime;
    }

    const app = admin.apps.length
      ? admin.app()
      : admin.initializeApp({
          credential,
          projectId: projectId || undefined
        });

    firebaseRuntime = {
      configured: true,
      app,
      db: admin.firestore(app),
      auth: admin.auth(app),
      error: null
    };
  } catch (error) {
    firebaseRuntime = {
      configured: false,
      error: error.message || 'Firebase Admin initialization failed.'
    };
  }

  return firebaseRuntime;
}

function firebaseStatus() {
  const runtime = initializeFirebase();
  return {
    configured: runtime.configured,
    error: runtime.error,
    hasWebApiKey: Boolean(process.env.FIREBASE_WEB_API_KEY || process.env.FIREBASE_API_KEY)
  };
}

function createFirebaseError(message, statusCode = 503) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function requireFirebase() {
  const runtime = initializeFirebase();
  if (!runtime.configured) {
    throw createFirebaseError(runtime.error || 'Firebase is not configured.', 503);
  }

  return runtime;
}

function requireWebApiKey() {
  const apiKey = process.env.FIREBASE_WEB_API_KEY || process.env.FIREBASE_API_KEY;
  if (!apiKey) {
    throw createFirebaseError('Firebase password login requires FIREBASE_WEB_API_KEY in .env.', 503);
  }

  return apiKey;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeUsername(username, fallback = 'user') {
  return String(username || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32) || fallback;
}

function displayNameFor(firstName, lastName, username) {
  return [firstName, lastName].filter(Boolean).join(' ').trim() || username || 'Recipify User';
}

function avatarFor(firstName, lastName, email) {
  const name = encodeURIComponent(displayNameFor(firstName, lastName, email));
  return `https://ui-avatars.com/api/?name=${name}&background=random`;
}

function removeUndefined(value) {
  if (Array.isArray(value)) {
    return value.map(removeUndefined);
  }

  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, removeUndefined(entryValue)])
    );
  }

  return value;
}

function toPlainValue(value) {
  if (value && typeof value.toDate === 'function') {
    return value.toDate();
  }

  if (Array.isArray(value)) {
    return value.map(toPlainValue);
  }

  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, toPlainValue(entryValue)])
    );
  }

  return value;
}

function docToPlain(doc, idKey = 'id') {
  if (!doc.exists) {
    return null;
  }

  return {
    ...toPlainValue(doc.data() || {}),
    [idKey]: doc.id
  };
}

function dateMillis(value) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeDocId(...parts) {
  return parts
    .map(part => encodeURIComponent(String(part || 'missing')).replace(/\./g, '%2E'))
    .join('__')
    .slice(0, 1400);
}

async function usernameExists(db, username, exceptUid = null) {
  const snapshot = await db.collection('users').where('username', '==', username).limit(2).get();
  return snapshot.docs.some(doc => doc.id !== exceptUid);
}

async function buildUniqueUsername(seed, exceptUid = null) {
  const { db } = requireFirebase();
  const base = normalizeUsername(seed, 'recipify_user');
  let candidate = base;
  let suffix = 0;

  while (await usernameExists(db, candidate, exceptUid)) {
    suffix += 1;
    candidate = `${base}_${suffix}`;
  }

  return candidate;
}

function userPayload(uid, data = {}) {
  return {
    id: uid,
    uid,
    username: data.username || '',
    email: data.email || '',
    firstName: data.firstName || '',
    lastName: data.lastName || '',
    bio: data.bio || '',
    location: data.location || '',
    website: data.website || '',
    profileImageUrl: data.profileImageUrl || 'https://cdn-icons-png.flaticon.com/512/1077/1077114.png',
    preferences: {
      ...defaultPreferences(),
      ...(data.preferences || {})
    },
    authType: data.authType || 'local',
    createdAt: data.createdAt || null,
    lastLogin: data.lastLogin || null
  };
}

async function getUserProfile(uid) {
  const { db, auth } = requireFirebase();
  const doc = await db.collection('users').doc(uid).get();

  if (doc.exists) {
    return userPayload(uid, toPlainValue(doc.data()));
  }

  const authUser = await auth.getUser(uid);
  const [firstName = '', ...lastNameParts] = String(authUser.displayName || '').split(' ');
  const profile = {
    username: await buildUniqueUsername(authUser.email?.split('@')[0] || authUser.uid, uid),
    email: authUser.email || '',
    firstName,
    lastName: lastNameParts.join(' '),
    profileImageUrl: authUser.photoURL || avatarFor(firstName, lastNameParts.join(' '), authUser.email),
    preferences: defaultPreferences(),
    authType: 'local',
    createdAt: new Date(),
    lastLogin: new Date()
  };

  await db.collection('users').doc(uid).set(removeUndefined(profile), { merge: true });
  return userPayload(uid, profile);
}

async function createUserAccount({ username, email, password, firstName = '', lastName = '' }) {
  const { db, auth } = requireFirebase();
  const cleanEmail = normalizeEmail(email);
  const cleanUsername = normalizeUsername(username || cleanEmail.split('@')[0], 'recipify_user');

  if (!cleanEmail || !password) {
    throw createFirebaseError('Email and password are required.', 400);
  }

  if (await usernameExists(db, cleanUsername)) {
    throw createFirebaseError('Username already taken.', 400);
  }

  try {
    await auth.getUserByEmail(cleanEmail);
    throw createFirebaseError('Email already in use.', 400);
  } catch (error) {
    if (error.statusCode) throw error;
    if (error.code !== 'auth/user-not-found') throw error;
  }

  const authUser = await auth.createUser({
    email: cleanEmail,
    password,
    displayName: displayNameFor(firstName, lastName, cleanUsername),
    photoURL: avatarFor(firstName, lastName, cleanEmail)
  });

  const profile = {
    username: cleanUsername,
    email: cleanEmail,
    firstName,
    lastName,
    profileImageUrl: authUser.photoURL || avatarFor(firstName, lastName, cleanEmail),
    preferences: defaultPreferences(),
    authType: 'local',
    createdAt: new Date(),
    lastLogin: new Date()
  };

  await db.collection('users').doc(authUser.uid).set(removeUndefined(profile), { merge: true });
  return userPayload(authUser.uid, profile);
}

async function loginWithPassword(identifier, password) {
  const { db } = requireFirebase();
  const apiKey = requireWebApiKey();
  let email = normalizeEmail(identifier);

  if (!email.includes('@')) {
    const usernameSnapshot = await db.collection('users')
      .where('username', '==', normalizeUsername(identifier))
      .limit(1)
      .get();

    if (usernameSnapshot.empty) {
      throw createFirebaseError('Invalid credentials.', 400);
    }

    email = usernameSnapshot.docs[0].data().email;
  }

  try {
    const response = await axios.post(`${FIREBASE_AUTH_BASE_URL}/accounts:signInWithPassword`, {
      email,
      password,
      returnSecureToken: true
    }, {
      params: { key: apiKey },
      timeout: 10000
    });

    const uid = response.data.localId;
    await db.collection('users').doc(uid).set({ lastLogin: new Date() }, { merge: true });
    return getUserProfile(uid);
  } catch (error) {
    throw createFirebaseError('Invalid credentials.', 400);
  }
}

async function upsertGoogleUser({ email, firstName = '', lastName = '', name = '', googleId, imageUrl }) {
  const { db, auth } = requireFirebase();
  const cleanEmail = normalizeEmail(email);
  let authUser;

  try {
    authUser = await auth.getUserByEmail(cleanEmail);
    authUser = await auth.updateUser(authUser.uid, removeUndefined({
      displayName: name || displayNameFor(firstName, lastName, cleanEmail),
      photoURL: imageUrl,
      emailVerified: true
    }));
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
    authUser = await auth.createUser(removeUndefined({
      email: cleanEmail,
      emailVerified: true,
      displayName: name || displayNameFor(firstName, lastName, cleanEmail),
      photoURL: imageUrl || avatarFor(firstName, lastName, cleanEmail)
    }));
  }

  const existing = await db.collection('users').doc(authUser.uid).get();
  const existingData = existing.exists ? existing.data() : {};
  const profile = {
    username: existingData.username || await buildUniqueUsername(cleanEmail.split('@')[0], authUser.uid),
    email: cleanEmail,
    firstName: existingData.firstName || firstName,
    lastName: existingData.lastName || lastName,
    profileImageUrl: imageUrl || existingData.profileImageUrl || authUser.photoURL || avatarFor(firstName, lastName, cleanEmail),
    preferences: {
      ...defaultPreferences(),
      ...(existingData.preferences || {})
    },
    googleId,
    authType: 'google',
    createdAt: existingData.createdAt || new Date(),
    lastLogin: new Date()
  };

  await db.collection('users').doc(authUser.uid).set(removeUndefined(profile), { merge: true });
  return userPayload(authUser.uid, profile);
}

function splitDisplayName(name = '') {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts.shift() || '',
    lastName: parts.join(' ')
  };
}

function getProviderUid(decodedToken, authUser, providerId) {
  const identities = decodedToken.firebase?.identities || {};
  const identityValue = identities[providerId];
  if (Array.isArray(identityValue) && identityValue.length) {
    return identityValue[0];
  }

  return authUser.providerData.find(provider => provider.providerId === providerId)?.uid || '';
}

async function loginWithFirebaseIdToken(idToken) {
  if (!idToken || typeof idToken !== 'string') {
    throw createFirebaseError('Firebase sign-in token is required.', 400);
  }

  const { db, auth } = requireFirebase();
  let decodedToken;

  try {
    decodedToken = await auth.verifyIdToken(idToken);
  } catch (error) {
    throw createFirebaseError('Firebase sign-in token could not be verified.', 401);
  }

  const authUser = await auth.getUser(decodedToken.uid);
  const cleanEmail = normalizeEmail(decodedToken.email || authUser.email);

  if (!cleanEmail) {
    throw createFirebaseError('Firebase sign-in did not return an email address.', 400);
  }

  const existing = await db.collection('users').doc(authUser.uid).get();
  const existingData = existing.exists ? existing.data() : {};
  const displayName = decodedToken.name || authUser.displayName || existingData.username || cleanEmail;
  const names = splitDisplayName(displayName);
  const providerId = decodedToken.firebase?.sign_in_provider || authUser.providerData[0]?.providerId || 'firebase';
  const googleId = providerId === 'google.com'
    ? getProviderUid(decodedToken, authUser, 'google.com') || existingData.googleId
    : existingData.googleId;

  const profile = {
    username: existingData.username || await buildUniqueUsername(cleanEmail.split('@')[0], authUser.uid),
    email: cleanEmail,
    firstName: existingData.firstName || names.firstName,
    lastName: existingData.lastName || names.lastName,
    profileImageUrl: decodedToken.picture || authUser.photoURL || existingData.profileImageUrl || avatarFor(names.firstName, names.lastName, cleanEmail),
    preferences: {
      ...defaultPreferences(),
      ...(existingData.preferences || {})
    },
    googleId,
    authType: providerId === 'google.com' ? 'google' : 'firebase',
    createdAt: existingData.createdAt || new Date(),
    lastLogin: new Date()
  };

  await db.collection('users').doc(authUser.uid).set(removeUndefined(profile), { merge: true });
  return userPayload(authUser.uid, profile);
}

async function updateUserProfile(uid, updates = {}) {
  const { db, auth } = requireFirebase();
  const allowed = {
    firstName: updates.firstName,
    lastName: updates.lastName,
    bio: updates.bio,
    location: updates.location,
    website: updates.website,
    profileImageUrl: updates.profileImageUrl
  };

  await db.collection('users').doc(uid).set(removeUndefined(allowed), { merge: true });

  if (allowed.firstName !== undefined || allowed.lastName !== undefined || allowed.profileImageUrl !== undefined) {
    const current = await getUserProfile(uid);
    await auth.updateUser(uid, removeUndefined({
      displayName: displayNameFor(current.firstName, current.lastName, current.username),
      photoURL: current.profileImageUrl
    }));
  }

  return getUserProfile(uid);
}

async function updateUserPreferences(uid, preferences = {}) {
  const { db } = requireFirebase();
  const current = await getUserProfile(uid);
  const nextPreferences = {
    ...defaultPreferences(),
    ...(current.preferences || {}),
    ...preferences
  };

  await db.collection('users').doc(uid).set({ preferences: removeUndefined(nextPreferences) }, { merge: true });
  return nextPreferences;
}

function recipePayload(doc, id) {
  return {
    ...toPlainValue(doc),
    id,
    _id: id,
    source_collection: USER_RECIPE_COLLECTION
  };
}

async function createUserRecipe(uid, username, payload = {}) {
  const { db } = requireFirebase();
  const now = new Date();
  const recipe = removeUndefined({
    ...payload,
    published: payload.published === true || payload.published === 'true',
    publishedAt: payload.published === true || payload.published === 'true' ? now : null,
    createdByUserId: uid,
    createdByUsername: username || '',
    created_at: now,
    updated_at: now,
    source_collection: USER_RECIPE_COLLECTION
  });

  const ref = await db.collection(USER_RECIPE_COLLECTION).add(recipe);
  return recipePayload(recipe, ref.id);
}

async function listUserRecipes(uid) {
  const { db } = requireFirebase();
  const snapshot = await db.collection(USER_RECIPE_COLLECTION).where('createdByUserId', '==', uid).get();
  return snapshot.docs
    .map(doc => recipePayload(doc.data(), doc.id))
    .sort((a, b) => dateMillis(b.updated_at || b.created_at) - dateMillis(a.updated_at || a.created_at));
}

async function getUserRecipeForOwner(uid, recipeId) {
  const { db } = requireFirebase();
  const doc = await db.collection(USER_RECIPE_COLLECTION).doc(recipeId).get();
  const recipe = docToPlain(doc);
  if (!recipe || recipe.createdByUserId !== uid) {
    return null;
  }

  return recipePayload(recipe, doc.id);
}

async function getUserRecipeForView(recipeId, viewerUid = null) {
  const { db } = requireFirebase();
  const doc = await db.collection(USER_RECIPE_COLLECTION).doc(recipeId).get();
  const recipe = docToPlain(doc);

  if (!recipe) return null;
  if (recipe.published === false && recipe.createdByUserId !== viewerUid) return null;

  return recipePayload(recipe, doc.id);
}

async function updateUserRecipe(uid, recipeId, payload = {}) {
  const { db } = requireFirebase();
  const current = await getUserRecipeForOwner(uid, recipeId);
  if (!current) return null;

  const update = removeUndefined({
    ...payload,
    createdByUserId: uid,
    createdByUsername: current.createdByUsername || '',
    source_collection: USER_RECIPE_COLLECTION,
    updated_at: new Date()
  });

  await db.collection(USER_RECIPE_COLLECTION).doc(recipeId).set(update, { merge: true });
  return getUserRecipeForOwner(uid, recipeId);
}

async function setUserRecipePublished(uid, recipeId, published) {
  const current = await getUserRecipeForOwner(uid, recipeId);
  if (!current) return null;

  const { db } = requireFirebase();
  await db.collection(USER_RECIPE_COLLECTION).doc(recipeId).set({
    published: Boolean(published),
    publishedAt: published ? new Date() : null,
    updated_at: new Date()
  }, { merge: true });

  return getUserRecipeForOwner(uid, recipeId);
}

async function deleteUserRecipe(uid, recipeId) {
  const current = await getUserRecipeForOwner(uid, recipeId);
  if (!current) return false;

  const { db } = requireFirebase();
  await db.collection(USER_RECIPE_COLLECTION).doc(recipeId).delete();
  return true;
}

function getRegexText(condition) {
  if (!condition || typeof condition !== 'object' || !condition.$regex) return null;
  return String(condition.$regex).replace(/^\^|\$$/g, '').toLowerCase();
}

function matchesSearchQuery(recipe, query = {}) {
  if (!query || !query.$or) return true;
  return query.$or.some(condition => {
    const [field, expression] = Object.entries(condition)[0] || [];
    const needle = getRegexText(expression);
    if (!field || !needle) return true;
    const value = recipe[field];
    return Array.isArray(value)
      ? value.join(' ').toLowerCase().includes(needle)
      : String(value || '').toLowerCase().includes(needle);
  });
}

async function listPublicUserRecipes({ query = {}, limit = 50, skip = 0, viewerUid = null } = {}) {
  const { db } = requireFirebase();
  const snapshot = await db.collection(USER_RECIPE_COLLECTION).get();
  const recipes = snapshot.docs
    .map(doc => recipePayload(doc.data(), doc.id))
    .filter(recipe => recipe.published !== false || recipe.createdByUserId === viewerUid)
    .filter(recipe => matchesSearchQuery(recipe, query))
    .sort((a, b) => dateMillis(b.updated_at || b.created_at) - dateMillis(a.updated_at || a.created_at));

  return {
    recipes: recipes.slice(skip, skip + limit),
    total: recipes.length
  };
}

async function getSavedRecipeRefs(uid) {
  const { db } = requireFirebase();
  const doc = await db.collection('saved_recipes').doc(uid).get();
  const data = doc.exists ? toPlainValue(doc.data()) : {};
  return data.recipes || [];
}

async function saveRecipe(uid, recipeId, collection) {
  const { db } = requireFirebase();
  const current = await getSavedRecipeRefs(uid);
  const normalizedCollection = collection || USER_RECIPE_COLLECTION;
  const exists = current.some(recipe => recipe.recipeId === recipeId && recipe.collection === normalizedCollection);
  const recipes = exists
    ? current
    : [...current, { recipeId, collection: normalizedCollection, savedAt: new Date() }];

  await db.collection('saved_recipes').doc(uid).set({ recipes }, { merge: true });
  return recipes;
}

async function unsaveRecipe(uid, recipeId, collection) {
  const { db } = requireFirebase();
  const recipes = (await getSavedRecipeRefs(uid))
    .filter(recipe => !(recipe.recipeId === recipeId && recipe.collection === collection));

  await db.collection('saved_recipes').doc(uid).set({ recipes }, { merge: true });
  return recipes;
}

async function getUserHistory(uid) {
  const { db } = requireFirebase();
  const doc = await db.collection('user_history').doc(uid).get();
  return doc.exists ? toPlainValue(doc.data()) : { viewedRecipes: [], searchHistory: [], ratings: [] };
}

async function recordRecipeView(uid, recipeId, collection) {
  const { db } = requireFirebase();
  const history = await getUserHistory(uid);
  const viewedRecipes = [
    ...(history.viewedRecipes || []),
    { recipeId, collection, timestamp: new Date() }
  ].slice(-100);

  await db.collection('user_history').doc(uid).set({ viewedRecipes }, { merge: true });
}

async function recordSearchTerm(uid, term) {
  const { db } = requireFirebase();
  const history = await getUserHistory(uid);
  const searchHistory = [
    ...(history.searchHistory || []),
    { term, timestamp: new Date() }
  ].slice(-50);

  await db.collection('user_history').doc(uid).set({ searchHistory }, { merge: true });
}

async function deleteViewedRecipe(uid, recipeId, collection) {
  const { db } = requireFirebase();
  const history = await getUserHistory(uid);
  const viewedRecipes = (history.viewedRecipes || [])
    .filter(recipe => !(recipe.recipeId === recipeId && recipe.collection === collection));

  await db.collection('user_history').doc(uid).set({ viewedRecipes }, { merge: true });
}

async function clearViewingHistory(uid) {
  const { db } = requireFirebase();
  await db.collection('user_history').doc(uid).set({ viewedRecipes: [] }, { merge: true });
}

async function saveMealPlan(uid, date, meals) {
  const { db } = requireFirebase();
  const mealPlan = { userId: uid, date, meals, updatedAt: new Date() };
  await db.collection('meal_plans').doc(safeDocId(uid, date)).set(removeUndefined(mealPlan), { merge: true });
  return mealPlan;
}

async function getMealPlan(uid, date) {
  const { db } = requireFirebase();
  const doc = await db.collection('meal_plans').doc(safeDocId(uid, date)).get();
  return doc.exists ? toPlainValue(doc.data()) : null;
}

async function getMealPlans(uid) {
  const { db } = requireFirebase();
  const snapshot = await db.collection('meal_plans').where('userId', '==', uid).get();
  return snapshot.docs
    .map(doc => toPlainValue(doc.data()))
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
}

async function deleteMealPlan(uid, date) {
  const { db } = requireFirebase();
  await db.collection('meal_plans').doc(safeDocId(uid, date)).delete();
}

async function addComment(uid, username, recipeId, collection, text) {
  const { db } = requireFirebase();
  const comment = {
    recipeId,
    collection,
    userId: uid,
    userName: username || 'Anonymous',
    text,
    createdAt: new Date()
  };
  const ref = await db.collection('comments').add(removeUndefined(comment));
  return { ...comment, id: ref.id, _id: ref.id };
}

async function getRecipeComments(recipeId, collection) {
  const { db } = requireFirebase();
  const snapshot = await db.collection('comments')
    .where('recipeId', '==', recipeId)
    .where('collection', '==', collection)
    .get();

  return snapshot.docs
    .map(doc => ({ ...docToPlain(doc), _id: doc.id }))
    .sort((a, b) => dateMillis(b.createdAt) - dateMillis(a.createdAt));
}

async function getUserComments(uid) {
  const { db } = requireFirebase();
  const snapshot = await db.collection('comments').where('userId', '==', uid).get();
  return snapshot.docs
    .map(doc => ({ ...docToPlain(doc), _id: doc.id }))
    .sort((a, b) => dateMillis(b.createdAt) - dateMillis(a.createdAt));
}

async function updateComment(uid, commentId, text) {
  const { db } = requireFirebase();
  const ref = db.collection('comments').doc(commentId);
  const doc = await ref.get();
  const comment = docToPlain(doc);
  if (!comment || comment.userId !== uid) return false;

  await ref.set({ text, updatedAt: new Date() }, { merge: true });
  return true;
}

async function deleteComment(uid, commentId) {
  const { db } = requireFirebase();
  const ref = db.collection('comments').doc(commentId);
  const doc = await ref.get();
  const comment = docToPlain(doc);
  if (!comment || comment.userId !== uid) return false;

  await ref.delete();
  return true;
}

async function rateRecipe(uid, username, recipeId, collection, rating) {
  const { db } = requireFirebase();
  const ratingNumber = Number(rating);
  const ratingDoc = {
    userId: uid,
    username: username || '',
    recipeId,
    collection,
    rating: ratingNumber,
    updatedAt: new Date()
  };

  const id = safeDocId(collection, recipeId, uid);
  const ref = db.collection('ratings').doc(id);
  const existing = await ref.get();
  await ref.set(removeUndefined({
    ...ratingDoc,
    createdAt: existing.exists ? existing.data().createdAt : new Date()
  }), { merge: true });

  return getRecipeRatings(recipeId, collection, uid);
}

async function getRecipeRatings(recipeId, collection, uid = null) {
  const { db } = requireFirebase();
  const snapshot = await db.collection('ratings')
    .where('recipeId', '==', recipeId)
    .where('collection', '==', collection)
    .get();

  const ratings = snapshot.docs.map(doc => ({ ...docToPlain(doc), _id: doc.id }));
  const averageRating = ratings.length
    ? ratings.reduce((sum, entry) => sum + Number(entry.rating || 0), 0) / ratings.length
    : 0;
  const userRating = uid
    ? ratings.find(entry => entry.userId === uid)?.rating || null
    : null;

  return { ratings, averageRating, userRating };
}

async function getUserRatings(uid) {
  const { db } = requireFirebase();
  const snapshot = await db.collection('ratings').where('userId', '==', uid).get();
  return snapshot.docs
    .map(doc => ({ ...docToPlain(doc), _id: doc.id }))
    .sort((a, b) => dateMillis(b.updatedAt || b.createdAt) - dateMillis(a.updatedAt || a.createdAt));
}

async function recordShareEvent(uid, recipeId, collection, platform) {
  const { db } = requireFirebase();
  await db.collection('share_events').add(removeUndefined({
    recipeId,
    collection,
    platform,
    userId: uid || 'anonymous',
    sharedAt: new Date()
  }));

  const metricsRef = db.collection('recipe_metrics').doc(safeDocId(collection, recipeId));
  await metricsRef.set({
    recipeId,
    collection,
    shareCount: admin.firestore.FieldValue.increment(1),
    lastUpdated: new Date()
  }, { merge: true });
}

async function getRecipeMetrics(recipeId, collection) {
  const { db } = requireFirebase();
  const doc = await db.collection('recipe_metrics').doc(safeDocId(collection, recipeId)).get();
  const metrics = doc.exists ? toPlainValue(doc.data()) : {};
  return {
    shareCount: metrics.shareCount || 0,
    viewCount: metrics.viewCount || 0
  };
}

async function getProfileStats(uid) {
  const [recipes, saved, history, mealPlans, comments, ratings] = await Promise.all([
    listUserRecipes(uid),
    getSavedRecipeRefs(uid),
    getUserHistory(uid),
    getMealPlans(uid),
    getUserComments(uid),
    getUserRatings(uid)
  ]);

  return {
    recipesCount: recipes.length,
    savesCount: saved.length,
    commentsCount: comments.length,
    viewsCount: (history.viewedRecipes || []).length,
    ratingsCount: ratings.length,
    mealPlansCount: mealPlans.length
  };
}

module.exports = {
  USER_RECIPE_COLLECTION,
  firebaseStatus,
  createFirebaseError,
  createUserAccount,
  loginWithPassword,
  loginWithFirebaseIdToken,
  upsertGoogleUser,
  getUserProfile,
  updateUserProfile,
  updateUserPreferences,
  createUserRecipe,
  listUserRecipes,
  listPublicUserRecipes,
  getUserRecipeForOwner,
  getUserRecipeForView,
  updateUserRecipe,
  setUserRecipePublished,
  deleteUserRecipe,
  saveRecipe,
  unsaveRecipe,
  getSavedRecipeRefs,
  getUserHistory,
  recordRecipeView,
  recordSearchTerm,
  deleteViewedRecipe,
  clearViewingHistory,
  saveMealPlan,
  getMealPlan,
  getMealPlans,
  deleteMealPlan,
  addComment,
  getRecipeComments,
  getUserComments,
  updateComment,
  deleteComment,
  rateRecipe,
  getRecipeRatings,
  getUserRatings,
  recordShareEvent,
  getRecipeMetrics,
  getProfileStats
};
