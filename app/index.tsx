import * as React from 'react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Dimensions,
  StyleSheet,
  StatusBar,
  BackHandler,
  ImageBackground,
  Share,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Localization from 'expo-localization';
import { Asset } from 'expo-asset';
import { useAudioPlayer, AudioSource } from 'expo-audio';
import * as Haptics from 'expo-haptics';

import {
  fetchFactsFromApi,
  trackFactInteraction,
  loadUserInterests,
  UserInterests,
  ALL_CATEGORIES,
  Fact,
} from '../services/FactServices';

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
  // 1. Hue: The color itself (0-360). We keep this fully random.
  const hue = Math.floor(Math.random() * 361);
  const saturation = Math.floor(70 + Math.random() * 21);
  const lightness = Math.floor(30 + Math.random() * 16);
  return `hsla(${hue}, ${saturation}%, ${lightness}%, 0.35)`;
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
  
  // New state for gesture management
  const [canUseGestures, setCanUseGestures] = useState(true);

  const translateY = useSharedValue(0);
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewStartTime = useRef<number>(Date.now());

  const audioSource = Asset.fromModule(require('../assets/sounds/ambiance.mp3')).uri;
  const player = useAudioPlayer(audioSource);

  // --- Sound Handling with Expo Audio ---
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); // Add light feedback
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
      const audioAsset = require('../assets/sounds/ambiance.mp3');
      await Asset.loadAsync([...imageUrls, audioAsset]); 
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

  // Disable gestures when modal is visible or after recent gesture
  useEffect(() => {
    if (isLanguagePickerVisible) {
      setCanUseGestures(false);
    } else {
      // Re-enable gestures after a delay when modal closes
      const timer = setTimeout(() => {
        setCanUseGestures(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isLanguagePickerVisible]);

  const handleNextFact = useCallback(async () => {
    setCanUseGestures(false);
    
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
    
    // Re-enable gestures after animation completes
    setTimeout(() => {
      setCanUseGestures(true);
    }, 500);
  }, [currentFactIndex, facts, userInterestData, resetAutoAdvanceTimer]);

  const handlePreviousFact = useCallback(() => {
    setCanUseGestures(false);
    
    if (currentFactIndex > 0) {
      setCurrentFactIndex(currentFactIndex - 1);
      viewStartTime.current = Date.now();
      resetAutoAdvanceTimer();
    }
    
    setTimeout(() => {
      setCanUseGestures(true);
    }, 500);
  }, [currentFactIndex, resetAutoAdvanceTimer]);

  const handleLikeFact = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const currentFact = facts[currentFactIndex];
    if (!currentFact) return;

    const categoryToTrack = isValidCategory(currentFact.category) ? currentFact.category : 'default';
    // The `timeSpent` is not as relevant for a direct action, so we can pass 0
    const updated = await trackFactInteraction(currentFact.id, categoryToTrack, 0, "like");
    if (updated) setUserInterestData(updated);
    handleNextFact();
  }, [currentFactIndex, facts, handleNextFact]);

  const handleDislikeFact = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const currentFact = facts[currentFactIndex];
    if (!currentFact) return;

    const categoryToTrack = isValidCategory(currentFact.category) ? currentFact.category : 'default';
    const updated = await trackFactInteraction(currentFact.id, categoryToTrack, 0, "dislike");
    if (updated) setUserInterestData(updated);
    handleNextFact();
  }, [currentFactIndex, facts, handleNextFact]);

  const handleShareFact = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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

  // Create a simple pan gesture
  const simplePanGesture = useMemo(() => {
    return Gesture.Pan()
      .enabled(canUseGestures)
      .minDistance(10)
      .failOffsetX([-50, 50])
      .maxPointers(1)
      .onChange((event) => {
        if (canUseGestures) {
          translateY.value = event.translationY;
        }
      })
      .onFinalize((event) => {
        if (!canUseGestures) return;
        
        const swipeThreshold = 80;
        const velocityThreshold = 800;
        
        if (event.translationY < -swipeThreshold || event.velocityY < -velocityThreshold) {
          runOnJS(handleNextFact)();
        } else if (event.translationY > swipeThreshold || event.velocityY > velocityThreshold) {
          runOnJS(handlePreviousFact)();
        }
        
        translateY.value = withSpring(0, {
          damping: 15,
          stiffness: 150,
        });
      });
  }, [canUseGestures, handleNextFact, handlePreviousFact, translateY]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: translateY.value * 0.3, // Damping factor for smoother movement
        },
      ],
    };
  });

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

  // Render card content
  const cardContent = (
    <Animated.View style={[styles.cardContainer, animatedStyle]}>
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
        onLike={handleLikeFact}
        onDislike={handleDislikeFact}
      />
    </Animated.View>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar hidden />
        <View style={styles.container}>
          <ImageBackground
            source={backgroundImageSource}
            style={styles.backgroundImage}
            resizeMode="cover"
          >
            <View style={[styles.overlay, { backgroundColor: currentColorOverlay }]}>
              {canUseGestures && !isLanguagePickerVisible ? (
                <GestureDetector gesture={simplePanGesture}>
                  {cardContent}
                </GestureDetector>
              ) : (
                cardContent
              )}
            </View>
          </ImageBackground>
        </View>

        <LanguagePickerModal
          isVisible={isLanguagePickerVisible}
          onClose={() => setLanguagePickerVisible(false)}
          onSelectLanguage={handleSelectLanguage}
          supportedLanguages={SUPPORTED_LANGUAGES}
          languageFlags={LANGUAGE_FLAGS}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  backgroundImage: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cardContainer: { 
    width: '100%', 
    height: '100%', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
});

export default FactSwipeApp;