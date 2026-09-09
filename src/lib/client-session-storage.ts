const appStoragePrefixes = ["acc-score:", "acc-correction:", "registration-operation:", "payment-operation:"];

export function clearAppSessionStorage(storage: Storage) {
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (key && appStoragePrefixes.some((prefix) => key.startsWith(prefix))) storage.removeItem(key);
  }
}

export async function clearThenSignOut(storage: Storage, signOut: () => Promise<boolean>) {
  let localClearFailed = false;
  try {
    clearAppSessionStorage(storage);
  } catch {
    localClearFailed = true;
  }
  const signedOut = await signOut();
  return { localClearFailed, signedOut };
}
