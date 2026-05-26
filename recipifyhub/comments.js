/**
 * RecipifyHub Comments and Ratings Module
 */

// Global variables
let currentRecipeId = null;
let currentCollection = null;

function showFeedback(message, type = 'info') {
    if (window.RecipifyComponents && typeof window.RecipifyComponents.showToast === 'function') {
        window.RecipifyComponents.showToast(message, type);
        return;
    }

    console[type === 'error' ? 'error' : 'log'](message);
}

// Initialize the comments and ratings system
function initCommentsAndRatings() {
    console.log('Initializing RecipifyComments module...');
    
    // Get recipe ID and collection from global variables
    if (window.currentRecipeId && window.currentCollection) {
        currentRecipeId = window.currentRecipeId;
        currentCollection = window.currentCollection;
        console.log('Using global variables: recipeId =', currentRecipeId, 'collection =', currentCollection);
    } else {
        // Fallback to URL parameters
        const params = new URLSearchParams(window.location.search);
        currentRecipeId = params.get('id');
        currentCollection = params.get('collection');
        console.log('Using URL parameters: recipeId =', currentRecipeId, 'collection =', currentCollection);
    }
    
    if (!currentRecipeId || !currentCollection) {
        console.error('Missing recipe ID or collection for comments/ratings');
        return;
    }

    console.log('Recipe data for comments:', {
        recipeId: currentRecipeId,
        collection: currentCollection,
        commentsListElement: document.getElementById('comments-list') ? 'Found' : 'Not found',
        commentsStatusElement: document.getElementById('comments-status') ? 'Found' : 'Not found',
        commentInputElement: document.getElementById('comment-input') ? 'Found' : 'Not found',
        submitButtonElement: document.getElementById('submit-comment') ? 'Found' : 'Not found'
    });

    // Check authentication status
    checkUserAuth();
    
    // Set up event listeners
    setupCommentForm();
    setupRatingStars();
    
    // Load initial data
    loadComments();
    loadRatings();
}

// Check authentication status
function checkUserAuth() {
    console.log('Checking user authentication...');
    fetch('/api/auth/check-auth')
        .then(response => {
            console.log('Auth check status code:', response.status);
            return response.json();
        })
        .then(data => {
            console.log('Auth check response:', data);
            if (data.isAuthenticated) {
                // User is authenticated
                window.currentUserId = data.userId;
                window.currentUsername = data.username;
                console.log('User authenticated! User ID:', data.userId, 'Username:', data.username);
                updateCommentFormState(true);
            } else {
                // User is not authenticated
                window.currentUserId = null;
                window.currentUsername = null;
                console.log('User is not authenticated');
                updateCommentFormState(false);
            }
        })
        .catch(error => {
            console.error('Error checking authentication:', error);
            updateCommentFormState(false);
        });
}

// Update comment form based on authentication status
function updateCommentFormState(isAuthenticated) {
    const commentTextarea = document.getElementById('comment-input');
    const commentButton = document.getElementById('submit-comment');
    const commentForm = document.querySelector('.comment-form');
    
    if (!commentTextarea || !commentButton || !commentForm) {
        return;
    }
    
    if (isAuthenticated) {
        commentTextarea.disabled = false;
        commentTextarea.placeholder = 'Share your thoughts about this recipe...';
        commentButton.disabled = false;
        
        if (commentForm.querySelector('.login-reminder')) {
            commentForm.querySelector('.login-reminder').remove();
        }
    } else {
        commentTextarea.disabled = true;
        commentTextarea.placeholder = 'Please log in to comment on recipes';
        commentButton.disabled = true;
        
        if (!commentForm.querySelector('.login-reminder')) {
            const loginReminder = document.createElement('div');
            loginReminder.className = 'login-reminder';
            loginReminder.innerHTML = '<i class="fas fa-info-circle"></i> <a href="/login">Log in or register</a> to comment on recipes';
            loginReminder.style.marginTop = '10px';
            loginReminder.style.textAlign = 'center';
            loginReminder.style.color = 'var(--dark)';
            commentForm.appendChild(loginReminder);
        }
    }
}

// Set up comment form submission
function setupCommentForm() {
    const submitButton = document.getElementById('submit-comment');
    const commentInput = document.getElementById('comment-input');
    
    if (!submitButton || !commentInput) {
        console.error('Comment form elements not found');
        return;
    }
    
    submitButton.addEventListener('click', async function() {
        const commentText = commentInput.value.trim();
        
        if (!commentText) {
            return;
        }
        
        // Disable form during submission
        commentInput.disabled = true;
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';
        
        try {
            const result = await window.RecipifyDB.addComment(
                currentRecipeId, 
                commentText, 
                currentCollection
            );
            
            if (result.success) {
                // Clear input and reload comments
                commentInput.value = '';
                await loadComments();
                
                // Scroll to comments section
                const commentsContainer = document.querySelector('.comments-container');
                if (commentsContainer) {
                    commentsContainer.scrollIntoView({ behavior: 'smooth' });
                }
            } else {
                showFeedback(result.error || 'Failed to post comment. Please try again.', 'error');
            }
        } catch (error) {
            console.error('Error posting comment:', error);
            showFeedback('An error occurred while posting your comment. Please try again.', 'error');
        } finally {
            // Re-enable form
            checkUserAuth(); // This will re-adjust the form based on auth state
        }
    });
}

// Load comments for the current recipe
async function loadComments() {
    console.log('Loading comments for recipeId:', currentRecipeId, 'collection:', currentCollection);
    
    const commentsList = document.getElementById('comments-list');
    const commentsStatus = document.getElementById('comments-status');
    
    if (!commentsList || !commentsStatus) {
        console.error('Comments container elements not found:', {
            commentsList: !!commentsList,
            commentsStatus: !!commentsStatus
        });
        return;
    }
    
    // Show loading indicator
    commentsStatus.style.display = 'flex';
    commentsList.style.display = 'none';
    
    try {
        console.log('Calling API:', `${window.RecipifyDB ? 'RecipifyDB available' : 'RecipifyDB missing'}`);
        
        const response = await window.RecipifyDB.getComments(
            currentRecipeId, 
            currentCollection
        );
        
        console.log('Comments API response:', response);
        
        // Hide loading indicator
        commentsStatus.style.display = 'none';
        commentsList.style.display = 'block';
        
        if (response.success) {
            displayComments(response.data);
        } else {
            // Show error message
            commentsList.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>${response.error || 'Failed to load comments. Please try again later.'}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading comments:', error);
        
        // Hide loading indicator and show error
        commentsStatus.style.display = 'none';
        commentsList.style.display = 'block';
        
        commentsList.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <p>An error occurred while loading comments.</p>
            </div>
        `;
    }
}

// Display comments in the DOM
function displayComments(comments) {
    const commentsList = document.getElementById('comments-list');
    const commentCount = document.getElementById('comment-count');
    
    if (!commentsList) {
        return;
    }
    
    // Update comment count
    if (commentCount) {
        commentCount.textContent = `(${comments.length})`;
    }
    
    if (comments.length === 0) {
        commentsList.innerHTML = `
            <div class="no-comments-message">
                <p>No comments yet. Be the first to share your thoughts!</p>
            </div>
        `;
        return;
    }
    
    // Generate comment HTML
    commentsList.innerHTML = comments.map(comment => {
        // Format author name
        const authorName = comment.userName || comment.userId || 'Anonymous';
        
        // Format date
        let dateDisplay = 'Just now';
        if (comment.createdAt) {
            try {
                const commentDate = new Date(comment.createdAt);
                dateDisplay = commentDate.toLocaleDateString(undefined, { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            } catch (e) {
                console.error('Error formatting date:', e);
            }
        }
        
        return `
            <div class="comment-item">
                <div class="comment-header">
                    <span class="comment-author"><i class="fas fa-user-circle"></i> ${authorName}</span>
                    <span class="comment-date"><i class="far fa-clock"></i> ${dateDisplay}</span>
                </div>
                <div class="comment-text">${comment.text}</div>
            </div>
        `;
    }).join('');
}

// Set up rating stars interaction
function setupRatingStars() {
    const ratingStars = document.querySelectorAll('.rating-stars i');
    
    if (!ratingStars.length) {
        console.error('Rating stars not found');
        return;
    }
    
    ratingStars.forEach(star => {
        // Handle hover effects
        star.addEventListener('mouseenter', () => {
            const rating = parseInt(star.dataset.rating);
            ratingStars.forEach(s => {
                const r = parseInt(s.dataset.rating);
                if (r <= rating) {
                    s.classList.add('hovered');
                } else {
                    s.classList.remove('hovered');
                }
            });
        });
        
        star.addEventListener('mouseleave', () => {
            ratingStars.forEach(s => {
                s.classList.remove('hovered');
            });
        });
        
        // Handle click to rate
        star.addEventListener('click', async () => {
            const rating = parseInt(star.dataset.rating);
            
            try {
                const authCheck = await window.RecipifyDB.checkAuth();
                
                if (!authCheck.isAuthenticated) {
                    showFeedback('Please log in to rate this recipe.', 'info');
                    return;
                }
                
                const result = await window.RecipifyDB.rateRecipe(
                    currentRecipeId, 
                    rating, 
                    currentCollection
                );
                
                if (result.success) {
                    updateRatingDisplay(result.data);
                    showFeedback('Your rating was saved.', 'success');
                } else {
                    showFeedback(result.error || 'Failed to rate recipe. Please try again.', 'error');
                }
            } catch (error) {
                console.error('Error rating recipe:', error);
                showFeedback('An error occurred while rating. Please try again.', 'error');
            }
        });
    });
}

// Load ratings for the current recipe
async function loadRatings() {
    try {
        const response = await window.RecipifyDB.getRatings(
            currentRecipeId, 
            currentCollection
        );
        
        if (response.success) {
            updateRatingDisplay(response.data);
        } else {
            console.error('Error loading ratings:', response.error);
        }
    } catch (error) {
        console.error('Error loading ratings:', error);
    }
}

// Update rating display in the DOM
function updateRatingDisplay(data) {
    const averageRatingElement = document.getElementById('average-rating');
    const ratingCountElement = document.getElementById('rating-count');
    const ratingStars = document.querySelectorAll('.rating-stars i');
    
    if (!averageRatingElement || !ratingCountElement || !ratingStars.length) {
        return;
    }
    
    // Update average display
    averageRatingElement.textContent = data.averageRating.toFixed(1);
    ratingCountElement.textContent = data.ratings.length;
    
    // Fill stars based on average rating
    const averageRounded = Math.round(data.averageRating);
    ratingStars.forEach(star => {
        const rating = parseInt(star.dataset.rating);
        if (rating <= averageRounded) {
            star.classList.add('active');
        } else {
            star.classList.remove('active');
        }
    });
    
    // Highlight user's rating if they've rated
    if (data.userRating) {
        ratingStars.forEach(star => {
            const rating = parseInt(star.dataset.rating);
            if (rating <= data.userRating) {
                star.classList.add('user-rated');
            } else {
                star.classList.remove('user-rated');
            }
        });
    }
}

// Expose to global scope
window.RecipifyComments = {
    init: initCommentsAndRatings,
    loadComments,
    loadRatings,
    checkAuth: checkUserAuth
}; 

