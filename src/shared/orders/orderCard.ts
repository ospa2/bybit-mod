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


      const messages: string[] = res.result.result.map((m: any) => m.message);

      let foundCard: Card | null = null;
      let details: string[] = [];

      messages.forEach((message: string) => {

         switch (message) {
            case "79525176865 Татьяна Г сбер":
            case "2202208836068156":
            case "Взаимный лайк💚":
               details.push("mamaSber");
               break;

            case "79525181633 Никита К сбер":
            case "2202208821294064":
            case "Взaимный лайк💚":
               details.push("papaSber");
               break;

            case "79514513792 Серафим Г сбер":
            case "2202208034462813":
            case "Взаимный лaйк💚":
               details.push("seraphimSber");
               break;

            case "79514513792 Серафим Г тбанк":
            case "2200701913770423":
            case "Взаимный лaйк💛":
               details.push("seraphimTbank");
               break;

            case "79227518402 Галина Г тбанк":
            case "2200701940041368":
            case "Взaимный лайк💛":
               details.push("galyaTbank");
               break;
            case "79823097970 Никита К тбанк":
            case "5536914064598190":
            case "взaимный лайк💛":
               details.push("papaTbank");
               break;
         }

         if (details.length < 1) {
            return null;
         }
      });
      // вернуть последнюю найденную карту(если было загружено несколько реквизитов)
      foundCard = cards.find((c: Card) => c.id === details[0]) || null
      return foundCard
   } catch (error) {
      console.error("❌❌ Ошибка в getOrderCard:", error);
   }

   return null;
}

export function cardToMessage(card: Card, sbp: boolean = true): string {
   let message = ".";

   switch (card.id) {
      case "mamaSber":
         message = sbp ? "79525176865 Татьяна Г сбер" : "2202208836068156";
         break;

      case "papaSber":
         message = sbp ? "79525181633 Никита К сбер" : "2202208821294064";
         break;

      case "papaTbank":
         message = sbp ? "79823097970 Никита К тбанк" : "5536914064598190";
         break;

      case "seraphimSber":
         message = sbp ? "79514513792 Серафим Г сбер" : "2202208034462813";
         break;

      case "seraphimTbank":
         message = sbp ? "79514513792 Серафим Г тбанк" : "2200701913770423";
         break;

      case "galyaTbank":
         message = sbp ? "79227518402 Галина Г тбанк" : "2200701940041368";
         break;
   }

   return message;
}
