import type { OrderStatus } from "../types/ads";

export async function getOrderStatus(orderId: string): Promise<OrderStatus> {
   try {
      const response = await fetch(
         "https://www.bybit.com/x-api/fiat/otc/order/info",
         {
            method: "POST", // <-- ВАЖНО
            headers: {
               "Content-Type": "application/json;charset=UTF-8",
               accept: "application/json",
               origin: "https://www.bybit.com",

               // сюда добавь нужные куки/токены/хэдеры
            },
            body: JSON.stringify({
               orderId: orderId,
            }),
            credentials: "include", // если нужны cookies
         }
      );

      const result = await response.json();

      return result.result.status === 50
         ? "completed"
         : result.result.status === 40
            ? "cancelled"
            : "pending";
   } catch (err) {
      console.error("❌ Fetch error:", err);
      return "error";
   }
}
