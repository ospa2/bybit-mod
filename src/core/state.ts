// src/state.ts

import { handleUrlChange } from "../features/buy/logic/buyLoader";
// Единый объект состояния приложения
export const appState = {
    MIN_LEFT_VALUE: 10000,
    MAX_RIGHT_VALUE: 100000,
    isLoading: false,
    isSequentialLoadingActive: false,
    shouldStopLoading: false, // Флаг для остановки
    counterpartyNickname: "",
};

/**
 * Обновляет граничные значения фильтра.
 */
export function updateGlobalValues(min: number, max: number, onChangeCallback: () => void) {
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
export function setLoading(status: boolean) {
    appState.isLoading = status;
}

/** Устанавливает флаг для остановки цикла загрузки. */
export function setStopLoading(status: boolean) {
    appState.shouldStopLoading = status;
}

