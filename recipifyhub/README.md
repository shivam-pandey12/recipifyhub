# RecipifyHub

RecipifyHub is a modern, futuristic recipe management and cooking assistant web application. It provides a seamless experience for discovering, creating, and cooking recipes with advanced features like nutrition analysis and hands-free cooking mode. The application also includes a restaurant database with thousands of real restaurant entries.

## Features

- **Recipe Management**: Browse, create, search, and filter recipes
- **Nutrition Analysis**: Analyze the nutritional content of recipes 
- **Cook Mode**: Step-by-step cooking guide with built-in timers and voice control
- **Restaurant Database**: Access to thousands of restaurants with ratings and locations
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **User Profiles**: Create and manage user profiles
- **Theme System**: Switch between different visual themes including modern and classic designs

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express
- **Database**: MongoDB Atlas for preloaded recipe catalogue data, Firebase Auth + Firestore for accounts and user-owned app data
- **API Integrations**: Edamam Nutrition Analysis API

## Setup

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- MongoDB account for the preloaded recipe/restaurant collections
- Firebase project with Auth and Firestore enabled for accounts, saved recipes, user recipes, comments, ratings, history, profiles, and meal plans

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/recipifyhub.git
cd recipifyhub
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser and navigate to:
```
http://localhost:3000
```

## Development

For development with hot reloading:
```bash
npm run dev
```

## Theme System

RecipifyHub includes a customizable theme system:

- **Default Theme**: Modern design with purple accents
- **Classic Theme**: Elegant blue and gold design with classic styling

Users can switch between themes using the theme switcher in the bottom-left corner of every page. Theme preferences are saved in localStorage for a consistent experience.

### Adding New Themes

To create a new theme:

1. Create a new CSS file (e.g., `theme-dark.css`)
2. Override the CSS variables and add theme-specific styles
3. Add the theme option to the `theme-switcher.js` file

## Database Structure

The application now uses a hybrid data split:

1. **MongoDB `recipify_hub`** - Preloaded recipe catalogue collections only
2. **MongoDB `sample_restaurants`** - Restaurant sample data
3. **Firebase Auth + Firestore** - Login accounts, profiles, user-created recipes, saved recipes, comments, ratings, history, meal plans, and metrics

## API Endpoints

### Recipes
- `GET /recipes` - Get all recipes
- `GET /recipes/:id` - Get a single recipe by ID
- `POST /saveRecipe` - Create a new recipe
- `PUT /recipes/:id` - Update a recipe
- `DELETE /recipes/:id` - Delete a recipe
- `GET /recipes/filter` - Filter recipes by cuisine, course, diet, etc.
- `GET /recipes/search/:query` - Search recipes by name, description, ingredients, etc.

### Profiles
- `GET /getProfile` - Get a user profile by username
- `POST /saveProfile` - Create or update a user profile

### Restaurants
- `GET /restaurants` - Get paginated list of restaurants
- `GET /restaurants/:id` - Get a single restaurant by ID
- `GET /restaurants/search/:query` - Search restaurants by name, cuisine, or borough
- `GET /restaurants/cuisine/:cuisine` - Filter restaurants by cuisine type
- `GET /restaurants/top-rated/:limit` - Get top-rated restaurants (limit parameter sets the number of results)

## File Structure

```
recipifyhub/
├── components.js            # Reusable UI components
├── styles.css               # Global styles and default theme
├── theme-classic.css        # Classic theme styles
├── theme-switcher.js        # Theme switching functionality
├── server.js                # Express server and API endpoints
├── allrecipe.html           # Recipe listing page
├── recipe.html              # Recipe detail page
├── recipe_input.html        # Recipe creation page
├── nutritionanalysis.html   # Nutrition analysis page
├── cookmode.html            # Hands-free cooking mode
├── dashboard.html           # User dashboard
├── profile.html             # User profile page
└── package.json             # Project dependencies
```

## License

This project is licensed under the MIT License.

## Acknowledgements

- Recipe images from Unsplash
- Icons from Font Awesome
- Nutrition data from Edamam API
- Restaurant data from MongoDB sample datasets 

# RecipifyHub - Recipe Database Integration

This update integrates the RecipifyHub frontend with MongoDB database collections for recipe data.

## Features Added

1. **Database Integration**
   - Created a client-side database integration layer (`db-integration.js`)
   - Added server API endpoints for fetching recipes from MongoDB
   - Updated recipe components to work with various data schemas

2. **Recipe Listing Page**
   - Enhanced `allrecipe.html` to fetch recipes from multiple collections
   - Added filters for cuisine, recipe type, and search functionality
   - Implemented pagination with "Load More" button

3. **Recipe Detail Page**
   - Created a dynamic recipe detail page that fetches from the database
   - Added support for various recipe data formats
   - Enhanced UI with ingredient checklist, step-by-step instructions
   - Added video embedding when available

## Using the Recipe Features

1. **Browsing Recipes**
   - Navigate to the Recipes page from the main menu
   - Use filters to narrow down recipes by type (All, Videos, Quick & Easy, etc.)
   - Use the cuisine dropdown to filter by specific cuisines
   - Use the search bar to find recipes by name or ingredients

2. **Viewing a Recipe**
   - Click on any recipe card to view the full details
   - Check off ingredients as you use them
   - Follow the step-by-step instructions
   - Use the Cook Mode button to enter a distraction-free cooking interface
   - Print the recipe using the Print button

3. **Database Collections**
   - The application pulls from multiple recipe collections:
     - `recipe_with_serving`: Standard recipes with serving information
     - `recipe_with_video`: Recipes that include video tutorials
     - `baking`: Baking-specific recipes
     - `food_recipe`: General food recipes
   - `user_recipes`: User-submitted recipes stored in Firestore

## Technical Implementation

The database integration uses a modular approach:

1. `db-integration.js`: Client-side API interface
2. `server.js`: Server-side API endpoints and database connections
3. `components.js`: UI components that render recipe data

Recipe data is normalized to handle different schema formats from various collections.

## Starting the Application

1. Start the MongoDB server
2. Run the RecipifyHub server: `node server.js`
3. Open `recipify.html` in your browser to access the application

## API Endpoints

- `GET /api/recipe/:id`: Fetch a recipe by ID
- `POST /api/recipes`: Get recipes with pagination
- `GET /api/search-recipes`: Search across all recipe collections 

# RecipifyHub - Authentication System

## Authentication Features Added

This update adds a complete user authentication system to RecipifyHub:

1. **User Authentication**
   - User registration with password hashing
   - Login with session management
   - Logout functionality
   - Protected routes
   - **Google Sign-In** integration

2. **Profile Integration**
   - Profile page linked to user account
   - Session storage for user data
   - Login state reflected in the navigation

3. **Database Integration**
   - Firebase Auth for email/password and Google-backed accounts
   - Firestore for user profiles and app-owned user data
   - Session management with cookies

## Using the Authentication System

1. **Registration**
   - Visit the login page and switch to the Register tab
   - Fill in your details (username, email, password, etc.)
   - Or use the "Sign up with Google" button for faster registration
   - Upon successful registration, you'll be automatically logged in

2. **Login**
   - Enter your username and password on the login page
   - Or click the "Sign in with Google" button for one-click login
   - Your session will be remembered using cookies
   - The navbar will update to show your profile link

3. **Google Authentication**
   - Click the "Sign in with Google" button
   - Select your Google account
   - Grant permissions if prompted
   - You'll be automatically logged in and redirected to your profile

4. **Profile Management**
   - Access your profile page when logged in
   - Update personal information, preferences, and settings
   - Upload a profile picture

5. **Logout**
   - Click the logout button on your profile page
   - Your session will be cleared
   - You'll be redirected to the login page

## Technical Implementation

The authentication system uses:

1. **Backend**
   - Express.js server routes
   - Firebase Auth for account storage and password verification
   - Firestore for user data storage
   - express-session and cookie-parser for session management
   - Firebase Admin ID-token verification for Google login

2. **Frontend**
   - Firebase Auth Google provider
   - Firebase ID token handoff to the backend session
   - Session storage for client-side user data
   - Dynamic UI updates based on login state
   - Form validation for registration and login

## API Endpoints

- `POST /api/auth/register`: Register a new user
- `POST /api/auth/login`: Log in an existing user
- `GET /api/auth/firebase-config`: Fetch public Firebase web auth config
- `POST /api/auth/firebase-login`: Authenticate with a verified Firebase ID token
- `GET /api/auth/user`: Get the current user's information
- `POST /api/auth/logout`: Log out the current user

## Database Schema

The User schema includes:

- username (unique)
- email (unique)
- password (hashed)
- firstName
- lastName
- googleId (for Google authentication)
- authType ('local' or 'google')
- profileImageUrl
- preferences (measurement, temperature, skillLevel, diet)
- createdAt
- lastLogin

## Setting Up Firebase

Add Firebase server and web auth configuration to `.env`:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=replace-with-private-key-using-escaped-newlines
FIREBASE_WEB_API_KEY=your-firebase-web-api-key
FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
```

`FIREBASE_AUTH_DOMAIN` is optional when it follows the default `your-project-id.firebaseapp.com` pattern. Alternatively, set `GOOGLE_APPLICATION_CREDENTIALS` to a Firebase service-account JSON file path. `FIREBASE_WEB_API_KEY` is still required for username/email password login and browser Google login through Firebase Auth.

## Setting Up Google Sign-In

Google login now uses Firebase Authentication directly. You do not need to add a `GOOGLE_CLIENT_ID` to this app for the normal login flow.

1. Open Firebase Console > Authentication > Sign-in method.
2. Enable Google as a provider.
3. Open Firebase Console > Authentication > Settings > Authorized domains.
4. Add your local and deployed domains, such as `localhost`.
5. Restart the server so `/api/auth/firebase-config` can expose the public Firebase web config to `login.html`.

## Production And Hosting

The app is ready for Node hosting from the `recipifyhub` folder.

```bash
npm ci
npm run check
npm start
```

Required production environment variables are listed in `.env.example`. Keep `.env`, service-account JSON files, `node_modules`, and logs out of Git.

Useful deployment files:

- `../render.yaml` for Render web service deployment.
- `../Procfile` for Procfile-based hosts.
- `../DEPLOYMENT.md` for the full deploy checklist.
- `/api/health` for hosting health checks.

For production, set `NODE_ENV=production`, `TRUST_PROXY=true`, and `CORS_ORIGINS` to your real deployed origin.
