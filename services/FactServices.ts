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
  "Environment",
  "Other"
];

const API_URL = "API URL";

// --- Helpers ---
function normalizeCategory(category: string): string {
  return category.toLowerCase();
}

function weightedRandomCategory(interests: UserInterests, categories: string[]): string {
  if (Object.keys(interests).length === 0) {
    return categories[Math.floor(Math.random() * categories.length)];
  }

  const totalWeight = Object.values(interests).reduce((a, b) => a + b, 0);
  const r = Math.random() * totalWeight;

  let cumulative = 0;
  for (const category of categories) {
    cumulative += interests[category] || 0;
    if (r <= cumulative) {
      return category;
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
  timeSpent: number,
  action: "view" | "like" | "dislike" = "view"
) {
  try {
    const key = "userInterests";
    const stored = await AsyncStorage.getItem(key);
    let interests: UserInterests = stored ? JSON.parse(stored) : {};

    const normalized = normalizeCategory(category);

    // Score: time spent (logarithmic) + bonus for like/dislike
    let score = Math.log(Math.min(timeSpent, 60000) / 1000 + 1);
    if (action === "like") score += 2;
    if (action === "dislike") score -= 1;

    interests[normalized] = (interests[normalized] || 0) + score;

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
