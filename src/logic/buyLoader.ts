// src/logic/loader.js 
import { appState, setStopLoading } from "../state.ts"; 
import { fetchAndAppendPage } from "../api/bybitApi.ts";
 
const DEBOUNCE_MS = 150;

let handleUrlChangeDebounced: ReturnType<typeof setTimeout> | null = null;
function now() { return new Date().toISOString(); }

export async function loadOnceAndApply() {
  if (appState.isLoading) {
    console.log(`[${now()}] Запрос уже в процессе — пропускаю новый вызов.`);
    return;
  }
  
  console.log(`[${now()}] Начинаю загрузку (single request)...`);
  appState.isSequentialLoadingActive = true;
  setStopLoading(false);

  try {
    await fetchAndAppendPage();
    console.log(`[${now()}] Загрузка завершена.`);
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

  // Останавливаем текущие операции
  setStopLoading(true);
  // Ждём пока текущие загрузки закончатся
  while (appState.isLoading || appState.isSequentialLoadingActive) {
    // небольшой интервал ожидания
    // eslint-disable-next-line no-await-in-loop
    await new Promise(res => setTimeout(res, 50));
  }

  // Один раз очистить таблицу (как вы просили)
  tbody.querySelectorAll('.dynamic-row').forEach(row => row.remove());
  tbody.querySelector('.completion-indicator')?.remove();

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

      // небольшой deferred кастомный класс для выделения строк на buy-странице
      setTimeout(() => {
        if (location.href === "https://www.bybit.com/ru-RU/p2p/buy/USDT/RUB") {
          document.querySelectorAll('.trade-table__tbody tr').forEach(row => {
            row.classList.add('filtered-ad');
          });
        }
      }, 1500);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  console.log(`[${now()}] observeUrlChanges установлен.`);
}