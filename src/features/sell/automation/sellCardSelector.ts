
import { loadCards } from "../../../shared/storage/storageHelper";
import type { OrderPayload } from "../../../shared/types/ads";
import type { Card } from "../../../shared/types/reviews";
import { canUseCard } from "../../buy/automation/cardFinder";


export function findSellCard(ad: OrderPayload, remark?: string): Card | null {

   // Загружаем все карты
   let cards = loadCards();

   // Фильтруем подходящие карты
   const available = cards.filter((c) => canUseCard(c, ad, remark));

   if (!available.length) return null;

   // выбрать карту с наименьшим балансом
   available.sort((a, b) => a.balance - b.balance);
   

   let bestCard = available[0];

   localStorage.setItem("!cards", JSON.stringify(cards));

   return bestCard;
}