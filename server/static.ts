import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { shouldServeSpaNavigation } from "./http-security";

export function serveStatic(app: Express, options?: { distPath?: string }) {
  const distPath = options?.distPath ?? path.resolve(process.cwd(), "dist", "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath, {
    dotfiles: "deny",
    fallthrough: true,
    index: false,
  }));

  app.get("/{*path}", (req, res, next) => {
    if (!shouldServeSpaNavigation(req)) {
      next();
      return;
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
