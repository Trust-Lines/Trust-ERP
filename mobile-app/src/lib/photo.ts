import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** Camera → JPEG ≤1600 px wide as base64 (keeps uploads well under the API's 3 MB limit). null = cancelled. */
export async function takePhoto(): Promise<{ uri: string; base64: string } | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error('Kamera izni gerekiyor — Ayarlar\'dan izin ver.');
  const shot = await ImagePicker.launchCameraAsync({ quality: 1 });
  if (shot.canceled || !shot.assets[0]) return null;
  const ref = await ImageManipulator.manipulate(shot.assets[0].uri).resize({ width: 1600 }).renderAsync();
  const out = await ref.saveAsync({ compress: 0.6, format: SaveFormat.JPEG, base64: true });
  if (!out.base64) throw new Error('Fotoğraf işlenemedi');
  return { uri: out.uri, base64: out.base64 };
}
