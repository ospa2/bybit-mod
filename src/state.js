// src/state.js

import { handleUrlChange } from "./logic/loader";

// Единый объект состояния приложения
export const appState = {
    MIN_LEFT_VALUE: 9000,
    MAX_RIGHT_VALUE: 80000,
    currentPage: 0,
    isLoading: false,
    isSequentialLoadingActive: false,
    shouldStopLoading: false, // Флаг для остановки
    MAX_PAGES: 50,            // дефолт
    DELAY_MS: 500             // дефолт
};

/**
 * Обновляет граничные значения фильтра.
 */
export function updateGlobalValues(min, max, onChangeCallback) {
    if (min === appState.MIN_LEFT_VALUE && max === appState.MAX_RIGHT_VALUE) return;

    appState.MIN_LEFT_VALUE = min;
    appState.MAX_RIGHT_VALUE = max;

    if (typeof onChangeCallback === "function") {
        onChangeCallback();
        handleUrlChange()
    }

    console.log(
        `Значения обновлены: MIN_LEFT_VALUE = ${appState.MIN_LEFT_VALUE}, MAX_RIGHT_VALUE = ${appState.MAX_RIGHT_VALUE}`
    );
}

/** Устанавливает состояние загрузки. */
export function setLoading(status) {
    appState.isLoading = status;
}

/** Устанавливает номер текущей загружаемой страницы. */
export function setCurrentPage(page) {
    appState.currentPage = page;
}

/** Устанавливает флаг для остановки цикла загрузки. */
export function setStopLoading(status) {
    appState.shouldStopLoading = status;
}
