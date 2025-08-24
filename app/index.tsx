// app/index.tsx - Main entry point for FactSwipe with real API integration
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
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import {
  fetchFactsFromApi,
  trackFactInteraction,
  loadUserInterests,
  UserInterests,
  ALL_CATEGORIES
} from '../services/FactServices';

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

  const translateY = useRef(new Animated.Value(0)).current;
  const autoAdvanceTimer = useRef<NodeJS.Timeout | null>(null);
  const viewStartTime = useRef<number>(Date.now());
  const gestureRef = useRef(null);

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

                {/* Main fact content */}
                <View style={styles.factContainer}>
                  <Text style={styles.factText}>
                    {currentFact.summary}
                  </Text>
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
});

export default FactSwipeApp;
