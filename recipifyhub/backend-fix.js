/**
 * MongoDB Integration for RecipifyHub
 * 
 * This file contains functions to interact with MongoDB for user profiles,
 * saved recipes, and viewing history.
 */

const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const dns = require('dns');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const DNS_SERVERS = (process.env.DNS_SERVERS || '8.8.8.8,1.1.1.1')
    .split(',')
    .map(server => server.trim())
    .filter(Boolean);

if (DNS_SERVERS.length > 0) {
    try {
        dns.setServers(DNS_SERVERS);
    } catch (error) {
        console.warn('Failed to apply custom DNS servers:', error.message);
    }
}

// MongoDB Connection String
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const MONGODB_URI = (process.env.MONGODB_URI || (IS_PRODUCTION ? '' : 'mongodb://127.0.0.1:27017/')).trim();
const DB_NAME = 'recipify_hub';
const COLLECTION_ALIASES = {
    recipe_with_serving: 'recipes_with_servings'
};

function normalizeCollectionName(collection) {
    return COLLECTION_ALIASES[collection] || collection;
}

// Initialize MongoDB connection
let client;
let db;
let collections = {};

async function connectToMongoDB() {
    try {
        if (!MONGODB_URI) {
            throw new Error('MONGODB_URI is required for MongoDB recipe data access.');
        }

        console.log(`Attempting to connect to MongoDB Atlas database "${DB_NAME}"`);
        
        client = new MongoClient(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        await client.connect();
        console.log('Connected to MongoDB Atlas successfully');
        
        // Connect to the correct database - 'recipifyhub'
        console.log('Connecting to database:', DB_NAME);
        db = client.db(DB_NAME);
        
        // Log all available collections to verify they exist
        const collectionsList = await db.listCollections().toArray();
        console.log('Available collections in database:', collectionsList.map(c => c.name));
        
        // Initialize specific collections we need
        collections = {
            saved_recipes: db.collection('saved_recipes'),
            user_history: db.collection('user_history'),
            meal_plans: db.collection('meal_plans'),
            users: db.collection('users'),
            recipe: db.collection('recipe'),
            recipes: db.collection('recipes'),
            recipes_with_servings: db.collection('recipes_with_servings'),
            recipe_with_video: db.collection('recipe_with_video'),
            baking: db.collection('baking'),
            food_recipe: db.collection('food_recipe'),
            recipe_with_serving: db.collection('recipes_with_servings'),
            user_recipes: db.collection('user_recipes')
        };
        
        console.log('Initialized collections:', Object.keys(collections));
        
        // Verify each collection exists
        for (const [name, collection] of Object.entries(collections)) {
            try {
                const count = await collection.countDocuments({}, { limit: 1 });
                console.log(`Collection '${name}' verified with at least ${count} document(s)`);
            } catch (err) {
                console.error(`Failed to verify collection '${name}':`, err.message);
            }
        }
        
        return db;
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        throw error;
    }
}

// Get saved recipes with full recipe data
async function getSavedRecipesWithData(userId) {
    try {
        // Get the saved recipes document for the user from the saved_recipes collection
        console.log(`Looking for saved recipes for userId: ${userId}`);
        
        if (!collections.saved_recipes) {
            console.error('Collection saved_recipes is not initialized');
            return { success: false, error: 'Database not initialized', recipes: [] };
        }
        
        const savedRecipes = await collections.saved_recipes.findOne({ 
            userId: new ObjectId(userId) 
        });
        
        if (!savedRecipes || !savedRecipes.recipes || savedRecipes.recipes.length === 0) {
            console.log('No saved recipes found for this user');
            return { success: true, recipes: [] };
        }
        
        console.log(`Found ${savedRecipes.recipes.length} saved recipes:`, savedRecipes.recipes);
        
        // Process each saved recipe to fetch the full recipe data
        const recipesWithData = await Promise.all(
            savedRecipes.recipes.map(async (item) => {
                const { recipeId, collection, savedAt } = item;
                const collectionName = normalizeCollectionName(collection);
                console.log(`Processing saved recipe: ${recipeId} from collection: ${collectionName}`);
                
                try {
                    // Get the recipe from the appropriate collection
                    if (!collections[collectionName]) {
                        console.warn(`Collection ${collectionName} not found, falling back to db.collection`);
                    }
                    
                    const recipeCollection = collections[collectionName] || db.collection(collectionName);
                    let recipeIdToFind;
                    
                    // Handle different ID formats
                    try {
                        if (recipeId.match(/^[0-9a-fA-F]{24}$/)) {
                            recipeIdToFind = new ObjectId(recipeId);
                        } else {
                            recipeIdToFind = recipeId;
                        }
                    } catch (error) {
                        recipeIdToFind = recipeId;
                    }
                    
                    console.log(`Searching for recipe with ID ${recipeIdToFind} in collection ${collectionName}`);
                    
                    // Find the recipe using both _id and id fields to be safe
                    const recipe = await recipeCollection.findOne({ 
                        $or: [
                            { _id: recipeIdToFind },
                            { id: recipeId }
                        ]
                    });
                    
                    if (!recipe) {
                        console.log(`Recipe not found: ${recipeId}`);
                        return {
                            recipe: {
                                id: recipeId,
                                name: 'Recipe not found',
                                image: 'https://via.placeholder.com/300x200?text=Not+Found'
                            },
                            collection: collectionName,
                            savedAt
                        };
                    }
                    
                    console.log(`Found recipe: ${recipe.name || recipe.title || 'Unnamed'}`);
                    
                    // Add any needed conversions here
                    const processedRecipe = {
                        ...recipe,
                        id: recipe._id.toString(),
                        image: recipe.image || recipe.image_url || 'https://via.placeholder.com/300x200?text=No+Image',
                        name: recipe.name || recipe.title || 'Unnamed Recipe'
                    };
                    
                    return {
                        recipe: processedRecipe,
                        collection: collectionName,
                        savedAt
                    };
                } catch (error) {
                    console.error(`Error fetching recipe ${recipeId} from ${collectionName}:`, error);
                    return {
                        recipe: {
                            id: recipeId,
                            name: 'Error loading recipe',
                            image: 'https://via.placeholder.com/300x200?text=Error'
                        },
                        collection: collectionName,
                        savedAt
                    };
                }
            })
        );
        
        return { success: true, recipes: recipesWithData };
    } catch (error) {
        console.error('Error getting saved recipes with data:', error);
        return { success: false, error: error.message, recipes: [] };
    }
}

// Get viewed recipes with full recipe data
async function getViewedRecipesWithData(userId) {
    try {
        // Get the user history document from the user_history collection
        console.log(`Looking for viewed recipes for userId: ${userId}`);
        
        if (!collections.user_history) {
            console.error('Collection user_history is not initialized');
            return { success: false, error: 'Database not initialized', viewedRecipes: [] };
        }
        
        const userHistory = await collections.user_history.findOne({ 
            userId: new ObjectId(userId) 
        });
        
        if (!userHistory || !userHistory.viewedRecipes || userHistory.viewedRecipes.length === 0) {
            console.log('No viewed recipes found for this user');
            return { success: true, viewedRecipes: [] };
        }
        
        console.log(`Found ${userHistory.viewedRecipes.length} viewed recipes`);
        
        // Process each viewed recipe to fetch the full recipe data
        const viewedRecipesWithData = await Promise.all(
            userHistory.viewedRecipes.map(async (item) => {
                const { recipeId, collection, timestamp } = item;
                const collectionName = normalizeCollectionName(collection);
                console.log(`Processing viewed recipe: ${recipeId} from collection: ${collectionName}`);
                
                try {
                    // Get the recipe from the appropriate collection
                    if (!collections[collectionName]) {
                        console.warn(`Collection ${collectionName} not found, falling back to db.collection`);
                    }
                    
                    const recipeCollection = collections[collectionName] || db.collection(collectionName);
                    let recipeIdToFind;
                    
                    // Handle different ID formats
                    try {
                        if (recipeId.match(/^[0-9a-fA-F]{24}$/)) {
                            recipeIdToFind = new ObjectId(recipeId);
                        } else {
                            recipeIdToFind = recipeId;
                        }
                    } catch (error) {
                        recipeIdToFind = recipeId;
                    }
                    
                    console.log(`Searching for recipe with ID ${recipeIdToFind} in collection ${collectionName}`);
                    
                    // Find the recipe using both _id and id fields to be safe
                    const recipe = await recipeCollection.findOne({ 
                        $or: [
                            { _id: recipeIdToFind },
                            { id: recipeId }
                        ]
                    });
                    
                    if (!recipe) {
                        console.log(`Recipe not found: ${recipeId}`);
                        return {
                            recipe: {
                                id: recipeId,
                                name: 'Recipe not found',
                                image: 'https://via.placeholder.com/300x200?text=Not+Found'
                            },
                            collection: collectionName,
                            viewedAt: timestamp
                        };
                    }
                    
                    console.log(`Found recipe: ${recipe.name || recipe.title || 'Unnamed'}`);
                    
                    // Add any needed conversions here
                    const processedRecipe = {
                        ...recipe,
                        id: recipe._id.toString(),
                        image: recipe.image || recipe.image_url || 'https://via.placeholder.com/300x200?text=No+Image',
                        name: recipe.name || recipe.title || 'Unnamed Recipe'
                    };
                    
                    return {
                        recipe: processedRecipe,
                        collection: collectionName,
                        viewedAt: timestamp
                    };
                } catch (error) {
                    console.error(`Error fetching recipe ${recipeId} from ${collectionName}:`, error);
                    return {
                        recipe: {
                            id: recipeId,
                            name: 'Error loading recipe',
                            image: 'https://via.placeholder.com/300x200?text=Error'
                        },
                        collection: collectionName,
                        viewedAt: timestamp
                    };
                }
            })
        );
        
        // Sort by viewedAt in descending order (most recent first)
        viewedRecipesWithData.sort((a, b) => 
            new Date(b.viewedAt) - new Date(a.viewedAt)
        );
        
        return { success: true, viewedRecipes: viewedRecipesWithData };
    } catch (error) {
        console.error('Error getting viewed recipes with data:', error);
        return { success: false, error: error.message, viewedRecipes: [] };
    }
}

// Get meal plans for a user
async function getMealPlansWithData(userId) {
    try {
        // Get meal plans from the meal_plans collection
        console.log(`Looking for meal plans for userId: ${userId}`);
        
        if (!collections.meal_plans) {
            console.error('Collection meal_plans is not initialized');
            return { success: false, error: 'Database not initialized', mealPlans: [] };
        }
        
        const mealPlans = await collections.meal_plans.find({ 
            userId: new ObjectId(userId) 
        }).toArray();
        
        if (!mealPlans || mealPlans.length === 0) {
            console.log('No meal plans found for this user');
            return { success: true, mealPlans: [] };
        }
        
        console.log(`Found ${mealPlans.length} meal plans`);
        
        // Process meal plans to add any additional data if needed
        const processedMealPlans = mealPlans.map(plan => {
            return {
                ...plan,
                id: plan._id.toString(),
                userId: plan.userId.toString()
            };
        });
        
        // Sort meal plans by date (most recent first)
        processedMealPlans.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        return { success: true, mealPlans: processedMealPlans };
    } catch (error) {
        console.error('Error getting meal plans:', error);
        return { success: false, error: error.message, mealPlans: [] };
    }
}

// Get user ratings history
async function getUserRatingsWithData(userId) {
    try {
        // Get the user history document from the user_history collection
        console.log(`Looking for ratings for userId: ${userId}`);
        
        if (!collections.user_history) {
            console.error('Collection user_history is not initialized');
            return { success: false, error: 'Database not initialized', ratings: [] };
        }
        
        const userHistory = await collections.user_history.findOne({ 
            userId: new ObjectId(userId) 
        });
        
        if (!userHistory || !userHistory.ratings || userHistory.ratings.length === 0) {
            console.log('No ratings found for this user');
            return { success: true, ratings: [] };
        }
        
        console.log(`Found ${userHistory.ratings.length} ratings`);
        
        // Process each rating to fetch the full recipe data
        const ratingsWithData = await Promise.all(
            userHistory.ratings.map(async (rating) => {
                const { recipeId, collection, rating: ratingValue, createdAt, updatedAt } = rating;
                const collectionName = normalizeCollectionName(collection);
                console.log(`Processing rating for recipe: ${recipeId} from collection: ${collectionName}`);
                
                try {
                    // Get the recipe from the appropriate collection
                    if (!collections[collectionName]) {
                        console.warn(`Collection ${collectionName} not found, falling back to db.collection`);
                    }
                    
                    const recipeCollection = collections[collectionName] || db.collection(collectionName);
                    let recipeIdToFind;
                    
                    // Handle different ID formats
                    try {
                        if (recipeId.match(/^[0-9a-fA-F]{24}$/)) {
                            recipeIdToFind = new ObjectId(recipeId);
                        } else {
                            recipeIdToFind = recipeId;
                        }
                    } catch (error) {
                        recipeIdToFind = recipeId;
                    }
                    
                    // Find the recipe using both _id and id fields to be safe
                    const recipe = await recipeCollection.findOne({ 
                        $or: [
                            { _id: recipeIdToFind },
                            { id: recipeId }
                        ]
                    });
                    
                    if (!recipe) {
                        console.log(`Recipe not found: ${recipeId}`);
                        return {
                            recipe: {
                                id: recipeId,
                                name: 'Recipe not found',
                                image: 'https://via.placeholder.com/300x200?text=Not+Found'
                            },
                            collection: collectionName,
                            rating: ratingValue,
                            createdAt,
                            updatedAt
                        };
                    }
                    
                    // Add any needed conversions here
                    const processedRecipe = {
                        ...recipe,
                        id: recipe._id.toString(),
                        image: recipe.image || recipe.image_url || 'https://via.placeholder.com/300x200?text=No+Image',
                        name: recipe.name || recipe.title || 'Unnamed Recipe'
                    };
                    
                    return {
                        recipe: processedRecipe,
                        collection: collectionName,
                        rating: ratingValue,
                        createdAt,
                        updatedAt
                    };
                } catch (error) {
                    console.error(`Error fetching recipe ${recipeId} from ${collectionName}:`, error);
                    return {
                        recipe: {
                            id: recipeId,
                            name: 'Error loading recipe',
                            image: 'https://via.placeholder.com/300x200?text=Error'
                        },
                        collection: collectionName,
                        rating: ratingValue,
                        createdAt,
                        updatedAt
                    };
                }
            })
        );
        
        // Sort by createdAt in descending order (most recent first)
        ratingsWithData.sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
        );
        
        return { success: true, ratings: ratingsWithData };
    } catch (error) {
        console.error('Error getting user ratings:', error);
        return { success: false, error: error.message, ratings: [] };
    }
}

// Check authentication status
async function checkAuthStatus(req) {
    if (req.session && req.session.userId) {
        return {
            isAuthenticated: true,
            userId: req.session.userId
        };
    }
    return { isAuthenticated: false };
}

module.exports = {
    connectToMongoDB,
    getSavedRecipesWithData,
    getViewedRecipesWithData,
    getMealPlansWithData,
    getUserRatingsWithData,
    checkAuthStatus
}; 
