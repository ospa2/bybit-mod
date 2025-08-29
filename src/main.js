import './style.css';
import { initSliderReplacement } from "C:/Web/bybitmod/bybit-mod/src/components/rangeSlider.js";
import { updateGlobalValues } from "./state.js";
import { loadAllPagesSequentially, observeUrlChanges, handleUrlChange } from "./logic/loader.js";

function waitForTableAndStart() {
    const tbody = document.querySelector(".trade-table__tbody");

    if (!tbody || tbody.children.length === 0) {
        console.log("Ожидание таблицы...");
        setTimeout(waitForTableAndStart, 500);
    } else {
        tbody.querySelectorAll(".dynamic-row").forEach(row => row.remove());
        tbody.querySelector(".completion-indicator")?.remove();
        document.addEventListener('keydown', (event) => {
                // Проверяем, что нажата клавиша 'Z' (без учета регистра)
                if (event.key === 'z' || event.key === 'Z' || event.key === 'я' || event.key === 'Я') {
                    handleUrlChange();
                }
        });

        setTimeout(() => {
            initSliderReplacement({
                min: 9000,
                max: 80000,
                onUpdate: updateGlobalValues
            });

            loadAllPagesSequentially();
            observeUrlChanges();
            document.querySelectorAll(".trade-table__tbody tr").forEach(row => row.classList.add("filtered-ad"));
        }, 100);
    }
}

setTimeout(waitForTableAndStart, 100);
console.log("Bybit P2P Filter Enhanced загружен");

  const originalFetch = window.fetch;

    window.fetch = async (...args) => {
        // args[0] — URL, args[1] — опции (method, body и т.д.)
        let shouldIntercept = false;

        if (args[0].includes("/online") && args[1]?.body) {
            try {
                const body = JSON.parse(args[1].body);
                if (body.side === "0") {
                    shouldIntercept = true;
                }
            } catch (e) {
                console.warn("Не удалось распарсить body:", args[1].body);
            }
        }

        const response = await originalFetch(...args);

        if (shouldIntercept) {
            response.clone().json().then(data => {
                console.log("Перехватил ответ /online с side=1:", data);
                window.__bybitOnlineData = data; // сохраним глобально
            });
        }

        return response;
    };