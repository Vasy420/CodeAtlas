import { get, post } from "./api.js";

let currentToken = null;

export async function login(email, passwordHash) {
  const data = await post("/auth/login", { email, password_hash: passwordHash });
  currentToken = data.token;
  return currentToken;
}

export async function logout() {
  if (!currentToken) return;
  await post("/auth/logout", {}, currentToken);
  currentToken = null;
}

export function getToken() {
  return currentToken;
}

export function me() {
  return get("/auth/me", currentToken);
}
