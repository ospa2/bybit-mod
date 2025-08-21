// src/state.js

const appState = {
    MIN_LEFT_VALUE: 9000,
    MAX_RIGHT_VALUE: 80000,
    currentPage: 0,
    isLoading: false,
    isSequentialLoadingActive: false,
    shouldStopLoading: false, // Флаг для остановки
};
export const MAX_RIGHT_VALUE = appState.MAX_RIGHT_VALUE;
export const MIN_LEFT_VALUE = appState.MIN_LEFT_VALUE;
export const currentPage = appState.currentPage;
export const isLoading = appState.isLoading;
export const isSequentialLoadingActive = appState.isSequentialLoadingActive;
export const shouldStopLoading = appState.shouldStopLoading;
export function updateGlobalValues(min, max) {
    if(min == MIN_LEFT_VALUE && max == MAX_RIGHT_VALUE) return
    MIN_LEFT_VALUE = min;
    MAX_RIGHT_VALUE = max;
    handleUrlChange()
    console.log(`Значения обновлены: MIN_LEFT_VALUE = ${MIN_LEFT_VALUE}, MAX_RIGHT_VALUE = ${MAX_RIGHT_VALUE}`);
}

/**
 * Устанавливает состояние загрузки.
 * @param {boolean} status 
 */
export function setLoading(status) {
    appState.isLoading = status;
}

/**
 * Устанавливает номер текущей загружаемой страницы.
 * @param {number} page 
 */
export function setCurrentPage(page) {
    appState.currentPage = page;
}

/**
 * [НОВАЯ ФУНКЦИЯ] Устанавливает флаг для остановки цикла загрузки.
 * @param {boolean} status 
 */
export function setStopLoading(status) {
    appState.shouldStopLoading = status;
}