High-Level Description: Create a mobile application called FactSwipe for both iOS and Android. It's a global knowledge app where users can discover interesting facts by swiping up and down, similar to TikTok. The app should be designed for a seamless, fast, and engaging user experience, with a strong focus on performance and offline capabilities. It will be free to use and require no user account.

DataFetching
n8n workflow powered by AI.
Browse wikipedia database and determine if the facts can be summarize in less than 30 words while being comprehensive. 
Check for duplicates in the MySql database using wikidata uid.
Insert uid, summarize and add category tag based on the article in the database.

Core Features & Data Handling
Fact Display:
The main screen will display one fact at a time in full screen.
Users navigate through facts by swiping vertically (up and down).
Data Source:
Facts are stored in an external MySQL database.
The database has a table named knowledge_entries with the following columns: id (INT, Primary Key), summary, category.
Algorithm:
a random batch of facts are preloaded on the launch of the applications
A batch of facts must avoid duplicate facts as much as possible.
based on the time spent on each fact of the previous batch, the next batch of facts will be adjusted to contain facts from categories that interest the user the most.

Performance & User Experience
Seamless Swiping:
Implement a highly optimized preloading mechanism to ensure there is zero loading time between swipes.
While the user is viewing the first half of the currently loaded facts, the app should start preloading the next batch in the background.
To manage memory and maintain performance, the app should clear facts that have been viewed and are no longer in the immediate preload buffer (e.g., clear facts that are 10 swipes away).
Automatic Advancement:
If a user stays on a single fact for 30 seconds without any interaction, the app should automatically swipe to the next fact.

User Interface (UI)
Backgrounds:
The background of each fact slide should be a high-quality image corresponding to its category.
Apply a randomly selected color filter (e.g., a semi-transparent overlay of blue, green, purple, etc.) on top of the background image for each new slide to create a dynamic and visually appealing effect. The transition between filters should be smooth.
Text Display:
The fact_text should be displayed in the center of the screen.
Use a large, clean, and highly readable font with high contrast against the background (e.g., white text with a subtle drop shadow) to ensure legibility.
Simplicity:
The interface should be minimal. There are no buttons, menus, or complex navigation. The primary interaction is swiping.
