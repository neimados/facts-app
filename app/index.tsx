// app/index.tsx - Main entry point for FactSwipe with translation features
import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Dimensions,
  StyleSheet,
  StatusBar,
  BackHandler,
  Animated,
  TouchableOpacity,
  ActivityIndicator,
  Modal, // NEW: Using Modal for the language picker
  Pressable, // NEW: To close the modal
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as Localization from 'expo-localization';

import {
  fetchFactsFromApi,
  trackFactInteraction,
  loadUserInterests,
  UserInterests,
  ALL_CATEGORIES
} from '../services/FactServices';

// --- NEW: Translation Service (can be moved to a separate file e.g., services/TranslationService.ts) ---

// IMPORTANT: Replace this with your actual DeepL API key
const DEEPL_API_KEY = 'API KEY';
const DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate';

// Supported languages for the switcher
const SUPPORTED_LANGUAGES = ['EN', 'ES', 'FR', 'DE', 'ZH']; // English, Spanish, French, German, Chinese

/**
 * Translates text using the DeepL API.
 * @param text The text to translate.
 * @param targetLang The target language code (e.g., 'FR', 'ES').
 * @returns The translated text or null if an error occurs.
 */
const translateText = async (text: string, targetLang: string): Promise<string | null> => {
  if (targetLang.toUpperCase() === 'EN') {
    return text;
  }

  try {
    const response = await fetch(DEEPL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
      },
      body: JSON.stringify({
        text: [text],
        target_lang: targetLang,
      }),
    });

    const data = await response.json();
    if (data.translations && data.translations.length > 0) {
      return data.translations[0].text;
    }
    return text; // Return original text on failure
  } catch (error) {
    console.error('DeepL Translation Error:', error);
    return text; // Return original text on error
  }
};

// --- End of Translation Service ---

const { width, height } = Dimensions.get('window');

// Category color schemes for dynamic overlays
function getRandomColor(): string {
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);
  return `rgba(${r},${g},${b},0.75)`;
}

const CATEGORY_COLORS: { [key: string]: string[] } = {
  technology: [getRandomColor(), getRandomColor(), getRandomColor()],
  science: [getRandomColor(), getRandomColor(), getRandomColor()],
  history: [getRandomColor(), getRandomColor(), getRandomColor()],
  geography: [getRandomColor(), getRandomColor(), getRandomColor()],
  arts: [getRandomColor(), getRandomColor(), getRandomColor()],
  sports: [getRandomColor(), getRandomColor(), getRandomColor()],
  politics: [getRandomColor(), getRandomColor(), getRandomColor()],
  medicine: [getRandomColor(), getRandomColor(), getRandomColor()],
  environment: [getRandomColor(), getRandomColor(), getRandomColor()],
  other: [getRandomColor(), getRandomColor(), getRandomColor()],
  default: [getRandomColor(), getRandomColor(), getRandomColor()]
};

// Default background gradients
const CATEGORY_GRADIENTS: { [key: string]: string[] } = {
  technology: ['#1e3c72', '#2a5298'],
  science: ['#1e3c72', '#2a5298'],
  history: ['#667db6', '#0082c8'],
  geography: ['#56ab2f', '#a8e6cf'],
  arts: ['#ff7e5f', '#feb47b'],
  sports: ['#f7971e', '#ffd200'],
  politics: ['#b92b27', '#1565C0'],
  medicine: ['#43cea2', '#185a9d'],
  environment: ['#11998e', '#38ef7d'],
  other: ['#434343', '#000000'],
  default: ['#434343', '#000000']
};

const FactSwipeApp: React.FC = () => {
  const [currentFactIndex, setCurrentFactIndex] = useState<number>(0);
  const [facts, setFacts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [userInterestData, setUserInterestData] = useState<UserInterests>({});
  const [currentColorOverlay, setCurrentColorOverlay] = useState<string>('');

  // State for translation
  const [language, setLanguage] = useState<string>('EN');
  const [translatedSummary, setTranslatedSummary] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  // NEW: State to control the visibility of the language dropdown
  const [isLanguagePickerVisible, setLanguagePickerVisible] = useState(false);

  const translateY = useRef(new Animated.Value(0)).current;
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewStartTime = useRef<number>(Date.now());
  const gestureRef = useRef(null);

  // Auto-detect language on initial load
  useEffect(() => {
    const userLocales = Localization.getLocales();
    if (userLocales && userLocales.length > 0) {
      const detectedLanguageCode = userLocales[0].languageCode?.toUpperCase();
      if (detectedLanguageCode && SUPPORTED_LANGUAGES.includes(detectedLanguageCode)) {
        setLanguage(detectedLanguageCode);
      }
    }
  }, []);

  // Effect to translate the fact when the language or fact changes
  useEffect(() => {
    const translateCurrentFact = async () => {
      const currentFact = facts[currentFactIndex];
      if (!currentFact) return;

      setIsTranslating(true);
      const translated = await translateText(currentFact.summary, language);
      setTranslatedSummary(translated || currentFact.summary);
      setIsTranslating(false);
    };

    translateCurrentFact();
  }, [currentFactIndex, facts, language]);

  // NEW: Handler to select a language from the dropdown
  const handleSelectLanguage = (selectedLanguage: string) => {
    setLanguage(selectedLanguage);
    setLanguagePickerVisible(false);
  };

  // Auto-advance timer
  const resetAutoAdvanceTimer = useCallback(() => {
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    autoAdvanceTimer.current = setTimeout(() => {
      handleNextFact();
    }, 30000);
  }, []);

  // Load initial facts
  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const interests = await loadUserInterests();
      setUserInterestData(interests);
      const initialFacts = await fetchFactsFromApi(interests, ALL_CATEGORIES, 15);
      setFacts(initialFacts);
      setIsLoading(false);
    })();
  }, []);

  // Handle next fact
  const handleNextFact = useCallback(async () => {
    const currentFact = facts[currentFactIndex];
    const timeSpent = Date.now() - viewStartTime.current;

    if (currentFact && timeSpent > 1000) {
      const updated = await trackFactInteraction(currentFact.id, currentFact.category, timeSpent, "view");
      if (updated) setUserInterestData(updated);
    }

    if (currentFactIndex >= facts.length - 1) {
      const newFacts = await fetchFactsFromApi(userInterestData, ALL_CATEGORIES, 10);
      if (newFacts.length > 0) {
        setFacts(prev => [...prev, ...newFacts]);
        setCurrentFactIndex(currentFactIndex + 1);
      }
    } else {
      setCurrentFactIndex(currentFactIndex + 1);
    }

    viewStartTime.current = Date.now();
    resetAutoAdvanceTimer();
  }, [currentFactIndex, facts, userInterestData, resetAutoAdvanceTimer]);

  // Handle previous fact
  const handlePreviousFact = useCallback(() => {
    if (currentFactIndex > 0) {
      setCurrentFactIndex(currentFactIndex - 1);
      viewStartTime.current = Date.now();
      resetAutoAdvanceTimer();
    }
  }, [currentFactIndex, resetAutoAdvanceTimer]);

  // Gesture handler
  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: translateY } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = useCallback((event: any) => {
    const { nativeEvent } = event;
    if (nativeEvent.state === State.END) {
      const { translationY, velocityY } = nativeEvent;
      const swipeThreshold = 80;
      const velocityThreshold = 800;

      if (translationY < -swipeThreshold || velocityY < -velocityThreshold) {
        handleNextFact();
      } else if (translationY > swipeThreshold || velocityY > velocityThreshold) {
        handlePreviousFact();
      }

      Animated.spring(translateY, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }
  }, [handleNextFact, handlePreviousFact, translateY]);

  // Auto-advance setup
  useEffect(() => {
    resetAutoAdvanceTimer();
    return () => {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    };
  }, [resetAutoAdvanceTimer]);

  // Update overlay on fact change
  useEffect(() => {
    const currentFact = facts[currentFactIndex];
    if (currentFact) {
      const categoryColors = CATEGORY_COLORS[currentFact.category] || CATEGORY_COLORS.default;
      const randomColor = categoryColors[Math.floor(Math.random() * categoryColors.length)];
      setCurrentColorOverlay(randomColor);
    }
  }, [currentFactIndex, facts]);

  // Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (currentFactIndex > 0) {
        handlePreviousFact();
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [currentFactIndex, handlePreviousFact]);

  const currentFact = facts[currentFactIndex];

  if (!currentFact || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading amazing facts...</Text>
        <Text style={styles.loadingSubtext}>Swipe up and down to navigate</Text>
      </View>
    );
  }

  const gradientColors = CATEGORY_GRADIENTS[currentFact.category] || CATEGORY_GRADIENTS.default;

  return (
    <SafeAreaProvider>
      <StatusBar hidden />
      <PanGestureHandler
        ref={gestureRef}
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
        activeOffsetY={[-10, 10]}
      >
        <Animated.View 
          style={[
            styles.container,
            {
              transform: [{ 
                translateY: translateY.interpolate({
                  inputRange: [-height, 0, height],
                  outputRange: [-height * 0.3, 0, height * 0.3],
                  extrapolate: 'clamp',
                })
              }]
            }
          ]}
        >
          <View style={[styles.backgroundGradient, { backgroundColor: gradientColors[0] }]}>
            <View style={[styles.overlay, { backgroundColor: currentColorOverlay }]}>
              <SafeAreaView style={styles.safeArea}>
                {/* Category indicator */}
                <View style={styles.categoryIndicator}>
                  <Text style={styles.categoryText}>
                    {currentFact.category.toUpperCase()}
                  </Text>
                </View>

                {/* UPDATED: Language Switcher Button - now opens the modal */}
                <TouchableOpacity onPress={() => setLanguagePickerVisible(true)} style={styles.languageSwitcher}>
                  <Text style={styles.languageSwitcherText}>{language} ▾</Text>
                </TouchableOpacity>

                {/* Main fact content */}
                <View style={styles.factContainer}>
                  {isTranslating ? (
                    <ActivityIndicator size="large" color="#ffffff" />
                  ) : (
                    <Text style={styles.factText}>
                      {translatedSummary}
                    </Text>
                  )}
                </View>
                
                {/* Progress indicator */}
                <View style={styles.progressContainer}>
                  <View 
                    style={[
                      styles.progressBar, 
                      { width: `${((currentFactIndex + 1) / facts.length) * 100}%` }
                    ]} 
                  />
                </View>

                {currentFactIndex < 3 && (
                  <View style={styles.hintsContainer}>
                    <Text style={styles.hintText}>↑ Swipe up for next fact</Text>
                    <Text style={styles.hintText}>↓ Swipe down for previous fact</Text>
                  </View>
                )}
              </SafeAreaView>
            </View>
          </View>
        </Animated.View>
      </PanGestureHandler>

      {/* NEW: Language Picker Modal */}
      <Modal
        transparent={true}
        visible={isLanguagePickerVisible}
        animationType="fade"
        onRequestClose={() => setLanguagePickerVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setLanguagePickerVisible(false)}>
          <View style={styles.languagePickerContainer}>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang}
                style={styles.languageOption}
                onPress={() => handleSelectLanguage(lang)}
              >
                <Text style={styles.languageOptionText}>{lang}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  backgroundGradient: { flex: 1, width, height },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  safeArea: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  factContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30, paddingVertical: 40 },
  factText: {
    fontSize: 26,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
    lineHeight: 38,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
    letterSpacing: 0.3,
  },
  categoryIndicator: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  categoryText: { color: 'white', fontSize: 13, fontWeight: 'bold', letterSpacing: 1.2 },
  languageSwitcher: {
    position: 'absolute',
    top: 60,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
    zIndex: 10,
  },
  languageSwitcherText: {
    color: 'white',
    fontSize: 13,
    fontWeight: 'bold',
  },
  progressContainer: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  progressBar: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 2,
    shadowColor: 'white',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  hintsContainer: { position: 'absolute', bottom: 100, left: 0, right: 0, alignItems: 'center' },
  hintText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '500',
    marginVertical: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e', paddingHorizontal: 40 },
  loadingText: { color: 'white', fontSize: 24, fontWeight: '600', textAlign: 'center', marginBottom: 16 },
  loadingSubtext: { color: 'rgba(255, 255, 255, 0.7)', fontSize: 16, textAlign: 'center' },
  
  // NEW: Styles for the language picker modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  languagePickerContainer: {
    position: 'absolute',
    top: 105, // Positioned below the switcher button
    left: 20,
    backgroundColor: 'rgba(40, 40, 40, 0.95)',
    borderRadius: 12,
    padding: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  languageOption: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  languageOptionText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default FactSwipeApp;
