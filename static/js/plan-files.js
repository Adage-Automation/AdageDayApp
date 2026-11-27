// Seating / standing plan PDFs uploaded from the admin Plans tab (works from a
// phone, no code push). Firebase Storage needs the paid Blaze plan, so the PDF
// is stored in Firestore instead, split into ~900 KB chunks (a document holds
// at most 1 MiB):
//
//   settings/plans                 files.<plan id> = { version, chunks, size, name, uploadedAt }
//   settings/planFile_<id>_<version>_<n>   { data: Bytes }   n = 0 … chunks-1
//
// Each upload gets a new version, so a phone never mixes chunks of an old and
// a new file; the old version's chunks are deleted after the switch. Living in
// the existing `settings` collection means the current Firestore rules
// (public read, signed-in write) already cover it.
import { db } from "./firebase-init.js";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  deleteField,
  serverTimestamp,
  Bytes,
  FieldPath,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const CHUNK_BYTES = 900 * 1024;
export const MAX_PDF_BYTES = 8 * 1024 * 1024;
const settingsRef = doc(db, "settings", "plans");
const chunkRef = (planId, version, n) => doc(db, "settings", `planFile_${planId}_${version}_${n}`);

export const formatSize = (bytes) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

// meta: settings/plans files.<plan id>. Resolves to a blob: URL of the PDF.
// Cached per version, so each phone downloads a file once per page load.
const loaded = new Map();
export function loadPlanPdf(planId, meta) {
  const key = `${planId}_${meta.version}`;
  if (!loaded.has(key)) {
    const parts = Array.from({ length: meta.chunks }, (_, n) =>
      getDoc(chunkRef(planId, meta.version, n)).then((snap) => {
        if (!snap.exists()) throw new Error(`Missing part ${n + 1} of ${meta.chunks}`);
        return snap.get("data").toUint8Array();
      })
    );
    const promise = Promise.all(parts).then((bytes) => URL.createObjectURL(new Blob(bytes, { type: "application/pdf" })));
    promise.catch(() => loaded.delete(key)); // let a later render retry
    loaded.set(key, promise);
  }
  return loaded.get(key);
}

async function deleteChunks(planId, meta) {
  if (!meta?.version) return;
  await Promise.all(
    Array.from({ length: meta.chunks }, (_, n) => deleteDoc(chunkRef(planId, meta.version, n)).catch(() => {}))
  );
}

// file: a File from <input type="file">. oldMeta: the current files.<plan id>,
// if any. onProgress(done, total) after each chunk.
export async function uploadPlanPdf(planId, file, oldMeta, onProgress = () => {}) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const magic = String.fromCharCode(...bytes.subarray(0, 5));
  if (magic !== "%PDF-") throw new Error("That file isn't a PDF.");
  if (bytes.length > MAX_PDF_BYTES) {
    throw new Error(`PDF is ${formatSize(bytes.length)}; the limit is ${formatSize(MAX_PDF_BYTES)}. Compress it and try again.`);
  }

  const version = Date.now().toString(36);
  const chunks = Math.ceil(bytes.length / CHUNK_BYTES);
  onProgress(0, chunks);
  for (let n = 0; n < chunks; n++) {
    const part = bytes.subarray(n * CHUNK_BYTES, (n + 1) * CHUNK_BYTES);
    await setDoc(chunkRef(planId, version, n), { data: Bytes.fromUint8Array(part) });
    onProgress(n + 1, chunks);
  }
  // Switch every phone to the new file in one write, then clean up the old one.
  await setDoc(
    settingsRef,
    { files: { [planId]: { version, chunks, size: bytes.length, name: file.name, uploadedAt: serverTimestamp() } } },
    { merge: true }
  );
  await deleteChunks(planId, oldMeta);
}

export async function removePlanPdf(planId, meta) {
  await updateDoc(settingsRef, new FieldPath("files", planId), deleteField());
  await deleteChunks(planId, meta);
}
