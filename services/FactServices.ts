// services/FactService.ts - TypeScript version of the API service
import AsyncStorage from '@react-native-async-storage/async-storage';

// TypeScript interfaces
export interface Fact {
  id: string | number;
  summary: string;
  category: string;
  created_at?: string;
  updated_at?: string;
}

export interface UserInterests {
  [category: string]: number;
}

interface CacheData {
  facts: Fact[];
  timestamp: number;
}

interface InteractionData {
  factId: string | number;
  category: string;
  timeSpent: number;
  action: string;
  timestamp: number;
}

class FactService {
  private cache: Map<string | number, Fact> = new Map();
  private preloadedBatches: Fact[][] = [];
  private readonly API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://your-backend-api.com/api';

  /**
   * Fetch facts from MySQL database via your backend API
   */
  async fetchFacts(
    userInterests: UserInterests = {}, 
    batchSize: number = 20, 
    excludeIds: (string | number)[] = []
  ): Promise<Fact[]> {
    try {
      const requestBody = {
        interests: userInterests,
        batchSize,
        excludeIds,
        timestamp: Date.now()
      };

      const response = await fetch(`${this.API_BASE_URL}/facts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.facts || [];
    } catch (error) {
      console.error('Error fetching facts from API:', error);
      
      // Fallback to cached data or default facts
      return this.getFallbackFacts();
    }
  }

  /**
   * Get initial batch of random facts for app startup
   */
  async getInitialFacts(batchSize: number = 30): Promise<Fact[]> {
    try {
      // Try to load cached facts first for faster startup
      const cachedFacts = await this.getCachedFacts();
      if (cachedFacts && cachedFacts.length > 0) {
        // Return cached facts and fetch fresh ones in background
        this.fetchFacts({}, batchSize).then(freshFacts => {
          if (freshFacts.length > 0) {
            this.cacheFacts(freshFacts);
          }
        });
        return cachedFacts.slice(0, batchSize);
      }

      // No cached facts, fetch fresh ones
      const facts = await this.fetchFacts({}, batchSize);
      if (facts.length > 0) {
        await this.cacheFacts(facts);
      }
      return facts;
    } catch (error) {
      console.error('Error getting initial facts:', error);
      return this.getFallbackFacts();
    }
  }

  /**
   * Get personalized facts based on user interests
   */
  async getPersonalizedFacts(userInterests: UserInterests, viewedFactIds: (string | number)[] = []): Promise<Fact[]> {
    // Convert viewing time to interest scores
    const totalTime = Object.values(userInterests).reduce((sum, time) => sum + time, 0);
    const interestScores: UserInterests = {};
    
    Object.entries(userInterests).forEach(([category, time]) => {
      interestScores[category] = totalTime > 0 ? (time / totalTime) : 0;
    });

    return await this.fetchFacts(interestScores, 20, viewedFactIds);
  }

  /**
   * Cache facts locally for offline access and faster startup
   */
  async cacheFacts(facts: Fact[]): Promise<void> {
    try {
      const cacheData: CacheData = {
        facts,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem('cached_facts', JSON.stringify(cacheData));
      
      // Also update in-memory cache
      facts.forEach(fact => {
        this.cache.set(fact.id, fact);
      });
    } catch (error) {
      console.error('Error caching facts:', error);
    }
  }

  /**
   * Get cached facts from local storage
   */
  async getCachedFacts(): Promise<Fact[] | null> {
    try {
      const cacheData = await AsyncStorage.getItem('cached_facts');
      if (cacheData) {
        const { facts, timestamp }: CacheData = JSON.parse(cacheData);
        
        // Check if cache is still valid (24 hours)
        const cacheAge = Date.now() - timestamp;
        const maxCacheAge = 24 * 60 * 60 * 1000; // 24 hours
        
        if (cacheAge < maxCacheAge) {
          return facts;
        }
      }
      return null;
    } catch (error) {
      console.error('Error getting cached facts:', error);
      return null;
    }
  }

  /**
   * Fallback facts when API is unavailable
   */
  getFallbackFacts(): Fact[] {
    return [
      {
        id: 'fallback_1',
        summary: "The human brain uses about 20% of the body's total energy, despite being only 2% of body weight.",
        category: 'science'
      },
      {
        id: 'fallback_2',
        summary: "Octopuses have three hearts and blue blood. Two hearts pump blood to the gills, while the third pumps blood to the rest of the body.",
        category: 'animals'
      },
      {
        id: 'fallback_3',
        summary: "The Amazon rainforest produces about 20% of the world's oxygen, earning it the nickname 'lungs of the Earth'.",
        category: 'nature'
      },
      {
        id: 'fallback_4',
        summary: "The Great Wall of China is not visible from space with the naked eye, contrary to popular belief.",
        category: 'history'
      },
      {
        id: 'fallback_5',
        summary: "A day on Venus is longer than its year. Venus rotates so slowly that it takes 243 Earth days to complete one rotation.",
        category: 'science'
      },
      {
        id: 'fallback_6',
        summary: "Dolphins have names for each other. They develop signature whistles that function like names in human society.",
        category: 'animals'
      },
      {
        id: 'fallback_7',
        summary: "A single cloud can weigh more than a million pounds, yet it floats in the sky due to the density difference with surrounding air.",
        category: 'science'
      },
      {
        id: 'fallback_8',
        summary: "The shortest war in history lasted only 38-45 minutes. It was between Britain and Zanzibar in 1896.",
        category: 'history'
      }
    ];
  }

  /**
   * Preload next batch of facts in background
   */
  async preloadNextBatch(userInterests: UserInterests, viewedFactIds: (string | number)[]): Promise<Fact[]> {
    try {
      const facts = await this.getPersonalizedFacts(userInterests, viewedFactIds);
      this.preloadedBatches.push(facts);
      return facts;
    } catch (error) {
      console.error('Error preloading facts:', error);
      return [];
    }
  }

  /**
   * Get preloaded batch if available, otherwise fetch new one
   */
  async getNextBatch(userInterests: UserInterests, viewedFactIds: (string | number)[]): Promise<Fact[]> {
    if (this.preloadedBatches.length > 0) {
      const batch = this.preloadedBatches.shift();
      return batch || [];
    }
    return await this.getPersonalizedFacts(userInterests, viewedFactIds);
  }

  /**
   * Track user interaction for interest calculation
   */
  async trackFactInteraction(
    factId: string | number, 
    category: string, 
    timeSpent: number, 
    action: string = 'view'
  ): Promise<void> {
    try {
      // Store locally first
      const interactionData: InteractionData = {
        factId,
        category,
        timeSpent,
        action,
        timestamp: Date.now(),
      };
      
      await AsyncStorage.setItem(
        `interaction_${factId}_${Date.now()}`, 
        JSON.stringify(interactionData)
      );

      // Send to backend for analytics (if available)
      await fetch(`${this.API_BASE_URL}/interactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(interactionData),
      });
    } catch (error) {
      console.error('Error tracking interaction:', error);
      // Continue without blocking the app
    }
  }

  /**
   * Get user's interaction history for analytics
   */
  async getUserInteractionHistory(): Promise<InteractionData[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const interactionKeys = keys.filter(key => key.startsWith('interaction_'));
      
      if (interactionKeys.length === 0) return [];

      const interactions = await AsyncStorage.multiGet(interactionKeys);
      return interactions
        .map(([_, value]) => value ? JSON.parse(value) : null)
        .filter(Boolean) as InteractionData[];
    } catch (error) {
      console.error('Error getting interaction history:', error);
      return [];
    }
  }

  /**
   * Calculate user interests based on interaction history
   */
  async calculateUserInterests(): Promise<UserInterests> {
    try {
      const interactions = await this.getUserInteractionHistory();
      const interests: UserInterests = {};

      interactions.forEach(interaction => {
        const { category, timeSpent } = interaction;
        const normalizedTime = Math.min(timeSpent, 60000) / 1000; // Cap at 60s, convert to seconds
        const interestScore = Math.log(normalizedTime + 1); // Logarithmic scale

        interests[category] = (interests[category] || 0) + interestScore;
      });

      // Normalize scores to percentages
      const totalScore = Object.values(interests).reduce((sum, score) => sum + score, 0);
      if (totalScore > 0) {
        Object.keys(interests).forEach(category => {
          interests[category] = interests[category] / totalScore;
        });
      }

      return interests;
    } catch (error) {
      console.error('Error calculating user interests:', error);
      return {};
    }
  }

  /**
   * Clear old cached data to manage storage
   */
  async clearOldCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem('cached_facts');
      this.cache.clear();
      
      // Clear old interaction data (keep last 1000 interactions)
      const keys = await AsyncStorage.getAllKeys();
      const interactionKeys = keys.filter(key => key.startsWith('interaction_'));
      
      if (interactionKeys.length > 1000) {
        const keysToRemove = interactionKeys.slice(0, interactionKeys.length - 1000);
        await AsyncStorage.multiRemove(keysToRemove);
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Get cache statistics for debugging
   */
  async getCacheStats(): Promise<{
    cachedFactsCount: number;
    interactionCount: number;
    cacheAge: number;
  }> {
    try {
      const cachedFacts = await this.getCachedFacts();
      const interactions = await this.getUserInteractionHistory();
      const cacheData = await AsyncStorage.getItem('cached_facts');
      
      let cacheAge = 0;
      if (cacheData) {
        const { timestamp } = JSON.parse(cacheData);
        cacheAge = Date.now() - timestamp;
      }

      return {
        cachedFactsCount: cachedFacts?.length || 0,
        interactionCount: interactions.length,
        cacheAge: cacheAge,
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        cachedFactsCount: 0,
        interactionCount: 0,
        cacheAge: 0,
      };
    }
  }

  /**
   * Reset all user data (useful for testing or user preference)
   */
  async resetUserData(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const userDataKeys = keys.filter(key => 
        key.startsWith('interaction_') || 
        key === 'cached_facts' || 
        key === 'userInterests'
      );
      
      await AsyncStorage.multiRemove(userDataKeys);
      this.cache.clear();
      this.preloadedBatches = [];
    } catch (error) {
      console.error('Error resetting user data:', error);
    }
  }
}

// Export singleton instance
export const factService = new FactService();
export default factService;