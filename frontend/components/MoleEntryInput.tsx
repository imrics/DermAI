import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Platform,
  Keyboard,
  Alert,
} from 'react-native';
import { SymbolView } from 'expo-symbols';

import { useUser } from '@/hooks/use-user';
import { TextColors, spacing } from '@/constants/theme';

interface MoleEntryInputProps {
  visible: boolean;
  onSubmit: (location: string, customDate?: Date) => void;
  onCancel: () => void;
  getMoleLocations: () => Promise<string[]>;
  customDate?: Date;
}

export function MoleEntryInput({ visible, onSubmit, onCancel, getMoleLocations, customDate }: MoleEntryInputProps) {
  const { user } = useUser();
  const [location, setLocation] = useState('');
  const [existingLocations, setExistingLocations] = useState<string[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Load existing mole locations when component becomes visible
  useEffect(() => {
    if (visible && user) {
      loadExistingLocations();
      // Focus input after a brief delay to ensure it's rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [visible, user]);

  // Filter locations based on input
  useEffect(() => {
    if (location.trim()) {
      const filtered = existingLocations.filter(loc =>
        loc.toLowerCase().includes(location.toLowerCase())
      );
      setFilteredLocations(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setFilteredLocations(existingLocations);
      setShowSuggestions(existingLocations.length > 0);
    }
  }, [location, existingLocations]);

  const loadExistingLocations = async () => {
    if (!user) return;

    try {
      const locations = await getMoleLocations();
      setExistingLocations(locations);
    } catch (error) {
      console.warn('Failed to load mole locations:', error);
      setExistingLocations([]);
    }
  };

  const handleSubmit = () => {
    const trimmedLocation = location.trim();
    if (!trimmedLocation) {
      Alert.alert('Location Required', 'Please describe where the mole is located.');
      return;
    }

    onSubmit(trimmedLocation, customDate);
    setLocation('');
    setShowSuggestions(false);
    Keyboard.dismiss();
  };

  const handleSelectSuggestion = (selectedLocation: string) => {
    setLocation(selectedLocation);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleCancel = () => {
    setLocation('');
    setShowSuggestions(false);
    Keyboard.dismiss();
    onCancel();
  };

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Mole Location</Text>
          <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
            <SymbolView name="xmark" size={20} type="hierarchical" tintColor={TextColors.primary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.subtitle}>
          Describe where the mole is located (e.g., "back, upper left" or "arm, inner wrist")
        </Text>

        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={location}
            onChangeText={setLocation}
            placeholder="Enter mole location..."
            placeholderTextColor={TextColors.secondary}
            autoCapitalize="words"
            autoCorrect={true}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />

          {location.length > 0 && (
            <TouchableOpacity onPress={() => setLocation('')} style={styles.clearButton}>
              <SymbolView name="xmark.circle.fill" size={18} type="hierarchical" tintColor={TextColors.secondary} />
            </TouchableOpacity>
          )}
        </View>

        {showSuggestions && filteredLocations.length > 0 && (
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsTitle}>
              {location.trim() ? 'Matching locations:' : 'Previous locations:'}
            </Text>
            <FlatList
              data={filteredLocations}
              keyExtractor={(item, index) => `${item}-${index}`}
              renderItem={({ item }: { item: string }) => (
                <TouchableOpacity
                  style={styles.suggestionItem}
                  onPress={() => handleSelectSuggestion(item)}
                >
                  <Text style={styles.suggestionText}>{item}</Text>
                  <SymbolView name="chevron.right" size={14} type="hierarchical" tintColor={TextColors.secondary} />
                </TouchableOpacity>
              )}
              style={styles.suggestionsList}
              showsVerticalScrollIndicator={false}
            />
          </View>
        )}

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Add Mole Entry</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: spacing(4),
    margin: spacing(4),
    maxWidth: 400,
    width: '90%',
    maxHeight: '80%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
      },
      default: {
        elevation: 8,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing(3),
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: TextColors.primary,
  },
  cancelButton: {
    padding: spacing(1),
  },
  subtitle: {
    fontSize: 15,
    color: TextColors.secondary,
    lineHeight: 20,
    marginBottom: spacing(4),
  },
  inputContainer: {
    position: 'relative',
    marginBottom: spacing(3),
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 12,
    padding: spacing(3),
    fontSize: 16,
    color: TextColors.primary,
    backgroundColor: '#f8f9fa',
    paddingRight: 40,
  },
  clearButton: {
    position: 'absolute',
    right: spacing(2.5),
    top: '50%',
    transform: [{ translateY: -9 }],
  },
  suggestionsContainer: {
    maxHeight: 150,
    marginBottom: spacing(3),
  },
  suggestionsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: TextColors.secondary,
    marginBottom: spacing(2),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  suggestionsList: {
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  suggestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  suggestionText: {
    fontSize: 16,
    color: TextColors.primary,
    flex: 1,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: spacing(3),
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
