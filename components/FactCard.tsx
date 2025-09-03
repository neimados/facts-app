// app/components/FactCard.tsx
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Fact } from '../services/FactServices'; // Assuming you export Fact interface from services

interface FactCardProps {
  fact: Fact;
  translatedSummary: string;
  isTranslating: boolean;
  language: string;
  isMuted: boolean;
  showHints: boolean;
  onToggleLanguagePicker: () => void;
  onToggleMute: () => void;
  onShare: () => void;
  onLike: () => void; 
  onDislike: () => void; 
}

export const FactCard = ({
  fact,
  translatedSummary,
  isTranslating,
  language,
  isMuted,
  showHints,
  onToggleLanguagePicker,
  onToggleMute,
  onShare,
  onLike,
  onDislike, 
}: FactCardProps) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.categoryIndicator}>
        <Text style={styles.categoryText}>{fact.category.toUpperCase()}</Text>
      </View>

      <TouchableOpacity onPress={onToggleLanguagePicker} style={styles.languageSwitcher}>
        <Text style={styles.languageSwitcherText}>{language} ▾</Text>
      </TouchableOpacity>

      <View style={styles.bottomControlsContainer}>
        <TouchableOpacity onPress={onShare} style={styles.controlButton}>
          <Ionicons name="share-social" size={24} color="white" />
        </TouchableOpacity>
        <TouchableOpacity onPress={onLike} style={styles.controlButton}>
          <Ionicons name="heart" size={24} color="#4CAF50" />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDislike} style={styles.controlButton}>
          <Ionicons name="thumbs-down-outline" size={24} color="#F44336" />
        </TouchableOpacity>
        <TouchableOpacity onPress={onToggleMute} style={styles.controlButton}>
          <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={24} color="white" />
        </TouchableOpacity>
      </View>

      <View style={styles.factContainer}>
        {isTranslating ? (
          <ActivityIndicator size="large" color="#ffffff" />
        ) : (
          <View style={styles.textBackground}>
            <Text style={styles.factText}>{translatedSummary}</Text>
          </View>
        )}
      </View>

      {showHints && (
        <View style={styles.hintsContainer}>
          <Text style={styles.hintText}>↑ Swipe up for next fact</Text>
          <Text style={styles.hintText}>↓ Swipe down for previous fact</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  factContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 40,
  },
  textBackground: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 12,
  },
  factText: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
    textAlign: 'center',
    lineHeight: 30,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 6,
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
  languageSwitcher: {
    position: 'absolute',
    top: 60,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  languageSwitcherText: { color: 'white', fontSize: 13, fontWeight: 'bold' },
  bottomControlsContainer: {
    position: 'absolute',
    bottom: 40,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    padding: 12,
    borderRadius: 30,
    marginLeft: 12, // Add some space between buttons
    zIndex: 10,
  },
  hintsContainer: {
    position: 'absolute',
    bottom: 100,
    alignItems: 'center'
  },
  hintText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginVertical: 2,
  },
});