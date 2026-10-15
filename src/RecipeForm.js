import React, { useEffect, useRef, useState } from 'react';
import {
  Image, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { CATEGORIES } from './recipes';

// Limit the stored base64 string, which is larger than the original image file.
const MAX_IMAGE_LENGTH = 1500000;
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

function initialFields(recipe) {
  return {
    title: recipe?.title || '',
    image: recipe?.image || '',
    category: recipe?.category || CATEGORIES[0],
    ingredients: (recipe?.ingredients || []).join('\n'),
    instructions: (recipe?.instructions || []).join('\n'),
    prepMinutes: String(recipe?.prepMinutes ?? 20),
    servings: String(recipe?.servings ?? 2),
    calories: String(recipe?.calories ?? 300),
    difficulty: recipe?.difficulty || 'Easy',
  };
}

function lines(value) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

async function imageDataUri(asset) {
  if (asset.base64) {
    const mimeType = asset.mimeType || asset.file?.type || 'image/jpeg';
    return `data:${mimeType};base64,${asset.base64}`;
  }
  if (asset.uri?.startsWith('data:image/')) return asset.uri;

  // Some browsers return a File or blob URL instead of base64.
  if (Platform.OS === 'web' && typeof FileReader !== 'undefined') {
    const file = asset.file || await (await fetch(asset.uri)).blob();
    if (file.size * 4 / 3 > MAX_IMAGE_LENGTH) {
      throw new Error('This photo is too large. Choose a smaller photo (about 1 MB or less).');
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Could not read this photo. Please choose another image.'));
      reader.onabort = () => reject(new Error('Photo loading was canceled. Please try again.'));
      reader.readAsDataURL(file);
    });
  }
  throw new Error('Could not keep a saved copy of this photo. Please choose another image.');
}

export default function RecipeForm({ recipe, onSave, onCancel, saving = false }) {
  const [form, setForm] = useState(() => initialFields(recipe));
  const [errors, setErrors] = useState({});
  const [readingImage, setReadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const saveInProgress = useRef(false);
  const busy = saving || submitting || readingImage;

  useEffect(() => {
    setForm(initialFields(recipe));
    setErrors({});
  }, [recipe]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined, submit: undefined }));
  }

  async function chooseImage() {
    if (busy) return;
    try {
      // Launch directly from the button press so browsers allow the file picker.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.5, base64: true,
      });
      if (result.canceled || !result.assets?.length) return;
      setReadingImage(true);
      const dataUri = await imageDataUri(result.assets[0]);
      if (typeof dataUri !== 'string' || !dataUri.startsWith('data:image/')) {
        throw new Error('Please choose a supported image, such as a JPG or PNG.');
      }
      if (dataUri.length > MAX_IMAGE_LENGTH) {
        throw new Error('This photo is too large to save. Choose a smaller photo (about 1 MB or less).');
      }
      updateField('image', dataUri);
    } catch (error) {
      setErrors((current) => ({
        ...current,
        image: error.message || 'Could not open your photos. Check photo access and try again.',
      }));
    } finally {
      setReadingImage(false);
    }
  }

  async function saveRecipe() {
    if (busy || saveInProgress.current) return;
    const ingredients = lines(form.ingredients);
    const instructions = lines(form.instructions);
    const nextErrors = {};
    if (!form.title.trim()) nextErrors.title = 'Give your recipe a name.';
    if (!form.image) nextErrors.image = 'Upload a photo of your recipe.';
    if (!ingredients.length) nextErrors.ingredients = 'Add at least one ingredient.';
    if (!instructions.length) nextErrors.instructions = 'Add at least one instruction step.';

    const numbers = {};
    const defaults = { prepMinutes: 20, servings: 2, calories: 300 };
    for (const field of Object.keys(defaults)) {
      const value = form[field].trim();
      numbers[field] = value === '' ? defaults[field] : Number(value);
      if (value !== '' && (!/^\d+$/.test(value) || !Number.isSafeInteger(numbers[field]) || numbers[field] <= 0)) {
        nextErrors[field] = 'Enter a whole number greater than 0.';
      }
    }
    if (Object.keys(nextErrors).length) {
      setErrors({ ...nextErrors, submit: 'Please check the highlighted fields above.' });
      return;
    }

    saveInProgress.current = true;
    setSubmitting(true);
    setErrors({});
    try {
      await onSave({
        ...(recipe || {}),
        title: form.title.trim(), image: form.image, category: form.category,
        ingredients, instructions, ...numbers, difficulty: form.difficulty,
      });
    } catch (error) {
      setErrors({ submit: error.message || 'Your recipe could not be saved. Please try again.' });
    } finally {
      saveInProgress.current = false;
      setSubmitting(false);
    }
  }

  function fieldError(field) {
    return errors[field] ? <Text accessibilityRole="alert" style={styles.error}>{errors[field]}</Text> : null;
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Text style={styles.intro}>Keep your favorite creations in one place.</Text>

        <Text style={styles.label}>Recipe name *</Text>
        <TextInput
          accessibilityLabel="Recipe name" testID="recipe-name" value={form.title}
          onChangeText={(value) => updateField('title', value)} editable={!busy}
          placeholder="e.g. Sunday lemon pancakes" placeholderTextColor="#9b8d82"
          maxLength={100} style={[styles.input, errors.title && styles.inputError]}
        />
        {fieldError('title')}

        <Text style={styles.label}>Recipe photo *</Text>
        {form.image ? (
          <Image source={{ uri: form.image }} accessibilityLabel="Recipe photo preview" style={styles.preview} resizeMode="cover" />
        ) : (
          <View style={styles.photoPlaceholder}><Text style={styles.hint}>Add a photo of your dish</Text></View>
        )}
        <Pressable accessibilityRole="button" disabled={busy} onPress={chooseImage} testID="upload-image"
          style={({ pressed }) => [styles.uploadButton, pressed && styles.pressed, busy && styles.disabled]}>
          <Text style={styles.uploadText}>{readingImage ? 'Loading photo…' : form.image ? 'Change Image' : 'Upload Image'}</Text>
        </Pressable>
        <Text style={styles.hint}>Choose a JPG or PNG around 1 MB or smaller.</Text>
        {fieldError('image')}

        <Text style={styles.label}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {CATEGORIES.map((category) => (
            <Pressable key={category} accessibilityRole="button" accessibilityState={{ selected: form.category === category }}
              disabled={busy} onPress={() => updateField('category', category)}
              style={[styles.chip, form.category === category && styles.selectedChip]}>
              <Text style={[styles.chipText, form.category === category && styles.selectedChipText]}>{category}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.label}>Ingredients *</Text>
        <Text style={styles.hint}>Write one ingredient per line, including the amount.</Text>
        <TextInput
          accessibilityLabel="Ingredients, one per line" testID="ingredients" multiline textAlignVertical="top"
          value={form.ingredients} onChangeText={(value) => updateField('ingredients', value)} editable={!busy}
          placeholder={'1 cup flour\n2 eggs\n1 tablespoon honey'} placeholderTextColor="#9b8d82"
          maxLength={6000} style={[styles.input, styles.multiline, errors.ingredients && styles.inputError]}
        />
        {fieldError('ingredients')}

        <Text style={styles.label}>Instructions *</Text>
        <Text style={styles.hint}>Write one step per line. We will number them for you.</Text>
        <TextInput
          accessibilityLabel="Instructions, one step per line" testID="instructions" multiline textAlignVertical="top"
          value={form.instructions} onChangeText={(value) => updateField('instructions', value)} editable={!busy}
          placeholder={'Mix the ingredients in a bowl.\nCook until golden and serve warm.'} placeholderTextColor="#9b8d82"
          maxLength={10000} style={[styles.input, styles.multiline, errors.instructions && styles.inputError]}
        />
        {fieldError('instructions')}

        <View style={styles.numberRow}>
          {[
            ['prepMinutes', 'Prep (minutes)', 'prep-time', '20'],
            ['servings', 'Servings', 'servings', '2'],
            ['calories', 'Calories / serving', 'calories', '300'],
          ].map(([field, label, testID, placeholder]) => (
            <View key={field} style={styles.numberField}>
              <Text style={styles.label}>{label}</Text>
              <TextInput
                accessibilityLabel={label} testID={testID} value={form[field]} keyboardType="number-pad"
                onChangeText={(value) => updateField(field, value)} editable={!busy} maxLength={5}
                placeholder={placeholder} placeholderTextColor="#9b8d82"
                style={[styles.input, errors[field] && styles.inputError]}
              />
              {fieldError(field)}
            </View>
          ))}
        </View>
        <Text style={styles.label}>Difficulty</Text>
        <View style={styles.chips}>
          {DIFFICULTIES.map((difficulty) => (
            <Pressable key={difficulty} accessibilityRole="button" accessibilityState={{ selected: form.difficulty === difficulty }}
              disabled={busy} onPress={() => updateField('difficulty', difficulty)}
              style={[styles.chip, form.difficulty === difficulty && styles.selectedChip]}>
              <Text style={[styles.chipText, form.difficulty === difficulty && styles.selectedChipText]}>{difficulty}</Text>
            </Pressable>
          ))}
        </View>

        {fieldError('submit')}
        <Pressable accessibilityRole="button" disabled={busy} onPress={saveRecipe} testID="save-recipe"
          style={({ pressed }) => [styles.saveButton, pressed && styles.pressed, busy && styles.disabled]}>
          <Text style={styles.saveText}>{saving || submitting ? 'Saving…' : recipe ? 'Save Changes' : 'Save Recipe'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={onCancel} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fffaf4' },
  content: { padding: 20, paddingBottom: 36 },
  intro: { color: '#72675f', fontSize: 15, lineHeight: 22, marginBottom: 8 },
  label: { color: '#28221e', fontSize: 14, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e7ddd4', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, color: '#28221e', fontSize: 16, minHeight: 48 },
  inputError: { borderColor: '#bd4133' },
  multiline: { minHeight: 132, marginTop: 8, lineHeight: 24 },
  hint: { color: '#72675f', fontSize: 13, lineHeight: 19 },
  error: { color: '#a93829', fontSize: 13, lineHeight: 20, marginTop: 7 },
  preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: 16, backgroundColor: '#f1e8df' },
  photoPlaceholder: { height: 130, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#d5bbaa', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  uploadButton: { borderWidth: 1, borderColor: '#df6b36', borderRadius: 12, padding: 13, alignItems: 'center', marginTop: 12, marginBottom: 7, backgroundColor: '#fff' },
  uploadText: { color: '#b94e20', fontWeight: '700', fontSize: 15 },
  chips: { flexDirection: 'row', gap: 8, paddingVertical: 3 },
  chip: { paddingHorizontal: 15, paddingVertical: 11, borderRadius: 22, borderWidth: 1, borderColor: '#e7ddd4', backgroundColor: '#fff' },
  selectedChip: { borderColor: '#df6b36', backgroundColor: '#df6b36' },
  chipText: { color: '#72675f', fontSize: 14, fontWeight: '600' },
  selectedChipText: { color: '#fff' },
  numberRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  numberField: { flexGrow: 1, flexBasis: 120 },
  saveButton: { paddingVertical: 16, borderRadius: 14, backgroundColor: '#df6b36', alignItems: 'center', marginTop: 26 },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelButton: { alignItems: 'center', padding: 16, marginTop: 5 },
  cancelText: { color: '#72675f', fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
});
