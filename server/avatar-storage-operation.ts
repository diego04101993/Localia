type MaybePromise<T> = T | Promise<T>;

async function bestEffortDelete(deleteFile: () => MaybePromise<unknown>): Promise<void> {
  try {
    await deleteFile();
  } catch {
    // File cleanup must never undo a database state that already committed.
  }
}

export async function replaceAvatarAfterDatabaseWrite<T>(options: {
  previousUrl: string | null | undefined;
  nextUrl: string;
  persistNextUrl: (nextUrl: string) => Promise<T | undefined>;
  deleteNewFile: () => MaybePromise<unknown>;
  deletePreviousFile: () => MaybePromise<unknown>;
}): Promise<T> {
  let updated: T | undefined;
  try {
    updated = await options.persistNextUrl(options.nextUrl);
    if (!updated) {
      throw new Error("AVATAR_DATABASE_UPDATE_FAILED");
    }
  } catch (error) {
    await bestEffortDelete(options.deleteNewFile);
    throw error;
  }

  if (options.previousUrl && options.previousUrl !== options.nextUrl) {
    await bestEffortDelete(options.deletePreviousFile);
  }
  return updated;
}

export async function removeAvatarAfterDatabaseWrite<T>(options: {
  previousUrl: string | null | undefined;
  persistNull: () => Promise<T | undefined>;
  deletePreviousFile: () => MaybePromise<unknown>;
}): Promise<T> {
  const updated = await options.persistNull();
  if (!updated) {
    throw new Error("AVATAR_DATABASE_UPDATE_FAILED");
  }

  if (options.previousUrl) {
    await bestEffortDelete(options.deletePreviousFile);
  }
  return updated;
}
