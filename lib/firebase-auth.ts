"use client";

import { getAuth, type Auth } from "firebase/auth";
import { getFirebaseApp } from "./firebase";

let cachedAuth: Auth | null = null;

export function getFirebaseAuth(): Auth | null {
  const app = getFirebaseApp();
  if (!app) return null;
  if (!cachedAuth) {
    cachedAuth = getAuth(app);
  }
  return cachedAuth;
}
