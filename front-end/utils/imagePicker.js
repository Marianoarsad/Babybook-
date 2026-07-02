// Device photo picking via expo-image-picker.
// Guarded so the app still runs if the library isn't installed (e.g. on web).

let ImagePicker = null;
try {
    // eslint-disable-next-line global-require
    ImagePicker = require("expo-image-picker");
} catch (e) {
    ImagePicker = null;
}

export function pickerAvailable() {
    return !!ImagePicker;
}

// Opens the photo library and returns the selected image URI, or null.
export async function pickImage() {
    if (!ImagePicker) return null;
    try {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (perm && perm.granted === false) return null;
        // mediaTypes defaults to images; omitted for cross-version compatibility.
        const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
        if (!result || result.canceled) return null;
        if (result.assets && result.assets[0]) return result.assets[0].uri;
        return result.uri || null; // very old API shape
    } catch (e) {
        console.log("pickImage:", e.message);
        return null;
    }
}
