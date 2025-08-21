import { initSliderReplacement } from "C:/Web/bybitmod/bybit-mod/src/components/rangeSlider.js";
import { updateGlobalValues, currentPage } from "./state.js";
import { loadAllPagesSequentially, observeUrlChanges } from "./logic/loader.js";
import { USER_ID } from "./config.js";

function waitForTableAndStart() {
    const tbody = document.querySelector(".trade-table__tbody");

    if (!tbody || tbody.children.length === 0) {
        console.log("Ожидание таблицы...");
        setTimeout(waitForTableAndStart, 500);
    } else {
        tbody.querySelectorAll(".dynamic-row").forEach(row => row.remove());
        tbody.querySelector(".completion-indicator")?.remove();

        setTimeout(() => {
            document.querySelectorAll(".trade-table__tbody tr").forEach(row => row.classList.add("filtered-ad"));

            initSliderReplacement({
                min: 9000,
                max: 80000,
                onUpdate: updateGlobalValues
            });

            loadAllPagesSequentially(USER_ID);
            observeUrlChanges(USER_ID);
        }, 100);
    }
}

setTimeout(waitForTableAndStart, 100);
console.log("Bybit P2P Filter Enhanced загружен");
