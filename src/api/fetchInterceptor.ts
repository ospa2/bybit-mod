// src/services/fetchInterceptor.ts

import { enhanceAdRows } from "../logic/sellAdProc";
import { handleModalOpening } from "../logic/sellModal";
import { sendOrderData } from "./bybitApi";
import { getRowIndex } from "../utils/domHelpers";
import type { Ad } from "../types/ads";
import { processUserReviews } from "../components/review";
import { adShouldBeFiltered } from "../logic/adFilter";

let currentButtonClickHandler: ((e: MouseEvent) => void) | null = null;
let onlineAdsData: Ad[] = []; // Локальное хранилище данных об объявлениях
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function backgroundProcessAds(ads: any[]) {
  for (const ad of ads) {
    await processUserReviews(ad);
    await delay(2000); // пауза 1 сек, чтобы не заблокировали IP
  }

  console.log("Фоновая загрузка отзывов завершена ✅");
}

// 👉 Этот код сработает один раз

export function initFetchInterceptor() {
  const originalFetch = window.fetch;

  window.fetch = async (...args) => {
    const url = args[0].toString();
    const options = args[1];

    // Перехват списка объявлений на продажу
    if (url.includes("/x-api/fiat/otc/item/online") && options?.body) {
      const body = JSON.parse(options.body as string);
      if (body.side === "0") {
        // 0 = Sell
        const response = await originalFetch(...args);
        const clonedResponse = response.clone();
        clonedResponse.json().then((data) => {

          onlineAdsData = data.result.items || [];
          enhanceAdRows(onlineAdsData);
          setupSellButtonListener();

          // Запускаем фоновый процесс
          const filteredAds = onlineAdsData.filter((ad) => !adShouldBeFiltered(ad));
          backgroundProcessAds(filteredAds);
        });
        return response;
      }
    }

    // Перехват создания ордера на продажу и отправлям данные ордера в базу
    if (url.includes("x-api/fiat/otc/order/create") && options?.body) {
      const body = JSON.parse(options.body as string);
      if (body.side === "1") {
        // 1 = Sell
        const response = await originalFetch(...args);
        // Отправляем данные после успешного ответа от Bybit
        response
          .clone()
          .json()
          .then(() => sendOrderData(body));
        return response;
      }
    }

    return originalFetch(...args);
  };
}

function setupSellButtonListener() {
  // Удаляем старый обработчик, чтобы избежать дублирования
  if (currentButtonClickHandler) {
    document.removeEventListener("click", currentButtonClickHandler);
  }

  currentButtonClickHandler = (e: MouseEvent) => {
    const btn = (e.target as HTMLElement).closest("button");
    if (btn && btn.innerText.includes("Продать USDT")) {
      const index = getRowIndex(btn);
      if (index !== -1 && onlineAdsData[index]) {
        handleModalOpening(onlineAdsData[index], e);
      }
    }
  };

  document.addEventListener("click", currentButtonClickHandler);
}
