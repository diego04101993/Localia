import assert from "node:assert/strict";
import test from "node:test";
import {
  removeAvatarAfterDatabaseWrite,
  replaceAvatarAfterDatabaseWrite,
} from "../server/avatar-storage-operation";

test("database failure keeps the previous avatar and cleans only the new file", async () => {
  let databaseUrl = "/uploads/old.webp";
  const deleted: string[] = [];

  await assert.rejects(
    replaceAvatarAfterDatabaseWrite({
      previousUrl: databaseUrl,
      nextUrl: "/uploads/new.webp",
      persistNextUrl: async () => {
        throw new Error("DB_FAILED");
      },
      deleteNewFile: () => deleted.push("new"),
      deletePreviousFile: () => deleted.push("old"),
    }),
    /DB_FAILED/,
  );

  assert.equal(databaseUrl, "/uploads/old.webp");
  assert.deepEqual(deleted, ["new"]);
});

test("successful replacement persists first and deletes the previous file afterwards", async () => {
  const order: string[] = [];
  let databaseUrl = "/uploads/old.webp";

  await replaceAvatarAfterDatabaseWrite({
    previousUrl: databaseUrl,
    nextUrl: "/uploads/new.webp",
    persistNextUrl: async (nextUrl) => {
      order.push("database");
      databaseUrl = nextUrl;
      return { avatarUrl: nextUrl };
    },
    deleteNewFile: () => order.push("new"),
    deletePreviousFile: () => order.push("old"),
  });

  assert.equal(databaseUrl, "/uploads/new.webp");
  assert.deepEqual(order, ["database", "old"]);
});

test("failure deleting the previous file does not roll back a committed avatar URL", async () => {
  let databaseUrl = "/uploads/old.webp";
  const result = await replaceAvatarAfterDatabaseWrite({
    previousUrl: databaseUrl,
    nextUrl: "/uploads/new.webp",
    persistNextUrl: async (nextUrl) => {
      databaseUrl = nextUrl;
      return { avatarUrl: nextUrl };
    },
    deleteNewFile: () => {},
    deletePreviousFile: () => {
      throw new Error("FILESYSTEM_FAILED");
    },
  });

  assert.equal(databaseUrl, "/uploads/new.webp");
  assert.equal(result.avatarUrl, "/uploads/new.webp");
});

test("avatar removal clears the database before deleting the previous file", async () => {
  const order: string[] = [];
  let databaseUrl: string | null = "/uploads/old.webp";

  await removeAvatarAfterDatabaseWrite({
    previousUrl: databaseUrl,
    persistNull: async () => {
      order.push("database");
      databaseUrl = null;
      return { avatarUrl: null };
    },
    deletePreviousFile: () => order.push("old"),
  });

  assert.equal(databaseUrl, null);
  assert.deepEqual(order, ["database", "old"]);
});

test("failed avatar removal leaves the previous file untouched", async () => {
  let deleted = false;
  await assert.rejects(
    removeAvatarAfterDatabaseWrite({
      previousUrl: "/uploads/old.webp",
      persistNull: async () => {
        throw new Error("DB_FAILED");
      },
      deletePreviousFile: () => {
        deleted = true;
      },
    }),
    /DB_FAILED/,
  );
  assert.equal(deleted, false);
});
