// src/components/rangeSlider.ts
import { GM_getValue, GM_setValue } from "$";
import type { SliderOptions } from "../types/ads";


/**
 * Инициализирует замену текстовых полей на двойные слайдеры.
 */
export function initSliderReplacement(options: SliderOptions): void {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            replaceInputsWithSliders(options);
        });
    } else {
        replaceInputsWithSliders(options);
    }
}

function replaceInputsWithSliders(options: SliderOptions): void {
    const molyInputDivs = document.querySelectorAll<HTMLDivElement>(".moly-input");

    molyInputDivs.forEach((div) => {
        const textInputs = div.querySelectorAll<HTMLInputElement>("input[type='text']");
        textInputs.forEach((input) => {
            if (!div.querySelector(".double-slider-container")) {
                createDoubleSlider(input, div, options);
            }
        });
    });
}

function createDoubleSlider(
    originalInput: HTMLInputElement,
    container: HTMLElement,
    options: SliderOptions
): void {
    const { min: MIN_VALUE, max: MAX_VALUE, onUpdate } = options;

    const sliderId = "rangeSlider222";
    originalInput.setAttribute("data-slider-id", sliderId);

    // Загружаем сохраненные значения из GM
    const savedValues = GM_getValue(sliderId, null) as { min: number; max: number } | null;
    let initialMin = savedValues ? savedValues.min : MIN_VALUE;
    let initialMax = savedValues ? savedValues.max : MAX_VALUE;

    const sliderContainer = document.createElement("div");
    sliderContainer.className = "double-slider-container";
    container.style.width = "420px";

    const track = document.createElement("div");
    track.className = "slider-track";

    const activeRange = document.createElement("div");
    activeRange.className = "slider-range";

    const minSlider = createSliderInput("min-slider", MIN_VALUE, MAX_VALUE, initialMin);
    const maxSlider = createSliderInput("max-slider", MIN_VALUE, MAX_VALUE, initialMax);

    const valueLabels = document.createElement("div");
    valueLabels.className = "value-labels";
    const minValueSpan = document.createElement("span");
    const maxValueSpan = document.createElement("span");
    valueLabels.appendChild(minValueSpan);
    valueLabels.appendChild(maxValueSpan);

    minSlider.addEventListener("input", updateSlider);
    maxSlider.addEventListener("input", updateSlider);

    minSlider.addEventListener("mouseup", callOnUpdate);
    maxSlider.addEventListener("mouseup", callOnUpdate);
    minSlider.addEventListener("touchend", callOnUpdate);
    maxSlider.addEventListener("touchend", callOnUpdate);

    function updateSlider(): void {
        let min = parseInt(minSlider.value);
        let max = parseInt(maxSlider.value);

        if (min >= max) {
            if (minSlider === document.activeElement) {
                minSlider.value = max.toString();
            } else {
                maxSlider.value = min.toString();
            }
        }

        min = parseInt(minSlider.value);
        max = parseInt(maxSlider.value);

        minValueSpan.textContent = `${min}`;
        maxValueSpan.textContent = `${max}`;

        const leftPercent = ((min - MIN_VALUE) / (MAX_VALUE - MIN_VALUE)) * 100;
        const widthPercent = ((max - min) / (MAX_VALUE - MIN_VALUE)) * 100;

        activeRange.style.left = `${leftPercent}%`;
        activeRange.style.width = `${widthPercent}%`;

        originalInput.value = `${min}-${max}`;
        container.dispatchEvent(new Event("change", { bubbles: true }));

        GM_setValue(sliderId, { min, max });
    }

    function callOnUpdate(): void {
        const min = parseInt(minSlider.value);
        const max = parseInt(maxSlider.value);
        if (onUpdate) {
            console.log("Колбэк onUpdate вызван.");
            onUpdate(min, max, () => {});
        }
    }

    track.appendChild(activeRange);
    sliderContainer.appendChild(track);
    sliderContainer.appendChild(minSlider);
    sliderContainer.appendChild(maxSlider);
    sliderContainer.appendChild(valueLabels);

    originalInput.parentNode?.replaceChild(sliderContainer, originalInput);

    updateSlider();
}

function createSliderInput(className: string, min: number, max: number, value: number): HTMLInputElement {
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.value = String(value);
    input.className = className;
    input.step = "100";
    return input;
}
