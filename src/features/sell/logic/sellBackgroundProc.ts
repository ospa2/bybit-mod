import { LS_KEY } from "../../../shared/storage/storageHelper";
import type { Ad } from "../../../shared/types/ads";
import type { ReviewStats } from "../../../shared/types/reviews";
import { shouldRefresh } from "../../reviews/logic/procHelper";
import { processUserReviews } from "../../reviews/logic/reviewProcessor";

// Минимальное время между началом запросов (мс), чтобы не получить 429 от WAF Bybit
// 0 = максимально быстро, но риск бана высок. Рекомендую хотя бы 500-1000.
const MIN_REQUEST_INTERVAL = 1000;

function delay(ms: number) {
   return new Promise((resolve) => setTimeout(resolve, ms));
}

let isBackgroundProcessRunning = false;

export async function backgroundProcessAds(): Promise<void> {
   if (isBackgroundProcessRunning) {
      // Процесс уже идет, не запускаем дубль
      return;
   }
   isBackgroundProcessRunning = true;

   try {
      // Бесконечный цикл для постоянного мониторинга
      while (true) {
         const startTime = Date.now();
         let didWork = false;

         // =======================================================
         // 1. ПРИОРИТЕТ: Очередь новых продавцов (FIFO)
         // =======================================================

         // Читаем только начало очереди, чтобы минимизировать парсинг
         const newSellersQueueRaw = localStorage.getItem("unknownUserIds") || "[]";
         // Оптимизация: если строка короткая "[]", даже не парсим
         if (newSellersQueueRaw.length > 2) {
            const queue: Ad[] = JSON.parse(newSellersQueueRaw);

            if (queue.length > 0) {
               const adToProcess = queue[0]; // Берем первого

               try {
                  await processUserReviews(adToProcess);
               } catch (e) {
                  console.error(`Error processing new user ${adToProcess.userId}`, e);
               }

               // Удаляем обработанного (атомарная защита от Race Condition)
               const freshQueueRaw = localStorage.getItem("unknownUserIds") || "[]";
               const freshQueue: Ad[] = JSON.parse(freshQueueRaw);
               // Удаляем именно по ID, так как индекс мог сместиться
               const nextQueue = freshQueue.filter(item => item.userId !== adToProcess.userId);
               localStorage.setItem("unknownUserIds", JSON.stringify(nextQueue));

               didWork = true;
               // В этой ветке мы НЕ делаем break, чтобы сразу перейти к следующему в очереди
               // но нам нужно проверить тайминги ниже
            }
         }

         // =======================================================
         // 2. ФОН: Обновление старых (Только если очередь новых пуста)
         // =======================================================
         if (!didWork) {
            const storedStatsRaw = localStorage.getItem(LS_KEY);
            if (storedStatsRaw && storedStatsRaw.length > 2) {
               const storedStats = (JSON.parse(storedStatsRaw) as ReviewStats[])
                  .filter(s => s && s.priority !== 0); // Пропускаем "мертвых"

               // Ищем ОДНОГО кандидата на обновление
               // (не перебираем всех циклом, чтобы не блокировать поток надолго)
               let candidate = storedStats.find(stat => shouldRefresh(stat));
               if (!candidate && storedStats.length > 0) {
                  // Поиск максимума за один проход O(n)
                  candidate = storedStats.reduce((prev, current) =>
                     (current.priority > prev.priority) ? current : prev
                  );
               }
               if (candidate) {
                  try {
                     await processUserReviews(candidate.userId);
                     didWork = true;
                  } catch (e) {
                     console.error(`Error refreshing user ${candidate.userId}`, e);
                  }
               }
            }
         }

         // =======================================================
         // 3. Управление таймингом (Smart Delay)
         // =======================================================

         const executionTime = Date.now() - startTime;

         if (didWork) {
            // Если работа была, соблюдаем минимальный интервал безопасности API
            const waitTime = Math.max(0, MIN_REQUEST_INTERVAL - executionTime);
            if (waitTime > 0) await delay(waitTime);
            // Сразу идем на следующую итерацию while(true)
         } else {
            // Если работы НЕ было (обе очереди пусты или никто не требует обновления),
            // уходим в "сон" на 1-2 секунды, чтобы не грузить CPU холостым циклом
            await delay(1000);
         }
      }

   } catch (fatalError) {
      console.error("Background Process crashed:", fatalError);
   } finally {
      isBackgroundProcessRunning = false;
      // Опционально: перезапустить процесс через delay, если он упал
      // setTimeout(backgroundProcessAds, 5000); 
   }
}