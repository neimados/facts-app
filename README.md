# Swipnapse

**Discover the world’s most fascinating facts with a swipe.**

Swipnapse is a **React Native** mobile app for iOS and Android, delivering bite-sized, engaging facts in a seamless, TikTok-like swiping experience. Powered by **AI-driven data curation, auto-translation, and adaptive learning**, Swipnapse offers a minimalist, immersive experience—no accounts, no ads, just pure knowledge at your fingertips.

---

## 🌟 Why Swipnapse?

Swipnapse is built for **speed, simplicity, and personalization**:
- **AI-Powered Fact Curation**: Our backend uses an **n8n workflow** to scrape, analyze, and summarize Wikipedia articles into concise, engaging facts (under 30 words). Each fact is tagged by category and deduplicated using **Wikidata UIDs**.
- **Auto-Translation**: Facts are **automatically translated** into the user’s preferred language using AI, with the option to switch languages on the fly.
- **Adaptive Learning**: The app learns from user behavior, adjusting future fact batches based on **time spent per category** to keep content relevant and engaging.
- **Offline-First**: Facts are preloaded in batches, ensuring **zero loading time** between swipes—even offline.

---

## 🚀 Core Features

### 1. AI-Driven Data Pipeline
- **Wikipedia Scraping**: Automatically fetches and processes articles.
- **Summarization**: Uses AI to distill facts into **under 30 words** while retaining accuracy.
- **Deduplication**: Ensures no repeated facts using **Wikidata UIDs**.
- **Category Tagging**: Facts are categorized (e.g., Science, History, Tech) for personalized delivery.

### 2. Smart Preloading Algorithm
- **Batch Loading**: Facts are loaded in batches to eliminate delays.
- **Interest-Based**: Adjusts content based on **user engagement metrics** (time spent per category).
- **Memory Efficiency**: Clears old facts to optimize performance.

### 3. Seamless User Experience
- **Swipe Navigation**: Intuitive vertical swiping (up/down) to explore facts.
- **Auto-Advance**: Moves to the next fact after **30 seconds of inactivity**.
- **Minimalist UI**: No buttons, no clutter—just **high-contrast text** for maximum readability.

### 4. Multi-Language Support
- **Auto-Translation**: Facts are translated in real-time to the user’s device language.
- **Language Switcher**: Users can manually select their preferred language.

---

## 🛠 Technical Stack

| Area               | Technology Stack                          |
|--------------------|-------------------------------------------|
| **Frontend**       | React Native, Expo                        |
| **Backend**        | MySQL (for fact storage)                  |
| **AI/Automation**  | n8n (Wikipedia scraping, summarization, deduplication, translation) |
|                    | ChatGPT API 5 Nano                       |
|                    | DeepL Translation API                    |
| **Performance**    | Optimized preloading, memory management  |

