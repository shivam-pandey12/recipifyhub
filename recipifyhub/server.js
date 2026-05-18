const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('dns');
const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const multer = require('multer');
const bodyParser = require('body-parser');
const axios = require('axios');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const util = require('util');
const weatherapi = require('openweathermap-ts');
const { uniq } = require('lodash');
const morgan = require('morgan');

// Load environment variables from the app directory so startup works
// whether the server is launched from the repo root or this folder.
dotenv.config({ path: path.join(__dirname, '.env') });

const firebaseStore = require('./firebase-store');

const DNS_SERVERS = (process.env.DNS_SERVERS || '8.8.8.8,1.1.1.1')
  .split(',')
  .map(server => server.trim())
  .filter(Boolean);

if (DNS_SERVERS.length > 0) {
  try {
    dns.setServers(DNS_SERVERS);
    console.log(`Using DNS servers: ${DNS_SERVERS.join(', ')}`);
  } catch (error) {
    console.warn('Failed to apply custom DNS servers:', error.message);
  }
}

// Create Express app
const app = express();
const PORT = process.env.PORT || 5000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const REQUEST_BODY_LIMIT = process.env.REQUEST_BODY_LIMIT || '50mb';
const MONGODB_URI = (process.env.MONGODB_URI || (IS_PRODUCTION ? '' : 'mongodb://127.0.0.1:27017/')).trim();
const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim();
const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';

function isValidGoogleClientId(clientId) {
  return typeof clientId === 'string' && /\.apps\.googleusercontent\.com$/.test(clientId.trim());
}

function getFirebaseClientConfig() {
  const projectId = (process.env.FIREBASE_PROJECT_ID || '').trim();

  return {
    apiKey: (process.env.FIREBASE_WEB_API_KEY || process.env.FIREBASE_API_KEY || '').trim(),
    authDomain: (process.env.FIREBASE_AUTH_DOMAIN || (projectId ? `${projectId}.firebaseapp.com` : '')).trim(),
    projectId
  };
}

function isFirebaseClientConfigReady(config) {
  return Boolean(config.apiKey && config.authDomain && config.projectId);
}

function isTruthyEnv(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function parseCsvEnv(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function validateStartupConfig() {
  const missing = [];
  const hasFirebaseAdminConfig = Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY)
  );

  if (!MONGODB_URI) missing.push('MONGODB_URI');
  if (!process.env.SESSION_SECRET) missing.push('SESSION_SECRET');
  if (!hasFirebaseAdminConfig) {
    missing.push('Firebase Admin credentials');
  }
  if (!process.env.FIREBASE_WEB_API_KEY && !process.env.FIREBASE_API_KEY) {
    missing.push('FIREBASE_WEB_API_KEY');
  }

  if (missing.length === 0) return;

  const message = `Missing production configuration: ${missing.join(', ')}`;
  if (IS_PRODUCTION) {
    throw new Error(message);
  }

  console.warn(`${message}. Development mode will continue, but deployment will fail until these are set.`);
}

validateStartupConfig();

// Import our MongoDB integration functions
const { connectToMongoDB, getSavedRecipesWithData, getViewedRecipesWithData, getMealPlansWithData, getUserRatingsWithData } = require('./backend-fix');

// Middleware
if (IS_PRODUCTION || isTruthyEnv(process.env.TRUST_PROXY)) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));
}

const allowedCorsOrigins = parseCsvEnv(process.env.CORS_ORIGINS);
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedCorsOrigins.length === 0) return callback(null, !IS_PRODUCTION);
    return callback(null, allowedCorsOrigins.includes(origin));
  }
}));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use(morgan(IS_PRODUCTION ? 'combined' : 'dev'));
app.use(bodyParser.json({ limit: REQUEST_BODY_LIMIT }));
app.use(bodyParser.urlencoded({ limit: REQUEST_BODY_LIMIT, extended: true }));
app.use(express.static(path.join(__dirname), {
  etag: true,
  maxAge: IS_PRODUCTION ? '1h' : 0,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store');
    }
  }
}));
app.use(cookieParser());

// Session middleware
const SESSION_SECRET = process.env.SESSION_SECRET || 'recipifyhub-dev-secret';

function buildCookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'lax',
    maxAge
  };
}

const sessionOptions = {
  name: process.env.SESSION_COOKIE_NAME || 'recipifyhub.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  proxy: IS_PRODUCTION || isTruthyEnv(process.env.TRUST_PROXY),
  cookie: buildCookieOptions(24 * 60 * 60 * 1000)
};

if (MONGODB_URI) {
  sessionOptions.store = MongoStore.create({
    mongoUrl: MONGODB_URI,
    dbName: process.env.SESSION_DB_NAME || 'recipifyhub',
    collectionName: process.env.SESSION_COLLECTION || 'sessions',
    ttl: Number(process.env.SESSION_TTL_SECONDS || 7 * 24 * 60 * 60)
  });
}

app.use(session(sessionOptions));

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    console.log('Checking authentication');
    console.log('Session:', req.session);
    
    if (req.session && req.session.userId) {
        console.log('User is authenticated with ID:', req.session.userId);
        next();
    } else {
        console.log('User is not authenticated');
        res.status(401).json({ success: false, error: 'Not authenticated' });
    }
};

// Add a middleware that checks for authentication but doesn't block if not authenticated
const checkAuthentication = (req, res, next) => {
    console.log('Checking optional authentication');
    
    // Just set a flag in req to indicate if user is authenticated
    req.isAuthenticated = !!(req.session && req.session.userId);
    req.userId = req.session?.userId || null;
    
    console.log('Is user authenticated?', req.isAuthenticated);
    next(); 
};
  
// MongoDB Connection - Recipify Hub Database
function buildMongoDbUri(baseUri, databaseName) {
    const [uriWithoutQuery, queryString] = baseUri.split('?');
    const normalizedBase = uriWithoutQuery.endsWith('/') ? uriWithoutQuery : `${uriWithoutQuery}/`;

    return queryString
        ? `${normalizedBase}${databaseName}?${queryString}`
        : `${normalizedBase}${databaseName}`;
}

// Connect to MongoDB using our new function when the server starts
let mongoDb;
(async () => {
  try {
    mongoDb = await connectToMongoDB();
    console.log('MongoDB connection established for enhanced recipe data');
  } catch (error) {
    console.error('Failed to connect to MongoDB for enhanced recipe data:', error);
  }
})();

// Update MongoDB connection string for RecipifyHub
const recipifyHubConnection = mongoose.createConnection(buildMongoDbUri(MONGODB_URI, 'recipifyhub'), {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    tls: true,
    tlsAllowInvalidCertificates: false,
    retryWrites: true,
    w: 'majority',
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
});

recipifyHubConnection.on('connected', () => {
    console.log('Connected to RecipifyHub database');
});

recipifyHubConnection.on('error', (err) => {
    console.error('Error connecting to RecipifyHub database:', err);
});

recipifyHubConnection.asPromise().catch((err) => {
    console.error('Initial RecipifyHub database connection failed:', err);
});

// Connect to the main RecipifyHub database
const recipifyConnection = mongoose.createConnection(buildMongoDbUri(MONGODB_URI, 'recipify_hub'), {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    tls: true,
    tlsAllowInvalidCertificates: false,
    retryWrites: true,
    w: 'majority',
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
});

recipifyConnection.on('connected', () => {
    console.log('Connected to RecipifyHub database');
});

recipifyConnection.on('error', (err) => {
    console.error('Error connecting to RecipifyHub database:', err);
});

recipifyConnection.asPromise().catch((err) => {
    console.error('Initial recipify_hub database connection failed:', err);
});

// Connect to the sample_restaurants database
const restaurantsConnection = mongoose.createConnection(buildMongoDbUri(MONGODB_URI, 'sample_restaurants'), {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    tls: true,
    tlsAllowInvalidCertificates: false,
    retryWrites: true,
    w: 'majority',
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
});

restaurantsConnection.on('connected', () => {
    console.log('Connected to sample_restaurants database');
});

restaurantsConnection.on('error', (err) => {
    console.error('Error connecting to sample_restaurants database:', err);
});

restaurantsConnection.asPromise().catch((err) => {
    console.error('Initial sample_restaurants database connection failed:', err);
});

// Schema Definitions for RecipifyHub
const RecipeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: String,
    prep_time: String,
    cook_time: String,
    servings: String,
    difficulty: String,
    cuisine: String,
    course: String,
    diet: String,
    ingredients: String,
    instructions: String,
    image_url: String,
    image_available: Boolean,
    published: {
        type: Boolean,
        default: false
    },
    publishedAt: {
        type: Date,
        default: null
    },
    createdByUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    createdByUsername: {
        type: String,
        default: ''
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    },
    comments: [
        {
            userId: mongoose.Schema.Types.ObjectId,
            text: String,
            createdAt: Date
        }
    ],
    ratings: [
        {
            userId: mongoose.Schema.Types.ObjectId,
            rating: Number
        }
    ]
});

// User Data Schemas
const UserHistorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    viewedRecipes: [{
        recipeId: String,
        collection: String,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    searchHistory: [{
        term: String,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    ratings: [
        {
            recipeId: String,
            collection: String,
            rating: Number,
            createdAt: Date,
            updatedAt: Date
        }
    ],
    comments: [
        {
            userId: mongoose.Schema.Types.ObjectId,
            text: String,
            createdAt: Date
        }
    ]
});

const SavedRecipesSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    recipes: [{
        recipeId: String,
        collection: String,
        savedAt: {
            type: Date,
            default: Date.now
        }
    }]
});

const MealPlanSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    date: {
        type: String,
        required: true
    },
    meals: {
        breakfast: [{
            text: String,
            completed: {
                type: Boolean,
                default: false
            },
            recipeId: String,
            recipeCollection: {
                type: String,
                default: 'recipes'
            },
            recipeImage: String
        }],
        lunch: [{
            text: String,
            completed: {
                type: Boolean,
                default: false
            },
            recipeId: String,
            recipeCollection: {
                type: String,
                default: 'recipes'
            },
            recipeImage: String
        }],
        dinner: [{
            text: String,
            completed: {
                type: Boolean,
                default: false
            },
            recipeId: String,
            recipeCollection: {
                type: String,
                default: 'recipes'
            },
            recipeImage: String
        }]
    }
});

const ProfileSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    profileImageUrl: {
        type: String,
        default: ''
    }
});

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  firstName: String,
  lastName: String,
  googleId: String,
  authType: {
    type: String,
    enum: ['local', 'google'],
    default: 'local'
  },
  profileImageUrl: String,
  preferences: {
    measurement: {
      type: String,
      enum: ['metric', 'imperial'],
      default: 'metric'
    },
    temperature: {
      type: String,
      enum: ['celsius', 'fahrenheit'],
      default: 'celsius'
    },
    skillLevel: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'professional'],
      default: 'intermediate'
    },
    diet: {
      type: [String],
      default: []
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: Date
});

// Schema Definitions for sample_restaurants
const RestaurantSchema = new mongoose.Schema({
    address: Object,
    borough: String,
    cuisine: String,
    grades: Array,
    name: String,
    restaurant_id: String
}, { strict: false });

// Comment Schema
const CommentSchema = new mongoose.Schema({
    recipeId: {
        type: String,
        required: true
    },
    collection: {
        type: String,
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    userName: {
        type: String,
        required: true
    },
    text: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Models
const Recipe = recipifyConnection.model('Recipe', RecipeSchema, 'recipe');
const Profile = recipifyConnection.model('Profile', ProfileSchema, 'profiles');
const User = recipifyConnection.model('User', UserSchema, 'users');
const Restaurant = restaurantsConnection.model('Restaurant', RestaurantSchema, 'restaurants');
const UserHistory = recipifyConnection.model('UserHistory', UserHistorySchema, 'user_history');
const SavedRecipes = recipifyConnection.model('SavedRecipes', SavedRecipesSchema, 'saved_recipes');
const MealPlan = recipifyConnection.model('MealPlan', MealPlanSchema, 'meal_plans');
const Comment = recipifyHubConnection.model('Comment', CommentSchema, 'comments');

const RECIPIFY_RECIPE_COLLECTIONS = Object.freeze([
    'recipe',
    'recipes',
    'recipe_with_video',
    'recipes_with_servings',
    'food_recipe',
    'baking'
]);

const RECIPE_COLLECTION_ALIASES = Object.freeze({
    recipe_with_serving: 'recipes_with_servings'
});

function normalizeRecipeCollectionName(collection) {
    return RECIPE_COLLECTION_ALIASES[collection] || collection;
}

function getRecipeCollections() {
    return [...RECIPIFY_RECIPE_COLLECTIONS];
}

function getRecipeDbConnection(collection) {
    return RECIPIFY_RECIPE_COLLECTIONS.includes(normalizeRecipeCollectionName(collection))
        ? recipifyConnection
        : restaurantsConnection;
}

async function getNativeCollection(connection, collection) {
    await connection.asPromise();

    if (!connection?.db) {
        throw new Error(`Database connection for collection "${collection}" is not ready`);
    }

    return connection.db.collection(collection);
}

app.get('/api/site-stats', async (req, res) => {
  try {
    const recipeBreakdown = await Promise.all(
      getRecipeCollections().map(async collectionName => {
        const collection = await getNativeCollection(recipifyConnection, collectionName);
        const total = await collection.estimatedDocumentCount();
        return { name: collectionName, total };
      })
    );

    const [usersCollection, savedRecipesCollection, mealPlansCollection] = await Promise.all([
      getNativeCollection(recipifyConnection, 'users'),
      getNativeCollection(recipifyConnection, 'saved_recipes'),
      getNativeCollection(recipifyConnection, 'meal_plans')
    ]);

    const [users, savedRecipes, mealPlans] = await Promise.all([
      usersCollection.estimatedDocumentCount(),
      savedRecipesCollection.estimatedDocumentCount(),
      mealPlansCollection.estimatedDocumentCount()
    ]);

    const totalRecipes = recipeBreakdown.reduce((sum, entry) => sum + entry.total, 0);

    res.json({
      success: true,
      stats: {
        totalRecipes,
        recipeCollections: recipeBreakdown.length,
        collectionBreakdown: recipeBreakdown,
        users,
        savedRecipes,
        mealPlans
      }
    });
  } catch (error) {
    console.error('Error loading site stats:', error);
    res.status(500).json({
      success: false,
      error: 'Unable to load site stats right now'
    });
  }
});

function summarizeSchemaValue(value) {
    if (Array.isArray(value)) {
        const preview = value.slice(0, 2).map(item => {
            if (item && typeof item === 'object') {
                return `{ ${Object.keys(item).slice(0, 3).join(', ')} }`;
            }
            return String(item);
        }).join(', ');

        return preview ? `[${preview}]` : '[]';
    }

    if (value && typeof value === 'object') {
        return `{ ${Object.keys(value).slice(0, 4).join(', ')} }`;
    }

    if (value === null || value === undefined) {
        return '';
    }

    return String(value).slice(0, 120);
}

function getSchemaValueType(value) {
    if (Array.isArray(value)) {
        return 'array';
    }

    if (value === null) {
        return 'null';
    }

    return typeof value;
}

function buildOwnerFilters(userId) {
    const filters = [];

    if (!userId) {
        return filters;
    }

    filters.push({ createdByUserId: userId });

    if (userId?.toString) {
        filters.push({ createdByUserId: userId.toString() });
    }

    if (typeof userId === 'string' && ObjectId.isValid(userId)) {
        filters.push({ createdByUserId: new ObjectId(userId) });
    }

    return filters;
}

function isRecipeOwner(recipe, userId) {
    if (!recipe?.createdByUserId || !userId) {
        return false;
    }

    return String(recipe.createdByUserId) === String(userId);
}

function buildVisibleRecipeQuery(collection, baseQuery = {}, userId = null) {
    const normalizedCollection = normalizeRecipeCollectionName(collection);

    if (normalizedCollection !== 'recipe') {
        return baseQuery;
    }

    const publicQuery = { published: { $ne: false } };
    const ownerFilters = buildOwnerFilters(userId);

    if (!ownerFilters.length) {
        return { $and: [baseQuery, publicQuery] };
    }

    return {
        $or: [
            { $and: [baseQuery, publicQuery] },
            { $and: [baseQuery, { $or: ownerFilters }] }
        ]
    };
}

function canViewRecipeRecord(collection, recipe, userId) {
    const normalizedCollection = normalizeRecipeCollectionName(collection);

    if (normalizedCollection !== 'recipe') {
        return true;
    }

    return recipe?.published !== false || isRecipeOwner(recipe, userId);
}

function sanitizeOwnedRecipePayload(payload = {}) {
    const allowedFields = [
        'name',
        'description',
        'prep_time',
        'cook_time',
        'servings',
        'difficulty',
        'cuisine',
        'course',
        'diet',
        'ingredients',
        'instructions',
        'image_url',
        'image_available'
    ];

    const sanitized = {};
    allowedFields.forEach(field => {
        if (payload[field] !== undefined) {
            sanitized[field] = payload[field];
        }
    });

    return sanitized;
}

function isUserRecipeCollection(collection) {
    return normalizeRecipeCollectionName(collection) === firebaseStore.USER_RECIPE_COLLECTION;
}

function setSessionUser(req, res, user) {
    req.session.userId = user.id || user.uid;
    req.session.username = user.username || '';

    res.cookie('user_id', String(req.session.userId), buildCookieOptions(7 * 24 * 60 * 60 * 1000));
}

function sendFirebaseError(res, error, fallbackMessage = 'Firebase operation failed') {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
        success: false,
        error: error.message || fallbackMessage,
        message: error.message || fallbackMessage
    });
}

async function getRecipeReference(recipeId, collection, viewerUid = null) {
    const normalizedCollection = normalizeRecipeCollectionName(collection);

    if (isUserRecipeCollection(normalizedCollection)) {
        return firebaseStore.getUserRecipeForView(recipeId, viewerUid);
    }

    const db = getRecipeDbConnection(normalizedCollection);
    const recipe = await db.collection(normalizedCollection).findOne(buildRecipeLookupQuery(recipeId));

    if (!recipe || !canViewRecipeRecord(normalizedCollection, recipe, viewerUid)) {
        return null;
    }

    return {
        ...recipe,
        id: recipe.id || recipe._id,
        source_collection: normalizedCollection
    };
}

async function hydrateRecipeRefs(recipeRefs, viewerUid = null) {
    const hydrated = await Promise.all((recipeRefs || []).map(async (entry) => {
        try {
            const recipe = await getRecipeReference(entry.recipeId, entry.collection, viewerUid);
            if (!recipe) {
                return {
                    ...entry,
                    recipe: {
                        id: entry.recipeId,
                        _id: entry.recipeId,
                        name: 'Unavailable Recipe',
                        recipe_name: 'Unavailable Recipe',
                        source_collection: normalizeRecipeCollectionName(entry.collection),
                        image: 'https://via.placeholder.com/300x200?text=Recipe+Unavailable',
                        _unavailable: true
                    }
                };
            }

            return { ...entry, recipe };
        } catch (error) {
            console.error('Unable to hydrate recipe reference:', error);
            return null;
        }
    }));

    return hydrated.filter(Boolean);
}

async function getUserCommentsWithRecipes(userId) {
    const comments = await firebaseStore.getUserComments(userId);
    const hydrated = await Promise.all(comments.map(async (comment) => {
        const recipe = await getRecipeReference(comment.recipeId, comment.collection, userId);
        return {
            ...comment,
            recipe: recipe || {
                id: comment.recipeId,
                _id: comment.recipeId,
                name: 'Unavailable Recipe',
                recipe_name: 'Unavailable Recipe',
                source_collection: normalizeRecipeCollectionName(comment.collection),
                image: 'https://via.placeholder.com/300x200?text=Recipe+Unavailable',
                _unavailable: true
            }
        };
    }));

    return hydrated;
}

async function getUserRatingsWithRecipes(userId) {
    const ratings = await firebaseStore.getUserRatings(userId);
    const hydrated = await hydrateRecipeRefs(ratings, userId);
    return hydrated;
}

app.get('/api/admin/schema-inspector', async (req, res) => {
  try {
    const requestedSampleSize = parseInt(req.query.sampleSize, 10);
    const sampleSize = Number.isFinite(requestedSampleSize)
      ? Math.min(Math.max(requestedSampleSize, 25), 400)
      : 120;

    const collections = await Promise.all(
      getRecipeCollections().map(async collectionName => {
        const nativeCollection = await getNativeCollection(recipifyConnection, collectionName);
        const estimatedCount = await nativeCollection.estimatedDocumentCount();
        let documents = [];

        try {
          documents = await nativeCollection.aggregate([
            { $sample: { size: Math.max(1, Math.min(sampleSize, estimatedCount || sampleSize)) } }
          ]).toArray();
        } catch (sampleError) {
          documents = await nativeCollection.find({}).limit(sampleSize).toArray();
        }

        const fieldMap = new Map();
        documents.forEach(document => {
          Object.entries(document).forEach(([field, value]) => {
            if (!fieldMap.has(field)) {
              fieldMap.set(field, {
                field,
                count: 0,
                types: new Set(),
                example: ''
              });
            }

            const fieldEntry = fieldMap.get(field);
            fieldEntry.count += 1;
            fieldEntry.types.add(getSchemaValueType(value));

            if (!fieldEntry.example) {
              fieldEntry.example = summarizeSchemaValue(value);
            }
          });
        });

        const sampledCount = documents.length;
        const fields = Array.from(fieldMap.values())
          .map(entry => ({
            field: entry.field,
            count: entry.count,
            coverage: sampledCount ? Number(((entry.count / sampledCount) * 100).toFixed(1)) : 0,
            types: Array.from(entry.types),
            example: entry.example
          }))
          .sort((a, b) => b.count - a.count || a.field.localeCompare(b.field));

        return {
          name: collectionName,
          estimatedCount,
          sampledCount,
          fieldCount: fields.length,
          fields
        };
      })
    );

    res.json({
      success: true,
      sampleSize,
      collections
    });
  } catch (error) {
    console.error('Schema inspector error:', error);
    res.status(500).json({
      success: false,
      error: 'Unable to inspect recipe schema right now'
    });
  }
});

function buildRecipeLookupQuery(recipeId) {
    let normalizedId = recipeId;

    try {
        if (typeof recipeId === 'string' && ObjectId.isValid(recipeId)) {
            normalizedId = new ObjectId(recipeId);
        }
    } catch (error) {
        normalizedId = recipeId;
    }

    return {
        $or: [
            { _id: normalizedId },
            { id: recipeId }
        ]
    };
}



app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'recipify.html'));
});

app.get('/allrecipe.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'allrecipe.html'));
});

app.get('/nutritionanalysis.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'nutritionanalysis.html'));
});

app.get('/recipe_input.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'recipe_input.html'));
});

app.get('/cookmode.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'cookmode.html'));
});

app.get('/profile.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'profile.html'));
});

app.get('/restaurants.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'restaurants.html'));
});

app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'profile.html'));
});

// RecipifyHub API Endpoints
// Get all recipes
app.get('/recipes', async (req, res) => {
    try {
        const recipes = await Recipe.find().sort({ created_at: -1 });
        res.json(recipes);
    } catch (err) {
        console.error('Error fetching recipes:', err);
        res.status(500).json({ message: err.message });
    }
});

// Get a single recipe
app.get('/recipes/:id', async (req, res) => {
    try {
        const recipe = await Recipe.findById(req.params.id);
        if (!recipe) {
            return res.status(404).json({ message: 'Recipe not found' });
        }
        res.json(recipe);
    } catch (err) {
        console.error('Error fetching recipe:', err);
        res.status(500).json({ message: err.message });
    }
});

// Create a new recipe
app.post('/saveRecipe', async (req, res) => {
    try {
        if (!req.session?.userId) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }

        const recipePayload = {
            ...sanitizeOwnedRecipePayload(req.body),
            published: req.body.published === true || req.body.published === 'true'
        };
        const savedRecipe = await firebaseStore.createUserRecipe(req.session.userId, req.session.username, recipePayload);
        res.status(201).json(savedRecipe);
    } catch (err) {
        console.error('Error creating recipe:', err);
        sendFirebaseError(res, err, 'Unable to save recipe');
    }
});

// Update a recipe
app.put('/recipes/:id', async (req, res) => {
    try {
        const updatedRecipe = await Recipe.findByIdAndUpdate(
            req.params.id,
            { ...req.body, updated_at: Date.now() },
            { new: true }
        );
        if (!updatedRecipe) {
            return res.status(404).json({ message: 'Recipe not found' });
        }
        res.json(updatedRecipe);
    } catch (err) {
        console.error('Error updating recipe:', err);
        res.status(400).json({ message: err.message });
    }
});

// Delete a recipe
app.delete('/recipes/:id', async (req, res) => {
    try {
        const deletedRecipe = await Recipe.findByIdAndDelete(req.params.id);
        if (!deletedRecipe) {
            return res.status(404).json({ message: 'Recipe not found' });
        }
        res.json({ message: 'Recipe deleted successfully' });
    } catch (err) {
        console.error('Error deleting recipe:', err);
        res.status(500).json({ message: err.message });
    }
});

// Profile API endpoints
app.get('/getProfile', async (req, res) => {
    try {
        const { username } = req.query;
        const existingProfile = await Profile.findOne({ username });
        
        if (existingProfile) {
            res.status(200).json(existingProfile);
        } else {
            res.status(404).json({ message: 'Profile not found' });
        }
    } catch (error) {
        console.error('Error getting profile:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

app.post('/saveProfile', async (req, res) => {
    try {
        const {
            username,
            name,
            about,
            facebook,
            instagram,
            twitter,
            github,
            behance,
            profileImageUrl
        } = req.body;

        let existingProfile = await Profile.findOne({ username });

        if (existingProfile) {
            existingProfile.name = name;
            existingProfile.about = about;
            existingProfile.socialLinks = {
                facebook,
                instagram,
                twitter,
                github,
                behance
            };
            existingProfile.profileImageUrl = profileImageUrl;

            const updatedProfile = await existingProfile.save();
            res.status(200).json(updatedProfile);
        } else {
            const newProfile = new Profile({
                username,
                name,
                about,
                socialLinks: {
                    facebook,
                    instagram,
                    twitter,
                    github,
                    behance
                },
                profileImageUrl
            });

            const savedProfile = await newProfile.save();
            res.status(201).json(savedProfile);
        }
    } catch (error) {
        console.error('Error creating or updating profile:', error);
        res.status(500).json({ error: 'Failed to create or update profile' });
    }
});

// Filter recipes
app.get('/recipes/filter', async (req, res) => {
    try {
        const { cuisine, course, diet, difficulty } = req.query;
        const query = {};
        
        if (cuisine) query.cuisine = { $regex: cuisine, $options: 'i' };
        if (course) query.course = { $regex: course, $options: 'i' };
        if (diet) query.diet = { $regex: diet, $options: 'i' };
        if (difficulty) query.difficulty = { $regex: difficulty, $options: 'i' };
        
        const recipes = await Recipe.find(query);
        res.json(recipes);
    } catch (err) {
        console.error('Error filtering recipes:', err);
        res.status(500).json({ message: err.message });
    }
});

// Search recipes
app.get('/recipes/search/:query', async (req, res) => {
    try {
        const searchQuery = req.params.query;
        const recipes = await Recipe.find({
            $or: [
                { name: { $regex: searchQuery, $options: 'i' } },
                { description: { $regex: searchQuery, $options: 'i' } },
                { ingredients: { $regex: searchQuery, $options: 'i' } },
                { instructions: { $regex: searchQuery, $options: 'i' } }
            ]
        });
        res.json(recipes);
    } catch (err) {
        console.error('Error searching recipes:', err);
        res.status(500).json({ message: err.message });
    }
});

// Sample Restaurants API Endpoints
// Get all restaurants (paginated)
app.get('/restaurants', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        const restaurants = await Restaurant.find()
            .sort({ name: 1 })
            .skip(skip)
            .limit(limit);
        
        const total = await Restaurant.countDocuments();
        
        res.json({
            restaurants,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (err) {
        console.error('Error fetching restaurants:', err);
        res.status(500).json({ message: err.message });
    }
});

// Get a single restaurant
app.get('/restaurants/:id', async (req, res) => {
    try {
        const restaurant = await Restaurant.findOne({ restaurant_id: req.params.id });
        if (!restaurant) {
            return res.status(404).json({ message: 'Restaurant not found' });
        }
        res.json(restaurant);
    } catch (err) {
        console.error('Error fetching restaurant:', err);
        res.status(500).json({ message: err.message });
    }
});

// Search restaurants
app.get('/restaurants/search/:query', async (req, res) => {
    try {
        const searchQuery = req.params.query;
        const restaurants = await Restaurant.find({
            $or: [
                { name: { $regex: searchQuery, $options: 'i' } },
                { cuisine: { $regex: searchQuery, $options: 'i' } },
                { borough: { $regex: searchQuery, $options: 'i' } }
            ]
        }).limit(20);
        
        res.json(restaurants);
    } catch (err) {
        console.error('Error searching restaurants:', err);
        res.status(500).json({ message: err.message });
    }
});

// Filter restaurants by cuisine
app.get('/restaurants/cuisine/:cuisine', async (req, res) => {
    try {
        const cuisine = req.params.cuisine;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        const restaurants = await Restaurant.find({ 
            cuisine: { $regex: cuisine, $options: 'i' } 
        })
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit);
        
        const total = await Restaurant.countDocuments({ 
            cuisine: { $regex: cuisine, $options: 'i' } 
        });
        
        res.json({
            restaurants,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (err) {
        console.error('Error filtering restaurants by cuisine:', err);
        res.status(500).json({ message: err.message });
    }
});

// Get top-rated restaurants
app.get('/restaurants/top-rated/:limit', async (req, res) => {
    try {
        const limit = parseInt(req.params.limit) || 10;
        
        const restaurants = await Restaurant.aggregate([
            { $unwind: "$grades" },
            { $group: {
                _id: "$_id",
                name: { $first: "$name" },
                cuisine: { $first: "$cuisine" },
                borough: { $first: "$borough" },
                restaurant_id: { $first: "$restaurant_id" },
                address: { $first: "$address" },
                avgGrade: { $avg: "$grades.score" }
            }},
            { $sort: { avgGrade: -1 } },
            { $limit: limit }
        ]);
        
        res.json(restaurants);
    } catch (err) {
        console.error('Error fetching top-rated restaurants:', err);
        res.status(500).json({ message: err.message });
    }
});

// Add API endpoints for recipe database operations after the existing API endpoints

// Recipe API endpoints
app.get('/api/recipe/:id', async (req, res) => {
  try {
    const collection = normalizeRecipeCollectionName(req.query.collection || 'recipes');
    const id = req.params.id;
    if (isUserRecipeCollection(collection)) {
      const recipe = await firebaseStore.getUserRecipeForView(id, req.session?.userId || null);
      if (!recipe) {
        return res.status(404).json({ success: false, error: 'Recipe not found' });
      }
      return res.json({ success: true, recipe });
    }

    const db = getRecipeDbConnection(collection);
    const recipe = await db.collection(collection).findOne(buildRecipeLookupQuery(id));
    
    if (!recipe) {
      return res.status(404).json({ success: false, error: 'Recipe not found' });
    }

    if (!canViewRecipeRecord(collection, recipe, req.session?.userId)) {
      return res.status(404).json({ success: false, error: 'Recipe not found' });
    }
    
    // Normalize the recipe data to ensure it has an id field
    const normalizedRecipe = {
      ...recipe,
      id: recipe.id || recipe._id,
      source_collection: collection
    };
    
    res.json({ success: true, recipe: normalizedRecipe });
  } catch (error) {
    console.error('Error fetching recipe:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Recipe Comments API
app.post('/api/recipes/:recipeId/comments', checkAuthentication, async (req, res) => {
    try {
        const { recipeId } = req.params;
        const { comment, collection } = req.body;

        if (!req.session.userId) {
            return res.status(401).json({ 
                success: false, 
                error: 'You must be logged in to post comments' 
            });
        }

        if (!comment || !String(comment).trim()) {
            return res.status(400).json({ success: false, error: 'Comment cannot be empty' });
        }

        const newComment = await firebaseStore.addComment(
            req.session.userId,
            req.session.username,
            recipeId,
            normalizeRecipeCollectionName(collection),
            String(comment).trim()
        );
        
        res.json({ 
            success: true, 
            comment: newComment
        });
    } catch (error) {
        console.error('Add comment error:', error);
        sendFirebaseError(res, error, 'Server error adding comment');
    }
});

app.get('/api/recipes/:recipeId/comments', async (req, res) => {
    try {
        const { recipeId } = req.params;
        const { collection } = req.query;
        
        // Validate inputs
        if (!recipeId || !collection) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        const comments = await firebaseStore.getRecipeComments(recipeId, normalizeRecipeCollectionName(collection));
        
        res.json({ success: true, data: comments });
    } catch (error) {
        console.error('Error getting comments:', error);
        sendFirebaseError(res, error, 'Server error while getting comments');
    }
});

app.get(['/api/recipe/user-comments', '/api/user/comments'], async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }

        const comments = await getUserCommentsWithRecipes(req.session.userId);
        res.json({ success: true, comments });
    } catch (error) {
        console.error('Error fetching user comments from Firebase:', error);
        sendFirebaseError(res, error, 'Server error while getting user comments');
    }
});

// Get user's comments
app.get('/api/recipe/user-comments', async (req, res) => {
    try {
        console.log('Fetching comments for user:', req.session.userId);
        
        // Check if user is authenticated
        if (!req.session.userId) {
            console.log('User not authenticated');
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }

        // Find all comments by this user
        console.log('Finding comments for userId:', req.session.userId);
        
        // Convert userId to ObjectId if it's a valid ObjectId string
        let userId = req.session.userId;
        if (typeof userId === 'string' && ObjectId.isValid(userId)) {
            userId = new ObjectId(userId);
            console.log('Converted userId to ObjectId');
        }
        
        // Use recipifyHubConnection to access comments collection
        const comments = await recipifyHubConnection.collection('comments')
            .find({ 
                $or: [
                    { userId: userId },
                    { userId: userId.toString() }
                ]
            })
            .sort({ createdAt: -1 })
            .toArray();

        console.log(`Found ${comments.length} comments for user`);
        
        if (!comments || comments.length === 0) {
            return res.json({ success: true, comments: [] });
        }

        // Get recipe details for each comment
        console.log('Fetching recipe details for comments...');
        const commentsWithDetails = await Promise.all(comments.map(async (comment) => {
            try {
                const collectionName = normalizeRecipeCollectionName(comment.collection);
                const dbConnection = getRecipeDbConnection(collectionName);
                
                console.log(`Fetching recipe ${comment.recipeId} from collection ${collectionName}`);
                
                // Get recipe details
                const recipeId = comment.recipeId;
                const recipe = await dbConnection.collection(collectionName).findOne(buildRecipeLookupQuery(recipeId));

                if (recipe) {
                    console.log(`Found recipe: ${recipe.name || recipe.recipe_name || 'Unnamed Recipe'}`);
                    return {
                        ...comment,
                        recipe: {
                            ...recipe,
                            id: recipe.id || recipe._id,
                            source_collection: collectionName
                        }
                    };
                } else {
                    console.log(`Recipe not found for comment ${comment._id}`);
                    // Return the comment with a placeholder recipe object
                    return {
                        ...comment,
                        recipe: {
                            name: 'Unavailable Recipe',
                            recipe_name: 'Unavailable Recipe',
                            id: comment.recipeId,
                            source_collection: collectionName,
                            image: 'https://via.placeholder.com/300x200?text=Recipe+Unavailable',
                            _unavailable: true
                        }
                    };
                }
            } catch (error) {
                console.error('Error fetching recipe for comment:', error);
                // Return the comment with a placeholder recipe object in case of error
                return {
                    ...comment,
                    recipe: {
                        name: 'Unavailable Recipe',
                        recipe_name: 'Unavailable Recipe',
                        id: comment.recipeId,
                        source_collection: normalizeRecipeCollectionName(comment.collection),
                        image: 'https://via.placeholder.com/300x200?text=Recipe+Unavailable',
                        _unavailable: true
                    }
                };
            }
        }));

        // Filter out null entries and send the results
        res.json({
            success: true,
            comments: commentsWithDetails
        });
    } catch (error) {
        console.error('Error fetching user comments:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add an alias route using the new consistent API path pattern
app.get('/api/user/comments', async (req, res) => {
    try {
        console.log('Fetching comments for user via /api/user/comments route:', req.session.userId);
        
        // Check if user is authenticated
        if (!req.session.userId) {
            console.log('User not authenticated');
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }

        // Find all comments by this user
        console.log('Finding comments for userId:', req.session.userId);
        
        // Convert userId to ObjectId if it's a valid ObjectId string
        let userId = req.session.userId;
        if (typeof userId === 'string' && ObjectId.isValid(userId)) {
            userId = new ObjectId(userId);
            console.log('Converted userId to ObjectId');
        }
        
        // Use recipifyHubConnection to access comments collection
        const comments = await recipifyHubConnection.collection('comments')
            .find({ 
                $or: [
                    { userId: userId },
                    { userId: userId.toString() }
                ]
            })
            .sort({ createdAt: -1 })
            .toArray();

        console.log(`Found ${comments.length} comments for user`);
        
        if (!comments || comments.length === 0) {
            return res.json({ success: true, comments: [] });
        }

        // Get recipe details for each comment
        console.log('Fetching recipe details for comments...');
        const commentsWithDetails = await Promise.all(comments.map(async (comment) => {
            try {
                const collectionName = normalizeRecipeCollectionName(comment.collection);
                const dbConnection = getRecipeDbConnection(collectionName);
                
                console.log(`Fetching recipe ${comment.recipeId} from collection ${collectionName}`);
                
                // Get recipe details
                const recipeId = comment.recipeId;
                const recipe = await dbConnection.collection(collectionName).findOne(buildRecipeLookupQuery(recipeId));

                if (recipe) {
                    console.log(`Found recipe: ${recipe.name || recipe.recipe_name || 'Unnamed Recipe'}`);
                    return {
                        ...comment,
                        recipe: {
                            ...recipe,
                            id: recipe.id || recipe._id,
                            source_collection: collectionName
                        }
                    };
                } else {
                    console.log(`Recipe not found for comment ${comment._id}`);
                    // Return the comment with a placeholder recipe object
                    return {
                        ...comment,
                        recipe: {
                            name: 'Unavailable Recipe',
                            recipe_name: 'Unavailable Recipe',
                            id: comment.recipeId,
                            source_collection: collectionName,
                            image: 'https://via.placeholder.com/300x200?text=Recipe+Unavailable',
                            _unavailable: true
                        }
                    };
                }
            } catch (error) {
                console.error('Error fetching recipe for comment:', error);
                // Return the comment with a placeholder recipe object in case of error
                return {
                    ...comment,
                    recipe: {
                        name: 'Unavailable Recipe',
                        recipe_name: 'Unavailable Recipe',
                        id: comment.recipeId,
                        source_collection: normalizeRecipeCollectionName(comment.collection),
                        image: 'https://via.placeholder.com/300x200?text=Recipe+Unavailable',
                        _unavailable: true
                    }
                };
            }
        }));

        // Filter out null entries and send the results
        res.json({
            success: true,
            comments: commentsWithDetails
        });
    } catch (error) {
        console.error('Error fetching user comments:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/recipe/comment/update', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ success: false, error: 'You must be logged in to update comments' });
        }

        const { commentId, text } = req.body;
        if (!commentId || !text || !String(text).trim()) {
            return res.status(400).json({ success: false, error: 'Missing or empty comment text' });
        }

        const updated = await firebaseStore.updateComment(req.session.userId, commentId, String(text).trim());
        if (!updated) {
            return res.status(404).json({ success: false, error: 'Comment not found or not owned by you' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating Firebase comment:', error);
        sendFirebaseError(res, error, 'Server error while updating comment');
    }
});

app.post('/api/recipe/comment/delete', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ success: false, error: 'You must be logged in to delete comments' });
        }

        const { commentId } = req.body;
        if (!commentId) {
            return res.status(400).json({ success: false, error: 'Missing comment ID' });
        }

        const deleted = await firebaseStore.deleteComment(req.session.userId, commentId);
        if (!deleted) {
            return res.status(404).json({ success: false, error: 'Comment not found or not owned by you' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting Firebase comment:', error);
        sendFirebaseError(res, error, 'Server error while deleting comment');
    }
});

// Update a comment
app.post('/api/recipe/comment/update', async (req, res) => {
    try {
        // Check if user is authenticated
        if (!req.session.userId) {
            return res.status(401).json({ success: false, error: 'You must be logged in to update comments' });
        }
        
        const { commentId, text } = req.body;
        console.log('Updating comment:', commentId);
        
        // Validate inputs
        if (!commentId || !text) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        if (text.trim().length === 0) {
            return res.status(400).json({ success: false, error: 'Comment cannot be empty' });
        }
        
        // Convert IDs to proper format
        const commentObjectId = ObjectId.isValid(commentId) ? new ObjectId(commentId) : commentId;
        let userId = req.session.userId;
        if (typeof userId === 'string' && ObjectId.isValid(userId)) {
            userId = new ObjectId(userId);
        }
        
        // Find the comment - use recipifyHubConnection
        const comment = await recipifyHubConnection.collection('comments').findOne({
            _id: commentObjectId
        });
        
        // Check if comment exists and belongs to this user
        if (!comment) {
            console.log('Comment not found');
            return res.status(404).json({ success: false, error: 'Comment not found' });
        }
        
        // Compare userIds safely
        const commentUserId = comment.userId;
        const isOwner = 
            commentUserId.toString() === userId.toString() || 
            (ObjectId.isValid(commentUserId) && 
             ObjectId.isValid(userId) && 
             new ObjectId(commentUserId).equals(new ObjectId(userId)));
        
        if (!isOwner) {
            console.log('User does not own this comment.');
            console.log('Comment userId:', commentUserId);
            console.log('Session userId:', userId);
            return res.status(403).json({ success: false, error: 'You can only edit your own comments' });
        }
        
        // Update the comment - use recipifyHubConnection
        await recipifyHubConnection.collection('comments').updateOne(
            { _id: commentObjectId },
            { 
                $set: { 
                    text: text,
                    updatedAt: new Date()
                }
            }
        );
        
        console.log('Comment updated successfully');
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating comment:', error);
        res.status(500).json({ success: false, error: 'Server error while updating comment' });
    }
});

// Delete a comment
app.post('/api/recipe/comment/delete', async (req, res) => {
    try {
        // Check if user is authenticated
        if (!req.session.userId) {
            return res.status(401).json({ success: false, error: 'You must be logged in to delete comments' });
        }
        
        const { commentId } = req.body;
        console.log('Deleting comment:', commentId);
        
        // Validate inputs
        if (!commentId) {
            return res.status(400).json({ success: false, error: 'Missing comment ID' });
        }
        
        // Convert IDs to proper format
        const commentObjectId = ObjectId.isValid(commentId) ? new ObjectId(commentId) : commentId;
        let userId = req.session.userId;
        if (typeof userId === 'string' && ObjectId.isValid(userId)) {
            userId = new ObjectId(userId);
        }
        
        // Find the comment - use recipifyHubConnection
        const comment = await recipifyHubConnection.collection('comments').findOne({
            _id: commentObjectId
        });
        
        // Check if comment exists and belongs to this user
        if (!comment) {
            console.log('Comment not found');
            return res.status(404).json({ success: false, error: 'Comment not found' });
        }
        
        // Compare userIds safely
        const commentUserId = comment.userId;
        const isOwner = 
            commentUserId.toString() === userId.toString() || 
            (ObjectId.isValid(commentUserId) && 
             ObjectId.isValid(userId) && 
             new ObjectId(commentUserId).equals(new ObjectId(userId)));
        
        if (!isOwner) {
            console.log('User does not own this comment.');
            console.log('Comment userId:', commentUserId);
            console.log('Session userId:', userId);
            return res.status(403).json({ success: false, error: 'You can only delete your own comments' });
        }
        
        // Delete the comment - use recipifyHubConnection
        await recipifyHubConnection.collection('comments').deleteOne({
            _id: commentObjectId
        });
        
        console.log('Comment deleted successfully');
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ success: false, error: 'Server error while deleting comment' });
    }
});

app.post('/api/recipes/:recipeId/rate', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const { recipeId } = req.params;
    const { rating, collection } = req.body;
    const collectionName = normalizeRecipeCollectionName(collection);
    const ratingNumber = Number(rating);

    if (!Number.isFinite(ratingNumber) || ratingNumber < 1 || ratingNumber > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    const ratingResult = await firebaseStore.rateRecipe(
      req.session.userId,
      req.session.username,
      recipeId,
      collectionName,
      ratingNumber
    );

    res.json({
      success: true,
      message: 'Rating updated successfully',
      data: {
        ratings: ratingResult.ratings,
        averageRating: ratingResult.averageRating,
        userRating: ratingResult.userRating
      }
    });
  } catch (error) {
    console.error('Error updating Firebase rating:', error);
    sendFirebaseError(res, error, 'Server error while rating recipe');
  }
});

app.get('/api/recipes/:recipeId/ratings', async (req, res) => {
  try {
    const { recipeId } = req.params;
    const collection = normalizeRecipeCollectionName(req.query.collection);

    if (!collection) {
      return res.status(400).json({ success: false, message: 'Collection parameter is required' });
    }

    const ratingResult = await firebaseStore.getRecipeRatings(recipeId, collection, req.session?.userId || null);
    res.json({
      success: true,
      data: {
        ratings: ratingResult.ratings,
        averageRating: ratingResult.averageRating,
        userRating: ratingResult.userRating
      }
    });
  } catch (error) {
    console.error('Error fetching Firebase ratings:', error);
    sendFirebaseError(res, error, 'Server error while fetching ratings');
  }
});

app.get('/api/user/ratings', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const ratings = await getUserRatingsWithRecipes(req.session.userId);
    res.json({ success: true, ratings });
  } catch (error) {
    console.error('Error fetching Firebase user ratings:', error);
    sendFirebaseError(res, error, 'Server error while fetching user ratings');
  }
});

// Recipe Ratings API
app.post('/api/recipes/:recipeId/rate', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const { recipeId } = req.params;
    const { rating, collection } = req.body;
    const collectionName = normalizeRecipeCollectionName(collection);
    const userId = req.session.userId;

    // Validate rating
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    // Store the rating in the UserHistory collection for the user
    let userHistory = await UserHistory.findOne({ userId });
    if (!userHistory) {
      userHistory = new UserHistory({
        userId,
        searchHistory: [],
        viewedRecipes: [],
        ratings: []
      });
    }

    // Check if already rated this recipe
    const existingRatingIndex = userHistory.ratings.findIndex(
      r => r.recipeId === recipeId && normalizeRecipeCollectionName(r.collection) === collectionName
    );

    if (existingRatingIndex >= 0) {
      userHistory.ratings[existingRatingIndex].rating = rating;
      userHistory.ratings[existingRatingIndex].updatedAt = new Date();
    } else {
      userHistory.ratings.push({
        recipeId,
        collection: collectionName,
        rating,
        createdAt: new Date()
      });
    }

    await userHistory.save();

    // Get the recipe data for response
    let recipe;
    try {
      const db = getRecipeDbConnection(collectionName);
      recipe = await db.collection(collectionName).findOne(buildRecipeLookupQuery(recipeId));
    } catch (error) {
      console.error('Error fetching recipe details:', error);
    }

    // Calculate average rating
    const allRatings = await UserHistory.find({ 'ratings.recipeId': recipeId });
    const ratings = [];
    
    allRatings.forEach(history => {
      const userRatings = history.ratings.filter(
        r => r.recipeId === recipeId && normalizeRecipeCollectionName(r.collection) === collectionName
      );
      ratings.push(...userRatings);
    });

    const averageRating = ratings.reduce((acc, curr) => acc + curr.rating, 0) / ratings.length;

    res.json({
      success: true,
      message: 'Rating updated successfully',
      data: {
        ratings,
        averageRating
      }
    });
  } catch (error) {
    console.error('Error updating rating:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/recipes/:recipeId/ratings', async (req, res) => {
  try {
    const { recipeId } = req.params;
    const collection = normalizeRecipeCollectionName(req.query.collection);

    if (!collection) {
      return res.status(400).json({ success: false, message: 'Collection parameter is required' });
    }

    // Get all ratings for this recipe from user history
    const allRatings = await UserHistory.find({ 'ratings.recipeId': recipeId });
    const ratings = [];
    
    allRatings.forEach(history => {
      const userRatings = history.ratings.filter(
        r => r.recipeId === recipeId && normalizeRecipeCollectionName(r.collection) === collection
      );
      ratings.push(...userRatings);
    });

    let averageRating = 0;
    if (ratings.length > 0) {
      averageRating = ratings.reduce((acc, curr) => acc + curr.rating, 0) / ratings.length;
    }

    res.json({
      success: true,
      data: {
        ratings,
        averageRating
      }
    });
  } catch (error) {
    console.error('Error fetching ratings:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get user's ratings
app.get('/api/user/ratings', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const userHistory = await UserHistory.findOne({ userId: req.session.userId });
    
    if (!userHistory || !userHistory.ratings || userHistory.ratings.length === 0) {
      return res.json({ success: true, ratings: [] });
    }

    // Get recipe details for each rating
    const ratingsWithDetails = await Promise.all(userHistory.ratings.map(async (rating) => {
      try {
        const collectionName = normalizeRecipeCollectionName(rating.collection);
        const db = getRecipeDbConnection(collectionName);
        
        // Get recipe details
        const recipe = await db.collection(collectionName).findOne(buildRecipeLookupQuery(rating.recipeId));

        if (recipe) {
          return {
            ...rating.toObject(),
            recipe: {
              ...recipe,
              id: recipe.id || recipe._id,
              source_collection: collectionName
            }
          };
        } else {
          return null;
        }
      } catch (error) {
        console.error('Error fetching recipe:', error);
        return null;
      }
    }));

    // Filter out null entries and send the results
    res.json({
      success: true,
      ratings: ratingsWithDetails.filter(r => r !== null)
    });
  } catch (error) {
    console.error('Error fetching user ratings:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/recipes', async (req, res) => {
  try {
    const collection = normalizeRecipeCollectionName(req.body.collection || 'recipes');
    const limit = parseInt(req.body.limit) || 200;
    const skip = parseInt(req.body.skip) || 0;
    if (isUserRecipeCollection(collection)) {
      const result = await firebaseStore.listPublicUserRecipes({
        query: req.body.query || {},
        limit,
        skip,
        viewerUid: req.session?.userId || null
      });

      return res.json({
        success: true,
        recipes: result.recipes,
        total: result.total,
        hasMore: result.total > skip + limit
      });
    }

    const query = buildVisibleRecipeQuery(collection, req.body.query || {}, req.session?.userId);
    const db = getRecipeDbConnection(collection);
    const nativeCollection = await getNativeCollection(db, collection);
    
    // Query the database
    const recipes = await nativeCollection
      .find(query)
      .skip(skip)
      .limit(limit)
      .toArray();
    
    const total = await nativeCollection.countDocuments(query);
    
    // Normalize the recipes to ensure each has an id field
    const normalizedRecipes = recipes.map(recipe => ({
      ...recipe,
      id: recipe.id || recipe._id,
      source_collection: collection
    }));
    
    res.json({
      success: true,
      recipes: normalizedRecipes,
      total,
      hasMore: total > skip + limit
    });
  } catch (error) {
    console.error('Error fetching recipes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/search-recipes', async (req, res) => {
  try {
    const searchTerm = req.query.term || '';
    const limit = parseInt(req.query.limit) || 200;
    const skip = parseInt(req.query.skip) || 0;
    
    if (!searchTerm) {
      return res.status(400).json({ success: false, error: 'Search term is required' });
    }
    
    // Create search query
    const query = {
      $or: [
        { name: { $regex: searchTerm, $options: 'i' } },
        { recipe_name: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } },
        { ingredients: { $regex: searchTerm, $options: 'i' } },
        { tags: { $regex: searchTerm, $options: 'i' } },
        { cuisine: { $regex: searchTerm, $options: 'i' } }
      ]
    };
    
    // Search in multiple collections
    const collections = getRecipeCollections().map(name => ({ name, db: recipifyConnection }));
    
    const perCollection = Math.ceil(limit * 2 / collections.length);
    
    // Execute searches in parallel
    const searchPromises = collections.map(async (collection) => {
      try {
        const nativeCollection = await getNativeCollection(collection.db, collection.name);
        const visibleQuery = buildVisibleRecipeQuery(collection.name, query, req.session?.userId);
        const results = await nativeCollection
          .find(visibleQuery)
          .limit(perCollection)
          .skip(skip)
          .toArray();
        
        return {
          collection: collection.name,
          results
        };
      } catch (err) {
        console.error(`Error searching collection ${collection.name}:`, err);
        return {
          collection: collection.name,
          results: []
        };
      }
    });
    
    const searchResults = await Promise.all(searchPromises);
    
    // Combine results
    let allResults = [];
    searchResults.forEach(result => {
      if (result.results && result.results.length > 0) {
        result.results.forEach(recipe => {
          allResults.push({
            ...recipe,
            id: recipe.id || recipe._id,
            source_collection: result.collection
          });
        });
      }
    });

    let firebaseRecipeTotal = 0;
    try {
      const firebaseRecipes = await firebaseStore.listPublicUserRecipes({
        query,
        limit,
        skip: 0,
        viewerUid: req.session?.userId || null
      });
      firebaseRecipeTotal = firebaseRecipes.total;
      allResults.push(...firebaseRecipes.recipes);
    } catch (firebaseError) {
      if (firebaseStore.firebaseStatus().configured) {
        console.error('Error searching Firebase user recipes:', firebaseError);
      }
    }
    
    // Shuffle and limit results
    allResults = shuffleArray(allResults).slice(0, limit);
    
    // Count total results from all collections
    const totalCountPromises = collections.map(async (collection) => {
      try {
        const nativeCollection = await getNativeCollection(collection.db, collection.name);
        return await nativeCollection.countDocuments(query);
      } catch (err) {
        console.error(`Error counting documents in ${collection.name}:`, err);
        return 0;
      }
    });
    
    const totalCounts = await Promise.all(totalCountPromises);
    const totalRecipes = totalCounts.reduce((acc, count) => acc + count, 0) + firebaseRecipeTotal;
    
    res.json({ 
      success: true, 
      recipes: allResults, 
      total: totalRecipes,
      hasMore: totalRecipes > (skip + limit)
    });
  } catch (error) {
    console.error('Error searching recipes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper function to shuffle an array
function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

function createAuthError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isTruthyGoogleValue(value) {
  return value === true || value === 'true' || value === '1';
}

function buildGoogleProfileImageFallback(name, email) {
  const label = encodeURIComponent((name || email || 'Recipify User').trim());
  return `https://ui-avatars.com/api/?name=${label}&background=random`;
}

function getNameParts(name = '', givenName = '', familyName = '') {
  if (givenName || familyName) {
    return {
      firstName: givenName || 'User',
      lastName: familyName || ''
    };
  }

  const nameParts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: nameParts[0] || 'User',
    lastName: nameParts.length > 1 ? nameParts.slice(1).join(' ') : ''
  };
}

async function buildUniqueGoogleUsername(email) {
  const seed = String(email || '')
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 28) || 'google_user';

  let candidate = seed;
  let suffix = 0;

  while (await User.exists({ username: candidate })) {
    suffix += 1;
    candidate = suffix <= 25
      ? `${seed}_${suffix}`
      : `${seed}_${crypto.randomBytes(3).toString('hex')}`;
  }

  return candidate;
}

function buildAuthUserPayload(user) {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    profileImageUrl: user.profileImageUrl || '',
    preferences: user.preferences || {
      measurement: 'metric',
      temperature: 'celsius',
      skillLevel: 'intermediate',
      diet: []
    }
  };
}

async function verifyGoogleCredential(credential) {
  if (!GOOGLE_CLIENT_ID) {
    throw createAuthError('Google sign-in is not configured on this server.', 503);
  }

  if (!isValidGoogleClientId(GOOGLE_CLIENT_ID)) {
    throw createAuthError('Google sign-in is configured with an invalid Web OAuth client ID. Set GOOGLE_CLIENT_ID to the client ID ending in .apps.googleusercontent.com.', 503);
  }

  if (!credential || typeof credential !== 'string') {
    throw createAuthError('Google credential is required.', 400);
  }

  let tokenInfo;
  try {
    const response = await axios.get(GOOGLE_TOKENINFO_URL, {
      params: { id_token: credential },
      timeout: 8000
    });
    tokenInfo = response.data || {};
  } catch (error) {
    throw createAuthError('Google credential could not be verified.', 401);
  }

  if (tokenInfo.aud !== GOOGLE_CLIENT_ID) {
    throw createAuthError('Google credential was issued for a different client.', 401);
  }

  if (!tokenInfo.sub || !tokenInfo.email) {
    throw createAuthError('Google credential is missing required profile data.', 401);
  }

  const expiresAt = Number(tokenInfo.exp);
  if (expiresAt && expiresAt * 1000 <= Date.now()) {
    throw createAuthError('Google credential has expired.', 401);
  }

  if (!isTruthyGoogleValue(tokenInfo.email_verified)) {
    throw createAuthError('Google account email is not verified.', 401);
  }

  const { firstName, lastName } = getNameParts(tokenInfo.name, tokenInfo.given_name, tokenInfo.family_name);

  return {
    email: tokenInfo.email,
    name: tokenInfo.name || `${firstName} ${lastName}`.trim(),
    firstName,
    lastName,
    googleId: tokenInfo.sub,
    imageUrl: tokenInfo.picture || buildGoogleProfileImageFallback(tokenInfo.name, tokenInfo.email)
  };
}

// Authentication Endpoints
app.get('/api/auth/firebase-config', (req, res) => {
  const firebaseStatus = firebaseStore.firebaseStatus();
  const firebaseConfig = getFirebaseClientConfig();
  const clientConfigured = isFirebaseClientConfigReady(firebaseConfig);

  res.json({
    success: true,
    isConfigured: firebaseStatus.configured && clientConfigured,
    firebaseConfigured: firebaseStatus.configured,
    clientConfigured,
    firebaseConfig: clientConfigured ? firebaseConfig : null,
    message: firebaseStatus.configured && clientConfigured
      ? 'Firebase Auth is configured.'
      : 'Firebase Auth needs FIREBASE_PROJECT_ID and FIREBASE_WEB_API_KEY in .env.'
  });
});

app.get('/api/auth/google-config', (req, res) => {
  const firebaseStatus = firebaseStore.firebaseStatus();
  const hasClientId = Boolean(GOOGLE_CLIENT_ID);
  const clientIdLooksValid = isValidGoogleClientId(GOOGLE_CLIENT_ID);
  res.json({
    success: true,
    isConfigured: hasClientId && clientIdLooksValid,
    hasClientId,
    clientIdLooksValid,
    clientId: GOOGLE_CLIENT_ID || '',
    firebaseConfigured: firebaseStatus.configured
  });
});

app.post('/api/auth/firebase-login', async (req, res) => {
  try {
    const user = await firebaseStore.loginWithFirebaseIdToken(req.body?.idToken);
    setSessionUser(req, res, user);
    res.json({
      success: true,
      user,
      data: user
    });
  } catch (error) {
    console.error('Firebase Auth login error:', error);
    sendFirebaseError(res, error, 'Firebase Auth login failed');
  }
});

app.post(['/api/auth/register', '/api/register'], async (req, res) => {
  try {
    const user = await firebaseStore.createUserAccount(req.body);
    setSessionUser(req, res, user);
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user
    });
  } catch (error) {
    console.error('Firebase registration error:', error);
    sendFirebaseError(res, error, 'Registration failed');
  }
});

app.post(['/api/auth/login', '/api/login'], async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const identifier = typeof username === 'string' && username.trim()
      ? username
      : email;
    const user = await firebaseStore.loginWithPassword(identifier, password);
    setSessionUser(req, res, user);
    res.json({ success: true, user });
  } catch (error) {
    console.error('Firebase login error:', error);
    sendFirebaseError(res, error, 'Login failed');
  }
});

app.get('/api/auth/check-auth', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.json({ success: true, isAuthenticated: false });
    }

    const user = await firebaseStore.getUserProfile(req.session.userId);
    res.json({
      success: true,
      isAuthenticated: true,
      userId: user.id,
      username: user.username,
      user
    });
  } catch (error) {
    console.error('Firebase auth check error:', error);
    req.session.destroy(() => {});
    sendFirebaseError(res, error, 'Server error checking authentication');
  }
});

app.post('/api/auth/google', async (req, res) => {
  try {
    const googleProfile = await verifyGoogleCredential(req.body?.credential);
    const user = await firebaseStore.upsertGoogleUser(googleProfile);
    setSessionUser(req, res, user);
    res.json({
      success: true,
      user,
      data: user
    });
  } catch (error) {
    console.error('Firebase Google login error:', error);
    sendFirebaseError(res, error, 'Google login failed');
  }
});

app.get(['/api/auth/user', '/api/user'], async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const user = await firebaseStore.getUserProfile(req.session.userId);
    res.json({ success: true, data: user, user });
  } catch (error) {
    console.error('Firebase user fetch error:', error);
    sendFirebaseError(res, error, 'Unable to fetch user');
  }
});

app.post(['/api/auth/update-profile', '/api/user/profile'], async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const user = await firebaseStore.updateUserProfile(req.session.userId, req.body);
    req.session.username = user.username;
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: user,
      user
    });
  } catch (error) {
    console.error('Firebase profile update error:', error);
    sendFirebaseError(res, error, 'Profile update failed');
  }
});

app.post(['/api/auth/update-preferences', '/api/user/preferences'], async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const preferences = await firebaseStore.updateUserPreferences(
      req.session.userId,
      req.body.preferences || req.body
    );
    res.json({
      success: true,
      message: 'Preferences updated successfully',
      preferences,
      data: { preferences }
    });
  } catch (error) {
    console.error('Firebase preferences update error:', error);
    sendFirebaseError(res, error, 'Preferences update failed');
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ 
      $or: [
        { username: username },
        { email: email }
      ]
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'User with this username or email already exists' 
      });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create new user
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      firstName: firstName || '',
      lastName: lastName || '',
      authType: 'local',
      profileImageUrl: `https://ui-avatars.com/api/?name=${firstName}+${lastName}&background=random`,
      createdAt: Date.now()
    });
    
    // Save user to database
    await newUser.save();
    
    // Create session
    req.session.userId = newUser._id;
    req.session.username = newUser.username;
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email
      }
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Check if user is authenticated
app.get('/api/auth/check-auth', async (req, res) => {
    try {
        // Check if user is logged in based on session
        if (!req.session.userId) {
            return res.json({ 
                success: true, 
                isAuthenticated: false
            });
        }
        
        // Validate the user exists in database
        const user = await User.findById(req.session.userId);
        
        if (!user) {
            // Session refers to a user that no longer exists
            req.session.destroy();
            return res.json({ 
                success: true, 
                isAuthenticated: false
            });
        }
        
        // User is authenticated
        return res.json({ 
            success: true, 
            isAuthenticated: true, 
            userId: req.session.userId,
            username: user.username
        });
    } catch (error) {
        console.error('Auth check error:', error);
        return res.status(500).json({ 
            success: false, 
            isAuthenticated: false,
            error: 'Server error checking authentication'
        });
    }
});

// Google OAuth login
app.post('/api/auth/google', async (req, res) => {
  try {
    const googleProfile = await verifyGoogleCredential(req.body?.credential);
    const { email, firstName, lastName, googleId, imageUrl } = googleProfile;

    // Check if user exists
    let user = await User.findOne({ email });
    
    if (!user) {
      const username = await buildUniqueGoogleUsername(email);

      // Create new user
      user = new User({
        username,
        email,
        // Special password field for OAuth users
        password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), await bcrypt.genSalt(10)),
        firstName,
        lastName,
        googleId,
        profileImageUrl: imageUrl,
        authType: 'google',
        preferences: {
          measurement: 'metric',
          temperature: 'celsius',
          skillLevel: 'intermediate',
          diet: []
        }
      });
      
      await user.save();
    } else {
      // Update existing user with Google info if needed
      user.googleId = user.googleId || googleId;
      user.authType = 'google';
      user.firstName = user.firstName || firstName;
      user.lastName = user.lastName || lastName;
      if (imageUrl) user.profileImageUrl = imageUrl;
    }

    user.lastLogin = new Date();
    await user.save();
    
    // Create session
    req.session.userId = user._id;
    req.session.username = user.username;
    
    // Set cookie
    res.cookie('user_id', user._id.toString(), buildCookieOptions(7 * 24 * 60 * 60 * 1000));

    const authUser = buildAuthUserPayload(user);
    
    res.json({
      success: true,
      user: authUser,
      data: authUser
    });
  } catch (error) {
    console.error('Error with Google login:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Google login failed'
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const loginIdentifier = typeof username === 'string'
      ? username.trim()
      : typeof email === 'string'
        ? email.trim()
        : '';

    if (!loginIdentifier || !password) {
      return res.status(400).json({ success: false, error: 'Username or email and password are required' });
    }
    
    // Find user
    const user = loginIdentifier.includes('@')
      ? await User.findOne({
          email: new RegExp(`^${loginIdentifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
        })
      : await User.findOne({ username: loginIdentifier });
    if (!user) {
      return res.status(400).json({ success: false, error: 'Invalid credentials' });
    }
    
    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Invalid credentials' });
    }
    
    // Update last login
    user.lastLogin = new Date();
    await user.save();
    
    // Create session
    req.session.userId = user._id;
    req.session.username = user.username;
    
    // Set cookie
    res.cookie('user_id', user._id.toString(), buildCookieOptions(7 * 24 * 60 * 60 * 1000));
    
    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl || '',
        preferences: user.preferences || {
          measurement: 'metric',
          temperature: 'celsius',
          skillLevel: 'intermediate',
          diet: []
        }
      }
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/auth/user', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({
      success: true,
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl || '',
        preferences: user.preferences || {
          measurement: 'metric',
          temperature: 'celsius',
          skillLevel: 'intermediate',
          diet: []
        }
      }
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to logout' 
      });
    }
    
    res.clearCookie('connect.sid'); // Clear the session cookie
    
    return res.status(200).json({ 
      success: true, 
      message: 'Logged out successfully' 
    });
  });
});

// Update user preferences
app.post('/api/auth/update-preferences', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    
    const userId = req.session.userId;
    const { preferences } = req.body;
    
    // Validate preferences
    if (!preferences) {
      return res.status(400).json({ success: false, message: 'No preferences provided' });
    }
    
    // Find user and update preferences
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Update user preferences
    user.preferences = {
      ...user.preferences || {},
      ...preferences
    };
    
    await user.save();
    
    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl || '',
        preferences: user.preferences
      }
    });
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update user profile
app.post('/api/auth/update-profile', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    
    const userId = req.session.userId;
    const { firstName, lastName, profileImageUrl, bio, location, website } = req.body;
    
    // Find user and update profile
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Update fields if provided
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (profileImageUrl !== undefined) user.profileImageUrl = profileImageUrl;
    if (bio !== undefined) user.bio = bio;
    if (location !== undefined) user.location = location;
    if (website !== undefined) user.website = website;
    
    await user.save();
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl || '',
        bio: user.bio || '',
        location: user.location || '',
        website: user.website || '',
        preferences: user.preferences
      }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// User Data API Routes

// User session management
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }
        
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }
        
        // Update last login
        user.lastLogin = new Date();
        await user.save();
        
        // Set session
        req.session.userId = user._id;
        req.session.username = user.username;
        
        // Return user info (excluding password)
        const userInfo = {
            id: user._id,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImageUrl: user.profileImageUrl,
            preferences: user.preferences
        };
        
        res.json({ success: true, user: userInfo });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

app.post('/api/register', async (req, res) => {
    const { username, email, password, firstName, lastName } = req.body;
    
    try {
        // Check if user already exists
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        
        if (existingUser) {
            return res.status(400).json({ 
                success: false, 
                error: existingUser.email === email ? 'Email already in use' : 'Username already taken' 
            });
        }
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // Create new user
        const newUser = new User({
            username,
            email,
            password: hashedPassword,
            firstName,
            lastName,
            authType: 'local'
        });
        
        await newUser.save();
        
        // Create basic profile (just with username)
        const newProfile = new Profile({
            username,
            profileImageUrl: ''
        });
        
        await newProfile.save();
        
        // Set session
        req.session.userId = newUser._id;
        req.session.username = newUser.username;
        
        // Return user info
        const userInfo = {
            id: newUser._id,
            username: newUser.username,
            email: newUser.email,
            firstName: newUser.firstName,
            lastName: newUser.lastName,
            profileImageUrl: newUser.profileImageUrl,
            preferences: newUser.preferences
        };
        
        res.status(201).json({ success: true, user: userInfo });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

app.get('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ success: false, error: 'Failed to logout' });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true });
    });
});

app.get('/api/user', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId).select('-password');
        
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        res.json({ success: true, user });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

app.get('/api/user/profile', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const [user, stats] = await Promise.all([
      firebaseStore.getUserProfile(req.session.userId),
      firebaseStore.getProfileStats(req.session.userId)
    ]);

    res.json({
      success: true,
      user: {
        ...user,
        stats
      }
    });
  } catch (error) {
    console.error('Firebase profile fetch error:', error);
    sendFirebaseError(res, error, 'Unable to fetch profile');
  }
});

app.post('/api/profile/update-picture', isAuthenticated, async (req, res) => {
  try {
    const user = await firebaseStore.updateUserProfile(req.session.userId, {
      profileImageUrl: req.body.profileImageUrl
    });
    res.json({ success: true, user });
  } catch (error) {
    console.error('Firebase profile picture update error:', error);
    sendFirebaseError(res, error, 'Unable to update profile picture');
  }
});

app.get('/api/user/recipes', isAuthenticated, async (req, res) => {
    try {
        const recipes = await firebaseStore.listUserRecipes(req.session.userId);
        res.json({ success: true, recipes });
    } catch (error) {
        console.error('Firebase get user recipes error:', error);
        sendFirebaseError(res, error, 'Server error fetching user recipes');
    }
});

app.post('/api/user/recipes', isAuthenticated, async (req, res) => {
    try {
        const recipe = await firebaseStore.createUserRecipe(
            req.session.userId,
            req.session.username,
            {
                ...sanitizeOwnedRecipePayload(req.body),
                published: req.body.published === true || req.body.published === 'true'
            }
        );
        res.status(201).json({ success: true, recipe });
    } catch (error) {
        console.error('Firebase create user recipe error:', error);
        sendFirebaseError(res, error, 'Server error creating user recipe');
    }
});

app.get('/api/user/recipes/analytics', isAuthenticated, async (req, res) => {
    try {
        const recipes = await firebaseStore.listUserRecipes(req.session.userId);
        const analytics = await Promise.all(recipes.map(async recipe => {
            const [comments, ratingResult, metrics] = await Promise.all([
                firebaseStore.getRecipeComments(String(recipe.id), firebaseStore.USER_RECIPE_COLLECTION),
                firebaseStore.getRecipeRatings(String(recipe.id), firebaseStore.USER_RECIPE_COLLECTION),
                firebaseStore.getRecipeMetrics(String(recipe.id), firebaseStore.USER_RECIPE_COLLECTION)
            ]);

            return {
                recipeId: String(recipe.id),
                title: recipe.name || recipe.recipe_name || 'Untitled Recipe',
                published: recipe.published !== false,
                createdAt: recipe.created_at,
                updatedAt: recipe.updated_at,
                views: metrics.viewCount || 0,
                shares: metrics.shareCount || 0,
                comments: comments.length,
                ratingsCount: ratingResult.ratings.length,
                averageRating: Number((ratingResult.averageRating || 0).toFixed(1))
            };
        }));

        const summary = analytics.reduce((acc, recipe) => {
            acc.totalRecipes += 1;
            acc.publishedRecipes += recipe.published ? 1 : 0;
            acc.draftRecipes += recipe.published ? 0 : 1;
            acc.totalViews += recipe.views;
            acc.totalShares += recipe.shares;
            acc.totalComments += recipe.comments;
            acc.ratingSum += recipe.averageRating * recipe.ratingsCount;
            acc.ratingCount += recipe.ratingsCount;
            return acc;
        }, {
            totalRecipes: 0,
            publishedRecipes: 0,
            draftRecipes: 0,
            totalViews: 0,
            totalShares: 0,
            totalComments: 0,
            ratingSum: 0,
            ratingCount: 0
        });

        res.json({
            success: true,
            summary: {
                totalRecipes: summary.totalRecipes,
                publishedRecipes: summary.publishedRecipes,
                draftRecipes: summary.draftRecipes,
                totalViews: summary.totalViews,
                totalShares: summary.totalShares,
                totalComments: summary.totalComments,
                averageRating: summary.ratingCount ? Number((summary.ratingSum / summary.ratingCount).toFixed(1)) : 0
            },
            recipes: analytics
        });
    } catch (error) {
        console.error('Firebase user recipe analytics error:', error);
        sendFirebaseError(res, error, 'Server error fetching recipe analytics');
    }
});

app.get('/api/user/recipes/:id', isAuthenticated, async (req, res) => {
    try {
        const recipe = await firebaseStore.getUserRecipeForOwner(req.session.userId, req.params.id);
        if (!recipe) {
            return res.status(404).json({ success: false, error: 'Recipe not found or not owned by you' });
        }

        res.json({ success: true, recipe });
    } catch (error) {
        console.error('Firebase get user recipe error:', error);
        sendFirebaseError(res, error, 'Server error fetching user recipe');
    }
});

app.put('/api/user/recipes/:id', isAuthenticated, async (req, res) => {
    try {
        const recipe = await firebaseStore.updateUserRecipe(
            req.session.userId,
            req.params.id,
            sanitizeOwnedRecipePayload(req.body)
        );
        if (!recipe) {
            return res.status(404).json({ success: false, error: 'Recipe not found or not owned by you' });
        }

        res.json({ success: true, recipe });
    } catch (error) {
        console.error('Firebase update user recipe error:', error);
        sendFirebaseError(res, error, 'Server error updating user recipe');
    }
});

app.patch('/api/user/recipes/:id/publish', isAuthenticated, async (req, res) => {
    try {
        const recipe = await firebaseStore.setUserRecipePublished(
            req.session.userId,
            req.params.id,
            req.body.published === true || req.body.published === 'true'
        );
        if (!recipe) {
            return res.status(404).json({ success: false, error: 'Recipe not found or not owned by you' });
        }

        res.json({ success: true, recipe });
    } catch (error) {
        console.error('Firebase publish user recipe error:', error);
        sendFirebaseError(res, error, 'Server error updating publish state');
    }
});

app.delete('/api/user/recipes/:id', isAuthenticated, async (req, res) => {
    try {
        const deleted = await firebaseStore.deleteUserRecipe(req.session.userId, req.params.id);
        if (!deleted) {
            return res.status(404).json({ success: false, error: 'Recipe not found or not owned by you' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Firebase delete user recipe error:', error);
        sendFirebaseError(res, error, 'Server error deleting user recipe');
    }
});

app.post('/api/history/view-recipe', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.json({ success: true, anonymous: true });
        }

        await firebaseStore.recordRecipeView(
            req.session.userId,
            req.body.recipeId,
            normalizeRecipeCollectionName(req.body.collection)
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Firebase record recipe view error:', error);
        sendFirebaseError(res, error, 'Server error recording recipe view');
    }
});

app.post('/api/history/search', isAuthenticated, async (req, res) => {
    try {
        await firebaseStore.recordSearchTerm(req.session.userId, req.body.term);
        res.json({ success: true });
    } catch (error) {
        console.error('Firebase record search error:', error);
        sendFirebaseError(res, error, 'Server error recording search history');
    }
});

app.get('/api/history/viewed-recipes', isAuthenticated, async (req, res) => {
    try {
        const history = await firebaseStore.getUserHistory(req.session.userId);
        const viewedRecipes = await hydrateRecipeRefs(history.viewedRecipes || [], req.session.userId);
        res.json({ success: true, viewedRecipes });
    } catch (error) {
        console.error('Firebase viewed recipes error:', error);
        sendFirebaseError(res, error, 'Server error fetching viewed recipes');
    }
});

app.delete('/api/user/viewing-history/:recipeId', isAuthenticated, async (req, res) => {
    try {
        await firebaseStore.deleteViewedRecipe(
            req.session.userId,
            req.params.recipeId,
            normalizeRecipeCollectionName(req.body.collection)
        );
        res.json({ success: true, message: 'Recipe removed from viewing history' });
    } catch (error) {
        console.error('Firebase delete viewed recipe error:', error);
        sendFirebaseError(res, error, 'Server error deleting viewed recipe');
    }
});

app.delete('/api/user/viewing-history', isAuthenticated, async (req, res) => {
    try {
        await firebaseStore.clearViewingHistory(req.session.userId);
        res.json({ success: true, message: 'Viewing history cleared' });
    } catch (error) {
        console.error('Firebase clear viewing history error:', error);
        sendFirebaseError(res, error, 'Server error clearing viewed recipes');
    }
});

app.get('/api/history/search', isAuthenticated, async (req, res) => {
    try {
        const history = await firebaseStore.getUserHistory(req.session.userId);
        res.json({ success: true, searchHistory: history.searchHistory || [] });
    } catch (error) {
        console.error('Firebase search history error:', error);
        sendFirebaseError(res, error, 'Server error fetching search history');
    }
});

app.post('/api/recipes/save', isAuthenticated, async (req, res) => {
    try {
        await firebaseStore.saveRecipe(
            req.session.userId,
            req.body.recipeId,
            normalizeRecipeCollectionName(req.body.collection)
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Firebase save recipe error:', error);
        sendFirebaseError(res, error, 'Server error saving recipe');
    }
});

app.delete('/api/recipes/unsave', isAuthenticated, async (req, res) => {
    try {
        await firebaseStore.unsaveRecipe(
            req.session.userId,
            req.body.recipeId,
            normalizeRecipeCollectionName(req.body.collection)
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Firebase unsave recipe error:', error);
        sendFirebaseError(res, error, 'Server error removing saved recipe');
    }
});

app.get('/api/recipes/saved', isAuthenticated, async (req, res) => {
    try {
        const refs = await firebaseStore.getSavedRecipeRefs(req.session.userId);
        const recipes = await hydrateRecipeRefs(refs, req.session.userId);
        res.json({ success: true, recipes });
    } catch (error) {
        console.error('Firebase saved recipes error:', error);
        sendFirebaseError(res, error, 'Server error fetching saved recipes');
    }
});

app.post('/api/meal-plan/save', isAuthenticated, async (req, res) => {
    try {
        if (!req.body.date || !req.body.meals) {
            return res.status(400).json({ success: false, error: 'Date and meals are required' });
        }

        await firebaseStore.saveMealPlan(req.session.userId, req.body.date, req.body.meals);
        res.json({ success: true, message: 'Meal plan saved successfully' });
    } catch (error) {
        console.error('Firebase save meal plan error:', error);
        sendFirebaseError(res, error, 'Server error saving meal plan');
    }
});

app.get('/api/meal-plan', isAuthenticated, async (req, res) => {
    try {
        const { date } = req.query;
        if (date) {
            const mealPlan = await firebaseStore.getMealPlan(req.session.userId, date);
            return res.json({
                success: true,
                mealPlan: mealPlan || {
                    date,
                    meals: { breakfast: [], lunch: [], dinner: [] }
                }
            });
        }

        const mealPlans = await firebaseStore.getMealPlans(req.session.userId);
        res.json({ success: true, mealPlans });
    } catch (error) {
        console.error('Firebase meal plan fetch error:', error);
        sendFirebaseError(res, error, 'Server error fetching meal plans');
    }
});

app.delete('/api/meal-plan', isAuthenticated, async (req, res) => {
    try {
        if (!req.body.date) {
            return res.status(400).json({ success: false, error: 'Date is required' });
        }

        await firebaseStore.deleteMealPlan(req.session.userId, req.body.date);
        res.json({ success: true, message: 'Meal plan deleted successfully' });
    } catch (error) {
        console.error('Firebase meal plan delete error:', error);
        sendFirebaseError(res, error, 'Server error deleting meal plan');
    }
});

app.post('/api/recipe/rate', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ success: false, error: 'You must be logged in to rate a recipe' });
        }

        const { recipeId, rating, collection } = req.body;
        const ratingNumber = Number(rating);
        if (!recipeId || !collection || !Number.isFinite(ratingNumber) || ratingNumber < 1 || ratingNumber > 5) {
            return res.status(400).json({ success: false, error: 'Missing required fields or invalid rating' });
        }

        const ratingResult = await firebaseStore.rateRecipe(
            req.session.userId,
            req.session.username,
            recipeId,
            normalizeRecipeCollectionName(collection),
            ratingNumber
        );

        res.json({
            success: true,
            data: {
                ratings: ratingResult.ratings,
                averageRating: ratingResult.averageRating,
                userRating: ratingNumber
            }
        });
    } catch (error) {
        console.error('Firebase recipe rating error:', error);
        sendFirebaseError(res, error, 'Server error while rating recipe');
    }
});

app.get('/api/recipe/:recipeId/ratings', async (req, res) => {
    try {
        const { recipeId } = req.params;
        const collection = normalizeRecipeCollectionName(req.query.collection);
        if (!recipeId || !collection) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const ratingResult = await firebaseStore.getRecipeRatings(recipeId, collection, req.session?.userId || null);
        res.json({
            success: true,
            data: {
                ratings: ratingResult.ratings,
                averageRating: ratingResult.averageRating,
                userRating: ratingResult.userRating
            }
        });
    } catch (error) {
        console.error('Firebase recipe ratings fetch error:', error);
        sendFirebaseError(res, error, 'Server error while getting ratings');
    }
});

app.post('/api/recipe/comment', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ success: false, error: 'You must be logged in to comment' });
        }

        const { recipeId, text, collection } = req.body;
        if (!recipeId || !text || !collection || !String(text).trim()) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const comment = await firebaseStore.addComment(
            req.session.userId,
            req.session.username,
            recipeId,
            normalizeRecipeCollectionName(collection),
            String(text).trim()
        );

        res.json({ success: true, comment });
    } catch (error) {
        console.error('Firebase recipe comment error:', error);
        sendFirebaseError(res, error, 'Server error while adding comment');
    }
});

app.get('/api/recipe/:recipeId/comments', async (req, res) => {
    try {
        const { recipeId } = req.params;
        const collection = normalizeRecipeCollectionName(req.query.collection);
        if (!recipeId || !collection) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const comments = await firebaseStore.getRecipeComments(recipeId, collection);
        res.json({ success: true, data: comments });
    } catch (error) {
        console.error('Firebase recipe comments fetch error:', error);
        sendFirebaseError(res, error, 'Server error while getting comments');
    }
});

app.post('/api/recipes/share', async (req, res) => {
    try {
        const { recipeId, collection, platform } = req.body;
        if (!recipeId || !collection || !platform) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        await firebaseStore.recordShareEvent(
            req.session.userId || 'anonymous',
            recipeId,
            normalizeRecipeCollectionName(collection),
            platform
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Firebase share event error:', error);
        res.json({ success: true });
    }
});

app.get('/api/recipes/:id/metrics', async (req, res) => {
    try {
        const { id } = req.params;
        const collection = normalizeRecipeCollectionName(req.query.collection);
        if (!id || !collection) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const metrics = await firebaseStore.getRecipeMetrics(id, collection);
        res.json({ success: true, metrics });
    } catch (error) {
        console.error('Firebase metrics fetch error:', error);
        sendFirebaseError(res, error, 'Server error while getting metrics');
    }
});

app.get('/api/user/recipes', isAuthenticated, async (req, res) => {
    try {
        const recipes = await Recipe.find({ $or: buildOwnerFilters(req.session.userId) })
            .sort({ created_at: -1 })
            .lean();

        res.json({
            success: true,
            recipes: recipes.map((recipe) => ({
                ...recipe,
                id: recipe._id,
                source_collection: 'recipe'
            }))
        });
    } catch (error) {
        console.error('Get user recipes error:', error);
        res.status(500).json({ success: false, error: 'Server error fetching user recipes' });
    }
});

app.get('/api/user/recipes/analytics', isAuthenticated, async (req, res) => {
    try {
        const ownerQuery = { $or: buildOwnerFilters(req.session.userId) };
        const recipes = await Recipe.find(ownerQuery).sort({ created_at: -1 }).lean();
        const recipeIds = recipes.map(recipe => String(recipe._id));

        if (!recipeIds.length) {
            return res.json({
                success: true,
                summary: {
                    totalRecipes: 0,
                    publishedRecipes: 0,
                    draftRecipes: 0,
                    totalViews: 0,
                    totalShares: 0,
                    totalComments: 0,
                    averageRating: 0
                },
                recipes: []
            });
        }

        const [commentCounts, ratingStats, shareCounts, viewCounts] = await Promise.all([
            Comment.aggregate([
                { $match: { collection: 'recipe', recipeId: { $in: recipeIds } } },
                { $group: { _id: '$recipeId', count: { $sum: 1 } } }
            ]),
            recipifyConnection.collection('user_history').aggregate([
                { $unwind: '$ratings' },
                { $match: { 'ratings.collection': 'recipe', 'ratings.recipeId': { $in: recipeIds } } },
                {
                    $group: {
                        _id: '$ratings.recipeId',
                        count: { $sum: 1 },
                        averageRating: { $avg: '$ratings.rating' }
                    }
                }
            ]).toArray(),
            recipifyHubConnection.collection('share_events').aggregate([
                { $match: { collection: 'recipe', recipeId: { $in: recipeIds } } },
                { $group: { _id: '$recipeId', count: { $sum: 1 } } }
            ]).toArray(),
            recipifyConnection.collection('user_history').aggregate([
                { $unwind: '$viewedRecipes' },
                { $match: { 'viewedRecipes.collection': 'recipe', 'viewedRecipes.recipeId': { $in: recipeIds } } },
                { $group: { _id: '$viewedRecipes.recipeId', count: { $sum: 1 } } }
            ]).toArray()
        ]);

        const commentsMap = new Map(commentCounts.map(entry => [String(entry._id), entry.count]));
        const ratingsMap = new Map(ratingStats.map(entry => [String(entry._id), entry]));
        const sharesMap = new Map(shareCounts.map(entry => [String(entry._id), entry.count]));
        const viewsMap = new Map(viewCounts.map(entry => [String(entry._id), entry.count]));

        const analytics = recipes.map(recipe => {
            const recipeId = String(recipe._id);
            const ratingEntry = ratingsMap.get(recipeId);
            return {
                recipeId,
                title: recipe.name || recipe.recipe_name || 'Untitled Recipe',
                published: recipe.published !== false,
                createdAt: recipe.created_at,
                updatedAt: recipe.updated_at,
                views: viewsMap.get(recipeId) || 0,
                shares: sharesMap.get(recipeId) || 0,
                comments: commentsMap.get(recipeId) || 0,
                ratingsCount: ratingEntry?.count || 0,
                averageRating: ratingEntry?.averageRating ? Number(ratingEntry.averageRating.toFixed(1)) : 0
            };
        });

        const summary = analytics.reduce((acc, recipe) => {
            acc.totalRecipes += 1;
            acc.publishedRecipes += recipe.published ? 1 : 0;
            acc.draftRecipes += recipe.published ? 0 : 1;
            acc.totalViews += recipe.views;
            acc.totalShares += recipe.shares;
            acc.totalComments += recipe.comments;
            acc.ratingSum += recipe.averageRating * recipe.ratingsCount;
            acc.ratingCount += recipe.ratingsCount;
            return acc;
        }, {
            totalRecipes: 0,
            publishedRecipes: 0,
            draftRecipes: 0,
            totalViews: 0,
            totalShares: 0,
            totalComments: 0,
            ratingSum: 0,
            ratingCount: 0
        });

        res.json({
            success: true,
            summary: {
                totalRecipes: summary.totalRecipes,
                publishedRecipes: summary.publishedRecipes,
                draftRecipes: summary.draftRecipes,
                totalViews: summary.totalViews,
                totalShares: summary.totalShares,
                totalComments: summary.totalComments,
                averageRating: summary.ratingCount ? Number((summary.ratingSum / summary.ratingCount).toFixed(1)) : 0
            },
            recipes: analytics
        });
    } catch (error) {
        console.error('Get user recipe analytics error:', error);
        res.status(500).json({ success: false, error: 'Server error fetching recipe analytics' });
    }
});

app.get('/api/user/recipes/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, error: 'Invalid recipe id' });
        }

        const recipe = await Recipe.findOne({
            _id: new ObjectId(id),
            createdByUserId: req.session.userId
        }).lean();

        if (!recipe) {
            return res.status(404).json({ success: false, error: 'Recipe not found or not owned by you' });
        }

        res.json({
            success: true,
            recipe: {
                ...recipe,
                id: recipe._id,
                source_collection: 'recipe'
            }
        });
    } catch (error) {
        console.error('Get user recipe error:', error);
        res.status(500).json({ success: false, error: 'Server error fetching user recipe' });
    }
});

app.put('/api/user/recipes/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, error: 'Invalid recipe id' });
        }

        const updatePayload = {
            ...sanitizeOwnedRecipePayload(req.body),
            updated_at: new Date()
        };

        const updatedRecipe = await Recipe.findOneAndUpdate(
            {
                _id: new ObjectId(id),
                createdByUserId: req.session.userId
            },
            updatePayload,
            { new: true }
        ).lean();

        if (!updatedRecipe) {
            return res.status(404).json({ success: false, error: 'Recipe not found or not owned by you' });
        }

        res.json({
            success: true,
            recipe: {
                ...updatedRecipe,
                id: updatedRecipe._id,
                source_collection: 'recipe'
            }
        });
    } catch (error) {
        console.error('Update user recipe error:', error);
        res.status(500).json({ success: false, error: 'Server error updating user recipe' });
    }
});

app.patch('/api/user/recipes/:id/publish', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const publish = req.body.published === true || req.body.published === 'true';

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, error: 'Invalid recipe id' });
        }

        const updatedRecipe = await Recipe.findOneAndUpdate(
            {
                _id: new ObjectId(id),
                createdByUserId: req.session.userId
            },
            {
                published: publish,
                publishedAt: publish ? new Date() : null,
                updated_at: new Date()
            },
            { new: true }
        ).lean();

        if (!updatedRecipe) {
            return res.status(404).json({ success: false, error: 'Recipe not found or not owned by you' });
        }

        res.json({
            success: true,
            recipe: {
                ...updatedRecipe,
                id: updatedRecipe._id,
                source_collection: 'recipe'
            }
        });
    } catch (error) {
        console.error('Publish user recipe error:', error);
        res.status(500).json({ success: false, error: 'Server error updating publish state' });
    }
});

app.delete('/api/user/recipes/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, error: 'Invalid recipe id' });
        }

        const deletedRecipe = await Recipe.findOneAndDelete({
            _id: new ObjectId(id),
            createdByUserId: req.session.userId
        });

        if (!deletedRecipe) {
            return res.status(404).json({ success: false, error: 'Recipe not found or not owned by you' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Delete user recipe error:', error);
        res.status(500).json({ success: false, error: 'Server error deleting user recipe' });
    }
});

// User profile picture update only
app.post('/api/profile/update-picture', isAuthenticated, async (req, res) => {
    try {
        const { profileImageUrl } = req.body;
        
        // Update user profile picture
        await User.findByIdAndUpdate(req.session.userId, { profileImageUrl });
        
        // Update profile picture in profiles collection
        await Profile.findOneAndUpdate(
            { username: req.session.username }, 
            { profileImageUrl }
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Update profile picture error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// User history API
app.post('/api/history/view-recipe', async (req, res) => {
    try {
        const { recipeId, collection } = req.body;
        
        // Check if user is authenticated
        if (!req.session.userId) {
            // Allow anonymous recipe views but don't record them
            return res.json({ success: true, anonymous: true });
        }
        
        // Find or create user history
        let userHistory = await UserHistory.findOne({ userId: req.session.userId });
        
        if (!userHistory) {
            userHistory = new UserHistory({
                userId: req.session.userId,
                viewedRecipes: [],
                searchHistory: [],
                ratings: []
            });
        }
        
        // Add to viewed recipes
        userHistory.viewedRecipes.push({
            recipeId,
            collection,
            timestamp: new Date()
        });
        
        // Keep only the last 100 viewed recipes
        if (userHistory.viewedRecipes.length > 100) {
            userHistory.viewedRecipes = userHistory.viewedRecipes.slice(-100);
        }
        
        await userHistory.save();
        
        res.json({ success: true });
    } catch (error) {
        console.error('Record recipe view error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

app.post('/api/history/search', isAuthenticated, async (req, res) => {
    try {
        const { term } = req.body;
        
        // Find or create user history
        let userHistory = await UserHistory.findOne({ userId: req.session.userId });
        
        if (!userHistory) {
            userHistory = new UserHistory({
                userId: req.session.userId,
                viewedRecipes: [],
                searchHistory: [],
                ratings: []
            });
        }
        
        // Add to search history
        userHistory.searchHistory.push({
            term,
            timestamp: new Date()
        });
        
        // Keep only the last 50 search terms
        if (userHistory.searchHistory.length > 50) {
            userHistory.searchHistory = userHistory.searchHistory.slice(-50);
        }
        
        await userHistory.save();
        
        res.json({ success: true });
    } catch (error) {
        console.error('Record search history error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

app.get('/api/history/viewed-recipes', isAuthenticated, async (req, res) => {
    try {
        console.log('Fetching viewed recipes for user:', req.session.userId);
        
        // Call our new function that fetches full recipe data
        console.log('Calling getViewedRecipesWithData function...');
        const result = await getViewedRecipesWithData(req.session.userId);
        
        console.log('getViewedRecipesWithData result:', {
            success: result.success,
            error: result.error,
            viewedRecipesCount: result.viewedRecipes?.length || 0
        });
        
        if (result.success) {
            console.log(`Returning ${result.viewedRecipes?.length || 0} viewed recipes`);
            
            if (result.viewedRecipes && result.viewedRecipes.length > 0) {
                // Log a sample of the first recipe data for debugging
                const sampleRecipe = result.viewedRecipes[0];
                console.log('Sample viewed recipe data:', {
                    recipeId: sampleRecipe.recipe.id,
                    name: sampleRecipe.recipe.name,
                    collection: sampleRecipe.collection,
                    viewedAt: sampleRecipe.viewedAt
                });
            } else {
                console.log('No viewed recipes found for this user');
            }
        } else {
            console.log('Error fetching viewed recipes:', result.error);
        }
        
        res.json(result);
    } catch (error) {
        console.error('Get viewed recipes error:', error);
        res.status(500).json({ success: false, error: 'Server error', viewedRecipes: [] });
    }
});

// Delete a recipe from viewing history
app.delete('/api/user/viewing-history/:recipeId', isAuthenticated, async (req, res) => {
    try {
        const { recipeId } = req.params;
        const { collection } = req.body;
        
        console.log(`Deleting recipe ${recipeId} from collection ${collection} from viewing history`);
        
        // Find user history
        const userHistory = await UserHistory.findOne({ userId: req.session.userId });
        
        if (!userHistory) {
            return res.json({ success: true, message: 'No history found' });
        }
        
        // Remove the specific recipe from the viewing history
        userHistory.viewedRecipes = userHistory.viewedRecipes.filter(
            recipe => !(recipe.recipeId === recipeId && recipe.collection === collection)
        );
        
        await userHistory.save();
        
        res.json({ success: true, message: 'Recipe removed from viewing history' });
    } catch (error) {
        console.error('Error deleting recipe from viewing history:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Clear all viewing history
app.delete('/api/user/viewing-history', isAuthenticated, async (req, res) => {
    try {
        console.log(`Clearing all viewing history for user ${req.session.userId}`);
        
        // Find user history
        const userHistory = await UserHistory.findOne({ userId: req.session.userId });
        
        if (!userHistory) {
            return res.json({ success: true, message: 'No history found' });
        }
        
        // Clear the viewing history
        userHistory.viewedRecipes = [];
        
        await userHistory.save();
        
        res.json({ success: true, message: 'Viewing history cleared' });
    } catch (error) {
        console.error('Error clearing viewing history:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

app.get('/api/history/search', isAuthenticated, async (req, res) => {
    try {
        const userHistory = await UserHistory.findOne({ userId: req.session.userId });
        
        if (!userHistory) {
            return res.json({ success: true, searchHistory: [] });
        }
        
        res.json({ success: true, searchHistory: userHistory.searchHistory });
    } catch (error) {
        console.error('Get search history error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Saved recipes API
app.post('/api/recipes/save', isAuthenticated, async (req, res) => {
    try {
        const { recipeId, collection } = req.body;
        
        // Find or create saved recipes
        let savedRecipes = await SavedRecipes.findOne({ userId: req.session.userId });
        
        if (!savedRecipes) {
            savedRecipes = new SavedRecipes({
                userId: req.session.userId,
                recipes: []
            });
        }
        
        // Check if already saved
        const existingIndex = savedRecipes.recipes.findIndex(
            r => r.recipeId === recipeId && r.collection === collection
        );
        
        if (existingIndex === -1) {
            // Add to saved recipes
            savedRecipes.recipes.push({
                recipeId,
                collection,
                savedAt: new Date()
            });
        }
        
        await savedRecipes.save();
        
        res.json({ success: true });
    } catch (error) {
        console.error('Save recipe error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

app.delete('/api/recipes/unsave', isAuthenticated, async (req, res) => {
    try {
        const { recipeId, collection } = req.body;
        
        // Find saved recipes
        const savedRecipes = await SavedRecipes.findOne({ userId: req.session.userId });
        
        if (!savedRecipes) {
            return res.json({ success: true });
        }
        
        // Remove from saved recipes
        savedRecipes.recipes = savedRecipes.recipes.filter(
            r => !(r.recipeId === recipeId && r.collection === collection)
        );
        
        await savedRecipes.save();
        
        res.json({ success: true });
    } catch (error) {
        console.error('Unsave recipe error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

app.get('/api/recipes/saved', isAuthenticated, async (req, res) => {
    try {
        console.log('Fetching saved recipes for user:', req.session.userId);
        
        // Call our new function that fetches full recipe data
        console.log('Calling getSavedRecipesWithData function...');
        const result = await getSavedRecipesWithData(req.session.userId);
        
        console.log('getSavedRecipesWithData result:', {
            success: result.success,
            error: result.error,
            recipesCount: result.recipes?.length || 0
        });
        
        if (result.success) {
            console.log(`Returning ${result.recipes?.length || 0} saved recipes`);
            
            if (result.recipes && result.recipes.length > 0) {
                // Log a sample of the first recipe data for debugging
                const sampleRecipe = result.recipes[0];
                console.log('Sample recipe data:', {
                    recipeId: sampleRecipe.recipe.id,
                    name: sampleRecipe.recipe.name,
                    collection: sampleRecipe.collection,
                    savedAt: sampleRecipe.savedAt
                });
            } else {
                console.log('No saved recipes found for this user');
            }
        } else {
            console.log('Error fetching saved recipes:', result.error);
        }
        
        res.json(result);
    } catch (error) {
        console.error('Get saved recipes error:', error);
        res.status(500).json({ success: false, error: 'Server error', recipes: [] });
    }
});

// Meal planner API
app.post('/api/meal-plan/save', isAuthenticated, async (req, res) => {
    try {
        const { date, meals } = req.body;
        
        console.log(`Saving meal plan for user ${req.session.userId} on date ${date}`);
        
        if (!date || !meals) {
            console.error('Missing required fields:', { date: !!date, meals: !!meals });
            return res.status(400).json({ 
                success: false, 
                error: 'Date and meals are required' 
            });
        }
        
        // Find or create meal plan
        let mealPlan = await MealPlan.findOne({ 
            userId: req.session.userId,
            date
        });
        
        if (!mealPlan) {
            console.log(`Creating new meal plan for date ${date}`);
            mealPlan = new MealPlan({
                userId: req.session.userId,
                date,
                meals: {
                    breakfast: [],
                    lunch: [],
                    dinner: []
                }
            });
        } else {
            console.log(`Updating existing meal plan for date ${date}`);
        }
        
        // Update meals
        if (meals.breakfast) mealPlan.meals.breakfast = meals.breakfast;
        if (meals.lunch) mealPlan.meals.lunch = meals.lunch;
        if (meals.dinner) mealPlan.meals.dinner = meals.dinner;
        
        await mealPlan.save();
        console.log(`Successfully saved meal plan for date ${date}`);
        
        res.json({ 
            success: true,
            message: 'Meal plan saved successfully'
        });
    } catch (error) {
        console.error('Save meal plan error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Server error saving meal plan',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

app.get('/api/meal-plan', isAuthenticated, async (req, res) => {
    try {
        const { date } = req.query;
        console.log(`Fetching meal plan(s) for user: ${req.session.userId}, date: ${date || 'all'}`);
        
        if (date) {
            // Get specific date
            const mealPlan = await MealPlan.findOne({ 
                userId: req.session.userId,
                date
            });
            
            if (!mealPlan) {
                console.log(`No meal plan found for date ${date}, returning empty template`);
                return res.json({ 
                    success: true, 
                    mealPlan: {
                        date,
                        meals: {
                            breakfast: [],
                            lunch: [],
                            dinner: []
                        }
                    } 
                });
            }
            
            console.log(`Found meal plan for date ${date}`);
            res.json({ success: true, mealPlan });
        } else {
            // Get all dates using our new function with enhanced data
            console.log('Fetching all meal plans for user:', req.session.userId);
            const result = await getMealPlansWithData(req.session.userId);
            
            if (result.success) {
                console.log(`Found ${result.mealPlans?.length || 0} meal plans`);
                
                // Log a sample of data if available
                if (result.mealPlans && result.mealPlans.length > 0) {
                    const sample = result.mealPlans[0];
                    console.log('Sample meal plan:', {
                        date: sample.date,
                        mealTypes: Object.keys(sample.meals || {}),
                        breakfastItems: sample.meals?.breakfast?.length || 0,
                        lunchItems: sample.meals?.lunch?.length || 0,
                        dinnerItems: sample.meals?.dinner?.length || 0
                    });
                }
            } else {
                console.error('Error fetching meal plans:', result.error);
            }
            
            res.json(result);
        }
    } catch (error) {
        console.error('Get meal plan error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Server error fetching meal plans',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
            mealPlans: [] 
        });
    }
});

app.delete('/api/meal-plan', isAuthenticated, async (req, res) => {
    try {
        const { date } = req.body;
        
        if (!date) {
            console.error('Missing required date field');
            return res.status(400).json({ 
                success: false, 
                error: 'Date is required' 
            });
        }
        
        console.log(`Deleting meal plan for user ${req.session.userId} on date ${date}`);
        
        const result = await MealPlan.findOneAndDelete({ 
            userId: req.session.userId,
            date
        });
        
        if (result) {
            console.log(`Successfully deleted meal plan for date ${date}`);
            res.json({ 
                success: true,
                message: 'Meal plan deleted successfully' 
            });
        } else {
            console.log(`No meal plan found for date ${date}`);
            res.json({ 
                success: true,
                message: 'No meal plan found to delete'
            });
        }
    } catch (error) {
        console.error('Delete meal plan error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Server error deleting meal plan',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get user profile data with stats
app.get('/api/user/profile', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    // Get user basic info
    const user = await User.findById(req.session.userId).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Get counts from various collections
    const userHistory = await UserHistory.findOne({ userId: req.session.userId });
    const savedRecipes = await SavedRecipes.findOne({ userId: req.session.userId });
    const mealPlans = await MealPlan.find({ userId: req.session.userId });
    const recipesCount = await Recipe.countDocuments({ createdByUserId: req.session.userId });
    const commentOwnerFilters = [{ userId: req.session.userId }];

    if (req.session.userId?.toString) {
      commentOwnerFilters.push({ userId: req.session.userId.toString() });
    }

    if (typeof req.session.userId === 'string' && ObjectId.isValid(req.session.userId)) {
      commentOwnerFilters.push({ userId: new ObjectId(req.session.userId) });
    }

    const commentsCount = await recipifyHubConnection.collection('comments').countDocuments({
      $or: commentOwnerFilters
    });

    // Calculate stats
    const stats = {
      recipesCount,
      savesCount: savedRecipes ? savedRecipes.recipes.length : 0,
      commentsCount,
      viewsCount: userHistory ? userHistory.viewedRecipes.length : 0,
      ratingsCount: userHistory ? userHistory.ratings.length : 0,
      mealPlansCount: mealPlans.length
    };

    res.json({
      success: true,
      user: {
        username: user.username,
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        bio: user.bio || '',
        profileImageUrl: user.profileImageUrl || 'https://cdn-icons-png.flaticon.com/512/1077/1077114.png',
        preferences: user.preferences || {},
        stats
      }
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update user profile settings
app.post('/api/user/profile', isAuthenticated, async (req, res) => {
  try {
    console.log('Updating profile for user:', req.session.userId);
    console.log('Update data:', req.body);
    
    // Get allowed fields to update
    const { firstName, lastName, bio } = req.body;
    
    // Find and update the user
    const user = await User.findById(req.session.userId);
    if (!user) {
      console.log('User not found');
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Update fields if provided
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (bio !== undefined) user.bio = bio;
    
    // Save the updated user
    await user.save();
    console.log('User profile updated successfully');
    
    res.json({ 
      success: true, 
      message: 'Profile updated successfully',
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        bio: user.bio
      }
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update user preferences
app.post('/api/user/preferences', isAuthenticated, async (req, res) => {
  try {
    console.log('Updating preferences for user:', req.session.userId);
    console.log('Preferences data:', req.body);
    
    // Get dietary preferences
    const { diet } = req.body;
    
    // Find and update the user
    const user = await User.findById(req.session.userId);
    if (!user) {
      console.log('User not found');
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Initialize preferences object if it doesn't exist
    if (!user.preferences) user.preferences = {};
    
    // Update dietary preferences
    if (diet) {
      user.preferences.diet = Array.isArray(diet) ? diet : [diet];
    }
    
    // Save the updated user
    await user.save();
    console.log('User preferences updated successfully');
    
    res.json({ 
      success: true, 
      message: 'Preferences updated successfully',
      preferences: user.preferences
    });
  } catch (error) {
    console.error('Error updating user preferences:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add an API endpoint for user ratings
app.get('/api/user/ratings', isAuthenticated, async (req, res) => {
    try {
        console.log('Fetching ratings for user:', req.session.userId);
        const result = await getUserRatingsWithData(req.session.userId);
        console.log(`Returning ${result.ratings?.length || 0} ratings`);
        res.json(result);
    } catch (error) {
        console.error('Get user ratings error:', error);
        res.status(500).json({ success: false, error: 'Server error', ratings: [] });
    }
});

// Rate a recipe
app.post('/api/recipe/rate', async (req, res) => {
    try {
        // Check if user is authenticated
        if (!req.session.userId) {
            return res.status(401).json({ success: false, error: 'You must be logged in to rate a recipe' });
        }
        
        const { recipeId, rating, collection } = req.body;
        
        // Validate inputs
        if (!recipeId || !rating || !collection) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        // Validate rating value (1-5)
        if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
            return res.status(400).json({ success: false, error: 'Rating must be a whole number between 1 and 5' });
        }
        
        // Check if user has already rated this recipe
        const existingRating = await db.collection('ratings').findOne({
            recipeId,
            collection,
            userId: req.session.userId
        });
        
        if (existingRating) {
            // Update existing rating
            await db.collection('ratings').updateOne(
                { _id: existingRating._id },
                { $set: { rating, updatedAt: new Date() } }
            );
        } else {
            // Add new rating
            await db.collection('ratings').insertOne({
                recipeId,
                collection,
                userId: req.session.userId,
                username: req.session.username,
                rating,
                createdAt: new Date()
            });
        }
        
        // Get updated ratings for this recipe
        const ratings = await db.collection('ratings')
            .find({ recipeId, collection })
            .toArray();
        
        // Calculate average rating
        const total = ratings.reduce((sum, r) => sum + r.rating, 0);
        const averageRating = ratings.length > 0 ? total / ratings.length : 0;
        
        res.json({
            success: true,
            data: {
                ratings,
                averageRating,
                userRating: rating
            }
        });
    } catch (error) {
        console.error('Error rating recipe:', error);
        res.status(500).json({ success: false, error: 'Server error while rating recipe' });
    }
});

// Get ratings for a recipe
app.get('/api/recipe/:recipeId/ratings', async (req, res) => {
    try {
        const { recipeId } = req.params;
        const { collection } = req.query;
        
        // Validate inputs 
        if (!recipeId || !collection) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        // Get ratings for this recipe
        const ratings = await db.collection('ratings')
            .find({ recipeId, collection })
            .toArray();
        
        // Calculate average rating
        const total = ratings.reduce((sum, r) => sum + r.rating, 0);
        const averageRating = ratings.length > 0 ? total / ratings.length : 0;
        
        // If user is logged in, get their rating
        let userRating = null;
        if (req.session.userId) {
            const userRatingDoc = await db.collection('ratings').findOne({
                recipeId,
                collection,
                userId: req.session.userId
            });
            
            if (userRatingDoc) {
                userRating = userRatingDoc.rating;
            }
        }
        
        res.json({
            success: true,
            data: {
                ratings,
                averageRating,
                userRating
            }
        });
    } catch (error) {
        console.error('Error getting ratings:', error);
        res.status(500).json({ success: false, error: 'Server error while getting ratings' });
    }
});

// Add a comment to a recipe
app.post('/api/recipe/comment', async (req, res) => {
    try {
        // Check if user is authenticated
        if (!req.session.userId) {
            return res.status(401).json({ success: false, error: 'You must be logged in to comment' });
        }
        
        const { recipeId, text, collection } = req.body;
        
        // Validate inputs
        if (!recipeId || !text || !collection) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        if (text.trim().length === 0) {
            return res.status(400).json({ success: false, error: 'Comment cannot be empty' });
        }
        
        // Add comment
        await recipifyHubConnection.collection('comments').insertOne({
            recipeId,
            collection,
            userId: req.session.userId,
            userName: req.session.username,
            text,
            createdAt: new Date()
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ success: false, error: 'Server error while adding comment' });
    }
});

// Get comments for a recipe
app.get('/api/recipe/:recipeId/comments', async (req, res) => {
    try {
        const { recipeId } = req.params;
        const { collection } = req.query;
        
        // Validate inputs
        if (!recipeId || !collection) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        // Get comments for this recipe - use recipifyHubConnection
        const comments = await recipifyHubConnection.collection('comments')
            .find({ recipeId, collection })
            .sort({ createdAt: -1 }) // Newest first
            .toArray();
        
        res.json({ success: true, data: comments });
    } catch (error) {
        console.error('Error getting comments:', error);
        res.status(500).json({ success: false, error: 'Server error while getting comments' });
    }
});

// Update a user rating
app.post('/api/recipes/:id/rate', async (req, res) => {
    try {
        // Need to be logged in to rate
        if (!req.session.userId) {
            return res.status(401).json({ success: false, error: 'You must be logged in to rate recipes' });
        }
        
        const recipeId = req.params.id;
        const { rating, collection } = req.body;
        
        // Validate inputs
        if (!recipeId || !rating || !collection) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        // Validate rating is between 1 and 5
        const ratingNumber = parseInt(rating);
        if (isNaN(ratingNumber) || ratingNumber < 1 || ratingNumber > 5) {
            return res.status(400).json({ success: false, error: 'Rating must be between 1 and 5' });
        }
        
        console.log(`User ${req.session.userId} rating recipe ${recipeId} from ${collection} with ${rating} stars`);
        
        // Convert IDs to proper format for MongoDB
        let userId = req.session.userId;
        if (typeof userId === 'string' && ObjectId.isValid(userId)) {
            userId = new ObjectId(userId);
        }
        
        // Check if this user has already rated this recipe
        const existingRating = await recipifyHubConnection.collection('ratings').findOne({
            userId: userId.toString(),
            recipeId: recipeId,
            collection: collection
        });
        
        if (existingRating) {
            // Update existing rating
            await recipifyHubConnection.collection('ratings').updateOne(
                { _id: existingRating._id },
                { 
                    $set: { 
                        rating: ratingNumber,
                        updatedAt: new Date()
                    }
                }
            );
            console.log(`Updated existing rating (${existingRating._id})`);
        } else {
            // Create new rating
            await recipifyHubConnection.collection('ratings').insertOne({
                userId: userId.toString(),
                recipeId: recipeId,
                collection: collection,
                rating: ratingNumber,
                createdAt: new Date()
            });
            console.log('Created new rating');
        }
        
        // Get updated average rating and count
        const ratings = await recipifyHubConnection.collection('ratings')
            .find({ recipeId: recipeId, collection: collection })
            .toArray();
        
        const totalRatings = ratings.length;
        const averageRating = totalRatings > 0 
            ? ratings.reduce((acc, curr) => acc + curr.rating, 0) / totalRatings 
            : 0;
        
        res.json({
            success: true,
            data: {
                average: averageRating.toFixed(1),
                count: totalRatings
            }
        });
        
    } catch (error) {
        console.error('Error rating recipe:', error);
        res.status(500).json({ success: false, error: 'Server error while saving rating' });
    }
});

// Record recipe share event
app.post('/api/recipes/share', async (req, res) => {
    try {
        const { recipeId, collection, platform } = req.body;
        
        // Validate required fields
        if (!recipeId || !collection || !platform) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        // Current user ID if logged in, or 'anonymous' if not
        const userId = req.session.userId || 'anonymous';
        
        // Log the share event
        console.log(`Recipe shared: ${recipeId} from ${collection} on ${platform} by ${userId}`);
        
        // Record the share event in the database
        await recipifyHubConnection.collection('share_events').insertOne({
            recipeId,
            collection,
            platform,
            userId: userId.toString(),
            sharedAt: new Date()
        });
        
        // Update share count for this recipe
        await recipifyHubConnection.collection('recipe_metrics').updateOne(
            { 
                recipeId,
                collection
            },
            { 
                $inc: { shareCount: 1 },
                $set: { lastUpdated: new Date() }
            },
            { upsert: true }
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error recording share event:', error);
        // Don't fail the user experience for analytics
        res.json({ success: true });
    }
});

// Get recipe metrics
app.get('/api/recipes/:id/metrics', async (req, res) => {
    try {
        const { id } = req.params;
        const { collection } = req.query;
        
        // Validate inputs
        if (!id || !collection) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        // Get metrics for this recipe
        const metrics = await recipifyHubConnection.collection('recipe_metrics').findOne({
            recipeId: id,
            collection: collection
        }) || { shareCount: 0, viewCount: 0 };
        
        // Count shares from share_events collection as a backup
        if (!metrics.shareCount) {
            const shareCount = await recipifyHubConnection.collection('share_events').countDocuments({
                recipeId: id,
                collection: collection
            });
            
            metrics.shareCount = shareCount;
        }
        
        res.json({
            success: true,
            metrics: {
                shareCount: metrics.shareCount || 0,
                viewCount: metrics.viewCount || 0
            }
        });
    } catch (error) {
        console.error('Error getting recipe metrics:', error);
        res.status(500).json({ success: false, error: 'Server error while getting metrics' });
    }
});

app.get(['/api/health', '/healthz'], (req, res) => {
    const firebaseStatus = firebaseStore.firebaseStatus();
    res.json({
        success: true,
        status: 'ok',
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        mongoConnected: Boolean(mongoDb),
        firebaseConfigured: firebaseStatus.configured,
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    if (!IS_PRODUCTION) {
        console.log(`Visit http://localhost:${PORT} to view the application`);
    }
}); 
