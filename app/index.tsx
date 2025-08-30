// app/index.tsx - Main entry point for FactSwipe with updated audio handling
import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Dimensions,
  StyleSheet,
  StatusBar,
  BackHandler,
  Animated,
  ImageBackground,
  Share,
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Localization from 'expo-localization';
import { Asset } from 'expo-asset';
// Replace Expo AV with Expo Audio
import { useAudioPlayer, AudioSource } from 'expo-audio';

import {
  fetchFactsFromApi,
  trackFactInteraction,
  loadUserInterests,
  UserInterests,
  ALL_CATEGORIES,
  Fact, // Make sure to export the Fact interface from FactServices
} from '../services/FactServices';

// Import your new components
import { LoadingScreen } from '../components/LoadingScreen';
import { FactCard } from '../components/FactCard';
import { LanguagePickerModal } from '../components/LanguagePickerModal';

// --- Translation Service ---

const DEEPL_API_KEY = 'API KEY';
const DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate';
const SUPPORTED_LANGUAGES = ['EN', 'ES', 'FR', 'DE', 'ZH'];

const LANGUAGE_FLAGS: { [key: string]: string } = {
  EN: '🇬🇧',
  ES: '🇪🇸',
  FR: '🇫🇷',
  DE: '🇩🇪',
  ZH: '🇨🇳',
};

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

const { height } = Dimensions.get('window');

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
  const [language, setLanguage] = useState<string>('EN');
  const [translatedSummary, setTranslatedSummary] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [isLanguagePickerVisible, setLanguagePickerVisible] = useState(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const translateY = useRef(new Animated.Value(0)).current;
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewStartTime = useRef<number>(Date.now());
  const gestureRef = useRef(null);

  // Replace old Audio.Sound with new useAudioPlayer hook
  const audioSource: AudioSource = require('../assets/sounds/ambiance.mp3');
  const player = useAudioPlayer(audioSource);

  // --- Updated Sound Handling with Expo Audio ---
  useEffect(() => {
    const setupAudio = async () => {
      try {
        // Set the player to loop
        player.loop = true;
        // Start playing the audio
        player.play();
      } catch (error) {
        console.error('Error setting up audio:', error);
      }
    };

    setupAudio();

    // Cleanup is handled automatically by the hook
  }, [player]);

  const handleToggleMute = async () => {
    try {
      if (isMuted) {
        player.play();
        setIsMuted(false);
      } else {
        player.pause();
        setIsMuted(true);
      }
    } catch (error) {
      console.error('Error toggling mute:', error);
    }
  };

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

  const handleShareFact = async () => {
    const currentFact = facts[currentFactIndex];
    if (!currentFact) return;

    try {
      await Share.share({
        message: `SwipNapse Discovery:\n\n"${translatedSummary}"`, // Use the translated text
        title: `A fact about ${currentFact.category}`, // Optional: for Android
      });
    } catch (error) {
      console.error('Error sharing fact:', error);
    }
  };

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

  if (isLoading || !currentFact || !areImagesPreloaded) {
    return <LoadingScreen />;
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
              <FactCard
                fact={currentFact}
                translatedSummary={translatedSummary}
                isTranslating={isTranslating}
                language={language}
                isMuted={isMuted}
                showHints={currentFactIndex < 3}
                onToggleLanguagePicker={() => setLanguagePickerVisible(true)}
                onToggleMute={handleToggleMute}
                onShare={handleShareFact}
              />
            </View>
          </ImageBackground>
        </Animated.View>
      </PanGestureHandler>

      <LanguagePickerModal
        isVisible={isLanguagePickerVisible}
        onClose={() => setLanguagePickerVisible(false)}
        onSelectLanguage={handleSelectLanguage}
        supportedLanguages={SUPPORTED_LANGUAGES}
        languageFlags={LANGUAGE_FLAGS}
      />
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  backgroundImage: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});

export default FactSwipeApp;