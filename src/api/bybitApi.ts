import { createRowFromTemplate } from "../components/buyRow.ts";
import { adShouldBeFiltered } from "../logic/adFilter.ts";
import { USER_ID } from "../config.ts";
import { appState } from "../state.ts";
import { GM_xmlhttpRequest } from "$";
import { bestMerchants } from "../config.ts";
import { openTradingModal } from "../components/buyModal.ts";
function now() { return new Date().toISOString(); }

export async function fetchAndAppendPage() {
  // Защита от одновременных вызовов
  if (appState.isLoading || appState.shouldStopLoading) return;
  appState.isLoading = true;

  try {
    const currentUrl = window.location.href;
    const tbody = document.querySelector(".trade-table__tbody");
    if (!tbody) {
      console.log(`[${now()}] Tbody не найден — выходим.`);
      return;
    }

    // Если мы на sell-странице — просто один раз очистить таблицу и выйти
    if (currentUrl.includes("/sell/USDT/RUB")) {
      console.log(`[${now()}] sell — очищаю таблицу и не делаю fetch.`);
      tbody.querySelectorAll('.dynamic-row').forEach(row => row.remove());
      tbody.querySelector('.completion-indicator')?.remove();
      return;
    }

    // Если мы здесь — это buy страница
    if (!currentUrl.includes("/buy/USDT/RUB")) {
      console.log(`[${now()}] Не на buy/sell страницах — ничего не делаю.`);
      return;
    }

    console.log(`[${now()}] buy — выполняю запрос к API.`);

    // Параметры (size и side для buy)
    const payload = {
      userId: USER_ID,
      tokenId: "USDT",
      currencyId: "RUB",
      payment: [],
      side: "1",      // buy
      size: "150",
      page: "1",
      amount: "",
      vaMaker: false,
      bulkMaker: false,
      canTrade: true,
      verificationFilter: 0,
      sortType: "OVERALL_RANKING",
      paymentPeriod: [],
      itemRegion: 1
    };

    const res = await fetch("https://www.bybit.com/x-api/fiat/otc/item/online", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    const ads = json.result || json.data || {};

    // Удаляем старые строки и индикатор
    tbody.querySelectorAll('.dynamic-row').forEach(row => row.remove());
    tbody.querySelector('.completion-indicator')?.remove();

    // Создаем фрагмент и добавляем строки (приоритетные — наверх)
    const fragment = document.createDocumentFragment();
    const prioritizedAds = [];

    if (ads.items && Array.isArray(ads.items)) {
      for (const ad of ads.items) {
        if (typeof bestMerchants !== 'undefined' && bestMerchants.includes && bestMerchants.includes(ad.userId)) {
          prioritizedAds.push(ad);
          continue;
        }

        if (typeof adShouldBeFiltered === 'function' && adShouldBeFiltered(ad)) {
          continue;
        }

        const newRow = typeof createRowFromTemplate === 'function' ? createRowFromTemplate(ad) : null;
        if (newRow) fragment.appendChild(newRow);
      }

      // Добавляем приоритетные объявления в начало
      if (prioritizedAds.length) {
        for (const ad of prioritizedAds.reverse()) { // reverse чтобы сохранить порядок при prepend
          if (typeof adShouldBeFiltered === 'function' && adShouldBeFiltered(ad)) continue;
          const prRow = typeof createRowFromTemplate === 'function' ? createRowFromTemplate(ad) : null;
          if (prRow) fragment.prepend(prRow);
        }
      }
    } else {
      console.warn(`[${now()}] Ответ API не содержит ads.items массив.`);
    }

    // Вставляем в tbody
    tbody.prepend(fragment);
    console.log(`[${now()}] Вставил ${fragment.childNodes.length} строк(ы) в tbody.`);
  } catch (e) {
    console.error(`[${now()}] Ошибка при подгрузке:`, e);
  } finally {
    appState.isLoading = false;
  }
}

export function sendOrderData(body: any) {//отправляем данные ордера в базу данных 
  
  // Получаем имя из модального окна, сохраненного в appState

  const nickName = appState.counterpartyNickname;
  
  const newOrder = {
    "Order No.": body.itemId,
    Type: "SELL",
    "Fiat Amount": body.amount,
    Price: (parseFloat(body.amount) / parseFloat(body.quantity)).toFixed(2),
    "Coin Amount": body.quantity,
    Counterparty: nickName,
    Status: "Completed",
    Time: new Date().toISOString(),
  };

  GM_xmlhttpRequest({
    method: "POST",
    url: "https://orders-finances-68zktfy1k-ospa2s-projects.vercel.app/api/orders",
    headers: { "Content-Type": "application/json" },
    data: JSON.stringify(newOrder),
    onload: (response) =>
      console.log("Ордер успешно отправлен:", response.status),
    onerror: (response) =>
      console.error("Ошибка отправки ордера:", response.error),
  });
}


interface SendOrderMessageParams {
  message: string;
  orderId: string;
}
async function signRequest(
  apiSecret: string,
  payload: string
): Promise<string> {
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(apiSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload)
  );

  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function sendOrderMessage(
  { message, orderId }: SendOrderMessageParams
): Promise<any> {
  const apiKey = "K8CPRLuqD302ftIfua";
  const apiSecret = "E86RybeO4tLjoXiR5YYtbVStHC9qXCHDBeOI";
  
  const url = "https://api-testnet.bybit.com/v5/p2p/item/online";
  const timestamp = Date.now().toString();
  const recvWindow = "5000";

  const body = JSON.stringify({
    message,
    contentType: "str",
    orderId,
  });

  const payload = timestamp + apiKey + recvWindow + body;
  const signature = await signRequest(apiSecret, payload);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "X-BAPI-API-KEY": apiKey,
      "X-BAPI-SIGN": signature,
      "X-BAPI-TIMESTAMP": timestamp,
      "X-BAPI-RECV-WINDOW": recvWindow,
      "Content-Type": "application/json",
    },
    body,
  });

  return await response.json();
}
