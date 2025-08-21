// src/main.js
import './style.css';
import { appState, setLoading, setCurrentPage, setStopLoading } from './state';
import { adShouldBeFiltered } from './logic/adFilter';
import { createRowFromTemplate } from './components/AdRow';
import { fetchAds } from './api/bybitApi'; // Предполагаем, что эта функция добавлена в api.js
import { MAX_PAGES, DELAY_MS } from './config';

/**
 * Основная функция для последовательной загрузки, фильтрации и отображения объявлений.
 */
async function sequentialLoadAds() {
    if (appState.isLoading) {
        console.log("Загрузка уже в процессе.");
        return;
    }
    
    setLoading(true);
    appState.shouldStopLoading = false;
    const adsContainer = document.getElementById('ads-container');
    if (!adsContainer) {
        console.error("Контейнер #ads-container не найден!");
        setLoading(false);
        return;
    }
    adsContainer.innerHTML = '<div class="loading-indicator">Загрузка объявлений...</div>'; // Индикатор загрузки

    let foundAdsCount = 0;

    for (let i = 1; i <= MAX_PAGES; i++) {
        if (appState.shouldStopLoading) {
            console.log("Загрузка остановлена пользователем.");
            break;
        }

        setCurrentPage(i);
        console.log(`Загрузка страницы ${i}...`);

        try {
            const ads = await fetchAds(i); // Получаем объявления для текущей страницы

            if (i === 1) {
                adsContainer.innerHTML = ''; // Очищаем индикатор загрузки при получении первых данных
            }
            
            if (!ads || ads.length === 0) {
                console.log("Больше объявлений не найдено.");
                break; // Прерываем цикл, если API вернул пустой массив
            }
            
            const filteredAds = ads.filter(ad => !adShouldBeFiltered(ad));

            if (filteredAds.length > 0) {
                const fragment = document.createDocumentFragment();
                filteredAds.forEach(ad => {
                    const adRow = createRowFromTemplate(ad);
                    fragment.appendChild(adRow);
                });
                adsContainer.appendChild(fragment);
                foundAdsCount += filteredAds.length;
            }
            
            // Небольшая задержка между запросами, чтобы не нагружать API
            await new Promise(resolve => setTimeout(resolve, DELAY_MS));

        } catch (error) {
            console.error(`Ошибка при загрузке страницы ${i}:`, error);
            // Можно показать ошибку в UI
            adsContainer.innerHTML = '<div class="error-indicator">Не удалось загрузить объявления. Попробуйте позже.</div>';
            break;
        }
    }
    
    if (foundAdsCount === 0 && !adsContainer.querySelector('.error-indicator')) {
        adsContainer.innerHTML = '<div class="no-results">Подходящих объявлений не найдено.</div>';
    }

    setLoading(false);
    console.log("Загрузка завершена.");
}

/**
 * Инициализация приложения: настройка обработчиков и запуск начальной загрузки.
 */
function init() {
    // Здесь можно найти кнопки управления и повесить на них события
    const startButton = document.getElementById('start-load-button');
    const stopButton = document.getElementById('stop-load-button');

    startButton?.addEventListener('click', sequentialLoadAds);
    
    stopButton?.addEventListener('click', () => {
        if (appState.isLoading) {
            setStopLoading(true); // Устанавливаем флаг для остановки цикла
        }
    });
    
    // Запускаем загрузку сразу при старте приложения
    sequentialLoadAds();
}

// Запускаем инициализацию после полной загрузки DOM
init()

console.log('asdsad');
