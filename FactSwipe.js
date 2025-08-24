import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  PanGestureHandler,
  Animated,
  Dimensions,
  StyleSheet,
  ImageBackground,
  StatusBar,
  BackHandler,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

// Sample data structure - replace with your MySQL API calls
const SAMPLE_FACTS = [
  { id: 1, summary: "Honey never spoils. Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old and still perfectly edible.", category: "science" },
  { id: 2, summary: "A group of flamingos is called a 'flamboyance'. This colorful name perfectly matches their vibrant appearance and social behavior.", category: "animals" },
  { id: 3, summary: "The human brain contains approximately 86 billion neurons, each connecting to thousands of others, creating a network more complex than any computer.", category: "science" },
  { id: 4, summary: "Bananas are berries, but strawberries aren't. Botanically speaking, berries must have seeds inside their flesh, which bananas do but strawberries don't.", category: "nature" },
  { id: 5, summary: "The shortest war in history lasted only 38-45 minutes. It was between Britain and Zanzibar in 1896.", category: "history" },
];

// Category background colors for dynamic overlays
const CATEGORY_COLORS = {
  science: ['rgba(64, 123, 255, 0.7)', 'rgba(30, 144, 255, 0.7)', 'rgba(0, 191, 255, 0.7)'],
  animals: ['rgba(255, 99, 71, 0.7)', 'rgba(255, 140, 0, 0.7)', 'rgba(255, 69, 0, 0.7)'],
  nature: ['rgba(34, 139, 34, 0.7)', 'rgba(60, 179, 113, 0.7)', 'rgba(46, 125, 50, 0.7)'],
  history: ['rgba(138, 43, 226, 0.7)', 'rgba(147, 112, 219, 0.7)', 'rgba(123, 104, 238, 0.7)'],
  default: ['rgba(105, 105, 105, 0.7)', 'rgba(119, 136, 153, 0.7)', 'rgba(112, 128, 144, 0.7)']
};

// Background images for categories (you'll need to add actual images to your assets)
const CATEGORY_BACKGROUNDS = {
  science: require('./assets/science-bg.jpg'), // Add your images
  animals: require('./assets/animals-bg.jpg'),
  nature: require('./assets/nature-bg.jpg'),
  history: require('./assets/history-bg.jpg'),
  default: require('./assets/default-bg.jpg'),
};

const FactSwipe = () => {
  const [currentFactIndex, setCurrentFactIndex] = useState(0);
  const [facts, setFacts] = useState(SAMPLE_FACTS);
  const [isLoading, setIsLoading] = useState(false);
  const [userInterestData, setUserInterestData] = useState({});
  
  const translateY = useRef(new Animated.Value(0)).current;
  const autoAdvanceTimer = useRef(null);
  const viewStartTime = useRef(Date.now());

  // Simulate API calls - replace with actual MySQL database calls
  const fetchFactsFromDatabase = useCallback(async (interests = {}) => {
    setIsLoading(true);
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // In real implementation, this would be an API call to your MySQL database
      // with user interest data to get personalized facts
      const newFacts = SAMPLE_FACTS.map((fact, index) => ({
        ...fact,
        id: fact.id + Math.random() * 1000, // Simulate different IDs to avoid duplicates
      }));
      
      return newFacts;
    } catch (error) {
      console.error('Error fetching facts:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Track time spent on each fact for interest calculation
  const trackFactInteraction = useCallback((factId, category, timeSpent) => {
    setUserInterestData(prev => ({
      ...prev,
      [category]: (prev[category] || 0) + timeSpent
    }));
  }, []);

  // Auto-advance after 30 seconds of inactivity
  const resetAutoAdvanceTimer = useCallback(() => {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
    }
    
    autoAdvanceTimer.current = setTimeout(() => {
      handleNextFact();
    }, 30000); // 30 seconds
  }, []);

  // Handle swipe to next fact
  const handleNextFact = useCallback(() => {
    const currentFact = facts[currentFactIndex];
    const timeSpent = Date.now() - viewStartTime.current;
    
    if (currentFact) {
      trackFactInteraction(currentFact.id, currentFact.category, timeSpent);
    }

    if (currentFactIndex < facts.length - 1) {
      setCurrentFactIndex(currentFactIndex + 1);
    } else {
      // Load more facts based on user interests
      fetchFactsFromDatabase(userInterestData).then(newFacts => {
        setFacts(prev => [...prev, ...newFacts]);
        setCurrentFactIndex(currentFactIndex + 1);
      });
    }
    
    viewStartTime.current = Date.now();
    resetAutoAdvanceTimer();
  }, [currentFactIndex, facts, userInterestData, trackFactInteraction, fetchFactsFromDatabase, resetAutoAdvanceTimer]);

  // Handle swipe to previous fact
  const handlePreviousFact = useCallback(() => {
    if (currentFactIndex > 0) {
      setCurrentFactIndex(currentFactIndex - 1);
      viewStartTime.current = Date.now();
      resetAutoAdvanceTimer();
    }
  }, [currentFactIndex, resetAutoAdvanceTimer]);

  // Gesture handler for vertical swipes
  const handleGestureStateChange = useCallback((event) => {
    const { nativeEvent } = event;
    
    if (nativeEvent.state === 5) { // GESTURE_STATE_END
      const { translationY, velocityY } = nativeEvent;
      
      // Determine swipe direction and threshold
      const swipeThreshold = 50;
      const velocityThreshold = 500;
      
      if (translationY < -swipeThreshold || velocityY < -velocityThreshold) {
        // Swipe up - next fact
        handleNextFact();
      } else if (translationY > swipeThreshold || velocityY > velocityThreshold) {
        // Swipe down - previous fact
        handlePreviousFact();
      }
      
      // Reset animation
      Animated.spring(translateY, {
        toValue: 0,
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
    const halfwayPoint = Math.floor(facts.length / 2);
    if (currentFactIndex >= halfwayPoint && !isLoading) {
      fetchFactsFromDatabase(userInterestData).then(newFacts => {
        if (newFacts.length > 0) {
          setFacts(prev => [...prev, ...newFacts]);
        }
      });
    }
  }, [currentFactIndex, facts.length, isLoading, userInterestData, fetchFactsFromDatabase]);

  // Memory management - clear old facts
  useEffect(() => {
    const bufferSize = 10;
    if (currentFactIndex > bufferSize) {
      setFacts(prev => prev.slice(currentFactIndex - bufferSize));
      setCurrentFactIndex(bufferSize);
    }
  }, [currentFactIndex]);

  // Handle Android back button
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
  
  if (!currentFact) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading amazing facts...</Text>
      </View>
    );
  }

  // Get random color overlay for current fact
  const categoryColors = CATEGORY_COLORS[currentFact.category] || CATEGORY_COLORS.default;
  const randomColor = categoryColors[Math.floor(Math.random() * categoryColors.length)];
  
  // Get background image for category
  const backgroundImage = CATEGORY_BACKGROUNDS[currentFact.category] || CATEGORY_BACKGROUNDS.default;

  return (
    <SafeAreaProvider>
      <StatusBar hidden />
      <PanGestureHandler
        onHandlerStateChange={handleGestureStateChange}
        onGestureEvent={Animated.event(
          [{ nativeEvent: { translationY: translateY } }],
          { useNativeDriver: true }
        )}
      >
        <Animated.View 
          style={[
            styles.container,
            {
              transform: [{ translateY }]
            }
          ]}
        >
          <ImageBackground
            source={backgroundImage}
            style={styles.backgroundImage}
            resizeMode="cover"
          >
            <View style={[styles.overlay, { backgroundColor: randomColor }]}>
              <SafeAreaView style={styles.safeArea}>
                <View style={styles.factContainer}>
                  <Text style={styles.factText}>
                    {currentFact.summary}
                  </Text>
                </View>
                
                {/* Optional: Add category indicator */}
                <View style={styles.categoryIndicator}>
                  <Text style={styles.categoryText}>
                    {currentFact.category.toUpperCase()}
                  </Text>
                </View>
                
                {/* Optional: Add progress indicator */}
                <View style={styles.progressContainer}>
                  <View 
                    style={[
                      styles.progressBar, 
                      { width: `${((currentFactIndex + 1) / facts.length) * 100}%` }
                    ]} 
                  />
                </View>
              </SafeAreaView>
            </View>
          </ImageBackground>
        </Animated.View>
      </PanGestureHandler>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
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
    paddingHorizontal: 20,
  },
  factText: {
    fontSize: 24,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
    lineHeight: 32,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    letterSpacing: 0.5,
  },
  categoryIndicator: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  categoryText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  progressContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  progressBar: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '500',
  },
});

export default FactSwipe;