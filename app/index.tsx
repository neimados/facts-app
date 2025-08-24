// app/index.tsx - Main entry point for FactSwipe
import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Dimensions,
  StyleSheet,
  ImageBackground,
  StatusBar,
  BackHandler,
  Animated,
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

// TypeScript interfaces
interface Fact {
  id: string | number;
  summary: string;
  category: string;
}

interface UserInterests {
  [category: string]: number;
}

// Sample facts data - Replace with your MySQL API calls
const SAMPLE_FACTS: Fact[] = [
  { 
    id: 1, 
    summary: "Honey never spoils. Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old and still perfectly edible.", 
    category: "science" 
  },
  { 
    id: 2, 
    summary: "A group of flamingos is called a 'flamboyance'. This colorful name perfectly matches their vibrant appearance and social behavior.", 
    category: "animals" 
  },
  { 
    id: 3, 
    summary: "The human brain contains approximately 86 billion neurons, each connecting to thousands of others, creating a network more complex than any computer.", 
    category: "science" 
  },
  { 
    id: 4, 
    summary: "Bananas are berries, but strawberries aren't. Botanically speaking, berries must have seeds inside their flesh, which bananas do but strawberries don't.", 
    category: "nature" 
  },
  { 
    id: 5, 
    summary: "The shortest war in history lasted only 38-45 minutes. It was between Britain and Zanzibar in 1896.", 
    category: "history" 
  },
  { 
    id: 6, 
    summary: "Octopuses have three hearts and blue blood. Two hearts pump blood to the gills, while the third pumps blood to the rest of the body.", 
    category: "animals" 
  },
  { 
    id: 7, 
    summary: "A single cloud can weigh more than a million pounds, yet it floats in the sky due to the density difference with surrounding air.", 
    category: "science" 
  },
  { 
    id: 8, 
    summary: "Dolphins have names for each other. They develop signature whistles that function like names in human society.", 
    category: "animals" 
  },
];

// Category color schemes for dynamic overlays
const CATEGORY_COLORS: { [key: string]: string[] } = {
  science: ['rgba(64, 123, 255, 0.75)', 'rgba(30, 144, 255, 0.75)', 'rgba(0, 191, 255, 0.75)'],
  animals: ['rgba(255, 99, 71, 0.75)', 'rgba(255, 140, 0, 0.75)', 'rgba(255, 69, 0, 0.75)'],
  nature: ['rgba(34, 139, 34, 0.75)', 'rgba(60, 179, 113, 0.75)', 'rgba(46, 125, 50, 0.75)'],
  history: ['rgba(138, 43, 226, 0.75)', 'rgba(147, 112, 219, 0.75)', 'rgba(123, 104, 238, 0.75)'],
  default: ['rgba(105, 105, 105, 0.75)', 'rgba(119, 136, 153, 0.75)', 'rgba(112, 128, 144, 0.75)']
};

// Default background gradients (since we can't use require() with dynamic images in Expo Router)
const CATEGORY_GRADIENTS: { [key: string]: string[] } = {
  science: ['#1e3c72', '#2a5298'],
  animals: ['#ff7e5f', '#feb47b'],
  nature: ['#56ab2f', '#a8e6cf'],
  history: ['#667db6', '#0082c8'],
  default: ['#434343', '#000000']
};

const FactSwipeApp: React.FC = () => {
  // State management
  const [currentFactIndex, setCurrentFactIndex] = useState<number>(0);
  const [facts, setFacts] = useState<Fact[]>(SAMPLE_FACTS);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [userInterestData, setUserInterestData] = useState<UserInterests>({});
  const [currentColorOverlay, setCurrentColorOverlay] = useState<string>('');

  // Refs for animations and timers
  const translateY = useRef(new Animated.Value(0)).current;
  const autoAdvanceTimer = useRef<NodeJS.Timeout | null>(null);
  const viewStartTime = useRef<number>(Date.now());
  const gestureRef = useRef(null);

  // Simulate API call to fetch facts from MySQL database
  const fetchFactsFromDatabase = useCallback(async (interests: UserInterests = {}, batchSize: number = 20): Promise<Fact[]> => {
    setIsLoading(true);
    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // In production, this would be a real API call
      // const response = await fetch('your-api-endpoint/facts', { ... });
      
      // Simulate personalized fact selection based on interests
      const availableCategories = Object.keys(CATEGORY_COLORS);
      const newFacts: Fact[] = [];
      
      for (let i = 0; i < batchSize; i++) {
        // Select category based on user interests or random
        let selectedCategory: string;
        if (Object.keys(interests).length > 0) {
          const categoryWeights = Object.entries(interests);
          const randomValue = Math.random();
          let cumulativeWeight = 0;
          selectedCategory = categoryWeights[0][0]; // fallback
          
          for (const [category, weight] of categoryWeights) {
            cumulativeWeight += weight;
            if (randomValue <= cumulativeWeight) {
              selectedCategory = category;
              break;
            }
          }
        } else {
          selectedCategory = availableCategories[Math.floor(Math.random() * availableCategories.length)];
        }
        
        // Create a new fact (in production, this comes from database)
        const baseFact = SAMPLE_FACTS.find(f => f.category === selectedCategory) || SAMPLE_FACTS[0];
        newFacts.push({
          ...baseFact,
          id: `${baseFact.id}_${Date.now()}_${i}`, // Unique ID to avoid duplicates
        });
      }
      
      return newFacts;
    } catch (error) {
      console.error('Error fetching facts:', error);
      return SAMPLE_FACTS.slice(); // Return sample data as fallback
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Track user interaction time for personalization
  const trackFactInteraction = useCallback((factId: string | number, category: string, timeSpent: number) => {
    setUserInterestData(prev => {
      const currentTime = prev[category] || 0;
      const normalizedTime = Math.min(timeSpent, 60000) / 1000; // Cap at 60 seconds, convert to seconds
      const interestScore = Math.log(normalizedTime + 1); // Logarithmic scale
      
      return {
        ...prev,
        [category]: currentTime + interestScore
      };
    });

    // Store interaction data for persistence
    AsyncStorage.setItem(`interaction_${factId}`, JSON.stringify({
      category,
      timeSpent,
      timestamp: Date.now()
    })).catch(console.error);
  }, []);

  // Auto-advance timer management
  const resetAutoAdvanceTimer = useCallback(() => {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
    }
    
    autoAdvanceTimer.current = setTimeout(() => {
      handleNextFact();
    }, 30000); // 30 seconds
  }, []);

  // Handle navigation to next fact
  const handleNextFact = useCallback(async () => {
    const currentFact = facts[currentFactIndex];
    const timeSpent = Date.now() - viewStartTime.current;
    
    // Track interaction before moving
    if (currentFact && timeSpent > 1000) { // Only track if viewed for more than 1 second
      trackFactInteraction(currentFact.id, currentFact.category, timeSpent);
    }

    // Check if we need to load more facts
    if (currentFactIndex >= facts.length - 1) {
      const newFacts = await fetchFactsFromDatabase(userInterestData);
      if (newFacts.length > 0) {
        setFacts(prev => [...prev, ...newFacts]);
        setCurrentFactIndex(currentFactIndex + 1);
      }
    } else {
      setCurrentFactIndex(currentFactIndex + 1);
    }
    
    viewStartTime.current = Date.now();
    resetAutoAdvanceTimer();
  }, [currentFactIndex, facts, userInterestData, trackFactInteraction, fetchFactsFromDatabase, resetAutoAdvanceTimer]);

  // Handle navigation to previous fact
  const handlePreviousFact = useCallback(() => {
    if (currentFactIndex > 0) {
      setCurrentFactIndex(currentFactIndex - 1);
      viewStartTime.current = Date.now();
      resetAutoAdvanceTimer();
    }
  }, [currentFactIndex, resetAutoAdvanceTimer]);

  // Gesture handler for vertical swipes
  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: translateY } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = useCallback((event: any) => {
    const { nativeEvent } = event;
    
    if (nativeEvent.state === State.END) {
      const { translationY, velocityY } = nativeEvent;
      
      // Determine swipe direction and threshold
      const swipeThreshold = 80;
      const velocityThreshold = 800;
      
      if (translationY < -swipeThreshold || velocityY < -velocityThreshold) {
        // Swipe up - next fact
        handleNextFact();
      } else if (translationY > swipeThreshold || velocityY > velocityThreshold) {
        // Swipe down - previous fact
        handlePreviousFact();
      }
      
      // Reset animation with spring effect
      Animated.spring(translateY, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }
  }, [handleNextFact, handlePreviousFact, translateY]);

  // Initialize auto-advance timer
  useEffect(() => {
    resetAutoAdvanceTimer();
    return () => {
      if (autoAdvanceTimer.current) {
        clearTimeout(autoAdvanceTimer.current);
      }
    };
  }, [resetAutoAdvanceTimer]);

  // Preload next batch when halfway through current facts
  useEffect(() => {
    const preloadThreshold = Math.floor(facts.length * 0.6);
    if (currentFactIndex >= preloadThreshold && !isLoading) {
      fetchFactsFromDatabase(userInterestData).then(newFacts => {
        if (newFacts.length > 0) {
          setFacts(prev => [...prev, ...newFacts]);
        }
      });
    }
  }, [currentFactIndex, facts.length, isLoading, userInterestData, fetchFactsFromDatabase]);

  // Memory management - clear old facts to prevent memory bloat
  useEffect(() => {
    const bufferSize = 10;
    if (currentFactIndex > bufferSize && facts.length > bufferSize * 2) {
      const factsToKeep = facts.slice(currentFactIndex - bufferSize);
      setFacts(factsToKeep);
      setCurrentFactIndex(bufferSize);
    }
  }, [currentFactIndex, facts]);

  // Update color overlay when fact changes
  useEffect(() => {
    const currentFact = facts[currentFactIndex];
    if (currentFact) {
      const categoryColors = CATEGORY_COLORS[currentFact.category] || CATEGORY_COLORS.default;
      const randomColor = categoryColors[Math.floor(Math.random() * categoryColors.length)];
      setCurrentColorOverlay(randomColor);
    }
  }, [currentFactIndex, facts]);

  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (currentFactIndex > 0) {
        handlePreviousFact();
        return true; // Prevent default back action
      }
      return false; // Allow default back action (exit app)
    });

    return () => backHandler.remove();
  }, [currentFactIndex, handlePreviousFact]);

  // Load user interests from storage on app start
  useEffect(() => {
    AsyncStorage.getItem('userInterests')
      .then(data => {
        if (data) {
          setUserInterestData(JSON.parse(data));
        }
      })
      .catch(console.error);
  }, []);

  // Save user interests to storage when they change
  useEffect(() => {
    if (Object.keys(userInterestData).length > 0) {
      AsyncStorage.setItem('userInterests', JSON.stringify(userInterestData))
        .catch(console.error);
    }
  }, [userInterestData]);

  const currentFact = facts[currentFactIndex];
  
  // Loading screen
  if (!currentFact) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading amazing facts...</Text>
        <Text style={styles.loadingSubtext}>Swipe up and down to navigate</Text>
      </View>
    );
  }

  // Get gradient colors for current category
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
          <View style={[styles.backgroundGradient, { 
            backgroundColor: gradientColors[0] 
          }]}>
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

                {/* Navigation hints (only show for first few facts) */}
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
  container: {
    flex: 1,
  },
  backgroundGradient: {
    flex: 1,
    width: width,
    height: height,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  factContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 40,
  },
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
  categoryText: {
    color: 'white',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 1.2,
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
  hintsContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '500',
    marginVertical: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 40,
  },
  loadingText: {
    color: 'white',
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  loadingSubtext: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    textAlign: 'center',
  },
});

export default FactSwipeApp;