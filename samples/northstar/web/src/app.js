import { login, logout, me } from "./auth.js";
import { listProducts, placeOrder } from "./cart.js";

export async function boot() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("email")) {
    await login(params.get("email"), params.get("password") || "");
    await me();
  }
  const products = await listProducts();
  window.__northstar = { products, placeOrder, logout };
}
