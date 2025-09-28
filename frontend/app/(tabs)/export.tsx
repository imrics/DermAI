import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as Sharing from 'expo-sharing';
// Use the legacy FileSystem API as recommended for backward compatibility
import * as FileSystem from 'expo-file-system/legacy';

import { exportPdf } from '@/lib/api';
import { useUser } from '@/hooks/use-user';
import { AppGradient, Radii, spacing, TextColors } from '@/constants/theme';

export default function ExportScreen() {
  const { user } = useUser();
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState<{ message: string; tone: 'info' | 'error' } | null>(null);

  const handleExport = useCallback(async () => {
    if (!user) return;
    try {
      setExporting(true);
      setStatus(null);

      const { blob, filename } = await exportPdf(user.id);

      // For web platform, create blob URL and open in browser
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof URL !== 'undefined') {
        setStatus({ message: 'Report generated. Opening in your browser…', tone: 'info' });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');

        // Clean up the blob URL after a short delay
        setTimeout(() => {
          URL.revokeObjectURL(blobUrl);
        }, 10000);
      } else {
        // For mobile platforms, save file and share it
        setStatus({ message: 'Report generated. Preparing to share…', tone: 'info' });

        try {
          // Save blob to file first, then share the file
          console.log('Blob size:', blob.size, 'type:', blob.type);

          const fileName = `dermatology_report_${user.name.replace(/\s+/g, '_')}.pdf`;
          const fileUri = `${FileSystem.documentDirectory}${fileName}`;
          console.log('Target file URI:', fileUri);

          // Try different methods to save the PDF file
          const binaryString = await preparePDFFile(blob);
          console.log('Binary string length:', binaryString?.length || 'undefined');

          // Method 1: Try writing as bytes (best for binary data)
          try {
            // Convert binary string back to byte array
            const byteArray = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              byteArray[i] = binaryString.charCodeAt(i);
            }

            // Try using writeAsBytesAsync if available
            if ((FileSystem as any).writeAsBytesAsync) {
              await (FileSystem as any).writeAsBytesAsync(fileUri, Array.from(byteArray));
              console.log('File written as bytes successfully');
            } else {
              throw new Error('writeAsBytesAsync not available');
            }
          } catch (bytesError) {
            console.error('Bytes writing failed:', bytesError);
            // Method 2: Try writing as base64
            try {
              const base64Data = await blobToBase64ForFile(blob);
              console.log('Base64 data length:', base64Data.length);
              await FileSystem.writeAsStringAsync(fileUri, base64Data, { encoding: 'base64' } as any);
              console.log('File written as base64 successfully');
            } catch (base64Error) {
              console.error('Base64 writing failed:', base64Error);
              // Method 3: Last resort - write as binary string
              try {
                await FileSystem.writeAsStringAsync(fileUri, binaryString);
                console.log('File written as binary string successfully');
              } catch (stringError) {
                console.error('All writing methods failed:', stringError);
                throw new Error('All file writing methods failed');
              }
            }
          }

          // Verify file was created correctly
          const fileInfo = await FileSystem.getInfoAsync(fileUri);
          console.log('File info after writing:', fileInfo);
          console.log('File exists:', fileInfo.exists, 'size:', fileInfo.size);

          // Additional verification: try to read the file back
          if (fileInfo.exists) {
            try {
              const fileContent = await FileSystem.readAsStringAsync(fileUri);
              console.log('File content length when read back:', fileContent.length);
              console.log('First few bytes:', fileContent.substring(0, 10));
            } catch (readError) {
              console.error('Error reading file back:', readError);
            }
          }

          if (fileInfo.exists && fileInfo.size > 1000) { // PDF should be > 1KB
            console.log('File created successfully, size:', fileInfo.size);

            // Now share the file URI
            const isAvailable = await Sharing.isAvailableAsync();
            if (isAvailable) {
              const shareResult = await Sharing.shareAsync(fileUri, {
                mimeType: 'application/pdf',
                dialogTitle: 'Share Dermatology Report',
              });
              console.log('Share result:', shareResult);
              setStatus({ message: 'Report shared successfully', tone: 'info' });
            } else {
              setStatus({ message: `Report saved as ${fileName}`, tone: 'info' });
            }
          } else {
            throw new Error('File was not created properly');
          }
        } catch (fileError) {
          console.error('File handling error:', fileError);
          setStatus({
            message: 'Could not save the report file. Please try again.',
            tone: 'error'
          });
        }
      }
    } catch (error) {
      console.error('Failed to export report', error);
      setStatus({
        message: error instanceof Error ? error.message : 'We could not export your report. Please try again.',
        tone: 'error'
      });
    } finally {
      setExporting(false);
    }
  }, [user]);

  // Helper function to convert blob to base64 for file writing
  const blobToBase64ForFile = async (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data:application/pdf;base64, prefix
        const base64Data = result.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Helper function to handle PDF blob for file writing
  const preparePDFFile = async (blob: Blob): Promise<string> => {
    console.log('Starting PDF preparation, blob size:', blob.size);

    try {
      // Try using arrayBuffer() first (works on web)
      const arrayBuffer = await blob.arrayBuffer();
      console.log('Got arrayBuffer, size:', arrayBuffer.byteLength);
      const uint8Array = new Uint8Array(arrayBuffer);
      let binaryString = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binaryString += String.fromCharCode(uint8Array[i]);
      }
      console.log('Binary string length:', binaryString.length);
      return binaryString;
    } catch (error) {
      // Fallback for React Native where arrayBuffer() might not work
      console.log('arrayBuffer() failed, trying alternative method:', error);

      // Use FileReader as a fallback
      const binaryString = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          console.log('FileReader result type:', typeof result);
          if (result instanceof ArrayBuffer) {
            console.log('ArrayBuffer size:', result.byteLength);
            // Convert ArrayBuffer to string
            const uint8Array = new Uint8Array(result);
            let binaryString = '';
            for (let i = 0; i < uint8Array.length; i++) {
              binaryString += String.fromCharCode(uint8Array[i]);
            }
            console.log('Fallback binary string length:', binaryString.length);
            resolve(binaryString);
          } else {
            console.error('Unexpected FileReader result:', result);
            reject(new Error('Unexpected FileReader result type'));
          }
        };
        reader.onerror = () => {
          console.error('FileReader error:', reader.error);
          reject(reader.error);
        };
        reader.readAsArrayBuffer(blob);
      });

      return binaryString;
    }
  };

  return (
    <LinearGradient colors={AppGradient.light} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>Export Your Dermatology Report</Text>
          <Text style={styles.subtitle}>
            Create a PDF summary with your latest photos, AI assessments, and medication history to
            share with your dermatologist.
          </Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>What’s included</Text>
            <View style={styles.bulletRow}>
              <Text style={styles.bulletMark}>•</Text>
              <Text style={styles.bulletText}>Chronological entries for Acne, Norwood, and Moles</Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={styles.bulletMark}>•</Text>
              <Text style={styles.bulletText}>AI summaries, diagnoses, and recommended next steps</Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={styles.bulletMark}>•</Text>
              <Text style={styles.bulletText}>Active medications by condition with dosage details</Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={styles.bulletMark}>•</Text>
              <Text style={styles.bulletText}>High-resolution images for clinician review</Text>
            </View>
          </View>

          <View style={styles.ctaCard}>
            <Text style={styles.ctaTitle}>Ready to share your progress?</Text>
            <Text style={styles.ctaCopy}>
              DermAI assembles a polished PDF you can email, print, or bring to your next
              appointment.
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, exporting && styles.primaryButtonDisabled]}
              onPress={handleExport}
              disabled={exporting}
            >
              {exporting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Generate report</Text>}
            </TouchableOpacity>
            {status && (
              <Text style={[styles.status, status.tone === 'error' && styles.statusError]}>
                {status.message}
              </Text>
            )}
          </View>

          <View style={styles.infoBlock}>
            <Text style={styles.infoTitle}>Privacy first</Text>
            <Text style={styles.infoCopy}>
              Your data is stored securely and only used to generate this report. No information is
              shared without your explicit action.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(4),
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: TextColors.primary,
    marginBottom: spacing(1.5),
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: TextColors.secondary,
    marginBottom: spacing(3),
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.xl,
    padding: spacing(3),
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    marginBottom: spacing(3),
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TextColors.primary,
    marginBottom: spacing(2),
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing(1),
  },
  bulletMark: {
    fontSize: 18,
    color: '#4F46E5',
    marginRight: spacing(1),
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    color: TextColors.secondary,
    lineHeight: 22,
  },
  ctaCard: {
    backgroundColor: '#1D4ED8',
    borderRadius: Radii.xl,
    padding: spacing(3),
    marginBottom: spacing(3),
  },
  ctaTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: spacing(1),
  },
  ctaCopy: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
    marginBottom: spacing(2),
  },
  primaryButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.lg,
    paddingVertical: spacing(1.5),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing(1.5),
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#1D4ED8',
    fontSize: 16,
    fontWeight: '700',
  },
  status: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },
  statusError: {
    color: '#FEE2E2',
  },
  infoBlock: {
    padding: spacing(3),
    borderRadius: Radii.xl,
    backgroundColor: '#F1F5F9',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TextColors.primary,
    marginBottom: spacing(1),
  },
  infoCopy: {
    fontSize: 14,
    color: TextColors.secondary,
    lineHeight: 20,
  },
});
