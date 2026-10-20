import { Platform } from "react-native";

const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif" };
const cancelled = error => error?.name === "AbortError" || /cancel|dismiss/i.test(error?.code || error?.message || "");

// Only the original photo is exported. Signed/private URLs never leave through a share-text fallback.
export async function exportMemoryPhoto(action, memory, recordKind, isCurrent = () => true) {
    if (!memory.photoUrl) throw new Error("No photo is attached to this record.");
    const prefix = `babybook-${recordKind}-${String(memory.id).replace(/[^a-zA-Z0-9_-]/g, "")}`;
    try {
        if (Platform.OS === "web") {
            if (action === "share" && !globalThis.navigator?.share) throw new Error("Photo sharing is unavailable in this browser. Use Download instead.");
            const response = await fetch(memory.photoUrl);
            if (!response.ok) throw new Error("The original photo could not be retrieved. Reopen the record and try again.");
            const blob = await response.blob();
            if (!blob.size || !blob.type.startsWith("image/")) throw new Error("The original photo could not be retrieved.");
            if (!isCurrent()) return "cancelled";
            const name = `${prefix}.${extensions[blob.type] || "image"}`;
            if (action === "share") {
                const file = new File([blob], name, { type: blob.type });
                if (!navigator.canShare?.({ files: [file] })) throw new Error("This browser cannot share photo files. Use Download instead.");
                await navigator.share({ files: [file] });
                return "shared";
            }
            if (globalThis.showSaveFilePicker) {
                const handle = await globalThis.showSaveFilePicker({ suggestedName: name });
                if (!isCurrent()) return "cancelled";
                const writable = await handle.createWritable();
                try { await writable.write(blob); await writable.close(); }
                catch (error) { await writable.abort().catch(() => {}); throw error; }
                return "saved";
            }
            const url = URL.createObjectURL(blob), anchor = document.createElement("a");
            anchor.href = url; anchor.download = name; document.body.appendChild(anchor); anchor.click(); anchor.remove();
            setTimeout(() => URL.revokeObjectURL(url), 60000);
            return "requested";
        }
        const { File: NativeFile, Directory, Paths } = require("expo-file-system");
        const Sharing = require("expo-sharing");
        if (action === "share" && !await Sharing.isAvailableAsync()) throw new Error("Photo sharing is unavailable on this device.");
        const destination = action === "download" ? await Directory.pickDirectoryAsync() : null;
        if (!isCurrent() || (action === "download" && !destination)) return "cancelled";
        const cache = new Directory(Paths.cache, `${prefix}-${Date.now()}`);
        cache.create();
        const file = await NativeFile.downloadFileAsync(memory.photoUrl, cache);
        if (!isCurrent()) return "cancelled";
        if (action === "share") {
            await Sharing.shareAsync(file.uri, { mimeType: file.type || undefined });
            // Native share sheets do not confirm delivery to the recipient.
            return "presented";
        }
        const suffix = extensions[file.type] || (/^\.[a-z0-9]{1,6}$/i.test(file.extension) ? file.extension.slice(1) : "image");
        await file.copy(new NativeFile(destination, `${prefix}-${Date.now()}.${suffix}`));
        return "saved";
    } catch (error) {
        if (cancelled(error)) return "cancelled";
        throw error;
    }
}
