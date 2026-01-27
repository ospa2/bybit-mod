import { LS_KEY, upsertStatsBatch } from "../../../shared/storage/storageHelper";
import type { Ad } from "../../../shared/types/ads";
import type { ReviewStats } from "../../../shared/types/reviews";
import { shouldRefresh } from "../../reviews/logic/procHelper";
import { processUserReviewsPure } from "../../reviews/logic/reviewProcessor";

// Минимальное время между началом запросов (мс), чтобы не получить 429 от WAF Bybit
// 0 = максимально быстро, но риск бана высок. Рекомендую хотя бы 500-1000.
const MIN_REQUEST_INTERVAL = 1000;

function delay(ms: number) {
   return new Promise((resolve) => setTimeout(resolve, ms));
}

let isBackgroundProcessRunning = false;
async function tryRefreshOneOldUser() {
   const rawStats = localStorage.getItem(LS_KEY);
   if (!rawStats || rawStats.length <= 2) return false;

   try {
      const storedStats = JSON.parse(rawStats);
      if (!Array.isArray(storedStats) || storedStats.length === 0) return false;

      // 1. Поиск кандидата за один проход O(n)
      let candidate = null;
      let maxPriority = -1;

      for (let i = 0; i < storedStats.length; i++) {
         const stat = storedStats[i];
         if (!stat || stat.priority === 0) continue;

         // Если нашли того, кому СРОЧНО пора обновиться (hard-limit), берем сразу
         if (shouldRefresh(stat)) {
            candidate = stat;
            break;
         }

         // Иначе ищем самого приоритетного
         if (stat.priority > maxPriority) {
            maxPriority = stat.priority;
            candidate = stat;
         }
      }

      if (!candidate) return false;

      // 2. Выполняем "чистый" сетевой запрос
      const updatedEntry = await processUserReviewsPure(candidate.userId);

      if (updatedEntry) {
         // 3. Сохраняем результат через batch-метод (он обновит Map и запишет в LS)
         upsertStatsBatch([updatedEntry]);
         return true;
      }

      return false;
   } catch (err) {
      console.error("Error in tryRefreshOneOldUser:", err);
      return false;
   }
}
// ==========================================
// 2. Оптимизированный фоновый процесс
// ==========================================
export async function backgroundProcessAds(): Promise<void> {
   if (isBackgroundProcessRunning) return;
   isBackgroundProcessRunning = true;

   const BATCH_SIZE = 5; // Обрабатываем по 5 юзеров параллельно

   try {
      while (true) {
         const startTime = Date.now();
         let processedCount = 0;

         // --- ШАГ 1: Забираем пачку "Новичков" ---
         let rawQueue = localStorage.getItem("unknownUserIds");
         let queue: Ad[] = rawQueue ? JSON.parse(rawQueue) : [];

         // Берем срез задач
         const batchToDo = queue.slice(0, BATCH_SIZE);

         if (batchToDo.length > 0) {
            // ПАРАЛЛЕЛЬНОЕ выполнение запросов
            const results = await Promise.allSettled(
               batchToDo.map(ad => processUserReviewsPure(ad.userId))
            );

            // Собираем успешные результаты
            const newStats: ReviewStats[] = [];
            const processedIds = new Set<string>();

            results.forEach((res, index) => {
               const userId = batchToDo[index].userId;
               processedIds.add(userId); // Помечаем как обработанный даже при ошибке, чтобы не застрять
               if (res.status === "fulfilled" && res.value) {
                  newStats.push(res.value);
               }
            });

            // --- ШАГ 2: Атомарное сохранение Статистики (1 раз на пачку) ---
            if (newStats.length > 0) {
               // Используем upsertStatsBatch из предыдущего совета
               upsertStatsBatch(newStats);
            }

            // --- ШАГ 3: Атомарное удаление из очереди (1 раз на пачку) ---
            // Читаем заново перед записью (защита от Race Condition)
            const currentRaw = localStorage.getItem("unknownUserIds");
            const currentQueue: Ad[] = currentRaw ? JSON.parse(currentRaw) : [];
            const nextQueue = currentQueue.filter(ad => !processedIds.has(ad.userId));
            localStorage.setItem("unknownUserIds", JSON.stringify(nextQueue));

            processedCount = batchToDo.length;
         }

         // --- ШАГ 4: Если новичков нет, обновляем "Старичков" ---
         else {
            // Тут логика обновления одного старого, но тоже через processUserReviewsPure
            // и saveReviewsStatistics. 
            // ... (аналогично коду выше, но берем из statsMap)
            const didRefresh = await tryRefreshOneOldUser(); // Вынесем в отдельную функцию
            if (didRefresh) processedCount = 1;
         }

         // --- Умная задержка ---
         const executionTime = Date.now() - startTime;
         // Если ничего не делали - спим дольше (1с), если работали - короткий перерыв (200мс)
         const delayTime = processedCount === 0 ? 1000 : Math.max(200, MIN_REQUEST_INTERVAL - executionTime);

         await delay(delayTime);
      }

   } catch (fatalError) {
      console.error("Background loop crashed:", fatalError);
   } finally {
      isBackgroundProcessRunning = false;
   }
}