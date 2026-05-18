/**
 * RecipifyDB - Client-side database integration for RecipifyHub
 */
window.RecipifyDB = (function() {
    // Base API URL
    const API_BASE_URL = '/api';
    const USER_SESSION_KEY = 'user';
    const AUTH_CACHE_KEY = 'recipifyhub-auth-cache';
    const AUTH_CACHE_TTL_MS = 120000;
    let authCheckPromise = null;
    
    // Collection names
    const COLLECTIONS = {
        RECIPE_WITH_SERVING: 'recipes_with_servings',
        RECIPES_WITH_SERVINGS: 'recipes_with_servings',
        RECIPE_WITH_VIDEO: 'recipe_with_video',
        BAKING: 'baking',
        FOOD_RECIPE: 'food_recipe',
        RECIPE: 'recipe',
        RECIPES: 'recipes'
    };

    const RECIPE_COLLECTIONS = [
        COLLECTIONS.RECIPE,
        COLLECTIONS.RECIPES,
        COLLECTIONS.RECIPE_WITH_VIDEO,
        COLLECTIONS.RECIPES_WITH_SERVINGS,
        COLLECTIONS.FOOD_RECIPE,
        COLLECTIONS.BAKING
    ];

    function getStoredUser() {
        try {
            const user = JSON.parse(sessionStorage.getItem(USER_SESSION_KEY) || 'null');
            return user && typeof user === 'object' && (user.username || user.email) ? user : null;
        } catch (error) {
            console.error('Unable to read stored user session:', error);
            sessionStorage.removeItem(USER_SESSION_KEY);
            return null;
        }
    }

    function readAuthCache() {
        try {
            const cached = JSON.parse(sessionStorage.getItem(AUTH_CACHE_KEY) || 'null');
            return cached && typeof cached === 'object' ? cached : null;
        } catch (error) {
            console.error('Unable to read auth cache:', error);
            sessionStorage.removeItem(AUTH_CACHE_KEY);
            return null;
        }
    }

    function writeAuthCache(user, metadata = {}) {
        const safeUser = user && typeof user === 'object' && (user.username || user.email) ? user : null;
        const payload = {
            success: !!safeUser,
            isAuthenticated: !!safeUser,
            user: safeUser,
            userId: metadata.userId || safeUser?.id || safeUser?._id || null,
            updatedAt: Date.now()
        };

        try {
            sessionStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(payload));
            if (safeUser) {
                sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify(safeUser));
            } else {
                sessionStorage.removeItem(USER_SESSION_KEY);
            }
        } catch (error) {
            console.error('Unable to store auth cache:', error);
        }

        return payload;
    }

    function clearAuthCache() {
        sessionStorage.removeItem(AUTH_CACHE_KEY);
        sessionStorage.removeItem(USER_SESSION_KEY);
    }

    function getCachedAuthResult() {
        const cached = readAuthCache();
        if (!cached) {
            const user = getStoredUser();
            return user ? writeAuthCache(user) : null;
        }

        return cached;
    }

    function hasFreshAuthCache() {
        const cached = readAuthCache();
        if (!cached?.updatedAt) {
            return false;
        }

        return (Date.now() - Number(cached.updatedAt)) < AUTH_CACHE_TTL_MS;
    }

    function normalizeCollectionName(collection) {
        if (collection === 'recipe_with_serving') {
            return COLLECTIONS.RECIPES_WITH_SERVINGS;
        }

        return collection;
    }

    function getRecipeCollections() {
        return [...RECIPE_COLLECTIONS];
    }
    
    /**
     * Fetch recipes from a specific collection
     * @param {string} collection - Collection name
     * @param {Object} query - MongoDB query
     * @param {number} limit - Number of recipes to fetch
     * @param {number} skip - Number of recipes to skip
     * @returns {Promise<Object>} - API response
     */
    async function fetchRecipes(collection, query = {}, limit = 12, skip = 0) {
        try {
            const normalizedCollection = normalizeCollectionName(collection);
            const response = await fetch(`${API_BASE_URL}/recipes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    collection: normalizedCollection,
                    query,
                    limit,
                    skip
                }),
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            return {
                success: true,
                data: result.recipes,
                metadata: {
                    total: result.total,
                    hasMore: result.hasMore
                }
            };
        } catch (error) {
            console.error('Error fetching recipes:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Get a recipe by ID
     * @param {string} id - Recipe ID
     * @param {string} collection - Collection name
     * @returns {Promise<Object>} - API response
     */
    async function getRecipeById(id, collection) {
        try {
            const normalizedCollection = normalizeCollectionName(collection);
            const response = await fetch(`${API_BASE_URL}/recipe/${id}?collection=${normalizedCollection}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            return {
                success: true,
                data: result.recipe
            };
        } catch (error) {
            console.error('Error fetching recipe:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Search recipes across all collections
     * @param {string} searchTerm - Search term
     * @param {number} limit - Maximum number of results to return
     * @param {number} skip - Number of results to skip
     * @returns {Promise<Object>} - API response
     */
    async function searchAllRecipes(searchTerm, limit = 200, skip = 0) {
        try {
            const response = await fetch(`${API_BASE_URL}/search-recipes?term=${encodeURIComponent(searchTerm)}&limit=${limit}&skip=${skip}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            return {
                success: true,
                data: result.recipes,
                metadata: {
                    total: result.total,
                    hasMore: result.hasMore
                }
            };
        } catch (error) {
            console.error('Error searching recipes:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Get featured recipes from various collections
     * @param {number} limit - Number of recipes to fetch
     * @param {number} skip - Number of recipes to skip
     * @returns {Promise<Object>} - API response
     */
    async function getFeaturedRecipes(limit = 30, skip = 0) {
        try {
            // Fetch from multiple collections and merge results
            const collectionsToFetch = getRecipeCollections();
            
            // Calculate recipes per collection - fetch more to ensure we have enough
            const perCollection = Math.ceil((limit * 4) / collectionsToFetch.length);
            const perCollectionSkip = Math.floor(skip / collectionsToFetch.length);
            
            // Create an array of promises for each collection
            const collectionPromises = collectionsToFetch.map(collection => 
                fetchRecipes(collection, {}, perCollection, perCollectionSkip)
            );
            
            // Execute all promises in parallel
            const results = await Promise.all(collectionPromises);
            
            // Combine and shuffle results
            let allRecipes = [];
            
            results.forEach(result => {
                if (result.success && result.data && result.data.length > 0) {
                    allRecipes = allRecipes.concat(result.data);
                }
            });
            
            // Shuffle array
            allRecipes = shuffleArray(allRecipes);
            
            return {
                success: true,
                data: allRecipes.slice(0, limit),
                metadata: {
                    total: allRecipes.length,
                    hasMore: allRecipes.length > limit
                }
            };
        } catch (error) {
            console.error('Error fetching featured recipes:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Get recipes with video
     * @param {number} limit - Number of recipes to fetch
     * @returns {Promise<Object>} - API response
     */
    async function getVideoRecipes(limit = 200) {
        return fetchRecipes(COLLECTIONS.RECIPE_WITH_VIDEO, {}, limit);
    }
    
    /**
     * Get recipes by cuisine
     * @param {string} cuisine - Cuisine name
     * @param {number} limit - Number of recipes to fetch
     * @param {number} skip - Number of recipes to skip
     * @returns {Promise<Object>} - API response
     */
    async function getRecipesByCuisine(cuisine, limit = 200, skip = 0) {
        // Search across multiple collections
        const query = {
            $or: [
                { cuisine: { $regex: cuisine, $options: 'i' } },
                { cuisine: { $elemMatch: { $regex: cuisine, $options: 'i' } } }
            ]
        };
        
        try {
            // Fetch from multiple collections and merge results
            const collectionsToFetch = getRecipeCollections();
            
            // Calculate recipes per collection
            const perCollection = Math.ceil(limit / collectionsToFetch.length);
            const perCollectionSkip = Math.floor(skip / collectionsToFetch.length);
            
            // Create an array of promises for each collection
            const collectionPromises = collectionsToFetch.map(collection => 
                fetchRecipes(collection, query, perCollection, perCollectionSkip)
            );
            
            // Execute all promises in parallel
            const results = await Promise.all(collectionPromises);
            
            // Combine and shuffle results
            let allRecipes = [];
            
            results.forEach(result => {
                if (result.success && result.data && result.data.length > 0) {
                    allRecipes = allRecipes.concat(result.data);
                }
            });
            
            // Shuffle array
            allRecipes = shuffleArray(allRecipes);
            
            return {
                success: true,
                data: allRecipes.slice(0, limit),
                metadata: {
                    total: allRecipes.length,
                    hasMore: allRecipes.length > limit
                }
            };
        } catch (error) {
            console.error('Error fetching recipes by cuisine:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Normalize recipe data from different collections to a standard format
     * @param {Object} recipe - Recipe data
     * @param {string} collection - Source collection
     * @returns {Object} - Normalized recipe
     */
    function normalizeRecipeData(recipe, collection) {
        const normalizedCollection = normalizeCollectionName(collection);
        const normalizedRecipe = {
            id: recipe.id || recipe._id,
            name: recipe.name || recipe.recipe_name || recipe.title || 'Unnamed Recipe',
            description: recipe.description || recipe.summary || '',
            image: recipe.image || recipe.image_url || recipe.thumbnail_url || '',
            ingredients: recipe.ingredients || [],
            directions: recipe.directions || recipe.steps || recipe.instructions || [],
            prep_time: recipe.prep_time || recipe.time || (recipe['prep_time (in mins)'] ? `${recipe['prep_time (in mins)']} mins` : ''),
            servings: recipe.servings || recipe.serves || recipe.yield || '',
            cuisine: recipe.cuisine || '',
            video_url: recipe.video_url || '',
            source_collection: normalizedCollection
        };
        
        // Handle additional collection-specific fields
        if (normalizedCollection === COLLECTIONS.RECIPES_WITH_SERVINGS) {
            normalizedRecipe.tags = recipe.tags || '';
            normalizedRecipe.cooking_method = recipe.cooking_method || '';
        } else if (normalizedCollection === COLLECTIONS.RECIPE_WITH_VIDEO) {
            normalizedRecipe.calories = recipe.calories || '';
            normalizedRecipe.protein = recipe.protein || '';
            normalizedRecipe.carbohydrates = recipe.carbohydrates || '';
            normalizedRecipe.fat = recipe.fat || '';
            normalizedRecipe.score = recipe.score || '';
        } else if (normalizedCollection === COLLECTIONS.FOOD_RECIPE) {
            normalizedRecipe.course = recipe.course || '';
            normalizedRecipe.diet = recipe.diet || '';
            normalizedRecipe.cook_time = recipe['cook_time (in mins)'] || '';
        } else if (normalizedCollection === COLLECTIONS.BAKING) {
            normalizedRecipe.nutrients = recipe.nutrients || {};
            normalizedRecipe.difficult = recipe.difficult || '';
            normalizedRecipe.subcategory = recipe.subcategory || recipe.dish_type || '';
        }
        
        // Handle different ingredient formats
        if (Array.isArray(normalizedRecipe.ingredients) && normalizedRecipe.ingredients.length > 0) {
            if (typeof normalizedRecipe.ingredients[0] === 'object') {
                normalizedRecipe.ingredients = normalizedRecipe.ingredients.map(ing => 
                    ing.text || ing.name || ing.ingredient || ''
                );
            }
        }
        
        // Handle different direction formats
        if (Array.isArray(normalizedRecipe.directions) && normalizedRecipe.directions.length > 0) {
            if (typeof normalizedRecipe.directions[0] === 'object') {
                normalizedRecipe.directions = normalizedRecipe.directions.map(step => 
                    step.text || step.description || step.step || ''
                );
            }
        }
        
        return normalizedRecipe;
    }
    
    /**
     * Shuffle array using Fisher-Yates algorithm
     * @param {Array} array - Array to shuffle
     * @returns {Array} - Shuffled array
     */
    function shuffleArray(array) {
        let currentIndex = array.length, randomIndex;
        
        // While there remain elements to shuffle
        while (currentIndex != 0) {
            // Pick a remaining element
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            
            // And swap it with the current element
            [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
        }
        
        return array;
    }
    
    // Recipe Comments
    async function addComment(recipeId, text, collection) {
        try {
            const normalizedCollection = normalizeCollectionName(collection);
            const response = await fetch(`${API_BASE_URL}/recipes/${recipeId}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ comment: text, collection: normalizedCollection }),
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                console.error('Server error adding comment:', data.error || response.statusText);
                return { 
                    success: false, 
                    error: data.error || 'Failed to add comment. Please try again.'
                };
            }
            
            return {
                success: true,
                data: data.comment
            };
        } catch (error) {
            console.error('Error adding comment:', error);
            return {
                success: false,
                error: error.message || 'An unexpected error occurred'
            };
        }
    }
    
    async function getComments(recipeId, collection) {
        try {
            const normalizedCollection = normalizeCollectionName(collection || '');
            const response = await fetch(`${API_BASE_URL}/recipes/${recipeId}/comments?collection=${normalizedCollection}`);
            
            const data = await response.json();
            
            if (!response.ok) {
                console.error('Server error fetching comments:', data.error || response.statusText);
                return { 
                    success: false, 
                    error: data.error || 'Failed to fetch comments',
                    data: []
                };
            }
            
            return {
                success: true,
                data: data.comments || data.data || []
            };
        } catch (error) {
            console.error('Error fetching comments:', error);
            return {
                success: false,
                error: error.message || 'An unexpected error occurred',
                data: []
            };
        }
    }
    
    // Recipe Ratings
    async function rateRecipe(recipeId, rating, collection) {
        try {
            const normalizedCollection = normalizeCollectionName(collection);
            const response = await fetch(`${API_BASE_URL}/recipes/${recipeId}/rate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ rating, collection: normalizedCollection }),
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Failed to rate recipe');
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error rating recipe:', error);
            throw error;
        }
    }
    
    async function getRatings(recipeId, collection) {
        try {
            const normalizedCollection = normalizeCollectionName(collection || '');
            const response = await fetch(`${API_BASE_URL}/recipes/${recipeId}/ratings?collection=${normalizedCollection}`);
            
            if (!response.ok) {
                throw new Error('Failed to fetch ratings');
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching ratings:', error);
            throw error;
        }
    }
    
    /**
     * Record recipe view in user history
     * @param {string} recipeId - Recipe ID
     * @param {string} collection - Collection name
     * @returns {Promise<Object>} - API response
     */
    async function recordRecipeView(recipeId, collection) {
        try {
            const normalizedCollection = normalizeCollectionName(collection);
            const response = await fetch(`${API_BASE_URL}/history/view-recipe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    recipeId,
                    collection: normalizedCollection
                }),
                credentials: 'include'
            });
            
            if (!response.ok) {
                // If not authenticated or other error, silently fail
                return { success: false };
            }
            
            return { success: true };
        } catch (error) {
            console.error('Error recording recipe view:', error);
            return { success: false };
        }
    }
    
    /**
     * Record search term in user history
     * @param {string} term - Search term
     * @returns {Promise<Object>} - API response
     */
    async function recordSearchTerm(term) {
        try {
            const response = await fetch(`${API_BASE_URL}/history/search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ term }),
                credentials: 'include'
            });
            
            if (!response.ok) {
                // If not authenticated or other error, silently fail
                return { success: false };
            }
            
            return { success: true };
        } catch (error) {
            console.error('Error recording search term:', error);
            return { success: false };
        }
    }
    
    /**
     * Get user's viewed recipe history
     * @returns {Promise<Object>} - API response with viewedRecipes array
     */
    async function getViewedRecipes() {
        try {
            const response = await fetch(`${API_BASE_URL}/history/viewed-recipes`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching viewed recipes:', error);
            return { success: false, viewedRecipes: [] };
        }
    }
    
    /**
     * Get user's search history
     * @returns {Promise<Object>} - API response with searchHistory array
     */
    async function getSearchHistory() {
        try {
            const response = await fetch(`${API_BASE_URL}/history/search`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching search history:', error);
            return { success: false, searchHistory: [] };
        }
    }
    
    /**
     * Save a recipe to user's saved recipes
     * @param {string} recipeId - Recipe ID
     * @param {string} collection - Collection name
     * @returns {Promise<Object>} - API response
     */
    async function saveRecipe(recipeId, collection) {
        try {
            const normalizedCollection = normalizeCollectionName(collection);
            const response = await fetch(`${API_BASE_URL}/recipes/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    recipeId,
                    collection: normalizedCollection
                }),
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return { success: true };
        } catch (error) {
            console.error('Error saving recipe:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Remove a recipe from user's saved recipes
     * @param {string} recipeId - Recipe ID
     * @param {string} collection - Collection name
     * @returns {Promise<Object>} - API response
     */
    async function unsaveRecipe(recipeId, collection) {
        try {
            const normalizedCollection = normalizeCollectionName(collection);
            const response = await fetch(`${API_BASE_URL}/recipes/unsave`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    recipeId,
                    collection: normalizedCollection
                }),
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return { success: true };
        } catch (error) {
            console.error('Error unsaving recipe:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Get user's saved recipes
     * @returns {Promise<Object>} - API response with recipes array
     */
    async function getSavedRecipes() {
        try {
            const response = await fetch(`${API_BASE_URL}/recipes/saved`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            // Enhanced error handling
            if (!result.success) {
                console.error('Server returned error:', result.error);
                return { success: false, recipes: [] };
            }
            
            return result;
        } catch (error) {
            console.error('Error fetching saved recipes:', error);
            return { success: false, recipes: [] };
        }
    }

    /**
     * Get recipes created by the current user
     * @returns {Promise<Object>} - API response with recipes array
     */
    async function getMyRecipes() {
        try {
            const response = await fetch(`${API_BASE_URL}/user/recipes`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            if (!result.success) {
                return { success: false, recipes: [], error: result.error };
            }

            return result;
        } catch (error) {
            console.error('Error fetching user recipes:', error);
            return { success: false, recipes: [], error: error.message };
        }
    }

    /**
     * Delete a recipe created by the current user
     * @param {string} recipeId - Recipe ID
     * @returns {Promise<Object>} - API response
     */
    async function deleteMyRecipe(recipeId) {
        try {
            const response = await fetch(`${API_BASE_URL}/user/recipes/${recipeId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            const result = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    error: result.error || `HTTP error! status: ${response.status}`
                };
            }

            return result;
        } catch (error) {
            console.error('Error deleting user recipe:', error);
            return { success: false, error: error.message };
        }
    }

    async function getMyRecipeById(recipeId) {
        try {
            const response = await fetch(`${API_BASE_URL}/user/recipes/${recipeId}`, {
                credentials: 'include'
            });

            const result = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    error: result.error || `HTTP error! status: ${response.status}`
                };
            }

            return result;
        } catch (error) {
            console.error('Error fetching owned recipe:', error);
            return { success: false, error: error.message };
        }
    }

    async function updateMyRecipe(recipeId, recipeData) {
        try {
            const response = await fetch(`${API_BASE_URL}/user/recipes/${recipeId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(recipeData),
                credentials: 'include'
            });

            const result = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    error: result.error || `HTTP error! status: ${response.status}`
                };
            }

            return result;
        } catch (error) {
            console.error('Error updating owned recipe:', error);
            return { success: false, error: error.message };
        }
    }

    async function toggleMyRecipePublish(recipeId, published) {
        try {
            const response = await fetch(`${API_BASE_URL}/user/recipes/${recipeId}/publish`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ published }),
                credentials: 'include'
            });

            const result = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    error: result.error || `HTTP error! status: ${response.status}`
                };
            }

            return result;
        } catch (error) {
            console.error('Error toggling recipe publish state:', error);
            return { success: false, error: error.message };
        }
    }

    async function getMyRecipeAnalytics() {
        try {
            const response = await fetch(`${API_BASE_URL}/user/recipes/analytics`, {
                credentials: 'include'
            });

            const result = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    error: result.error || `HTTP error! status: ${response.status}`
                };
            }

            return result;
        } catch (error) {
            console.error('Error fetching owned recipe analytics:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Check if a recipe is saved by the current user
     * @param {string} recipeId - Recipe ID
     * @param {string} collection - Collection name
     * @returns {Promise<boolean>} - True if recipe is saved
     */
    async function isRecipeSaved(recipeId, collection) {
        try {
            const normalizedCollection = normalizeCollectionName(collection);
            const result = await getSavedRecipes();
            
            if (!result.success) {
                return false;
            }
            
            return result.recipes.some(r => 
                r.recipeId === recipeId && normalizeCollectionName(r.collection) === normalizedCollection
            );
        } catch (error) {
            console.error('Error checking if recipe is saved:', error);
            return false;
        }
    }
    
    /**
     * Save meal plan for a specific date
     * @param {string} date - Date in YYYY-MM-DD format
     * @param {Object} meals - Object containing breakfast, lunch, dinner arrays
     * @returns {Promise<Object>} - API response
     */
    async function saveMealPlan(date, meals) {
        try {
            console.log(`DB Integration: Saving meal plan for ${date}`, meals);
            
            // Create a deep copy of the meals to avoid modifying the original
            const mealsData = JSON.parse(JSON.stringify(meals));
            
            // Ensure consistent data structure for all meal items
            ['breakfast', 'lunch', 'dinner'].forEach(mealType => {
                if (mealsData[mealType] && Array.isArray(mealsData[mealType])) {
                    mealsData[mealType] = mealsData[mealType].map(item => {
                        // Ensure it has at least a text property
                        if (!item.text && item.name) {
                            item.text = item.name;
                        }
                        
                        // For recipe items, ensure ID is consistent
                        if (item.recipeId) {
                            // Keep only one ID format for storage
                            item.recipeId = item.recipeId.toString();
                        }
                        
                        return item;
                    });
                }
            });
            
            const response = await fetch(`${API_BASE_URL}/meal-plan/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    date,
                    meals: mealsData
                })
            });
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error saving meal plan:', error);
            return {
                success: false,
                error: 'Failed to save meal plan'
            };
        }
    }
    
    /**
     * Get meal plan for a specific date
     * @param {string} date - Date in format 'YYYY-MM-DD'
     * @returns {Promise<Object>} - API response with mealPlan object
     */
    async function getMealPlan(date) {
        try {
            const response = await fetch(`${API_BASE_URL}/meal-plan?date=${date}`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching meal plan:', error);
            return { 
                success: false, 
                mealPlan: {
                    date,
                    meals: {
                        breakfast: [],
                        lunch: [],
                        dinner: []
                    }
                }
            };
        }
    }
    
    /**
     * Get all meal plans for the user with enhanced data
     * @returns {Promise<Object>} - API response with mealPlans array
     */
    async function getAllMealPlans() {
        try {
            const response = await fetch(`${API_BASE_URL}/meal-plan`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            // Enhanced error handling
            if (!result.success) {
                console.error('Server returned error:', result.error);
                return { success: false, mealPlans: [] };
            }
            
            return result;
        } catch (error) {
            console.error('Error fetching all meal plans:', error);
            return { success: false, mealPlans: [] };
        }
    }
    
    /**
     * Delete meal plan for a specific date
     * @param {string} date - Date in format 'YYYY-MM-DD'
     * @returns {Promise<Object>} - API response
     */
    async function deleteMealPlan(date) {
        try {
            const response = await fetch(`${API_BASE_URL}/meal-plan`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ date }),
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return { success: true };
        } catch (error) {
            console.error('Error deleting meal plan:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Update user profile picture
     * @param {string} profileImageUrl - URL of the profile image
     * @returns {Promise<Object>} - API response
     */
    async function updateProfilePicture(profileImageUrl) {
        try {
            const response = await fetch(`${API_BASE_URL}/profile/update-picture`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ profileImageUrl }),
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return { success: true };
        } catch (error) {
            console.error('Error updating profile picture:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Update user profile settings
     * @param {Object} profileData - User profile data
     * @param {string} profileData.firstName - User's first name
     * @param {string} profileData.lastName - User's last name
     * @param {string} profileData.bio - User's bio
     * @returns {Promise<Object>} - API response
     */
    async function updateProfileSettings(profileData) {
        try {
            console.log('Sending profile update request:', profileData);
            
            const response = await fetch(`${API_BASE_URL}/user/profile`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(profileData),
                credentials: 'include'
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Error response:', response.status, errorText);
                throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
            }
            
            const result = await response.json();
            console.log('Profile update response:', result);
            return result;
        } catch (error) {
            console.error('Error updating profile settings:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Update user preferences
     * @param {Object} preferences - User preferences
     * @param {Array|string} preferences.diet - Dietary restrictions
     * @returns {Promise<Object>} - API response
     */
    async function updateUserPreferences(preferences) {
        try {
            console.log('Sending preferences update request:', preferences);
            
            const response = await fetch(`${API_BASE_URL}/user/preferences`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(preferences),
                credentials: 'include'
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Error response:', response.status, errorText);
                throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
            }
            
            const result = await response.json();
            console.log('Preference update response:', result);
            return result;
        } catch (error) {
            console.error('Error updating user preferences:', error);
            return { success: false, error: error.message };
        }
    }

    function redirectAfterSuccessfulAuth(defaultUrl = 'recipify.html') {
        const redirectUrl = sessionStorage.getItem('redirectAfterLogin');
        if (redirectUrl) {
            console.log('Redirecting to:', redirectUrl);
            sessionStorage.removeItem('redirectAfterLogin');
            window.location.href = redirectUrl;
            return;
        }

        window.location.href = defaultUrl;
    }

    async function loginWithGoogleCredential(credential) {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/google`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ credential }),
                credentials: 'include'
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || result.message || 'Google sign-in failed');
            }

            const user = result.user || result.data;
            if (user) {
                writeAuthCache(user, { userId: user.id || user._id || null });
                window.dispatchEvent(new CustomEvent('recipify:auth-changed', {
                    detail: { isAuthenticated: true, user }
                }));
            }

            redirectAfterSuccessfulAuth('recipify.html');
            return result;
        } catch (error) {
            console.error('Google login error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async function loginWithFirebaseIdToken(idToken) {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/firebase-login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ idToken }),
                credentials: 'include'
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || result.message || 'Firebase sign-in failed');
            }

            const user = result.user || result.data;
            if (user) {
                writeAuthCache(user, { userId: user.id || user._id || null });
                window.dispatchEvent(new CustomEvent('recipify:auth-changed', {
                    detail: { isAuthenticated: true, user }
                }));
            }

            redirectAfterSuccessfulAuth('recipify.html');
            return result;
        } catch (error) {
            console.error('Firebase login error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Login with username and password
     * @param {string} username - Username or email
     * @param {string} password - Password
     * @returns {Promise<Object>} - API response
     */
    async function login(identifier, password) {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: identifier,
                    email: identifier,
                    password
                }),
                credentials: 'include'
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || errorData.message || 'Login failed');
            }
            
            const result = await response.json();

            if (result.success && result.user) {
                writeAuthCache(result.user, { userId: result.user.id || result.user._id || null });
                window.dispatchEvent(new CustomEvent('recipify:auth-changed', {
                    detail: { isAuthenticated: true, user: result.user }
                }));
            }
            
            redirectAfterSuccessfulAuth('recipify.html');
            
            return result;
        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Check if user is logged in
     * @returns {Promise<Object>} - API response with auth status
     */
    async function checkAuth() {
        const cached = getCachedAuthResult();
        if (cached?.isAuthenticated && hasFreshAuthCache()) {
            return {
                success: true,
                isAuthenticated: true,
                userId: cached.userId || null,
                user: cached.user || null,
                fromCache: true
            };
        }

        if (authCheckPromise) {
            return authCheckPromise;
        }

        authCheckPromise = (async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/auth/check-auth`, {
                    credentials: 'include',
                    cache: 'no-store'
                });

                if (!response.ok) {
                    if ([401, 403].includes(response.status)) {
                        clearAuthCache();
                        return { success: false, isAuthenticated: false };
                    }

                    if (cached?.isAuthenticated) {
                        return {
                            success: true,
                            isAuthenticated: true,
                            userId: cached.userId || null,
                            user: cached.user || null,
                            fromCache: true
                        };
                    }

                    return { success: false, isAuthenticated: false };
                }

                const result = await response.json();
                if (!result.isAuthenticated) {
                    clearAuthCache();
                    return {
                        success: true,
                        isAuthenticated: false,
                        userId: null,
                        user: null
                    };
                }

                const cachedUser = cached?.user || getStoredUser();
                const payload = writeAuthCache(cachedUser, { userId: result.userId || cachedUser?.id || cachedUser?._id || null });

                return {
                    success: true,
                    isAuthenticated: true,
                    userId: payload.userId,
                    user: payload.user,
                    fromCache: !cachedUser
                };
            } catch (error) {
                console.error('Auth check error:', error);

                if (cached?.isAuthenticated) {
                    return {
                        success: true,
                        isAuthenticated: true,
                        userId: cached.userId || null,
                        user: cached.user || null,
                        stale: true
                    };
                }

                return { success: false, isAuthenticated: false };
            } finally {
                authCheckPromise = null;
            }
        })();

        return authCheckPromise;
    }
    
    /**
     * Get user's ratings with full recipe data
     * @returns {Promise<Object>} - API response with ratings array
     */
    async function getUserRatings() {
        try {
            const response = await fetch(`${API_BASE_URL}/user/ratings`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            // Enhanced error handling
            if (!result.success) {
                console.error('Server returned error:', result.error);
                return { success: false, ratings: [] };
            }
            
            return result;
        } catch (error) {
            console.error('Error fetching user ratings:', error);
            return { success: false, ratings: [] };
        }
    }
    
    /**
     * Delete a specific recipe from viewing history
     * @param {string} recipeId - ID of the recipe to delete
     * @param {string} collection - Collection the recipe belongs to
     * @returns {Promise<Object>} - API response
     */
    async function deleteViewedRecipe(recipeId, collection) {
        try {
            const normalizedCollection = normalizeCollectionName(collection);
            const response = await fetch(`${API_BASE_URL}/user/viewing-history/${recipeId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ collection: normalizedCollection }),
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error deleting viewed recipe:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Clear all viewing history
     * @returns {Promise<Object>} - API response
     */
    async function clearViewingHistory() {
        try {
            const response = await fetch(`${API_BASE_URL}/user/viewing-history`, {
                method: 'DELETE',
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error clearing viewing history:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Record a recipe share event
     * @param {string} recipeId - ID of the recipe that was shared
     * @param {string} collection - Collection the recipe belongs to
     * @param {string} platform - Platform where the recipe was shared (e.g., 'facebook', 'twitter')
     * @returns {Promise<Object>} - API response
     */
    async function recordShareEvent(recipeId, collection, platform) {
        try {
            const normalizedCollection = normalizeCollectionName(collection);
            const response = await fetch(`${API_BASE_URL}/recipes/share`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    recipeId,
                    collection: normalizedCollection,
                    platform
                }),
                credentials: 'include'
            });
            
            if (!response.ok) {
                // Silently fail for non-critical feature
                console.warn(`Failed to record share event: ${response.status}`);
                return { success: false };
            }
            
            return { success: true };
        } catch (error) {
            console.error('Error recording share event:', error);
            return { success: false };
        }
    }
    
    /**
     * Get user's comments with recipe details
     * @returns {Promise<Object>} - API response with comments array
     */
    async function getUserComments() {
        try {
            console.log('Getting user comments from RecipifyDB');
            const response = await fetch(`${API_BASE_URL}/user/comments`, {
                credentials: 'include'
            });
            
            console.log('User comments response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('API error fetching user comments. Status:', response.status, 'Text:', errorText);
                return { 
                    success: false, 
                    error: `Error ${response.status}: ${response.statusText}`,
                    comments: [] 
                };
            }
            
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Error fetching user comments:', error);
            return { success: false, error: error.message, comments: [] };
        }
    }
    
    /**
     * Get recipe metrics including share count
     * @param {string} recipeId - ID of the recipe
     * @param {string} collection - Collection the recipe belongs to
     * @returns {Promise<Object>} - API response with metrics
     */
    async function getRecipeMetrics(recipeId, collection) {
        try {
            const normalizedCollection = normalizeCollectionName(collection);
            const response = await fetch(`${API_BASE_URL}/recipes/${recipeId}/metrics?collection=${normalizedCollection}`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                console.warn(`Failed to get recipe metrics: ${response.status}`);
                return { 
                    success: false, 
                    metrics: { shareCount: 0, viewCount: 0 } 
                };
            }
            
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Error getting recipe metrics:', error);
            return { 
                success: false, 
                metrics: { shareCount: 0, viewCount: 0 } 
            };
        }
    }
    
    // Public API
    return {
        fetchRecipes,
        getRecipeById,
        searchAllRecipes,
        getFeaturedRecipes,
        getVideoRecipes,
        getRecipesByCuisine,
        getRecipeCollections,
        normalizeRecipeData,
        COLLECTIONS,
        addComment,
        getComments,
        getUserComments,
        rateRecipe,
        getRatings,
        recordRecipeView,
        recordSearchTerm,
        getViewedRecipes,
        deleteViewedRecipe,
        clearViewingHistory,
        getSearchHistory,
        saveRecipe,
        unsaveRecipe,
        getSavedRecipes,
        getMyRecipes,
        getMyRecipeById,
        updateMyRecipe,
        deleteMyRecipe,
        toggleMyRecipePublish,
        getMyRecipeAnalytics,
        isRecipeSaved,
        saveMealPlan,
        getMealPlan,
        getAllMealPlans,
        deleteMealPlan,
        updateProfilePicture,
        updateProfileSettings,
        updateUserPreferences,
        login,
        loginWithGoogleCredential,
        loginWithFirebaseIdToken,
        checkAuth,
        getUserRatings,
        recordShareEvent,
        getRecipeMetrics
    };
})(); 
