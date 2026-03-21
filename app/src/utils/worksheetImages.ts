import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

export const WORKSHEET_MERGE_MAX_WIDTH = 1024;

export function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      reject
    );
  });
}

/** Resize so width ≤ maxWidth (JPEG). Returns original uri if already small enough. */
export async function normalizeToMaxWidth(uri: string, maxWidth: number): Promise<string> {
  const { width } = await getImageSize(uri);
  if (width <= maxWidth) return uri;
  const out = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxWidth } }],
    { compress: 0.88, format: ImageManipulator.SaveFormat.JPEG }
  );
  return out.uri;
}

/** Image fitted with resizeMode="contain" inside a box of size cw×ch. */
export function computeContainRect(
  containerW: number,
  containerH: number,
  naturalW: number,
  naturalH: number
): { x: number; y: number; width: number; height: number } {
  const scale = Math.min(containerW / naturalW, containerH / naturalH);
  const width = naturalW * scale;
  const height = naturalH * scale;
  const x = (containerW - width) / 2;
  const y = (containerH - height) / 2;
  return { x, y, width, height };
}

/** Crop rect in display coords (relative to container) → pixel crop in natural image space. */
export function displayCropToImagePixels(
  crop: { left: number; top: number; width: number; height: number },
  fitted: { x: number; y: number; width: number; height: number },
  naturalW: number,
  naturalH: number
): { originX: number; originY: number; width: number; height: number } {
  const relLeft = crop.left - fitted.x;
  const relTop = crop.top - fitted.y;
  const scaleX = naturalW / fitted.width;
  const scaleY = naturalH / fitted.height;
  const originX = Math.round(Math.max(0, relLeft * scaleX));
  const originY = Math.round(Math.max(0, relTop * scaleY));
  const width = Math.round(Math.min(naturalW - originX, crop.width * scaleX));
  const height = Math.round(Math.min(naturalH - originY, crop.height * scaleY));
  return {
    originX,
    originY,
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
}
