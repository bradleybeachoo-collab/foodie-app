# Foodie

**Bradley Beachoo — React Native final project**

Foodie is a React Native recipe app built with Expo SDK 54. Browse 24 sample recipes across 12 food categories, search by name, save favorites, and add recipes with your own photos. The code uses React state, simple components, and AsyncStorage.

## Run locally

Install Node.js and npm, then open a terminal in the `FoodieApp` folder:

```sh
npm install
npm start
```

To open the browser version directly:

```sh
npm run web
```

The Expo terminal also offers Android and iOS options. A phone needs an Expo Go version compatible with SDK 54; native-device testing has not been completed for this project.

## Open in Expo Snack

1. Visit [Expo Snack](https://snack.expo.dev/).
2. Open the project menu and choose **Import Git Repository**.
3. Paste `https://github.com/bradleybeachoo-collab/foodie-app` and import the project.
4. Select **Expo SDK 54**, allow the dependencies to load, and open the **Web** preview.

Keep `App.js` at the repository root and preserve the `src` folder. The repository was successfully imported with **Import Git Repository** and runs in Snack's Web preview with **No errors**.

[Open the imported app in Snack](https://snack.expo.dev/@git/github.com/bradleybeachoo-collab/foodie-app)

## Files to explore

| File | Purpose |
| --- | --- |
| `App.js` | Recipe feed, search, filters, details, favorites, navigation, and saved data. |
| `src/RecipeForm.js` | Add/edit form, photo selection, and input validation. |
| `src/recipes.js` | The 12 categories and 24 sample recipes. |
| `index.js` | Starts the app for local Expo development. |
| `app.json` | App settings and image-picker permissions. |
| `package.json` | Dependencies and run commands. |

## Feature walkthrough

1. Browse **All recipes**, search for a recipe, or select a category. **Pasta** shows two sample recipes.
2. Open a recipe to see its photo, ingredients, instructions, preparation time, servings, estimated calories, and difficulty. Use **Back** to return.
3. Tap a heart to add a recipe to **Favorites**. Tap it again to remove it, then reload to check that the saved selection remains.
4. Select **My Food**, then **Add New Recipe**. Enter the recipe details, choose a photo, and save. Your recipe appears under **My Recipes**.
5. Open your recipe and use **Edit Recipe** to change it. Save, reload, and check that the changes and photo remain.
6. Use **Delete Recipe**. **Cancel** keeps the recipe; confirming deletion removes it from both My Recipes and Favorites.

## Storage and testing notes

Recipes and favorites are stored only on the current device or browser using AsyncStorage. There is no account, backend, or cross-device sync. Clearing app/browser storage removes saved data.

Use photos of about **1 MB or less**. The stored photo is limited to 1.5 million characters, and the complete saved collection is limited to **1.8 million characters**. Smaller photos leave room for more recipes. Sample photos load remotely from Unsplash and require an internet connection. Calorie values are estimates per serving.

Local browser checks passed for category filtering, recipe details, Back navigation, favorite changes and persistence, photo upload, adding and editing recipes, and deletion with confirmation. A 42 KB JPEG remained visible after editing and reloading. Deleting its recipe also removed its favorite and remained deleted after another reload. Expo dependency checks and the web export passed.

Snack's repository import, Web launch, category filtering, recipe details, Back, and favorites were also checked. The embedded Snack photo chooser could not be controlled by the browser test tool, so its upload flow is unverified there. Native Android and iOS devices have not been tested.
