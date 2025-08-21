// src/state.js

export const appState = {
    MIN_LEFT_VALUE: 9000,
    MAX_RIGHT_VALUE: 80000,
    currentPage: 0,
    isLoading: false,
    isSequentialLoadingActive: false,
    shouldStopLoading: false, // Флаг для остановки
};

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