import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

/** Convert a local file or blob URI to a data: URL for API upload. */
export async function localImageToDataUri(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const lower = uri.toLowerCase();
  const mime = lower.includes('.png') ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${base64}`;
}
