
import { loadCards } from "../../../shared/storage/storageHelper";
import type { OrderPayload } from "../../../shared/types/ads";
import type { Card } from "../../../shared/types/reviews";
import { canUseCard } from "../../buy/automation/adFinder";


export function findSellCard(ad: OrderPayload): Card | null {

   // Загружаем все карты
   let cards = loadCards();
   
   // Фильтруем подходящие карты
   const available = cards.filter((c) => canUseCard(c, ad));
   
   if (!available.length) return null;

   // если есть рабочие тиньки, то они в приоритете
   available.sort((a, b) => {
      const priority = (bank: string) =>
         bank.toLowerCase().includes("tbank")
            ? 1
            : bank.toLowerCase().includes("sber")
               ? 2
               : 3;
      return priority(a.bank) - priority(b.bank);
   });

   let bestCard = available[0];

   // Обновляем cards_v1 (сброс turnover при новом дне)
   localStorage.setItem("!cards", JSON.stringify(cards));

   return bestCard;
}