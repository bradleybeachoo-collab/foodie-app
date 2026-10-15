import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, BackHandler, FlatList, Image, Modal, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RecipeForm from './src/RecipeForm';
import { CATEGORIES, SEED_RECIPES } from './src/recipes';

const STORAGE_KEY = 'foodie-recipes-v1';
const HOME = { name: 'feed', category: 'All' };

function Foodie() {
  const [route, setRoute] = useState(HOME);
  const [history, setHistory] = useState([]);
  const [myRecipes, setMyRecipes] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [search, setSearch] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [deleteRecipe, setDeleteRecipe] = useState(null);
  const saveInProgress = useRef(false);
  const loadInProgress = useRef(false);
  const { width } = useWindowDimensions();
  const columns = width >= 650 ? 2 : 1;

  // Remeber recipes and favorites on this device between visits.
  async function loadRecipes() {
    if (loadInProgress.current) return;
    loadInProgress.current = true;
    setLoaded(false);
    setLoadError('');
    try {
      const text = await AsyncStorage.getItem(STORAGE_KEY);
      const saved = text ? JSON.parse(text) : { myRecipes: [], favoriteIds: [] };
      if (!saved || !Array.isArray(saved.myRecipes) || !Array.isArray(saved.favoriteIds)) {
        throw new Error('Saved recipes have an unexpected format.');
      }
      setMyRecipes(saved.myRecipes);
      setFavoriteIds(saved.favoriteIds);
      setLoaded(true);
    } catch (error) {
      setLoadError('Your saved recipes could not be loaded. Please retry. Your saved data has not been changed.');
    } finally {
      loadInProgress.current = false;
    }
  }

  useEffect(() => {
    loadRecipes();
  }, []);

  function navigate(next) {
    setHistory((oldHistory) => [...oldHistory, route]);
    setRoute(next);
    setMessage('');
  }

  const goBack = useCallback(() => {
    if (saving) return;
    setDeleteRecipe(null);
    setMessage('');
    if (history.length > 0) {
      setRoute(history[history.length - 1]);
      setHistory(history.slice(0, -1));
    } else {
      setRoute(HOME);
      setSearch('');
    }
  }, [saving, history]);

  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (deleteRecipe) {
        setDeleteRecipe(null);
        return true;
      }
      if (history.length > 0 || route.name !== 'feed' || route.category !== 'All') {
        goBack();
        return true;
      }
      return false;
    });
    return () => listener.remove();
  }, [history, route, goBack, deleteRecipe]);

  // Save before leaving the form so a storage error does not lose typed work.
  async function saveData(nextRecipes, nextFavorites) {
    if (!loaded || saveInProgress.current) return false;
    saveInProgress.current = true;
    setSaving(true);
    try {
      const savedText = JSON.stringify({
        myRecipes: nextRecipes,
        favoriteIds: nextFavorites,
      });
      // Keep this small enough to read back on Android as well as the web.
      if (savedText.length > 1800000) {
        setMessage('Your recipe collection is getting too large. Use a smaller photo or remove an old recipe, then try again.');
        return false;
      }
      await AsyncStorage.setItem(STORAGE_KEY, savedText);
      setMyRecipes(nextRecipes);
      setFavoriteIds(nextFavorites);
      return true;
    } catch (error) {
      setMessage('Could not save. Try a smaller photo or free up some device storage.');
      return false;
    } finally {
      saveInProgress.current = false;
      setSaving(false);
    }
  }

  async function toggleFavorite(id) {
    if (saving) return;
    const next = favoriteIds.includes(id)
      ? favoriteIds.filter((favoriteId) => favoriteId !== id)
      : [...favoriteIds, id];
    await saveData(myRecipes, next);
  }

  async function saveRecipe(values) {
    if (saving) return;
    const editing = route.name === 'edit';
    const recipe = {
      ...values,
      id: editing ? route.id : 'my-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      author: 'You',
    };
    const next = editing
      ? myRecipes.map((item) => item.id === recipe.id ? recipe : item)
      : [recipe, ...myRecipes];
    if (await saveData(next, favoriteIds)) {
      setRoute({ name: 'feed', category: 'My Food' });
      setHistory([HOME]);
      setSearch('');
      setMessage(editing ? 'Recipe updated.' : 'Recipe saved. Time to get cooking!');
    }
  }

  async function confirmDelete() {
    if (!deleteRecipe || saving) return;
    const id = deleteRecipe.id;
    const nextRecipes = myRecipes.filter((recipe) => recipe.id !== id);
    const nextFavorites = favoriteIds.filter((favoriteId) => favoriteId !== id);
    if (await saveData(nextRecipes, nextFavorites)) {
      setDeleteRecipe(null);
      setHistory([HOME]);
      setRoute({ name: 'feed', category: 'My Food' });
      setMessage('Recipe deleted.');
    }
  }

  const allRecipes = [...myRecipes, ...SEED_RECIPES];
  const selectedRecipe = allRecipes.find((recipe) => recipe.id === route.id);
  const isMine = route.category === 'My Food';
  const isFavorites = route.category === 'Favorites';
  let visibleRecipes = allRecipes;
  if (isMine) visibleRecipes = myRecipes;
  else if (isFavorites) visibleRecipes = allRecipes.filter((recipe) => favoriteIds.includes(recipe.id));
  else if (route.category && route.category !== 'All') {
    visibleRecipes = allRecipes.filter((recipe) => recipe.category === route.category);
  }
  visibleRecipes = visibleRecipes.filter((recipe) => recipe.title.toLowerCase().includes(search.trim().toLowerCase()));

  function chooseCategory(category) {
    if (route.category === category) return;
    setSearch('');
    navigate({ name: 'feed', category });
  }

  const pageTitle = route.name === 'details' ? 'Recipe details'
    : route.name === 'add' ? 'Add New Recipe'
      : route.name === 'edit' ? 'Edit Recipe' : 'Foodie';
  const canGoBack = history.length > 0 || route.name !== 'feed' || route.category !== 'All';

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.app}>
        <View style={styles.header}>
          <Pressable onPress={goBack} disabled={!canGoBack || saving} accessibilityRole="button"
            accessibilityLabel="Back" style={[styles.back, !canGoBack && styles.disabled]}>
            <Ionicons name="arrow-back" size={20} color="#28221e" />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <View style={styles.brand}>
            {route.name === 'feed' && <Ionicons name="restaurant-outline" size={23} color="#df6b36" />}
            <Text style={styles.headerTitle}>{pageTitle}</Text>
          </View>
          <View style={{ width: 65 }} />
        </View>

        {!!message && <Pressable onPress={() => setMessage('')} style={styles.message}
          accessibilityRole="button" accessibilityLabel={'Dismiss message: ' + message}>
          <Text style={styles.messageText}>{message}</Text>
          <Ionicons name="close" size={18} color="#6d4e32" />
        </Pressable>}

        {!loaded ? <View style={[styles.center, { padding: 24 }]}>
          {loadError ? <>
            <Text style={[styles.muted, { textAlign: 'center' }]} accessibilityRole="alert">{loadError}</Text>
            <Pressable onPress={loadRecipes} style={styles.addButton} accessibilityRole="button" accessibilityLabel="Retry loading recipes">
              <Ionicons name="refresh-outline" size={18} color="white" /><Text style={styles.addText}>Retry</Text>
            </Pressable>
          </> : <><ActivityIndicator color="#df6b36" /><Text>Loading recipes...</Text></>}
        </View>
          : route.name === 'add' || route.name === 'edit' ? (
            <RecipeForm key={route.name + (route.id || '')} recipe={selectedRecipe}
              onSave={saveRecipe} onCancel={goBack} saving={saving} />
          ) : route.name === 'details' ? (
            selectedRecipe ? <RecipeDetails recipe={selectedRecipe} favorite={favoriteIds.includes(selectedRecipe.id)}
              toggleFavorite={() => toggleFavorite(selectedRecipe.id)} saving={saving}
              ownRecipe={myRecipes.some((recipe) => recipe.id === selectedRecipe.id)}
              onEdit={() => navigate({ name: 'edit', id: selectedRecipe.id })}
              onDelete={() => setDeleteRecipe(selectedRecipe)} />
              : <View style={styles.center}><Text>This recipe is no longer available.</Text>
                <Pressable onPress={goBack}><Text style={styles.link}>Go back</Text></Pressable></View>
          ) : (
            <View style={styles.feed}>
              <View style={styles.intro}>
                <Text style={styles.categoryLabel}>Bradley Beachoo's recipe book</Text>
                <Text style={styles.heading}>What sounds good today?</Text>
                <Text style={styles.muted}>Find a recipe, save a favorite, or add one of your own.</Text>
                <View style={styles.search}>
                  <Ionicons name="search-outline" size={21} color="#72675f" />
                  <TextInput value={search} onChangeText={setSearch} placeholder="Search recipes"
                    placeholderTextColor="#8b8178" accessibilityLabel="Search recipes" style={styles.searchInput} />
                  {!!search && <Pressable onPress={() => setSearch('')} accessibilityRole="button" accessibilityLabel="Clear search">
                    <Ionicons name="close-circle" size={20} color="#72675f" />
                  </Pressable>}
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator style={styles.categories}
                contentContainerStyle={styles.categoryContent} accessibilityLabel="Recipe categories">
                {['All', 'Favorites', 'My Food', ...CATEGORIES].map((category) => (
                  <Pressable key={category} onPress={() => chooseCategory(category)} accessibilityRole="button"
                    accessibilityLabel={category} accessibilityState={{ selected: route.category === category }}
                    style={[styles.chip, route.category === category && styles.activeChip]}>
                    {category === 'Favorites' && <Ionicons name="heart-outline" size={16} color={route.category === category ? 'white' : '#72675f'} />}
                    {category === 'My Food' && <Ionicons name="book-outline" size={16} color={route.category === category ? 'white' : '#72675f'} />}
                    <Text style={[styles.chipText, route.category === category && styles.activeChipText]}>{category}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <View style={styles.sectionHead}>
                <View>
                  <Text style={styles.sectionTitle}>{isMine ? 'My Recipes' : isFavorites ? 'Favorites' : route.category === 'All' ? 'All recipes' : route.category}</Text>
                  <Text style={styles.muted}>{visibleRecipes.length} {visibleRecipes.length === 1 ? 'recipe' : 'recipes'}</Text>
                </View>
                {isMine && <Pressable style={styles.addButton} onPress={() => navigate({ name: 'add' })} accessibilityRole="button">
                  <Ionicons name="add" size={19} color="white" /><Text style={styles.addText}>Add New Recipe</Text>
                </Pressable>}
              </View>
              <FlatList data={visibleRecipes} key={columns} numColumns={columns} keyExtractor={(recipe) => recipe.id}
                contentContainerStyle={styles.recipeList} columnWrapperStyle={columns > 1 ? { gap: 16 } : undefined}
                renderItem={({ item }) => <RecipeCard recipe={item} favorite={favoriteIds.includes(item.id)}
                  onOpen={() => navigate({ name: 'details', id: item.id })}
                  onFavorite={() => toggleFavorite(item.id)} saving={saving}
                  ownRecipe={isMine} onEdit={() => navigate({ name: 'edit', id: item.id })}
                  onDelete={() => setDeleteRecipe(item)} />}
                ListEmptyComponent={<View style={styles.empty}>
                  <Ionicons name={isFavorites ? 'heart-outline' : 'restaurant-outline'} size={42} color="#d9b9a4" />
                  <Text style={styles.emptyTitle}>{search ? 'No recipes found' : isMine ? 'Your recipes belong here' : isFavorites ? 'A place for your favorites' : 'Nothing here yet'}</Text>
                  <Text style={styles.emptyText}>{search ? 'Try another recipe name.' : isMine ? 'Tap Add New Recipe to save your first dish.' : isFavorites ? 'Tap the heart on a recipe to keep it here.' : 'Try another category.'}</Text>
                </View>} />
            </View>
          )}
      </View>

      <Modal visible={!!deleteRecipe} transparent animationType="fade" onRequestClose={() => !saving && setDeleteRecipe(null)}>
        <View style={styles.modalShade}><View style={styles.modalCard}>
          <Text style={styles.sectionTitle}>Delete recipe?</Text>
          <Text style={styles.modalText}>Remove “{deleteRecipe?.title}” from My Recipes and Favorites?</Text>
          <View style={styles.modalActions}>
            <Pressable onPress={() => setDeleteRecipe(null)} disabled={saving} style={styles.cancelButton} accessibilityRole="button"><Text>Cancel</Text></Pressable>
            <Pressable onPress={confirmDelete} disabled={saving} style={styles.deleteButton} accessibilityRole="button" accessibilityLabel="Confirm delete recipe">
              <Text style={styles.addText}>{saving ? 'Deleting...' : 'Delete Recipe'}</Text>
            </Pressable>
          </View>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

function RecipePhoto({ uri, title, style }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  return failed ? <View style={[style, styles.photoFallback]}><Ionicons name="restaurant-outline" size={45} color="#b68c70" /><Text style={styles.muted}>Recipe photo unavailable</Text></View>
    : <Image source={{ uri }} style={style} resizeMode="cover" accessibilityLabel={title} onError={() => setFailed(true)} />;
}

function HeartButton({ favorite, onPress, title, disabled }) {
  return <Pressable onPress={onPress} disabled={disabled} style={styles.heart} accessibilityRole="button"
    accessibilityLabel={(favorite ? 'Unfavorite ' : 'Favorite ') + title} accessibilityState={{ selected: favorite, disabled }}>
    <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={25} color={favorite ? '#d65342' : '#54443a'} />
  </Pressable>;
}

function RecipeCard({ recipe, favorite, onOpen, onFavorite, ownRecipe, onEdit, onDelete, saving }) {
  return <View style={styles.card}>
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={'Open ' + recipe.title}>
      <RecipePhoto uri={recipe.image} title={recipe.title} style={styles.cardPhoto} />
      <View style={styles.cardBody}>
        <Text style={styles.categoryLabel}>{recipe.category}</Text>
        <Text style={styles.recipeTitle}>{recipe.title}</Text>
        <Text style={styles.muted}>{recipe.prepMinutes} min  ·  {recipe.difficulty}  ·  {recipe.servings} servings</Text>
      </View>
    </Pressable>
    <View style={styles.cardHeart}><HeartButton favorite={favorite} onPress={onFavorite} title={recipe.title} disabled={saving} /></View>
    {ownRecipe && <View style={styles.cardActions}>
      <Pressable onPress={onEdit} style={styles.smallAction} accessibilityRole="button" accessibilityLabel={'Edit ' + recipe.title}>
        <Ionicons name="create-outline" size={18} color="#91502e" /><Text style={styles.link}>Edit</Text>
      </Pressable>
      <Pressable onPress={onDelete} style={styles.smallAction} accessibilityRole="button" accessibilityLabel={'Delete ' + recipe.title}>
        <Ionicons name="trash-outline" size={18} color="#b34538" /><Text style={{ color: '#b34538' }}>Delete</Text>
      </Pressable>
    </View>}
  </View>;
}

function RecipeDetails({ recipe, favorite, toggleFavorite, saving, ownRecipe, onEdit, onDelete }) {
  return <ScrollView contentContainerStyle={styles.detailContent}>
    <RecipePhoto uri={recipe.image} title={recipe.title} style={styles.detailPhoto} />
    <View style={styles.detailBody}>
      <Text style={styles.categoryLabel}>{recipe.category}</Text>
      <View style={styles.detailHeading}><Text style={styles.detailTitle}>{recipe.title}</Text>
        <HeartButton favorite={favorite} onPress={toggleFavorite} title={recipe.title} disabled={saving} /></View>
      <Text style={styles.muted}>{ownRecipe ? 'From your kitchen' : 'From the Foodie recipe collection'}</Text>
      <View style={styles.facts}>
        {[
          ['time-outline', 'Preparation time', recipe.prepMinutes + ' min'],
          ['people-outline', 'Servings', String(recipe.servings)],
          ['flame-outline', 'Calories', recipe.calories + ' kcal'],
          ['bar-chart-outline', 'Difficulty', recipe.difficulty],
        ].map(([icon, label, value]) => <View key={label} style={styles.fact}>
          <Ionicons name={icon} size={22} color="#b5673f" /><Text style={styles.factValue}>{value}</Text><Text style={styles.factLabel}>{label}</Text>
        </View>)}
      </View>
      <Text style={styles.detailSection}>Ingredients</Text>
      {recipe.ingredients.map((ingredient, index) => <View key={index} style={styles.ingredient}>
        <View style={styles.bullet} /><Text style={styles.bodyText}>{ingredient}</Text>
      </View>)}
      <Text style={styles.detailSection}>Instructions</Text>
      {recipe.instructions.map((step, index) => <View key={index} style={styles.step}>
        <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{index + 1}</Text></View>
        <Text style={styles.bodyText}>{step}</Text>
      </View>)}
      <Text style={styles.calorieNote}>Calories are an estimate per serving.</Text>
      {ownRecipe && <View style={styles.cardActions}>
        <Pressable onPress={onEdit} style={styles.smallAction} accessibilityRole="button"><Ionicons name="create-outline" size={20} color="#91502e" /><Text style={styles.link}>Edit Recipe</Text></Pressable>
        <Pressable onPress={onDelete} style={styles.smallAction} accessibilityRole="button"><Ionicons name="trash-outline" size={20} color="#b34538" /><Text style={{ color: '#b34538' }}>Delete Recipe</Text></Pressable>
      </View>}
    </View>
  </ScrollView>;
}

export default function App() {
  return <SafeAreaProvider><Foodie /></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fffaf4' },
  app: { flex: 1, width: '100%', maxWidth: 960, alignSelf: 'center' },
  header: { height: 66, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#eee2d6' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 65, minHeight: 44 },
  backText: { fontSize: 14, color: '#28221e' }, disabled: { opacity: 0.3 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#28221e' },
  intro: { padding: 20, paddingBottom: 10 },
  heading: { fontSize: 27, fontWeight: '700', color: '#28221e', marginBottom: 7 },
  muted: { fontSize: 13, color: '#72675f', lineHeight: 20 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: 'white', borderWidth: 1, borderColor: '#e8ddd2', borderRadius: 12, paddingHorizontal: 13, marginTop: 17 },
  searchInput: { flex: 1, minHeight: 47, fontSize: 15, color: '#28221e' },
  feed: { flex: 1 }, categories: { flexGrow: 0, flexShrink: 0, height: 59 },
  categoryContent: { gap: 8, alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8 },
  chip: { flexDirection: 'row', gap: 5, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#e9ddd0', borderRadius: 22, backgroundColor: 'white' },
  activeChip: { backgroundColor: '#df6b36', borderColor: '#df6b36' },
  chipText: { fontSize: 14, fontWeight: '500', color: '#625247' }, activeChipText: { color: 'white' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14 },
  sectionTitle: { fontSize: 21, fontWeight: '700', color: '#28221e' },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#df6b36', paddingHorizontal: 12, paddingVertical: 12, borderRadius: 10 },
  addText: { color: 'white', fontWeight: '600', fontSize: 13 },
  recipeList: { paddingHorizontal: 20, paddingBottom: 30 },
  card: { flex: 1, backgroundColor: 'white', borderWidth: 1, borderColor: '#eee2d6', borderRadius: 16, marginBottom: 18, overflow: 'hidden' },
  cardPhoto: { width: '100%', height: 200, backgroundColor: '#f2e5d8' },
  cardBody: { padding: 16 }, categoryLabel: { color: '#a45a30', fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 5 },
  recipeTitle: { color: '#28221e', fontSize: 20, fontWeight: '700', marginBottom: 7 },
  cardHeart: { position: 'absolute', top: 12, right: 12 },
  heart: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fffdf8', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#eee2d6' },
  cardActions: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#eee2d6', paddingHorizontal: 16 },
  smallAction: { minHeight: 46, flexDirection: 'row', gap: 6, alignItems: 'center' },
  link: { color: '#91502e', fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 45, paddingHorizontal: 25 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#4f4034', marginTop: 14, marginBottom: 8 },
  emptyText: { color: '#72675f', fontSize: 15, textAlign: 'center', lineHeight: 23 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  detailContent: { paddingBottom: 35 }, detailPhoto: { width: '100%', height: 300, backgroundColor: '#f2e5d8' },
  detailBody: { padding: 23 }, detailHeading: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 6 },
  detailTitle: { flex: 1, fontSize: 29, fontWeight: '700', color: '#28221e' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', marginVertical: 24, paddingVertical: 17, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#e8ddd2', rowGap: 18 },
  fact: { width: '25%', alignItems: 'center', paddingHorizontal: 3 }, factValue: { color: '#3f3025', fontWeight: '700', fontSize: 16, marginTop: 8, marginBottom: 3 },
  factLabel: { fontSize: 11, textAlign: 'center', color: '#72675f' },
  detailSection: { fontSize: 23, fontWeight: '700', color: '#28221e', marginBottom: 15, marginTop: 8 },
  ingredient: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 12 },
  bullet: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#df6b36', marginTop: 9 },
  bodyText: { flex: 1, fontSize: 16, lineHeight: 25, color: '#4b4038' },
  step: { flexDirection: 'row', gap: 13, marginBottom: 19 },
  stepNumber: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#f8e4d4', alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontWeight: '700', color: '#a45a30' },
  calorieNote: { fontSize: 12, color: '#8b8178', marginTop: 5, marginBottom: 20 },
  photoFallback: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  message: { margin: 14, padding: 12, borderRadius: 9, backgroundColor: '#f6e7d6', flexDirection: 'row', alignItems: 'center', gap: 9 },
  messageText: { flex: 1, color: '#6d4e32', fontSize: 14, lineHeight: 20 },
  modalShade: { flex: 1, backgroundColor: 'rgba(35,25,18,0.45)', alignItems: 'center', justifyContent: 'center', padding: 25 },
  modalCard: { width: '100%', maxWidth: 390, padding: 25, borderRadius: 18, backgroundColor: '#fffaf4' },
  modalText: { color: '#72675f', fontSize: 16, lineHeight: 24, marginVertical: 18 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  cancelButton: { padding: 13, borderRadius: 8, backgroundColor: '#eee6dd' },
  deleteButton: { padding: 13, borderRadius: 8, backgroundColor: '#b34538' },
});
