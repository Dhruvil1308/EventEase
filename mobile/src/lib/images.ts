import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

export type PickedImage = { uri: string; mimeType: string };

/** The server's limit for photos and covers. */
const MAX_BYTES = 300 * 1024;

/**
 * Lets the person pick (and crop) a photo, then shrinks it on the phone until
 * it fits the 300 KB limit — the same rule the website applies before upload.
 */
export async function pickImage({ square, maxWidth }: { square: boolean; maxWidth: number }): Promise<PickedImage | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: square ? [1, 1] : [16, 9],
    quality: 1,
  });
  if (picked.canceled || !picked.assets[0]) return null;
  const asset = picked.assets[0];

  let width = Math.min(maxWidth, asset.width || maxWidth);
  for (const quality of [0.82, 0.7, 0.55, 0.42]) {
    const ref = await ImageManipulator.manipulate(asset.uri).resize({ width }).renderAsync();
    const out = await ref.saveAsync({ compress: quality, format: SaveFormat.JPEG });
    const size = new File(out.uri).size ?? 0;
    if (size > 0 && size <= MAX_BYTES) return { uri: out.uri, mimeType: "image/jpeg" };
    width = Math.round(width * 0.85);
  }
  Alert.alert("Photo too large", "We couldn't shrink this photo under 300 KB. Try a different one.");
  return null;
}
