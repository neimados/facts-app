// services/FactServices.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Fact {
  id: string | number;
  summary: string;
  category: string;
}

export interface UserInterests {
  [category: string]: number;
}

export const ALL_CATEGORIES: string[] = [
  "Technology",
  "Science",
  "History",
  "Geography",
  "Arts",
  "Sports",
  "Politics",
  "Medicine",
  "Environment"
];

const API_URL = "API URL";

function normalizeCategory(category: string): string {
  return category.toLowerCase();
}

function weightedRandomCategory(interests: UserInterests, categories: string[]): string {
  const EXPLORATION_WEIGHT = 5; // Adjust this value to control randomness. Higher = more exploration.

  if (Object.keys(interests).length === 0) {
    return categories[Math.floor(Math.random() * categories.length)];
  }

  const weightedCategories = categories.map(category => {
    // Get the user's score for the category, default to 0 if not present.
    const userScore = interests[category] || 0;
    const weight = Math.max(1, userScore + EXPLORATION_WEIGHT);
    
    return { category, weight };
  });

  const totalWeight = weightedCategories.reduce((sum, item) => sum + item.weight, 0);
  const r = Math.random() * totalWeight;

  let cumulative = 0;
  for (const item of weightedCategories) {
    cumulative += item.weight;
    if (r <= cumulative) {
      return item.category;
    }
  }
  return categories[Math.floor(Math.random() * categories.length)];
}

// --- API Calls ---
export async function fetchFactByCategory(category: string): Promise<Fact | null> {
  try {
    // Capitalize first letter (Science, History, etc.)
    const apiCategory = category.charAt(0).toUpperCase() + category.slice(1);

    const response = await fetch(`${API_URL}?category=${encodeURIComponent(apiCategory)}`);
    if (!response.ok) throw new Error(`Network error fetching fact (${response.status})`);

    const data = await response.json();

    return {
      id: data.id,
      summary: data.summary,
      category: normalizeCategory(data.category || category) // store lowercase internally
    };
  } catch (error) {
    console.error("Error fetching fact:", error);
    return null;
  }
}


export async function fetchFactsFromApi(
  interests: UserInterests = {},
  categories: string[] = ALL_CATEGORIES,
  batchSize: number = 10
): Promise<Fact[]> {
  const facts: Fact[] = [];
  // Use a Set for efficient O(1) lookups to track IDs in the current batch
  const fetchedFactIds = new Set<string | number>();
  
  // Add a safety limit to prevent potential infinite loops
  const maxAttempts = batchSize * 2; 
  let attempts = 0;

  // Use a 'while' loop to ensure we collect enough UNIQUE facts
  while (facts.length < batchSize && attempts < maxAttempts) {
    attempts++;
    
    const chosenCategory = weightedRandomCategory(
      interests,
      categories.map(c => normalizeCategory(c))
    );
    
    const fact = await fetchFactByCategory(chosenCategory);

    // Only add the fact if it's valid AND its ID hasn't been seen yet
    if (fact && !fetchedFactIds.has(fact.id)) {
      fetchedFactIds.add(fact.id); // Add the new ID to our set
      facts.push(fact);           // Add the unique fact to our results
    }
  }

  return facts;
}

// --- Tracking user interests ---
export async function trackFactInteraction(
  factId: string | number,
  category: string,
  timeSpent: number, // in milliseconds
  action: "view" | "like" | "dislike" = "view"
) {
  try {
    const key = "userInterests";
    const stored = await AsyncStorage.getItem(key);
    let interests: UserInterests = stored ? JSON.parse(stored) : {};

    const normalized = normalizeCategory(category);
    const currentScore = interests[normalized] || 0;
    
    let scoreChange = 0;

    // 1. Calculate a base score from time spent.
    // Max of 10 points for viewing up to 30 seconds.
    const timeScore = Math.min(timeSpent / 1000, 30) / 3;

    // 2. Adjust the final score based on the explicit user action.
    if (action === "like") {
      scoreChange = 15;
    } else if (action === "dislike") {
      scoreChange = -20;
    } else { // "view" action
      scoreChange = timeSpent > 1000 ? 0.5 + timeScore : timeScore;
    }
    
    // 3. Calculate the new score and apply caps.
    const newScore = Math.max(-50, currentScore + scoreChange);

    interests[normalized] = newScore;

    await AsyncStorage.setItem(key, JSON.stringify(interests));
    return interests;
  } catch (err) {
    console.error("Error tracking interaction:", err);
  }
  return {};
}

export async function loadUserInterests(): Promise<UserInterests> {
  try {
    const data = await AsyncStorage.getItem("userInterests");
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error("Error loading interests:", error);
    return {};
  }
}
