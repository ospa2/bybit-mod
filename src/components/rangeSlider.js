// sliders.js
import { GM_getValue, GM_setValue } from "$";
/**
 * Инициализирует замену текстовых полей на двойные слайдеры.
 * @param {object} options - Объект с настройками.
 * @param {number} options.min - Минимальное значение.
 * @param {number} options.max - Максимальное значение.
 * @param {function} options.onUpdate - Функция-колбэк для обновления значений.
 */
export function initSliderReplacement(options) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            replaceInputsWithSliders(options);
        });
    } else {
        replaceInputsWithSliders(options);
    }
}

function replaceInputsWithSliders(options) {
    const molyInputDivs = document.querySelectorAll('.moly-input');

    molyInputDivs.forEach(div => {
        const textInputs = div.querySelectorAll('input[type="text"]');
        textInputs.forEach(input => {
            if (!div.querySelector('.double-slider-container')) {
                createDoubleSlider(input, div, options);
            }
        });
    });
}

function createDoubleSlider(originalInput, container, options) {
    const { min: MIN_VALUE, max: MAX_VALUE, onUpdate } = options;

    // Генерируем уникальный ID для этого слайдера
    const sliderId = 'rangeSlider222'
    originalInput.setAttribute('data-slider-id', sliderId);

    // Загружаем сохраненные значения из localStorage
    const savedValues = GM_getValue(sliderId, null);
    let initialMin = savedValues ? savedValues.min : MIN_VALUE;
    let initialMax = savedValues ? savedValues.max : MAX_VALUE;
    
    // Создаем контейнер для слайдера
    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'double-slider-container';
    container.style.width = '420px';

    // Создаем трек (дорожку) слайдера
    const track = document.createElement('div');
    track.className = 'slider-track';

    // Создаем активную область между ползунками
    const activeRange = document.createElement('div');
    activeRange.className = 'slider-range';

    // Создаем ползунки с загруженными или начальными значениями
    const minSlider = createSliderInput('min-slider', MIN_VALUE, MAX_VALUE, initialMin);
    const maxSlider = createSliderInput('max-slider', MIN_VALUE, MAX_VALUE, initialMax);

    // Создаем отображение значений
    const valueLabels = document.createElement('div');
    valueLabels.className = 'value-labels';
    const minValueSpan = document.createElement('span');
    const maxValueSpan = document.createElement('span');
    valueLabels.appendChild(minValueSpan);
    valueLabels.appendChild(maxValueSpan);

    // Добавляем обработчики событий
    minSlider.addEventListener('input', updateSlider);
    maxSlider.addEventListener('input', updateSlider);

    minSlider.addEventListener('mouseup', callOnUpdate);
    maxSlider.addEventListener('mouseup', callOnUpdate);
    minSlider.addEventListener('touchend', callOnUpdate);
    maxSlider.addEventListener('touchend', callOnUpdate);

    function updateSlider() {
        let min = parseInt(minSlider.value);
        let max = parseInt(maxSlider.value);

        if (min >= max) {
            if (minSlider === document.activeElement) {
                minSlider.value = max;
            } else {
                maxSlider.value = min;
            }
        }

        min = parseInt(minSlider.value);
        max = parseInt(maxSlider.value);

        // Обновляем отображение значений
        minValueSpan.textContent = `${min}`;
        maxValueSpan.textContent = `${max}`;

        // Вычисляем позицию и ширину активной области
        const leftPercent = ((min - MIN_VALUE) / (MAX_VALUE - MIN_VALUE)) * 100;
        const widthPercent = ((max - min) / (MAX_VALUE - MIN_VALUE)) * 100;

        activeRange.style.left = `${leftPercent}%`;
        activeRange.style.width = `${widthPercent}%`;

        // Устанавливаем значение в формате "min-max"
        originalInput.value = `${min}-${max}`;
        container.dispatchEvent(new Event('change', { bubbles: true }));

        // Сохраняем значения в localStorage
        GM_setValue(sliderId, { min, max });

    }

    function callOnUpdate() {
        let min = parseInt(minSlider.value);
        let max = parseInt(maxSlider.value);
        if (onUpdate) {
            console.log('Колбэк onUpdate вызван.');
            onUpdate(min, max);
        }
    }

    // Собираем все элементы
    track.appendChild(activeRange);
    sliderContainer.appendChild(track);
    sliderContainer.appendChild(minSlider);
    sliderContainer.appendChild(maxSlider);
    sliderContainer.appendChild(valueLabels);

    // Заменяем оригинальный input
    originalInput.parentNode.replaceChild(sliderContainer, originalInput);

    // Инициализируем отображение
    updateSlider();
}

function createSliderInput(className, min, max, value) {
    const input = document.createElement('input');
    input.type = 'range';
    input.min = min;
    input.max = max;
    input.value = value;
    input.className = className;
    input.step = '100'; // Добавляем шаг 100
    return input;
}