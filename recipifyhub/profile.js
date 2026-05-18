/**
 * RecipifyHub Profile Page JavaScript
 * Handles profile page functionality including loading user data,
 * tab navigation, and content loading for different sections
 */

let myRecipeSelection = new Set();
let myRecipeListCache = [];
let myRecipeAnalyticsCache = [];

// Function to load user profile data
async function loadUserProfile() {
    try {
        const profileAvatar = document.getElementById('profile-avatar');
        const profileName = document.getElementById('profile-name');
        const profileBio = document.getElementById('profile-bio');
        const recipesCount = document.getElementById('recipes-count');
        const savesCount = document.getElementById('saves-count');
        const commentsCount = document.getElementById('comments-count');
        
        // Show loading state
        profileName.textContent = 'Loading...';
        profileBio.textContent = 'Loading...';
        
        // Make API request
        const response = await fetch('/api/user/profile', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch profile data');
        }
        
        const data = await response.json();
        
        if (data.success && data.user) {
            // Update profile image
            if (data.user.profileImageUrl) {
                profileAvatar.src = data.user.profileImageUrl;
            }
            
            // Update profile name
            const fullName = `${data.user.firstName || ''} ${data.user.lastName || ''}`.trim();
            profileName.textContent = fullName || data.user.username || 'User';
            
            // Update profile bio
            profileBio.textContent = data.user.bio || 'No bio provided';
            
            // Update stats counters
            if (data.user.stats) {
                recipesCount.textContent = data.user.stats.recipesCount || 0;
                savesCount.textContent = data.user.stats.savesCount || 0;
                commentsCount.textContent = data.user.stats.commentsCount || 0;
            }
            
            // Fill in form fields
            populateProfileForms(data.user);
        } else {
            profileName.textContent = 'User';
            profileBio.textContent = 'No bio provided';
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        
        // Show error state
        const profileName = document.getElementById('profile-name');
        const profileBio = document.getElementById('profile-bio');
        
        if (profileName) profileName.textContent = 'Error loading profile';
        if (profileBio) profileBio.textContent = 'Please try refreshing the page';
    }
}

// Populate profile forms with user data
function populateProfileForms(userData) {
    console.log('Populating profile forms with data:', userData);
    
    // Populate profile settings form
    const firstNameInput = document.getElementById('first-name');
    const lastNameInput = document.getElementById('last-name');
    const bioInput = document.getElementById('bio');
    
    if (firstNameInput) firstNameInput.value = userData.firstName || '';
    if (lastNameInput) lastNameInput.value = userData.lastName || '';
    if (bioInput) bioInput.value = userData.bio || '';
    
    // Populate preferences form - dietary restrictions
    if (userData.preferences && userData.preferences.diet) {
        console.log('Setting dietary preferences:', userData.preferences.diet);
        const dietCheckboxes = document.querySelectorAll('input[name="diet"]');
        dietCheckboxes.forEach(checkbox => {
            if (userData.preferences.diet.includes(checkbox.value)) {
                checkbox.checked = true;
            }
        });
    }
}

// Function to set up profile photo upload
function setupProfilePhotoUpload() {
    // Create a hidden file input element
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    
    // Get the edit profile button
    const editAvatarBtn = document.querySelector('.edit-avatar-btn');
    
    if (editAvatarBtn) {
        // Add click event listener to the edit button
        editAvatarBtn.addEventListener('click', () => {
            fileInput.click(); // Trigger file selection dialog
        });
        
        // Add change event listener to the file input
        fileInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            // Check file type
            if (!file.type.match('image.*')) {
                showToast('Please select an image file', 'error');
                return;
            }
            
            // Check file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                showToast('Image size must be less than 5MB', 'error');
                return;
            }
            
            try {
                // Show loading indicator
                editAvatarBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                editAvatarBtn.disabled = true;
                
                // Read the file as a data URL
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const imageDataUrl = e.target.result;
                        
                        // Update profile pictures with the new image (preview)
                        const profileAvatar = document.getElementById('profile-avatar');
                        const userAvatar = document.getElementById('user-avatar');
                        
                        if (profileAvatar) profileAvatar.src = imageDataUrl;
                        if (userAvatar) userAvatar.src = imageDataUrl;
                        
                        // Upload the image to the server
                        const response = await window.RecipifyDB.updateProfilePicture(imageDataUrl);
                        
                        if (response.success) {
                            // Save in session storage for persistence across pages
                            sessionStorage.setItem('user', JSON.stringify({
                                ...JSON.parse(sessionStorage.getItem('user') || '{}'),
                                profileImageUrl: imageDataUrl
                            }));
                            
                            showToast('Profile photo updated successfully', 'success');
                        } else {
                            throw new Error(response.error || 'Failed to update profile photo');
                        }
                    } catch (error) {
                        console.error('Error updating profile photo:', error);
                        showToast('Failed to update profile photo', 'error');
                        
                        // Revert to the previous image if available
                        const user = JSON.parse(sessionStorage.getItem('user') || '{}');
                        if (user.profileImageUrl) {
                            const profileAvatar = document.getElementById('profile-avatar');
                            const userAvatar = document.getElementById('user-avatar');
                            
                            if (profileAvatar) profileAvatar.src = user.profileImageUrl;
                            if (userAvatar) userAvatar.src = user.profileImageUrl;
                        }
                    } finally {
                        // Restore button state
                        editAvatarBtn.innerHTML = '<i class="fas fa-camera"></i>';
                        editAvatarBtn.disabled = false;
                    }
                };
                
                reader.readAsDataURL(file);
            } catch (error) {
                console.error('Error processing image:', error);
                showToast('Error processing image', 'error');
                
                // Restore button state
                editAvatarBtn.innerHTML = '<i class="fas fa-camera"></i>';
                editAvatarBtn.disabled = false;
            }
        });
    }
}

// Helper function to show toast notifications
function showToast(message, type = 'info') {
    if (window.RecipifyComponents && typeof window.RecipifyComponents.showToast === 'function') {
        window.RecipifyComponents.showToast(message, type);
        return;
    }

    console[type === 'error' ? 'error' : 'log'](message);
}

async function requestConfirmation(options) {
    if (window.RecipifyComponents && typeof window.RecipifyComponents.confirmAction === 'function') {
        return window.RecipifyComponents.confirmAction(options);
    }

    return false;
}

// Function to set up tab navigation
function setupTabNavigation() {
    const tabs = document.querySelectorAll('.nav-item');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            // Add active class to clicked tab
            this.classList.add('active');
            
            // Hide all tab panes
            document.querySelectorAll('.tab-pane').forEach(pane => {
                pane.classList.remove('active');
            });
            
            // Show the selected tab pane
            const tabName = this.getAttribute('data-tab');
            document.getElementById(`${tabName}-tab`).classList.add('active');
            
            // Load tab content if needed
            loadTabContent(tabName);
        });
    });
}

// Function to load content for each tab
function loadTabContent(tabName) {
    switch(tabName) {
        case 'recipes':
            loadMyRecipeAnalytics().finally(() => loadMyRecipes());
            break;
        case 'saved':
            loadSavedRecipes();
            break;
        case 'comments':
            loadMyComments();
            break;
        case 'history':
            loadViewedRecipes();
            break;
        case 'meal-plans':
            loadMealPlans();
            break;
        case 'ratings':
            loadMyRatings();
            break;
    }
}

// Load saved recipes
async function loadSavedRecipes() {
    try {
        const savedGrid = document.getElementById('saved-recipes-grid');
        savedGrid.innerHTML = '<div class="loading">Loading your saved recipes...</div>';
        
        console.log('Calling RecipifyDB.getSavedRecipes()...');
        const response = await window.RecipifyDB.getSavedRecipes();
        console.log('getSavedRecipes response:', response);
        
        if (response.success && response.recipes && response.recipes.length > 0) {
            console.log(`Found ${response.recipes.length} saved recipes`);
            
            // Log first recipe for debugging
            if (response.recipes.length > 0) {
                const firstRecipe = response.recipes[0];
                console.log('Sample saved recipe:', {
                    recipeId: firstRecipe.recipe.id || firstRecipe.recipe._id,
                    name: firstRecipe.recipe.name,
                    collection: firstRecipe.collection,
                    savedAt: firstRecipe.savedAt
                });
            }
            
            savedGrid.innerHTML = response.recipes.map(item => {
                const recipe = item.recipe;
                const recipeId = recipe.id || recipe._id;
                const collection = recipe.source_collection || item.collection;
                
                return `
                    <div class="recipe-card" data-recipe-id="${recipeId}" data-collection="${collection}">
                        <div class="recipe-image">
                            <img src="${recipe.image || recipe.image_url || 'https://via.placeholder.com/300x200?text=No+Image'}" alt="${recipe.name}" 
                                onerror="this.src='https://via.placeholder.com/300x200?text=Image+Error'">
                        </div>
                        <div class="recipe-details">
                            <h3>${recipe.name}</h3>
                            <p class="saved-date">Saved: ${new Date(item.savedAt).toLocaleDateString()}</p>
                            <div class="recipe-actions">
                                <a href="recipe.html?id=${recipeId}&collection=${collection}" class="btn-outline">View Recipe</a>
                                <button class="btn-unsave" onclick="unsaveRecipe('${recipeId}', '${collection}', this)">
                                    <i class="fas fa-trash"></i> Unsave
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            console.log('No saved recipes found. Response:', response);
            savedGrid.innerHTML = '<div class="empty-state">You haven\'t saved any recipes yet.</div>';
        }
    } catch (error) {
        console.error('Error loading saved recipes:', error);
        document.getElementById('saved-recipes-grid').innerHTML = 
            '<div class="error-state">Failed to load your saved recipes. Please try again later.</div>';
    }
}

// Function to unsave a recipe
window.unsaveRecipe = async function(recipeId, collection, button) {
    try {
        // Disable the button to prevent multiple clicks
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Removing...';
        
        // Call API to unsave the recipe
        const result = await window.RecipifyDB.unsaveRecipe(recipeId, collection);
        
        if (result.success) {
            // Show notification
            showNotification('Recipe removed from saved recipes', 'success');
            
            // Remove the recipe card from the grid
            const recipeCard = button.closest('.recipe-card');
            recipeCard.classList.add('fade-out');
            
            // After animation completes, remove the element
            setTimeout(() => {
                recipeCard.remove();
                
                // Check if there are any recipes left
                const savedGrid = document.getElementById('saved-recipes-grid');
                if (savedGrid.querySelectorAll('.recipe-card').length === 0) {
                    savedGrid.innerHTML = '<div class="empty-state">You haven\'t saved any recipes yet.</div>';
                }
                
                // Also update the count in the profile stats
                updateSavedRecipeCount();
            }, 300);
        } else {
            // Re-enable the button
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-trash"></i> Unsave';
            
            showNotification('Failed to remove recipe. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Error unsaving recipe:', error);
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-trash"></i> Unsave';
        showNotification('Failed to remove recipe. Please try again.', 'error');
    }
}

// Update the saved recipes count in the profile stats
async function updateSavedRecipeCount() {
    try {
        const response = await window.RecipifyDB.getSavedRecipes();
        if (response.success) {
            const count = response.recipes ? response.recipes.length : 0;
            document.getElementById('saves-count').textContent = count;
        }
    } catch (error) {
        console.error('Error updating saved recipe count:', error);
    }
}

// Show notification
window.showNotification = function(message, type = 'success') {
    showToast(message, type === 'success' ? 'success' : type);
}

function updateRecipeSelectionStatus() {
    const selectedCount = document.getElementById('selected-recipes-count');
    const publishButton = document.getElementById('bulk-publish-btn');
    const unpublishButton = document.getElementById('bulk-unpublish-btn');

    if (selectedCount) {
        selectedCount.textContent = `${myRecipeSelection.size} selected`;
    }

    if (publishButton) {
        publishButton.disabled = myRecipeSelection.size === 0;
    }

    if (unpublishButton) {
        unpublishButton.disabled = myRecipeSelection.size === 0;
    }
}

window.toggleMyRecipeSelection = function(recipeId, checked) {
    if (checked) {
        myRecipeSelection.add(recipeId);
    } else {
        myRecipeSelection.delete(recipeId);
    }

    updateRecipeSelectionStatus();
}

async function loadMyRecipeAnalytics() {
    const analyticsContainer = document.getElementById('my-recipe-analytics');
    if (!analyticsContainer) {
        return;
    }

    analyticsContainer.innerHTML = '<div class="loading">Loading analytics...</div>';

    try {
        const result = await window.RecipifyDB.getMyRecipeAnalytics();
        if (!result.success) {
            throw new Error(result.error || 'Failed to load analytics');
        }

        myRecipeAnalyticsCache = result.recipes || [];
        const summary = result.summary || {};

        analyticsContainer.innerHTML = `
            <div class="recipe-insight-card"><strong>${summary.totalRecipes || 0}</strong><span>Total recipes</span></div>
            <div class="recipe-insight-card"><strong>${summary.publishedRecipes || 0}</strong><span>Published</span></div>
            <div class="recipe-insight-card"><strong>${summary.draftRecipes || 0}</strong><span>Drafts</span></div>
            <div class="recipe-insight-card"><strong>${summary.totalViews || 0}</strong><span>Total views</span></div>
            <div class="recipe-insight-card"><strong>${summary.totalComments || 0}</strong><span>Comments</span></div>
            <div class="recipe-insight-card"><strong>${summary.averageRating || 0}</strong><span>Average rating</span></div>
        `;
    } catch (error) {
        console.error('Error loading recipe analytics:', error);
        analyticsContainer.innerHTML = '<div class="error-state">Failed to load recipe analytics.</div>';
    }
}

async function runBulkPublishUpdate(published) {
    if (myRecipeSelection.size === 0) {
        showToast('Select at least one recipe first', 'warning');
        return;
    }

    const selectedIds = Array.from(myRecipeSelection);
    const button = document.getElementById(published ? 'bulk-publish-btn' : 'bulk-unpublish-btn');
    const originalText = button ? button.textContent : '';

    try {
        if (button) {
            button.disabled = true;
            button.textContent = 'Updating...';
        }

        const results = await Promise.all(selectedIds.map(recipeId => window.RecipifyDB.toggleMyRecipePublish(recipeId, published)));
        const failures = results.filter(result => !result.success);

        if (failures.length) {
            throw new Error(`${failures.length} recipe update(s) failed`);
        }

        myRecipeSelection.clear();
        await loadMyRecipeAnalytics();
        await loadMyRecipes();
        showToast(published ? 'Selected recipes published' : 'Selected recipes moved to draft', 'success');
    } catch (error) {
        console.error('Bulk publish update error:', error);
        showToast(error.message || 'Failed to update selected recipes', 'error');
    } finally {
        if (button) {
            button.textContent = originalText;
        }
        updateRecipeSelectionStatus();
    }
}

function setupMyRecipeBulkActions() {
    const selectAllButton = document.getElementById('select-all-recipes');
    const clearSelectionButton = document.getElementById('clear-recipe-selection');
    const publishButton = document.getElementById('bulk-publish-btn');
    const unpublishButton = document.getElementById('bulk-unpublish-btn');

    if (!selectAllButton || selectAllButton.dataset.bound === 'true') {
        updateRecipeSelectionStatus();
        return;
    }

    selectAllButton.dataset.bound = 'true';

    selectAllButton.addEventListener('click', () => {
        myRecipeSelection = new Set(myRecipeListCache.map(recipe => String(recipe.id || recipe._id)));
        document.querySelectorAll('.recipe-select-checkbox').forEach(checkbox => {
            checkbox.checked = true;
        });
        updateRecipeSelectionStatus();
    });

    clearSelectionButton.addEventListener('click', () => {
        myRecipeSelection.clear();
        document.querySelectorAll('.recipe-select-checkbox').forEach(checkbox => {
            checkbox.checked = false;
        });
        updateRecipeSelectionStatus();
    });

    publishButton.addEventListener('click', () => runBulkPublishUpdate(true));
    unpublishButton.addEventListener('click', () => runBulkPublishUpdate(false));
    updateRecipeSelectionStatus();
}

// Load my recipes
async function loadMyRecipes() {
    try {
        const recipesGrid = document.getElementById('my-recipes-grid');
        recipesGrid.innerHTML = '<div class="loading">Loading your recipes...</div>';

        const response = await window.RecipifyDB.getMyRecipes();

        if (response.success && response.recipes && response.recipes.length > 0) {
            myRecipeListCache = response.recipes;
            myRecipeSelection = new Set(
                Array.from(myRecipeSelection).filter(recipeId =>
                    response.recipes.some(recipe => String(recipe.id || recipe._id) === String(recipeId))
                )
            );
            updateMyRecipeCount(response.recipes.length);

            recipesGrid.innerHTML = response.recipes.map(recipe => {
                const recipeId = recipe.id || recipe._id;
                const recipeName = recipe.name || recipe.recipe_name || 'Untitled Recipe';
                const imageUrl = recipe.image_url || recipe.image || 'https://via.placeholder.com/300x200?text=No+Image';
                const createdDate = recipe.created_at
                    ? new Date(recipe.created_at).toLocaleDateString()
                    : 'Unknown date';
                const summaryBits = [recipe.cuisine, recipe.course, recipe.difficulty].filter(Boolean);
                const publishState = recipe.published === false ? 'Draft' : 'Published';
                const publishAction = recipe.published === false ? 'Publish' : 'Unpublish';
                const nextPublishState = recipe.published === false;
                const recipeAnalytics = myRecipeAnalyticsCache.find(item => String(item.recipeId) === String(recipeId));
                const collection = recipe.source_collection || 'user_recipes';

                return `
                    <div class="recipe-card" data-created-recipe-id="${recipeId}">
                        <div class="recipe-image">
                            <img src="${imageUrl}" alt="${recipeName}"
                                onerror="this.src='https://via.placeholder.com/300x200?text=Image+Error'">
                        </div>
                        <div class="recipe-details">
                            <div class="recipe-select-row">
                                <label>
                                    <input type="checkbox" class="recipe-select-checkbox" ${myRecipeSelection.has(String(recipeId)) ? 'checked' : ''} onchange="toggleMyRecipeSelection('${recipeId}', this.checked)">
                                    Select
                                </label>
                            </div>
                            <h3>${recipeName}</h3>
                            <p class="saved-date">Created: ${createdDate}</p>
                            <p class="saved-date">Status: <span class="recipe-state-badge ${publishState.toLowerCase()}">${publishState}</span></p>
                            ${summaryBits.length ? `<p>${summaryBits.join(' | ')}</p>` : '<p>Your custom recipe is ready to view.</p>'}
                            ${recipeAnalytics ? `
                                <div class="recipe-analytics-row">
                                    <span class="recipe-analytics-chip"><i class="fas fa-eye"></i> ${recipeAnalytics.views}</span>
                                    <span class="recipe-analytics-chip"><i class="fas fa-share-nodes"></i> ${recipeAnalytics.shares}</span>
                                    <span class="recipe-analytics-chip"><i class="fas fa-comments"></i> ${recipeAnalytics.comments}</span>
                                    <span class="recipe-analytics-chip"><i class="fas fa-star"></i> ${recipeAnalytics.averageRating} (${recipeAnalytics.ratingsCount})</span>
                                </div>
                            ` : ''}
                            <div class="recipe-actions">
                                <a href="recipe.html?id=${recipeId}&collection=${collection}" class="btn-outline">View Recipe</a>
                                <a href="recipe_input.html?edit=${recipeId}" class="btn-outline">Edit</a>
                                <button class="btn-outline" onclick="toggleMyRecipePublish('${recipeId}', ${nextPublishState}, this)">
                                    <i class="fas fa-bullhorn"></i> ${publishAction}
                                </button>
                                <button class="btn-unsave" onclick="deleteMyRecipe('${recipeId}', this)">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            updateRecipeSelectionStatus();
        } else {
            myRecipeListCache = [];
            myRecipeSelection.clear();
            updateMyRecipeCount(0);
            recipesGrid.innerHTML = `
                <div class="empty-state">
                    <p>You haven't created any recipes yet.</p>
                    <a href="recipe_input.html" class="btn-primary">Create Recipe</a>
                </div>
            `;
            updateRecipeSelectionStatus();
        }
    } catch (error) {
        console.error('Error loading recipes:', error);
        myRecipeListCache = [];
        myRecipeSelection.clear();
        updateMyRecipeCount(0);
        document.getElementById('my-recipes-grid').innerHTML = 
            '<div class="error-state">Failed to load your recipes. Please try again later.</div>';
        updateRecipeSelectionStatus();
    }
}

function updateMyRecipeCount(count) {
    const recipesCount = document.getElementById('recipes-count');
    if (recipesCount) {
        recipesCount.textContent = count;
    }
}

window.toggleMyRecipePublish = async function(recipeId, published, button) {
    const originalText = button.innerHTML;

    try {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';

        const result = await window.RecipifyDB.toggleMyRecipePublish(recipeId, published);
        if (!result.success) {
            throw new Error(result.error || 'Failed to update recipe visibility');
        }

        showToast(published ? 'Recipe published successfully' : 'Recipe moved back to draft', 'success');
        await loadMyRecipeAnalytics();
        await loadMyRecipes();
    } catch (error) {
        console.error('Error updating recipe publish state:', error);
        button.disabled = false;
        button.innerHTML = originalText;
        showToast(error.message || 'Failed to update recipe visibility', 'error');
    }
}

window.deleteMyRecipe = async function(recipeId, button) {
    const shouldDelete = await requestConfirmation({
        title: 'Delete this recipe?',
        message: 'This removes the recipe from your profile and public library if it is published.',
        confirmText: 'Delete recipe',
        cancelText: 'Keep recipe',
        danger: true
    });

    if (!shouldDelete) {
        return;
    }

    try {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';

        const result = await window.RecipifyDB.deleteMyRecipe(recipeId);

        if (!result.success) {
            throw new Error(result.error || 'Failed to delete recipe');
        }

        const recipeCard = button.closest('[data-created-recipe-id]');
        if (recipeCard) {
            recipeCard.classList.add('fade-out');

            setTimeout(() => {
                recipeCard.remove();

                const remainingCards = document.querySelectorAll('[data-created-recipe-id]').length;
                updateMyRecipeCount(remainingCards);

                if (remainingCards === 0) {
                    document.getElementById('my-recipes-grid').innerHTML = `
                        <div class="empty-state">
                            <p>You haven't created any recipes yet.</p>
                            <a href="recipe_input.html" class="btn-primary">Create Recipe</a>
                        </div>
                    `;
                }
            }, 300);
        }

        myRecipeSelection.delete(String(recipeId));
        await loadMyRecipeAnalytics();
        updateRecipeSelectionStatus();
        showToast('Recipe deleted successfully', 'success');
    } catch (error) {
        console.error('Error deleting user recipe:', error);
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-trash"></i> Delete';
        showToast(error.message || 'Failed to delete recipe', 'error');
    }
}

// Load my comments
async function loadMyComments() {
    try {
        const commentsList = document.getElementById('my-comments-list');
        commentsList.innerHTML = '<div class="loading">Loading your comments...</div>';
        
        // Fetch user comments from the server
        console.log('Fetching user comments...');
        
        // First check that the user is authenticated
        const authStatus = await window.RecipifyDB.checkAuth();
        console.log('Authentication status for comments:', authStatus);
        
        if (!authStatus.isAuthenticated) {
            console.error('User not authenticated for comments');
            commentsList.innerHTML = '<div class="error-state">You must be logged in to view your comments. Please <a href="login.html">login</a> first.</div>';
            return;
        }
        
        let data;
        let response;
        
        // Try using RecipifyDB first if it has a getUserComments method
        if (window.RecipifyDB && typeof window.RecipifyDB.getUserComments === 'function') {
            console.log('Using RecipifyDB.getUserComments()');
            const result = await window.RecipifyDB.getUserComments();
            data = result;
            if (!result.success) {
                throw new Error(`Failed to fetch comments: ${result.error || 'Unknown error'}`);
            }
        } else {
            // Fallback to direct fetch
            console.log('Falling back to direct fetch for user comments');
            response = await fetch('/api/recipe/user-comments', {
                credentials: 'include'
            });
            
            console.log('User comments response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Failed to fetch comments. Status:', response.status, 'Text:', errorText);
                throw new Error(`Failed to fetch comments: ${response.status} ${response.statusText}`);
            }
            
            data = await response.json();
        }
        
        console.log('User comments data:', data);
        
        if (data.success && data.comments && data.comments.length > 0) {
            console.log(`Rendering ${data.comments.length} comments`);
            commentsList.innerHTML = data.comments.map(comment => {
                // Ensure recipe data is available
                const recipe = comment.recipe || {};
                const recipeName = recipe.name || recipe.recipe_name || 'Unknown Recipe';
                const recipeImage = recipe.image || recipe.image_url || 'https://via.placeholder.com/50x50?text=No+Image';
                const recipeId = recipe.id || recipe._id || comment.recipeId;
                const collection = recipe.source_collection || comment.collection || 'recipe';
                
                console.log('Comment:', comment._id, 'Recipe:', recipeName);
                
                // For unavailable recipes, show a warning
                const unavailableWarning = recipe._unavailable ? 
                    '<div class="recipe-unavailable">Recipe no longer available</div>' : '';
                
                return `
                    <div class="comment-item" data-comment-id="${comment._id}">
                        <div class="comment-header">
                            <img class="comment-recipe-image" src="${recipeImage}" 
                                alt="${recipeName}" 
                                onerror="this.src='https://via.placeholder.com/50x50?text=Image+Error'">
                            <div class="comment-info">
                                <h4>${recipeName}</h4>
                                <span class="comment-date">${comment.createdAt ? new Date(comment.createdAt).toLocaleDateString() : 'Unknown date'}</span>
                                ${unavailableWarning}
                            </div>
                        </div>
                        <div class="comment-text">
                            <p id="comment-content-${comment._id}">${comment.text}</p>
                            <textarea id="comment-edit-${comment._id}" class="comment-edit-textarea" style="display: none;">${comment.text}</textarea>
                        </div>
                        <div class="comment-actions">
                            <a href="recipe.html?id=${recipeId}&collection=${collection}" class="view-recipe-link" ${recipe._unavailable ? 'style="opacity: 0.5; pointer-events: none;"' : ''}>View Recipe</a>
                            <div class="comment-buttons">
                                <button class="btn-small" onclick="editComment('${comment._id}')">
                                    <i class="fas fa-edit"></i> Edit
                                </button>
                                <button id="save-${comment._id}" class="btn-small btn-primary" onclick="saveComment('${comment._id}', '${comment.recipeId}', '${comment.collection}')" style="display: none;">
                                    <i class="fas fa-save"></i> Save
                                </button>
                                <button id="cancel-${comment._id}" class="btn-small" onclick="cancelEdit('${comment._id}')" style="display: none;">
                                    <i class="fas fa-times"></i> Cancel
                                </button>
                                <button class="btn-small btn-danger" onclick="deleteComment('${comment._id}', '${comment.recipeId}', '${comment.collection}', this)">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            console.log('No comments found or empty comments array');
            commentsList.innerHTML = '<div class="empty-state">You haven\'t commented on any recipes yet.</div>';
        }
    } catch (error) {
        console.error('Error loading comments:', error);
        document.getElementById('my-comments-list').innerHTML = 
            `<div class="error-state">
                <p>Failed to load your comments. Please try again later.</p>
                <p>Error: ${error.message}</p>
                <button class="btn-primary" onclick="loadMyComments()">Retry</button>
            </div>`;
    }
}

// Edit comment function
window.editComment = function(commentId) {
    // Hide content, show edit textarea
    document.getElementById(`comment-content-${commentId}`).style.display = 'none';
    document.getElementById(`comment-edit-${commentId}`).style.display = 'block';
    
    // Hide edit button, show save and cancel buttons
    const commentItem = document.querySelector(`[data-comment-id="${commentId}"]`);
    const editBtn = commentItem.querySelector('button:nth-child(1)');
    editBtn.style.display = 'none';
    
    document.getElementById(`save-${commentId}`).style.display = 'inline-block';
    document.getElementById(`cancel-${commentId}`).style.display = 'inline-block';
}

// Save edited comment
window.saveComment = async function(commentId, recipeId, collection) {
    const newText = document.getElementById(`comment-edit-${commentId}`).value.trim();
    
    if (!newText) {
        showToast('Comment cannot be empty', 'warning');
        return;
    }
    
    try {
        // Show loading state
        const saveBtn = document.getElementById(`save-${commentId}`);
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        
        // Call API to update comment
        const response = await fetch('/api/recipe/comment/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                commentId,
                recipeId,
                collection,
                text: newText
            }),
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Update displayed comment
            document.getElementById(`comment-content-${commentId}`).textContent = newText;
            
            // Return to view mode
            cancelEdit(commentId);
            
            showToast('Comment updated successfully', 'success');
        } else {
            throw new Error(data.error || 'Failed to update comment');
        }
    } catch (error) {
        console.error('Error updating comment:', error);
        showToast('Failed to update comment', 'error');
        
        // Restore button state
        const saveBtn = document.getElementById(`save-${commentId}`);
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save';
    }
}

// Cancel edit mode
window.cancelEdit = function(commentId) {
    // Show content, hide edit textarea
    document.getElementById(`comment-content-${commentId}`).style.display = 'block';
    document.getElementById(`comment-edit-${commentId}`).style.display = 'none';
    
    // Show edit button, hide save and cancel buttons
    const commentItem = document.querySelector(`[data-comment-id="${commentId}"]`);
    const editBtn = commentItem.querySelector('button:nth-child(1)');
    editBtn.style.display = 'inline-block';
    
    document.getElementById(`save-${commentId}`).style.display = 'none';
    document.getElementById(`cancel-${commentId}`).style.display = 'none';
}

// Delete comment
window.deleteComment = async function(commentId, recipeId, collection, button) {
    const shouldDelete = await requestConfirmation({
        title: 'Delete this comment?',
        message: 'Your comment will be removed from the recipe discussion.',
        confirmText: 'Delete comment',
        cancelText: 'Keep comment',
        danger: true
    });

    if (!shouldDelete) {
        return;
    }
    
    try {
        // Disable the button to prevent multiple clicks
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
        
        // Call API to delete comment
        const response = await fetch('/api/recipe/comment/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                commentId,
                recipeId,
                collection
            }),
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Remove the comment from the UI with animation
            const commentItem = document.querySelector(`[data-comment-id="${commentId}"]`);
            commentItem.classList.add('fade-out');
            
            setTimeout(() => {
                commentItem.remove();
                
                // Check if there are any comments left
                if (document.querySelectorAll('.comment-item').length === 0) {
                    document.getElementById('my-comments-list').innerHTML = 
                        '<div class="empty-state">You haven\'t commented on any recipes yet.</div>';
                }
                
                showToast('Comment deleted successfully', 'success');
            }, 300);
        } else {
            throw new Error(data.error || 'Failed to delete comment');
        }
    } catch (error) {
        console.error('Error deleting comment:', error);
        
        // Restore button state
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-trash"></i> Delete';
        
        showToast('Failed to delete comment', 'error');
    }
}

// Load recipe viewing history
async function loadViewedRecipes() {
    try {
        const viewedGrid = document.getElementById('viewed-recipes-grid');
        viewedGrid.innerHTML = '<div class="loading">Loading your recently viewed recipes...</div>';
        
        const response = await window.RecipifyDB.getViewedRecipes();
        
        if (response.success && response.viewedRecipes && response.viewedRecipes.length > 0) {
            // First clear the container
            viewedGrid.innerHTML = '';
            
            // Add the header with clear button
            const headerDiv = document.createElement('div');
            headerDiv.className = 'viewed-recipes-header';
            headerDiv.innerHTML = `
                <h3>Recently Viewed Recipes</h3>
                <button id="clear-history-btn" class="btn-danger">
                    <i class="fas fa-trash"></i> Clear All History
                </button>
            `;
            viewedGrid.appendChild(headerDiv);
            
            // Create the grid container for recipes
            const recipesContainer = document.createElement('div');
            recipesContainer.className = 'recipes-container';
            
            // Add each recipe with a delete button
            recipesContainer.innerHTML = response.viewedRecipes.map(item => {
                const recipe = item.recipe;
                return `
                    <div class="recipe-card" data-recipe-id="${recipe.id || recipe._id}" data-collection="${recipe.source_collection || item.collection}">
                        <div class="recipe-image">
                            <img src="${recipe.image || recipe.image_url || 'https://via.placeholder.com/300x200?text=No+Image'}" alt="${recipe.name}" 
                                onerror="this.src='https://via.placeholder.com/300x200?text=Image+Error'">
                        </div>
                        <div class="recipe-details">
                            <h3>${recipe.name}</h3>
                            <p class="viewed-date">Viewed: ${new Date(item.viewedAt).toLocaleDateString()}</p>
                            <div class="recipe-actions">
                                <a href="recipe.html?id=${recipe.id || recipe._id}&collection=${recipe.source_collection || item.collection}" class="btn-outline">View Recipe</a>
                                <button class="btn-delete-history" onclick="deleteViewedRecipe('${recipe.id || recipe._id}', '${recipe.source_collection || item.collection}', this)">
                                    <i class="fas fa-trash"></i> Remove
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            // Append the recipes container to the grid
            viewedGrid.appendChild(recipesContainer);
            
            // Add event listener for the clear all button
            document.getElementById('clear-history-btn').addEventListener('click', clearAllViewHistory);
        } else {
            viewedGrid.innerHTML = '<div class="empty-state">You haven\'t viewed any recipes yet.</div>';
        }
    } catch (error) {
        console.error('Error loading viewed recipes:', error);
        document.getElementById('viewed-recipes-grid').innerHTML = 
            '<div class="error-state">Failed to load your viewing history. Please try again later.</div>';
    }
}

// Function to delete a single viewed recipe from history
window.deleteViewedRecipe = async function(recipeId, collection, button) {
    try {
        // Disable the button and show loading state
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Removing...';
        
        // Call RecipifyDB to delete viewing history for this recipe
        const response = await window.RecipifyDB.deleteViewedRecipe(recipeId, collection);
        
        if (response.success) {
            // Remove the recipe card with animation
            const recipeCard = button.closest('.recipe-card');
            recipeCard.classList.add('fade-out');
            
            // After animation completes, remove the element
            setTimeout(() => {
                recipeCard.remove();
                
                // Check if there are any recipes left
                const recipesContainer = document.querySelector('.recipes-container');
                if (recipesContainer && recipesContainer.querySelectorAll('.recipe-card').length === 0) {
                    document.getElementById('viewed-recipes-grid').innerHTML = 
                        '<div class="empty-state">You haven\'t viewed any recipes yet.</div>';
                }
                
                showToast('Recipe removed from history', 'success');
            }, 300);
        } else {
            // Restore button state
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-trash"></i> Remove';
            showToast('Failed to remove recipe from history', 'error');
        }
    } catch (error) {
        console.error('Error deleting viewed recipe:', error);
        // Restore button state
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-trash"></i> Remove';
        showToast('Failed to remove recipe from history', 'error');
    }
}

// Function to clear all viewing history
async function clearAllViewHistory() {
    const shouldClear = await requestConfirmation({
        title: 'Clear viewing history?',
        message: 'This removes your full recently viewed recipe list from the profile.',
        confirmText: 'Clear history',
        cancelText: 'Keep history',
        danger: true
    });

    if (!shouldClear) {
        return;
    }
    
    try {
        // Show loading state
        const viewedGrid = document.getElementById('viewed-recipes-grid');
        viewedGrid.innerHTML = '<div class="loading">Clearing your viewing history...</div>';
        
        // Call RecipifyDB to clear all viewing history
        const response = await window.RecipifyDB.clearViewingHistory();
        
        if (response.success) {
            // Show empty state
            viewedGrid.innerHTML = '<div class="empty-state">You haven\'t viewed any recipes yet.</div>';
            showToast('Viewing history cleared successfully', 'success');
        } else {
            // Reload the recipes to restore the view
            loadViewedRecipes();
            showToast('Failed to clear viewing history', 'error');
        }
    } catch (error) {
        console.error('Error clearing viewing history:', error);
        // Reload the recipes to restore the view
        loadViewedRecipes();
        showToast('Failed to clear viewing history', 'error');
    }
}

// Load meal plans
async function loadMealPlans() {
    try {
        const plansContainer = document.getElementById('meal-plans-list');
        plansContainer.innerHTML = '<div class="loading">Loading your meal plans...</div>';
        
        const response = await window.RecipifyDB.getAllMealPlans();
        
        if (response.success && response.mealPlans && response.mealPlans.length > 0) {
            plansContainer.innerHTML = response.mealPlans.map(plan => {
                return `
                    <div class="meal-plan-card">
                        <div class="meal-plan-header">
                            <h3>${formatDate(plan.date)}</h3>
                            <div class="meal-plan-actions">
                                <a href="meal-planner.html?date=${plan.date}" class="btn-small">Edit</a>
                                <button class="btn-small btn-danger" onclick="deleteMealPlan('${plan.date}')">Delete</button>
                            </div>
                        </div>
                        <div class="meal-plan-content">
                            <div class="meal-section">
                                <h4>Breakfast</h4>
                                <div class="meal-items">
                                    ${renderMealItems(plan.meals.breakfast)}
                                </div>
                            </div>
                            <div class="meal-section">
                                <h4>Lunch</h4>
                                <div class="meal-items">
                                    ${renderMealItems(plan.meals.lunch)}
                                </div>
                            </div>
                            <div class="meal-section">
                                <h4>Dinner</h4>
                                <div class="meal-items">
                                    ${renderMealItems(plan.meals.dinner)}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            plansContainer.innerHTML = '<div class="empty-state">You haven\'t created any meal plans yet.</div>';
        }
    } catch (error) {
        console.error('Error loading meal plans:', error);
        document.getElementById('meal-plans-list').innerHTML = 
            '<div class="error-state">Failed to load your meal plans. Please try again later.</div>';
    }
}

// Load ratings
async function loadMyRatings() {
    try {
        const ratingsContainer = document.getElementById('my-ratings-list');
        ratingsContainer.innerHTML = '<div class="loading">Loading your ratings...</div>';
        
        const response = await window.RecipifyDB.getUserRatings();
        
        if (response.success && response.ratings && response.ratings.length > 0) {
            ratingsContainer.innerHTML = response.ratings.map(rating => {
                const recipe = rating.recipe;
                return `
                    <div class="rating-item">
                        <div class="rating-recipe">
                            <img src="${recipe.image || recipe.image_url || 'https://via.placeholder.com/80x80?text=No+Image'}" 
                                 alt="${recipe.name || 'Recipe'}" 
                                 onerror="this.src='https://via.placeholder.com/80x80?text=Image+Error'">
                            <div class="rating-recipe-details">
                                <h3>${recipe.name || 'Unnamed Recipe'}</h3>
                                <p>Rated on: ${new Date(rating.createdAt).toLocaleDateString()}</p>
                            </div>
                        </div>
                        <div class="rating-stars">
                            ${renderStars(rating.rating)}
                        </div>
                        <a href="recipe.html?id=${recipe.id || recipe._id}&collection=${recipe.source_collection || rating.collection}" class="btn-small">View Recipe</a>
                    </div>
                `;
            }).join('');
        } else {
            ratingsContainer.innerHTML = '<div class="empty-state">You haven\'t rated any recipes yet.</div>';
        }
    } catch (error) {
        console.error('Error loading ratings:', error);
        document.getElementById('my-ratings-list').innerHTML = 
            '<div class="error-state">Failed to load your ratings. Please try again later.</div>';
    }
}

// Delete meal plan
async function deleteMealPlan(date) {
    const shouldDelete = await requestConfirmation({
        title: 'Delete this meal plan?',
        message: 'The saved meal plan for this date will be permanently removed.',
        confirmText: 'Delete meal plan',
        cancelText: 'Keep meal plan',
        danger: true
    });

    if (!shouldDelete) {
        return;
    }

    try {
        const result = await window.RecipifyDB.deleteMealPlan(date);
        if (result.success) {
            loadMealPlans();
            showToast('Meal plan deleted.', 'success');
        } else {
            showToast('Failed to delete the meal plan. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Error deleting meal plan:', error);
        showToast('An error occurred while deleting the meal plan.', 'error');
    }
}

// Helper functions
function formatDate(dateString) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

function renderMealItems(items) {
    if (!items || items.length === 0) {
        return '<p class="empty-meal">No items planned</p>';
    }
    
    return items.map(item => `
        <div class="meal-item">
            <img src="${item.image || 'https://via.placeholder.com/50x50?text=No+Image'}" alt="${item.name}">
            <span>${item.name}</span>
        </div>
    `).join('');
}

function renderStars(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= rating) {
            stars += '<i class="fas fa-star"></i>';
        } else {
            stars += '<i class="far fa-star"></i>';
        }
    }
    return stars;
}

// Handle user logout
function setupLogout() {
    const logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
        logoutLink.addEventListener('click', async function(e) {
            e.preventDefault();
            
            try {
                const response = await fetch('/api/auth/logout', {
                    method: 'POST',
                    credentials: 'include'
                });
                
                if (response.ok) {
                    // Clear any session storage items
                    sessionStorage.removeItem('user');
                    
                    // Redirect to home page
                    window.location.href = 'recipify.html';
                } else {
                    console.error('Logout failed');
                    showToast('Logout failed. Please try again.', 'error');
                }
            } catch (error) {
                console.error('Error during logout:', error);
                showToast('An error occurred during logout. Please try again.', 'error');
            }
        });
    }
}

// Initialize when document is loaded
document.addEventListener('DOMContentLoaded', async function() {
    // Check if user is authenticated
    const authStatus = await window.RecipifyDB.checkAuth();
    console.log('Authentication status:', authStatus);
    
    if (!authStatus.isAuthenticated) {
        console.error('User is not authenticated, redirecting to login page');
        window.location.href = 'login.html';
        return;
    }
    
    // Load user profile data
    await loadUserProfile();
    
    // Set up tab navigation
    setupTabNavigation();
    
    // Set up profile photo upload
    setupProfilePhotoUpload();
    
    // Set up logout functionality
    setupLogout();
    setupMyRecipeBulkActions();
    
    // Load initial tab content
    await loadMyRecipeAnalytics();
    await loadMyRecipes();
    
    // Set up settings form submission
    const profileSettingsForm = document.getElementById('profile-settings-form');
    if (profileSettingsForm) {
        profileSettingsForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            try {
                // Disable submit button to prevent multiple submissions
                const submitButton = this.querySelector('button[type="submit"]');
                if (submitButton) {
                    submitButton.disabled = true;
                    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
                }
                
                // Get form data
                const formData = new FormData(this);
                const profileData = {
                    firstName: formData.get('firstName'),
                    lastName: formData.get('lastName'),
                    bio: formData.get('bio')
                };
                
                console.log('Submitting profile data:', profileData);
                
                // Send update to API
                const response = await window.RecipifyDB.updateProfileSettings(profileData);
                
                console.log('Profile update response:', response);
                
                if (response.success) {
                    showToast('Profile settings updated successfully', 'success');
                    
                    // Update displayed name in profile
                    const profileName = document.getElementById('profile-name');
                    if (profileName) {
                        const fullName = `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim();
                        profileName.textContent = fullName || 'User';
                    }
                    
                    // Update bio in profile
                    const profileBio = document.getElementById('profile-bio');
                    if (profileBio) {
                        profileBio.textContent = profileData.bio || 'No bio provided';
                    }
                } else {
                    showToast('Failed to update profile settings', 'error');
                    console.error('Error updating profile:', response.error);
                }
            } catch (error) {
                console.error('Error submitting profile form:', error);
                showToast('An error occurred while updating profile', 'error');
            } finally {
                // Re-enable submit button
                const submitButton = this.querySelector('button[type="submit"]');
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.innerHTML = 'Save Changes';
                }
            }
        });
    }
    
    // Set up preferences form submission
    const preferencesForm = document.getElementById('recipe-preferences-form');
    if (preferencesForm) {
        preferencesForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            try {
                // Disable submit button to prevent multiple submissions
                const submitButton = this.querySelector('button[type="submit"]');
                if (submitButton) {
                    submitButton.disabled = true;
                    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
                }
                
                // Get dietary preferences
                const dietCheckboxes = this.querySelectorAll('input[name="diet"]:checked');
                const dietPreferences = Array.from(dietCheckboxes).map(checkbox => checkbox.value);
                
                console.log('Submitting diet preferences:', { diet: dietPreferences });
                
                // Send update to API
                const response = await window.RecipifyDB.updateUserPreferences({
                    diet: dietPreferences
                });
                
                console.log('Preferences update response:', response);
                
                if (response.success) {
                    showToast('Recipe preferences updated successfully', 'success');
                } else {
                    showToast('Failed to update preferences', 'error');
                    console.error('Error updating preferences:', response.error);
                }
            } catch (error) {
                console.error('Error submitting preferences form:', error);
                showToast('An error occurred while updating preferences', 'error');
            } finally {
                // Re-enable submit button
                const submitButton = this.querySelector('button[type="submit"]');
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.innerHTML = 'Save Preferences';
                }
            }
        });
    }
});
