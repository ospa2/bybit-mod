import { fetchAndAppendPage } from "../api/bybitApi.js";
import { currentPage, isLoading, shouldStopLoading, isSequentialLoadingActive } from "../state.js"
import {MAX_PAGES, DELAY_MS} from "../config.js";

export async function loadAllPagesSequentially(USER_ID) {
    if (isSequentialLoadingActive) {
        shouldStopLoading = true;
        while (isLoading) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    console.log("Начинаю последовательную загрузку страниц...");

    isSequentialLoadingActive = true;
    shouldStopLoading = false;

    while (currentPage <= MAX_PAGES && !shouldStopLoading) {
        await fetchAndAppendPage(currentPage, USER_ID);

        if (shouldStopLoading) break;

        currentPage++;
        if (currentPage <= MAX_PAGES && !shouldStopLoading) {
            await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
    }

    isSequentialLoadingActive = false;

    if (!shouldStopLoading) {
        console.log("Все страницы загружены.");
    } else {
        console.log("Загрузка страниц остановлена из-за смены URL.");
    }
}

export async function handleUrlChange(USER_ID) {
    const tbody = document.querySelector(".trade-table__tbody");
    if (!tbody) return;

    if (isSequentialLoadingActive) {
        shouldStopLoading = true;
        while (isSequentialLoadingActive || isLoading) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    tbody.querySelectorAll(".dynamic-row").forEach(row => row.remove());
    tbody.querySelector(".completion-indicator")?.remove();

    const currentUrl = window.location.href;
    if (currentUrl.includes("/sell/USDT/RUB")) {
        currentPage = 16;
    } else {
        currentPage = 1;
    }

    shouldStopLoading = false;

    loadAllPagesSequentially(USER_ID);
}

export function observeUrlChanges(USER_ID) {
    let previousUrl = location.href;
    const observer = new MutationObserver(() => {
        if (location.href !== previousUrl) {
            console.log(`URL изменился: ${previousUrl} → ${location.href}`);
            previousUrl = location.href;
            handleUrlChange(USER_ID);

            setTimeout(() => {
                const tableRows = document.querySelectorAll(".trade-table__tbody tr");
                tableRows.forEach(row => row.classList.add("filtered-ad"));
            }, 2000);
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}
