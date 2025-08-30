// app/components/LanguagePickerModal.tsx
import React from 'react';
import { Modal, View, Text, StyleSheet, Pressable, TouchableOpacity } from 'react-native';

interface LanguagePickerProps {
  isVisible: boolean;
  onClose: () => void;
  onSelectLanguage: (language: string) => void;
  supportedLanguages: string[];
  languageFlags: { [key: string]: string };
}

export const LanguagePickerModal = ({
  isVisible,
  onClose,
  onSelectLanguage,
  supportedLanguages,
  languageFlags,
}: LanguagePickerProps) => (
  <Modal
    transparent={true}
    visible={isVisible}
    animationType="fade"
    onRequestClose={onClose}
  >
    <Pressable style={styles.modalOverlay} onPress={onClose}>
      <View style={styles.languagePickerContainer}>
        {supportedLanguages.map((lang) => (
          <TouchableOpacity
            key={lang}
            style={styles.languageOption}
            onPress={() => onSelectLanguage(lang)}
          >
            <Text style={styles.languageFlagText}>{languageFlags[lang]}</Text>
            <Text style={styles.languageOptionText}>{lang}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Pressable>
  </Modal>
);

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  languagePickerContainer: {
    position: 'absolute',
    top: 120,
    left: 20,
    backgroundColor: 'rgba(40, 40, 40, 0.95)',
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  languageFlagText: {
    fontSize: 22,
    marginRight: 12,
  },
  languageOptionText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});