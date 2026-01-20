
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

   // если есть рабочие тиньки, то они в приоритете
   available.sort((a, b) => {
      const priority = (bank: string) =>
         bank.toLowerCase().includes("sber")
            ? 1
            : bank.toLowerCase().includes("tbank")
               ? 2
               : 3;
      return priority(a.bank) - priority(b.bank);
   });

   let bestCard = available[0];

   // Обновляем cards_v1 (сброс turnover при новом дне)
   localStorage.setItem("!cards", JSON.stringify(cards));

   return bestCard;
}