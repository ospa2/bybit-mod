import { loadCards } from "../storage/storageHelper";
import type { Card } from "../types/reviews";

export async function getUsedCard(orderId: string): Promise<Card | null> {
   try {
      const cards: Card[] = loadCards()

      const res = await fetch(
         "https://www.bybit.com/x-api/fiat/otc/order/message/listpage",
         {
            method: "POST",
            headers: {
               "Content-Type": "application/json;charset=UTF-8",
               accept: "application/json",
               origin: "https://www.bybit.com",
            },
            body: JSON.stringify({
               orderId: orderId,
               currentPage: "1",
               size: "100",
            }),
            credentials: "include",
         }
      ).then((response) => response.json());

      console.log("📨 Ответ от API:", res);

      const messages = res.result.result.map((m: any) => m.message);
      console.log("💬 Messages:", messages);

      let foundCard: Card | null = null;

      messages.forEach((message: string) => {

         switch (message) {
            case "79525176865 Татьяна Г сбер":
            case "2202208836068156":
            case "Взаимный лайк💚":
               foundCard = cards.find((c: Card) => c.id === "mamaSber") || null
               break;

            case "79525181633 Никита К сбер":
            case "2202208821294064":
            case "Взaимный лайк💚":
               foundCard = cards.find((c: Card) => c.id === "papaSber") || null
               break;

            case "79514513792 Серафим Г сбер":
            case "2202208034462813":
            case "Взаимный лaйк💚":
               foundCard = cards.find((c: Card) => c.id === "seraphimSber") || null
               break;

            case "79514513792 Серафим Г тбанк":
            case "2200701913770423":
            case "Взаимный лaйк💛":
               foundCard = cards.find((c: Card) => c.id === "seraphimTbank") || null
               break;

            case "79227518402 Галина Г тбанк":
            case "2200701940041368":
            case "Взaимный лайк💛":
               foundCard = cards.find((c: Card) => c.id === "galyaTbank") || null
               break;
         }

         if (!foundCard) {
            console.log("❌ Карта не найдена для message:", message);
            return null;
         }
      });

      console.log("✅ Найдена карта:", foundCard);
      return foundCard;
   } catch (error) {
      console.error("🔥 Ошибка в getOrderCard:", error);
   }

   return null;
}
