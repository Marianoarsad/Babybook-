const assert = require("node:assert/strict"), fs = require("node:fs");
const { transformSync } = require("@babel/core");
const source = transformSync(fs.readFileSync(__dirname + "/memoryPhoto.js", "utf8"), { babelrc: false, configFile: false, plugins: ["@babel/plugin-transform-modules-commonjs"] }).code;
const memory = { id: "7", photoUrl: "https://private.example/photo?signature=private", description: "Do not export notes" };
const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), blob = new Blob([bytes], { type: "image/png" });
let os = "web", requests = [], shares = [], copied = [], writes = [], picker = null, clickCount = 0, fetchError = false, nativeError = null;
const navigator = { canShare: data => !!data.files, share: async data => { shares.push(data); } };
class NativeFile {
    constructor(directory, name) { this.uri = `${directory.uri}/${name}`; this.type = "image/png"; this.extension = ".png"; }
    static async downloadFileAsync(uri, directory) { requests.push(uri); if (nativeError) throw nativeError; return new NativeFile(directory, "original.png"); }
    async copy(destination) { copied.push({ bytes, destination }); }
}
class Directory { constructor(parent, name) { this.uri = `${parent}/${name}`; } create() {} static async pickDirectoryAsync() { if (nativeError) throw nativeError; return picker; } }
const Sharing = { isAvailableAsync: async () => true, shareAsync: async (...args) => { shares.push(args); } };
const modulePhoto = { exports: {} };
const globalMock = { navigator };
new Function("require", "module", "exports", "fetch", "globalThis", "navigator", "document", "File", "URL", "setTimeout", source)(name => {
    if (name === "react-native") return { Platform: { get OS() { return os; } } };
    if (name === "expo-file-system") return { File: NativeFile, Directory, Paths: { cache: "cache" } };
    if (name === "expo-sharing") return Sharing;
    throw Error(name);
}, modulePhoto, modulePhoto.exports, async uri => { requests.push(uri); return { ok: !fetchError, blob: async () => blob }; }, globalMock, navigator,
{ createElement: () => ({ click() { clickCount++; }, remove() {} }), body: { appendChild() {} } }, File,
{ createObjectURL: () => "blob:original", revokeObjectURL() {} }, () => {});
const { exportMemoryPhoto } = modulePhoto.exports;
async function main() {
    assert.equal(await exportMemoryPhoto("share", memory, "memory"), "shared");
    assert.equal(shares.length, 1); assert.deepEqual(Object.keys(shares[0]), ["files"]);
    assert.deepEqual(new Uint8Array(await shares[0].files[0].arrayBuffer()), bytes); assert.equal(shares[0].files[0].name, "babybook-memory-7.png");
    navigator.share = async () => { throw { name: "AbortError" }; };
    assert.equal(await exportMemoryPhoto("share", memory, "memory"), "cancelled");
    delete navigator.share;
    await assert.rejects(exportMemoryPhoto("share", memory, "memory"), /unavailable/);
    globalMock.showSaveFilePicker = async () => ({ createWritable: async () => ({ write: async data => writes.push(data), close: async () => {}, abort: async () => {} }) });
    assert.equal(await exportMemoryPhoto("download", memory, "memory"), "saved"); assert.equal(writes[0], blob);
    globalMock.showSaveFilePicker = async () => { throw { name: "AbortError" }; };
    assert.equal(await exportMemoryPhoto("download", memory, "memory"), "cancelled");
    delete globalMock.showSaveFilePicker;
    assert.equal(await exportMemoryPhoto("download", memory, "memory"), "requested"); assert.equal(clickCount, 1);
    assert.equal(await exportMemoryPhoto("download", memory, "memory", () => false), "cancelled"); assert.equal(clickCount, 1);
    fetchError = true; await assert.rejects(exportMemoryPhoto("download", memory, "memory"), /retrieved/); fetchError = false;
    await assert.rejects(exportMemoryPhoto("download", { ...memory, photoUrl: "" }, "memory"), /No photo/);
    os = "ios"; shares = []; requests = [];
    assert.equal(await exportMemoryPhoto("share", memory, "milestone"), "presented");
    assert(shares[0][0].startsWith("cache/babybook-milestone-7-")); assert(!shares[0][0].includes("signature"));
    picker = { uri: "chosen-directory" };
    assert.equal(await exportMemoryPhoto("download", memory, "memory"), "saved");
    assert.deepEqual(copied[0].bytes, bytes); assert(copied[0].destination.uri.startsWith("chosen-directory/babybook-memory-7-"));
    os = "android"; nativeError = { code: "ERR_CANCELED" };
    assert.equal(await exportMemoryPhoto("download", memory, "memory"), "cancelled");
    nativeError = new Error("Network failure"); await assert.rejects(exportMemoryPhoto("share", memory, "memory"), /Network failure/);
    assert(requests.every(uri => uri === memory.photoUrl));
    console.log("Original-photo export passed: unchanged bytes, private file-only sharing, web save/download status, native cache/destination, cancellation, stale session and error handling.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
