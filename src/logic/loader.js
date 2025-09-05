// src/logic/loader.js 
import { appState, setStopLoading } from "../state.js"; 
import { fetchAndAppendPage } from "../api/bybitApi.js";
 
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
    await fetchAndAppendPage();

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
    // tbody.querySelectorAll('.dynamic-row').forEach(row => row.remove());
    // tbody.querySelector('.completion-indicator')?.remove();

    
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
                if (location.href==="https://www.bybit.com/ru-RU/p2p/buy/USDT/RUB") {
                    
                
                const tableRows = document.querySelectorAll('.trade-table__tbody tr');
                tableRows.forEach(row => {
                    row.classList.add('filtered-ad');
                });
                }
            }, 1500);
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}