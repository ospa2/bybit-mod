import "./style.css";
import { initSliderReplacement } from "./shared/components/rangeSlider.ts";
import { updateGlobalValues } from "./core/state.ts";
import { loadOnceAndApply, observeUrlChanges } from "./features/buy/logic/buyLoader.ts";
let periodicRefreshId: ReturnType<typeof setInterval> | null = null;

import { BybitP2PWebSocket } from "./shared/api/wsPrivate.ts";
import { initFetchInterceptor } from "./features/sell/logic/sellInterceptor.ts";
import { resumePendingOrders } from "./features/buy/api/buyApi.ts";
import { AutoClickElements } from "./features/sell/automation/autoсlicker.ts";
import { backgroundProcessAds } from "./features/reviews/logic/reviewsSync.ts";
import { addOnlySberSwitch } from "./features/buy/components/sberSwitch.ts";
import { loadCards } from "./shared/storage/storageHelper.ts";
import { watchNewOrders } from "./shared/orders/newOrdersScanner.ts";
import { fetchAndStoreCards } from "./shared/orders/fetchCards.ts";
import { OrderChatManager } from "./shared/orders/orderChatManager.ts";
function now() {
   return new Date().toISOString();
}
// Объявляем обработчик глобально, чтобы можно было его удалить

initFetchInterceptor();
function startPeriodicRefresh() {
   stopPeriodicRefresh();
   // Только на buy странице обновляем раз в 3000ms
   if (location.href.includes("/buy/USDT/RUB") || location.href.includes("/sell/USDT/RUB")) {
      periodicRefreshId = setInterval(() => {
         // Запускаем загрузку (внутри уже есть защита от параллельных вызовов)
         loadOnceAndApply().catch((e) =>
            console.error("periodic load error:", e)
         );
      }, 3000);
      console.log(`[${now()}] Periodic refresh запущен.`);
   }
}

function stopPeriodicRefresh() {
   if (periodicRefreshId) {
      clearInterval(periodicRefreshId);
      periodicRefreshId = null;
      console.log(`[${now()}] Periodic refresh остановлен.`);
   }
}

function waitForTableAndStart() {
   const tbody = document.querySelector(".trade-table__tbody");

   if (!tbody || tbody.children.length === 0) {
      console.log("Ожидание таблицы...");
      setTimeout(waitForTableAndStart, 500);
      return;
   }

   // Очистим старые динамические строки
   tbody.querySelectorAll(".dynamic-row").forEach((row) => row.remove());
   tbody.querySelector(".completion-indicator")?.remove();

   // Запускаем наблюдение за URL и начальную инициализацию
   observeUrlChanges();

   // Инициализация слайдера
   setTimeout(() => {
      initSliderReplacement({
         min: 9000,
         max: 80000,
         onUpdate: updateGlobalValues,
      });

      // Первичная загрузка
      loadOnceAndApply();

      // Запустить периодический рефреш если мы на buy
      startPeriodicRefresh();

      // Если URL сменится — observeUrlChanges вызовет handleUrlChange, и можно остановить/запустить периодический рефреш там же.
      // Потому добавим слушатель попstate для управления периодическим рефрешем:
      window.addEventListener("popstate", () => {
         if (location.href.includes("/buy/USDT/RUB") || location.href.includes("/sell/USDT/RUB")) startPeriodicRefresh();
         else stopPeriodicRefresh();
      });

      // И ещё перехваты history API — для случая pushState/replaceState
      const originalPush = history.pushState;
      history.pushState = function (...args) {
         originalPush.apply(this, args);
         if (location.href.includes("/buy/USDT/RUB") || location.href.includes("/sell/USDT/RUB")) startPeriodicRefresh();
         else stopPeriodicRefresh();
      };
      const originalReplace = history.replaceState;
      history.replaceState = function (...args) {
         originalReplace.apply(this, args);
         if (location.href.includes("/buy/USDT/RUB") || location.href.includes("/sell/USDT/RUB")) startPeriodicRefresh();
         else stopPeriodicRefresh();
      };

   }, 100);
}

setTimeout(waitForTableAndStart, 100);

let attempts = 0;
const maxAttempts = 50; // 5 секунд (50 * 100ms)

const checkInterval = setInterval(() => {
   attempts++;

   if (addOnlySberSwitch()) {
      clearInterval(checkInterval);
      console.log('Свич добавлен после', attempts, 'попыток');
   } else if (attempts >= maxAttempts) {
      clearInterval(checkInterval);
      console.error('Не удалось найти элемент guide-step-two после', maxAttempts, 'попыток');
   }
}, 100);
setInterval(() => {
   if (window.location.href === "https://www.bybit.com/ru-RU/p2p/sell/USDT/RUB") {
      window.location.reload();
   }
}, 60 * 1000 * 10);
setTimeout(() => {
   document.querySelector(".fiat-otc-side-bar-aiguide")?.remove();
}, 3000);

// Запускаем автоматизацию кликов

const autoClicker = new AutoClickElements();


// Делаем экземпляр доступным глобально
(window as any).autoClicker = autoClicker;

setTimeout(() => {
   const manager = new OrderChatManager((window as any).wsClient);
   (window as any).manager = manager;
}, 4000);

fetchAndStoreCards()

resumePendingOrders();

backgroundProcessAds()

const cards = loadCards()
console.log('cards:', cards);

watchNewOrders()
const wsClient = new BybitP2PWebSocket();

(window as any).wsClient = wsClient;
// Запускаем
try {
   console.log("Connecting to WebSocket...");
   await (window as any).wsClient.connect();
   console.log("Connected to WebSocket and Logged in!");
} catch (e) {
   console.error("Failed:", e);
}