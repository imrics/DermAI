import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
  FlatList,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { ActionSheetIOS } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { CreateEntryPayload, createEntry, getImageUrl } from '@/lib/api';
import { useUser } from '@/hooks/use-user';
import { TextColors, Brand, spacing } from '@/constants/theme';

interface AddMoleEntryModalProps {
  visible: boolean;
  onClose: () => void;
  onEntryAdded: () => void;
  existingMoleEntries: { location: string; entry: EntrySummary }[];
}

export function AddMoleEntryModal({
  visible,
  onClose,
  onEntryAdded,
  existingMoleEntries,
}: AddMoleEntryModalProps) {
  const { user } = useUser();
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Grid item component
  const renderLocationItem = ({ item }: { item: { location: string; entry: EntrySummary } }) => {
    const imageUri = getImageUrl(item.entry.image_id) || item.entry.photo_url || (item.entry as any).photoUrl;

    return (
      <TouchableOpacity
        style={styles.locationItem}
        onPress={() => setLocation(item.location)}
      >
        <View style={styles.imageContainer}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.locationImage} contentFit="cover" />
          ) : (
            <View style={[styles.locationImage, styles.imagePlaceholder]}>
              <Text style={styles.placeholderText}>No Image</Text>
            </View>
          )}
        </View>
        <Text style={styles.locationText} numberOfLines={2}>
          {item.location}
        </Text>
      </TouchableOpacity>
    );
  };

  const resetForm = () => {
    setLocation('');
    setDescription('');
    setLoading(false);
    setUploading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const openImagePicker = async (mode: 'camera' | 'library') => {
    if (!user) return;

    try {
      setUploading(true);

      const pickAsync =
        mode === 'camera'
          ? ImagePicker.launchCameraAsync
          : ImagePicker.launchImageLibraryAsync;

      if (mode === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== ImagePicker.PermissionStatus.GRANTED) {
          Alert.alert('Camera access needed', 'Please allow camera access to capture a new entry.');
          setUploading(false);
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== ImagePicker.PermissionStatus.GRANTED) {
          Alert.alert(
            'Photo library access needed',
            'Please allow media access to upload a new entry.',
          );
          setUploading(false);
          return;
        }
      }

      const result = await pickAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.85,
      });

      if (result.canceled) {
        setUploading(false);
        return;
      }

      const asset = result.assets?.[0];
      if (!asset) {
        setUploading(false);
        return;
      }

      // Validate inputs
      if (!location.trim()) {
        Alert.alert('Location required', 'Please describe where the mole is located.');
        setUploading(false);
        return;
      }

      const payload: CreateEntryPayload = {
        photo: {
          uri: asset.uri,
          name: asset.fileName ?? `entry-${Date.now()}.jpg`,
          type: asset.mimeType ?? 'image/jpeg',
        },
        sequence_id: location.trim(),
        user_notes: description.trim() || null,
      };

      const entry = await createEntry(user.id, 'mole', payload);
      await onEntryAdded();

      Alert.alert('Success', 'Mole entry added successfully!', [
        {
          text: 'OK',
          onPress: handleClose,
        },
      ]);
    } catch (error) {
      console.error('Failed to create mole entry', error);
      Alert.alert('Upload failed', 'We could not create the entry. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleImagePicker = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        (index) => {
          if (index === 1) openImagePicker('camera');
          if (index === 2) openImagePicker('library');
        },
      );
    } else {
      Alert.alert('Add Photo', 'Choose a source', [
        { text: 'Camera', onPress: () => openImagePicker('camera') },
        { text: 'Photo Library', onPress: () => openImagePicker('library') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const handleAddEntry = () => {
    if (!location.trim()) {
      Alert.alert('Location required', 'Please describe where the mole is located.');
      return;
    }

    handleImagePicker();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <SymbolView name="xmark" size={20} type="hierarchical" tintColor={TextColors.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Add Mole Entry</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.content}>
          <Text style={styles.label}>Where is the mole located?</Text>
          <TextInput
            placeholder="e.g., 'Left shoulder', 'Back of neck', etc."
            value={location}
            onChangeText={setLocation}
            style={styles.input}
          />

          {existingMoleEntries.length > 0 && (
            <View style={styles.locationsGrid}>
              <Text style={styles.gridLabel}>Previous locations:</Text>
              <FlatList
                data={existingMoleEntries}
                renderItem={renderLocationItem}
                keyExtractor={(item) => item.location}
                numColumns={3}
                contentContainerStyle={styles.gridContainer}
                scrollEnabled={false}
              />
            </View>
          )}

          <Text style={styles.label}>Additional notes (optional)</Text>
          <TextInput
            placeholder="Any additional details about this mole..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={styles.input}
          />

          <TouchableOpacity
            style={[styles.addButton, (loading || uploading) && styles.disabledButton]}
            onPress={handleAddEntry}
            disabled={loading || uploading}
          >
            {uploading ? (
              <View style={styles.buttonContent}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.buttonText}>Adding Entry...</Text>
              </View>
            ) : (
              <View style={styles.buttonContent}>
                <SymbolView name="camera" size={20} type="hierarchical" tintColor="#fff" />
                <Text style={styles.buttonText}>Add Entry</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(2),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    paddingTop: Platform.OS === 'ios' ? spacing(6) : spacing(2),
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: TextColors.primary,
  },
  headerSpacer: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: spacing(2),
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: TextColors.primary,
    marginBottom: spacing(1),
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: TextColors.primary,
    backgroundColor: '#fff',
    marginBottom: spacing(2),
  },
  locationsGrid: {
    marginBottom: spacing(2),
  },
  gridLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: TextColors.secondary,
    marginBottom: spacing(1),
  },
  gridContainer: {
    paddingBottom: spacing(2),
  },
  locationItem: {
    flex: 1,
    alignItems: 'center',
    margin: spacing(1),
    maxWidth: (Dimensions.get('window').width - spacing(4) - spacing(4)) / 3, // 3 columns with margins
  },
  imageContainer: {
    marginBottom: spacing(0.5),
  },
  locationImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  imagePlaceholder: {
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 10,
    color: TextColors.secondary,
  },
  locationText: {
    fontSize: 12,
    color: TextColors.primary,
    textAlign: 'center',
    lineHeight: 16,
  },
  addButton: {
    backgroundColor: Brand.purple,
    borderRadius: 16,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing(2),
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
