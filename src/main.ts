import "./style.css";
import { initSliderReplacement } from "C:/Web/bybitmod/bybit-mod/src/components/rangeSlider.ts";
import { updateGlobalValues } from "./state.ts";
import {
  loadOnceAndApply,
  observeUrlChanges,
} from "./logic/buyLoader.ts";
let periodicRefreshId: ReturnType<typeof setInterval> | null = null;

import {connectPrivateWs} from "./api/wsPrivate.ts";
import { initFetchInterceptor } from "./api/fetchInterceptor.ts";
import { sendOrderMessage } from "./api/bybitApi.ts";
import { AutoClickElements } from "./automation/autoсlicker.ts";

function now() {
  return new Date().toISOString();
}

function startPeriodicRefresh() {
  stopPeriodicRefresh();
  // Только на buy странице обновляем раз в 3000ms
  if (location.href.includes("/buy/USDT/RUB")) {
    periodicRefreshId = setInterval(() => {
      // Запускаем загрузку (внутри уже есть защита от параллельных вызовов)
      loadOnceAndApply().catch((e) => console.error("periodic load error:", e));
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
      if (location.href.includes("/buy/USDT/RUB")) startPeriodicRefresh();
      else stopPeriodicRefresh();
    });

    // И ещё перехваты history API — для случая pushState/replaceState
    const originalPush = history.pushState;
    history.pushState = function (...args) {
      originalPush.apply(this, args);
      if (location.href.includes("/buy/USDT/RUB")) startPeriodicRefresh();
      else stopPeriodicRefresh();
    };
    const originalReplace = history.replaceState;
    history.replaceState = function (...args) {
      originalReplace.apply(this, args);
      if (location.href.includes("/buy/USDT/RUB")) startPeriodicRefresh();
      else stopPeriodicRefresh();
    };

    // Отметить текущие строки как filtered-ads (если нужно)
    document
      .querySelectorAll(".trade-table__tbody tr")
      .forEach((row) => row.classList.add("filtered-ads"));
  }, 100);
}

setTimeout(waitForTableAndStart, 100);

// Объявляем обработчик глобально, чтобы можно было его удалить

initFetchInterceptor();

// Запускаем автоматизацию кликов
new AutoClickElements()

connectPrivateWs();

const result = await sendOrderMessage({message: "test", orderId: "123"});

console.log('result:', result);

