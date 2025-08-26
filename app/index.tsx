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
  Modal,
  Pressable,
  ImageBackground,
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as Localization from 'expo-localization';
import { Asset } from 'expo-asset';

import {
  fetchFactsFromApi,
  trackFactInteraction,
  loadUserInterests,
  UserInterests,
  ALL_CATEGORIES
} from '../services/FactServices';

// --- Translation Service ---

const DEEPL_API_KEY = 'API KEY';
const DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate';
const SUPPORTED_LANGUAGES = ['EN', 'ES', 'FR', 'DE', 'ZH'];

const translateText = async (text: string, targetLang: string): Promise<string | null> => {
  try {
    const response = await fetch(DEEPL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
      },
      body: JSON.stringify({ text: [text], target_lang: targetLang }),
    });
    const data = await response.json();
    return data.translations?.[0]?.text || text;
  } catch (error) {
    console.error('DeepL Translation Error:', error);
    return text;
  }
};

// --- End of Translation Service ---

const { width, height } = Dimensions.get('window');

function getRandomColor(): string {
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);
  return `rgba(${r},${g},${b},0.75)`;
}

const CATEGORY_BACKGROUNDS = {
  technology: require('../assets/images/technology.png'),
  science: require('../assets/images/science.png'),
  history: require('../assets/images/history.png'),
  geography: require('../assets/images/geography.png'),
  arts: require('../assets/images/arts.png'),
  sports: require('../assets/images/sports.png'),
  politics: require('../assets/images/politics.png'),
  medicine: require('../assets/images/medicine.png'),
  environment: require('../assets/images/environment.png'),
  other: require('../assets/images/other.png'),
  default: require('../assets/images/default.png')
};

type Category = keyof typeof CATEGORY_BACKGROUNDS;

// Define the structure of a Fact object
interface Fact {
  id: number | string;
  summary: string;
  // UPDATED: Category is now a string to match the service response
  category: string;
}

// NEW: Type guard to check if a string is a valid category key
function isValidCategory(category: string): category is Category {
  return Object.keys(CATEGORY_BACKGROUNDS).includes(category);
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


const FactSwipeApp: React.FC = () => {
  const [currentFactIndex, setCurrentFactIndex] = useState<number>(0);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userInterestData, setUserInterestData] = useState<UserInterests>({});
  const [currentColorOverlay, setCurrentColorOverlay] = useState<string>('');
  
  const [areImagesPreloaded, setAreImagesPreloaded] = useState(false);

  // State for translation
  const [language, setLanguage] = useState<string>('EN');
  const [translatedSummary, setTranslatedSummary] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [isLanguagePickerVisible, setLanguagePickerVisible] = useState(false);

  const translateY = useRef(new Animated.Value(0)).current;
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewStartTime = useRef<number>(Date.now());
  const gestureRef = useRef(null);

  // Preload images on app start
  useEffect(() => {
    const preloadAssets = async () => {
      const imageUrls = Object.values(CATEGORY_BACKGROUNDS);
      await Asset.loadAsync(imageUrls);
      setAreImagesPreloaded(true);
    };
    preloadAssets();
  }, []);

  // Auto-detect language on initial load
  useEffect(() => {
    const userLocales = Localization.getLocales();
    if (userLocales.length > 0) {
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

  const handleSelectLanguage = (selectedLanguage: string) => {
    setLanguage(selectedLanguage);
    setLanguagePickerVisible(false);
  };

  const resetAutoAdvanceTimer = useCallback(() => {
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    autoAdvanceTimer.current = setTimeout(() => handleNextFact(), 30000);
  }, []);

  // Load initial facts
  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const interests = await loadUserInterests();
      setUserInterestData(interests);
      const initialFacts: Fact[] = await fetchFactsFromApi(interests, ALL_CATEGORIES, 15);
      setFacts(initialFacts);
      setIsLoading(false);
    })();
  }, []);

  const handleNextFact = useCallback(async () => {
    const currentFact = facts[currentFactIndex];
    const timeSpent = Date.now() - viewStartTime.current;

    if (currentFact && timeSpent > 1000) {
      const categoryToTrack = isValidCategory(currentFact.category) ? currentFact.category : 'default';
      const updated = await trackFactInteraction(currentFact.id, categoryToTrack, timeSpent, "view");
      if (updated) setUserInterestData(updated);
    }

    if (currentFactIndex >= facts.length - 1) {
      const newFacts: Fact[] = await fetchFactsFromApi(userInterestData, ALL_CATEGORIES, 10);
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

  const handlePreviousFact = useCallback(() => {
    if (currentFactIndex > 0) {
      setCurrentFactIndex(currentFactIndex - 1);
      viewStartTime.current = Date.now();
      resetAutoAdvanceTimer();
    }
  }, [currentFactIndex, resetAutoAdvanceTimer]);

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

  useEffect(() => {
    resetAutoAdvanceTimer();
    return () => {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    };
  }, [resetAutoAdvanceTimer]);

  useEffect(() => {
    const currentFact = facts[currentFactIndex];
    if (currentFact) {
      const categoryKey = isValidCategory(currentFact.category) ? currentFact.category : 'default';
      const categoryColors = CATEGORY_COLORS[categoryKey];
      const randomColor = categoryColors[Math.floor(Math.random() * categoryColors.length)];
      setCurrentColorOverlay(randomColor);
    }
  }, [currentFactIndex, facts]);

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

  if (!currentFact || isLoading || !areImagesPreloaded) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading amazing facts...</Text>
        <Text style={styles.loadingSubtext}>Swipe up and down to navigate</Text>
      </View>
    );
  }

  const categoryKey = isValidCategory(currentFact.category) ? currentFact.category : 'default';
  const backgroundImageSource = CATEGORY_BACKGROUNDS[categoryKey];

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
          <ImageBackground
            source={backgroundImageSource}
            style={styles.backgroundImage}
            resizeMode="cover"
          >
            <View style={[styles.overlay, { backgroundColor: currentColorOverlay }]}>
              <SafeAreaView style={styles.safeArea}>
                <View style={styles.categoryIndicator}>
                  <Text style={styles.categoryText}>
                    {currentFact.category.toUpperCase()}
                  </Text>
                </View>

                <TouchableOpacity onPress={() => setLanguagePickerVisible(true)} style={styles.languageSwitcher}>
                  <Text style={styles.languageSwitcherText}>{language} ▾</Text>
                </TouchableOpacity>

                <View style={styles.factContainer}>
                  {isTranslating ? (
                    <ActivityIndicator size="large" color="#ffffff" />
                  ) : (
                    <View style={styles.textBackground}>
                      <Text style={styles.factText}>
                        {translatedSummary}
                      </Text>
                    </View>
                  )}
                </View>
                
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
          </ImageBackground>
        </Animated.View>
      </PanGestureHandler>

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
  backgroundImage: { flex: 1, width, height },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  safeArea: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  factContainer: {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  paddingHorizontal: 30,
  paddingVertical: 40,
  // Remove backgroundColor from here
},

textBackground: {
  backgroundColor: 'rgba(0, 0, 0, 0.4)', // Semi-transparent background
  paddingHorizontal: 20,
  paddingVertical: 15,
  borderRadius: 12, // Rounded corners for better look
  // Optional: add some styling
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 4,
  elevation: 5, // For Android shadow
},

factText: {
  fontSize: 28,
  fontWeight: '700',
  color: 'white',
  textAlign: 'center',
  lineHeight: 40,
  textShadowColor: 'rgba(0, 0, 0, 0.9)',
  textShadowOffset: { width: 2, height: 2 },
  textShadowRadius: 6,
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
  
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  languagePickerContainer: {
    position: 'absolute',
    top: 105,
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
