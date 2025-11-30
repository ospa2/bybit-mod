// src/logic/loader.js 
import { appState, setStopLoading } from "../../../core/state";
import { AutoClickElements } from "../../sell/automation/autoсlicker.ts";
import { fetchAndAppendPage } from "../api/buyApi.ts";

const DEBOUNCE_MS = 150;

let handleUrlChangeDebounced: ReturnType<typeof setTimeout> | null = null;
function now() { return new Date().toISOString(); }

export async function loadOnceAndApply() {
  if (appState.isLoading) {
    console.log(`[${now()}] Запрос уже в процессе — пропускаю новый вызов.`);
    return;
  }

  appState.isSequentialLoadingActive = true;
  setStopLoading(false);

  try {
    await fetchAndAppendPage();
  } catch (e) {
    console.error(`[${now()}] Ошибка в fetchAndAppendPage:`, e);
  } finally {
    appState.isSequentialLoadingActive = false;
  }
}

export async function handleUrlChange() {
  const tbody = document.querySelector('.trade-table__tbody');
  if (!tbody) {
    console.log(`[${now()}] tbody не найден — ничего не делаю.`);
    return;
  }

  console.log(`[${now()}] handleUrlChange — очищаю таблицу один раз и перезапускаю загрузку по правилу страницы.`);
  if (window.location.href === "https://www.bybit.com/ru-RU/p2p/sell/USDT/RUB") {
    AutoClickElements.findAndClickRefreshSelector((window as any).autoClicker)
  }
  if (window.location.href === "https://www.bybit.com/ru-RU/p2p/buy/USDT/RUB") {
    AutoClickElements.findAndClickRefreshSelector((window as any).autoClicker)
  }
  // Останавливаем текущие операции
  setStopLoading(true);
  // Ждём пока текущие загрузки закончатся
  while (appState.isLoading || appState.isSequentialLoadingActive) {
    // небольшой интервал ожидания
    // eslint-disable-next-line no-await-in-loop
    await new Promise(res => setTimeout(res, 50));
  }

  setStopLoading(false);

  // Запустить новую загрузку (внутри fetchAndAppendPage логика для buy/sell)
  await loadOnceAndApply();
}

export function observeUrlChanges() {
  // Отслеживаем pushState/replaceState и popstate
  const originalPush = history.pushState;
  const originalReplace = history.replaceState;

  function emitUrlChange() {
    // дебаунс
    if (handleUrlChangeDebounced) clearTimeout(handleUrlChangeDebounced);
    handleUrlChangeDebounced = setTimeout(() => {
      handleUrlChange().catch(e => console.error("handleUrlChange error:", e));
    }, DEBOUNCE_MS);
  }

  history.pushState = function (...args) {
    originalPush.apply(this, args);
    emitUrlChange();
  };
  history.replaceState = function (...args) {
    originalReplace.apply(this, args);
    emitUrlChange();
  };
  window.addEventListener('popstate', emitUrlChange);

  // Дополнительно MutationObserver на body — на случай SPA рендеров
  let previousUrl = location.href;
  const observer = new MutationObserver(() => {
    if (location.href !== previousUrl) {
      console.log(`[${now()}] URL изменился: ${previousUrl} → ${location.href}`);
      previousUrl = location.href;
      emitUrlChange();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  if (window.location.href === "https://www.bybit.com/ru-RU/p2p/sell/USDT/RUB") {
    AutoClickElements.findAndClickRefreshSelector((window as any).autoClicker)
  }
  console.log(`[${now()}] observeUrlChanges установлен.`);
}