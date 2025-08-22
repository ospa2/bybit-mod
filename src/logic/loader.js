// src/logic/loader.js 
import { appState, setStopLoading, setCurrentPage } from "../state.js"; 
import { adShouldBeFiltered } from "./adFilter.js"; 
import { createRowFromTemplate } from "../components/AdRow.js";
import { USER_ID } from "../config.js";
 
// Загружаем одну страницу и добавляем её в таблицу 
export async function fetchAndAppendPage(pageNum) { 
    if (appState.isLoading || appState.shouldStopLoading) return; 
    appState.isLoading = true; 
 
    let side = "1";
    let size = "1"
    const currentUrl = window.location.href; 
    if (currentUrl.includes("/sell/USDT/RUB")) {
        side = "0"
        size = "300"
    }
    else if (currentUrl.includes("/buy/USDT/RUB")) {
        side = "1"
        size = "70"
    }; 
 
    const payload = { 
        userId: USER_ID, 
        tokenId: "USDT", 
        currencyId: "RUB", 
        payment: [], 
        side: side, 
        size: size, 
        page: String(pageNum), 
        amount: "", 
        vaMaker: false, 
        bulkMaker: false, 
        canTrade: true, 
        verificationFilter: 0, 
        sortType: "OVERALL_RANKING", 
        paymentPeriod: [], 
        itemRegion: 1 
    }; 
 
    try { 
        const res = await fetch("https://www.bybit.com/x-api/fiat/otc/item/online", { 
            method: "POST", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify(payload) 
        }); 
 
        const json = await res.json(); 
        const ads = json.result || json.data || []; 
 
        const tbody = document.querySelector(".trade-table__tbody"); 
        if (!tbody) { 
            console.log("Tbody не найден"); 
            return; 
        } 
 
        let addedCount = 0; 
        
        
        ads.items.forEach(ad => { 
            if (!adShouldBeFiltered(ad)) { 
                const newRow = createRowFromTemplate(ad); 
                if (newRow) { 
                    tbody.appendChild(newRow); 
                    addedCount++; 
                } 
            } 
        }); 
    } catch (e) { 
        console.error("Ошибка при подгрузке:", e); 
    } 
 
    appState.isLoading = false; 
} 
 
// Загружаем все страницы подряд 
export async function loadAllPagesSequentially() { 
    if (appState.isSequentialLoadingActive) { 
        setStopLoading(true); 
        while (appState.isLoading) { 
            await new Promise(resolve => setTimeout(resolve, 100)); 
        } 
    } 
 
    console.log("Начинаю последовательную загрузку страниц..."); 
 
    appState.isSequentialLoadingActive = true; 
    setStopLoading(false); 
    await fetchAndAppendPage(1);
    // while (appState.currentPage <= appState.MAX_PAGES && !appState.shouldStopLoading) { 
    //     await fetchAndAppendPage(appState.currentPage); 
 
    //     if (appState.shouldStopLoading) break; 
 
    //     appState.currentPage++; 
    //     if (appState.currentPage <= appState.MAX_PAGES && !appState.shouldStopLoading) { 
    //         await new Promise(resolve => setTimeout(resolve, DELAY_MS)); 
    //     } 
    // } 
 
    appState.isSequentialLoadingActive = false; 
 
    if (!appState.shouldStopLoading) { 
        console.log("Все страницы загружены."); 
    } else { 
        console.log("Загрузка страниц остановлена из-за смены URL."); 
    } 
}
export async function handleUrlChange() {
    const tbody = document.querySelector('.trade-table__tbody');
    if (!tbody) {
        return;
    }

    // Останавливаем текущую загрузку
    if (appState.isSequentialLoadingActive) {
        setStopLoading(true)
        // Ждем завершения всех операций
        while (appState.isSequentialLoadingActive || appState.isLoading) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    // Очищаем таблицу
    tbody.querySelectorAll('.dynamic-row').forEach(row => row.remove());
    tbody.querySelector('.completion-indicator')?.remove();

    // Сбрасываем состояние
    const currentUrl = window.location.href;
    if (currentUrl.includes("/sell/USDT/RUB")) {
        setCurrentPage(1)
    } else setCurrentPage(1);
    
    setStopLoading(false);
    
    // Запускаем новую загрузку
    loadAllPagesSequentially();
}

export function observeUrlChanges() {
    let previousUrl = location.href;
    const observer = new MutationObserver(() => {
        if (location.href !== previousUrl) {
            console.log(`URL изменился: ${previousUrl} → ${location.href}`);
            previousUrl = location.href;
            handleUrlChange();
            setTimeout(() => {
                const tableRows = document.querySelectorAll('.trade-table__tbody tr');
                tableRows.forEach(row => {
                    row.classList.add('filtered-ad');
                });
            }, 1000);
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}