import { get, post } from "./api.js";
import { getToken } from "./auth.js";

export function listProducts() {
  return get("/catalog/");
}

export function placeOrder(productId, qty) {
  const token = getToken();
  if (!token) {
    throw new Error("login required");
  }
  return post("/orders/", { product_id: productId, qty }, token);
}
