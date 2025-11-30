import { editTelegramMessage, } from "../api/confirmOrder";

export class AutoClickElements {
  private observer: MutationObserver | null = null;
  private isActive = false;

  constructor() {
    this.start();
  }

  private start(): void {
    if (this.isActive) return;
    this.isActive = true;

    this.observer = new MutationObserver((mutations: MutationRecord[]) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.checkForElements(node as HTMLElement);
            }
          });
        }
      });
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    this.checkForElements(document.body);
    console.log("AutoClick: Мониторинг всех элементов запущен");
  }

  private checkForElements(element: HTMLElement): void {
    if (!this.isActive) return;

    // 1️⃣ Ищем span "Все"
    const spans: HTMLSpanElement[] = element.querySelectorAll?.("span")
      ? Array.from(element.querySelectorAll("span"))
      : element.tagName === "SPAN"
        ? [element as HTMLSpanElement]
        : [];

    spans.forEach((span) => {
      const spanText = span.textContent?.trim();

      if (spanText === "Все" && span.classList.contains("amount-input-all")) {
        const parent = span.closest("div");
        const hasUsdtSibling = parent?.querySelector("span")?.textContent?.trim() === "USDT";

        if (hasUsdtSibling) {
          console.log('AutoClick: Найден нужный span "Все" рядом с "USDT", выполняю клик');
          this.clickMax(span, "span");
        }
      }
    });

    setTimeout(() => { }, 500)
    // 2️⃣ Ищем селект "Выбрать способ оплаты"
    const divs: HTMLDivElement[] = element.querySelectorAll?.("div")
      ? Array.from(element.querySelectorAll("div"))
      : element.tagName === "DIV"
        ? [element as HTMLDivElement]
        : [];

    divs.forEach((div) => {
      const selectText = div.textContent?.trim();
      if (
        selectText &&
        selectText.includes("Выбрать способ оплаты") &&
        div.classList.contains("cursor-pointer")
      ) {
        console.log("AutoClick: Найден селект способа оплаты, открываю список");
        this.clickElement(div, "payment selector", () => {
          setTimeout(() => {
            this.findAndClickSBP();
          }, 500);
        });
      }
    });
  }
  static findAndClickCancel(ctx: AutoClickElements): void {
    const modal = document.querySelector('div[role="dialog"]') as HTMLElement;
    const buttons: HTMLButtonElement[] = modal.querySelectorAll?.("button")
      ? Array.from(modal.querySelectorAll("button"))
      : modal.tagName === "BUTTON"
        ? [modal as HTMLButtonElement]
        : [];
    if (buttons) {
      buttons.forEach((button) => {
        const buttonText = button.textContent?.trim();
        if (buttonText && buttonText.includes("Отмена")) {
          console.log("AutoClick: Найдена кнопка Отмена, выполняю клик");
          ctx.clickElement(button, "button");
        }
      });
    }
  }
  // --- Шаг 1 ---
  private findAndClickSellButton(element: HTMLElement): void {
    if (!element) {
      throw new Error("\n\n😭 Не найден диалог");
    }

    const buttons: HTMLButtonElement[] = element.querySelectorAll?.("button")
      ? Array.from(element.querySelectorAll("button"))
      : element.tagName === "BUTTON"
        ? [element as HTMLButtonElement]
        : [];

    let found = false;
    buttons.forEach((button) => {
      const buttonText = button.textContent?.trim();
      if (buttonText && buttonText.includes("Продажа")) {
        console.log("AutoClick: Найдена кнопка Продажа, выполняю клик");
        this.clickElement(button, "button");
        found = true;
      }
    });

    if (!found) {
      throw new Error("\n\n😭 Не смог кликнуть на продажа");
    }
  }

  // --- Шаг 2 ---
  private findAndClickUseOtherMethods(timeout: number = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const interval = 200;

      const tryToFind = () => {
        let foundElement: { div: HTMLDivElement, span: HTMLSpanElement } | null = null;
        const divs = document.querySelectorAll<HTMLDivElement>("div[style]");

        for (const div of divs) {
          const span = div.querySelector("span");
          const text = span?.textContent?.trim();
          if (text === "Использовать другие способы" && span) {
            foundElement = { div, span };
            break;
          }
        }

        // 1. Успех: Элемент найден
        if (foundElement) {
          console.log("AutoClick: Найден 'Использовать другие способы', кликаю");
          foundElement.span?.click();
          this.clickElement(foundElement.div, "use-other-methods");
          resolve();
          return;
        }

        // 2. Ошибка: Таймаут истек
        if (Date.now() - startTime > timeout) {
          console.error("AutoClick: Таймаут. Элемент 'Использовать другие способы' не найден.");

          AutoClickElements.findAndClickCancel(this);
          reject(new Error("\n\n😭 Не смог кликнуть на использование других способов"));
          return;
        }

        // 3. Попытка: Элемент не найден, таймаут не истек
        setTimeout(tryToFind, interval);
      };

      tryToFind();
    });
  }

  // --- Шаг 3 ---
  private findAndClickFundPassword(): void {
    const options = document.querySelectorAll<HTMLDivElement>("div.custom-option");
    let found = false;

    options.forEach((option) => {
      const text = option.textContent?.trim();
      if (text && text.includes("Финансовый пароль")) {
        console.log("AutoClick: Найден 'Финансовый пароль', кликаю");
        this.clickElement(option, "fund-password");
        found = true;
      }
    });

    if (!found) {
      throw new Error("\n\n😭 Не смог кликнуть на финансовый пароль");
    }
  }

  // --- Шаг 4 ---
  private findAndTypeFundPassword(password = "qCJjubprde927d$"): Promise<void> {
    return new Promise((resolve, reject) => {
      const maxAttempts = 30; // 10 попыток по 50ms = 1.5 секунды
      let attempts = 0;

      const tryToType = () => {
        const input = document.querySelector<HTMLInputElement>(
          'input[placeholder="Введите финансовый пароль"]'
        );

        if (!input) {
          attempts++;
          if (attempts >= maxAttempts) {
            reject(new Error("😭 Не найден инпут финансового пароля"));
            return;
          }
          setTimeout(tryToType, 50);
          return;
        }

        console.log("AutoClick: найден инпут финансового пароля, ввожу данные...");

        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        )?.set;
        nativeInputValueSetter?.call(input, password);

        const events = ["input", "change", "keyup", "keydown"];
        events.forEach((eventName) => {
          input.dispatchEvent(new Event(eventName, { bubbles: true }));
        });

        resolve();
      };

      tryToType();
    });
  }

  // --- Шаг 5 ---
  private findAndClickConfirmButton(): void {
    const buttons = document.querySelectorAll<HTMLButtonElement>("button");
    let found = false;
    let i = 0;
    buttons.forEach((btn) => {
      const text = btn.textContent?.trim();
      if (text === "Подтвердить") {
        console.log("AutoClick: Найдена кнопка Подтвердить, кликаю");
        setInterval(() => {
          if(i > 20) return
          this.clickElement(btn, "confirm") 
          i++;
        }, 50);
        found = true;
      }
    });

    if (!found) {
      throw new Error("\n\n😭Не смог кликнуть на подтвердить");
    }
  }


  // --- Универсальный клик ---
  private clickElement(
    element: HTMLElement,
    type: string,
    callback?: () => void
  ): void {
    try {
      const anyEl = element as any;
      if ("disabled" in anyEl && anyEl.disabled) {
        console.log(`AutoClick: ${type} отключен`);
        return;
      }

      element.focus();
      element.click();
      console.log(`AutoClick: клик по ${type}`);

      if (callback) callback();
    } catch (error) {
      if (error instanceof Error) {
        console.log(`AutoClick: Ошибка при клике на ${type}:`, error.message);
      }
    }
  }
  private clickMax(
    element: HTMLElement,
    type: string,
    callback?: () => void
  ): void {
    try {
      const anyEl = element as any;
      if ("disabled" in anyEl && anyEl.disabled) {
        console.log(`AutoClick: ${type} отключен`);
        return;
      }

      if (type === "span") {
        let i = 0;
        const interval = setInterval(() => {
          if (i > 1) {
            clearInterval(interval);
          }
          i++;
          element.focus();
          (element as HTMLElement).click();
          console.log("span");
        }, 300);
      } else {
        element.focus();
        element.click();
        console.log("button");
      }

      if (callback) {
        callback();
      }
    } catch (error) {
      if (error instanceof Error) {
        console.log(`AutoClick: Ошибка при клике на ${type}:`, error.message);
      }
    }
  }
  // --- Поиск способа оплаты ---
  private findAndClickSBP(): void {
    const sbpDivs = document.querySelectorAll<HTMLDivElement>(
      "div.payment-select__list-wrapper"
    );

    sbpDivs.forEach((div) => {
      const sbpSpan = div.querySelector("span");
      const text = sbpSpan?.textContent?.trim();
      if (
        text &&
        ["Наличные", "Bank Transfer", "Mobile Top-up", "Cash Deposit to Bank"].includes(text)
      ) {
        console.log("AutoClick: Найден способ оплаты, кликаю");
        this.clickElement(div, "SBP div");
      }
    });

    if (sbpDivs.length === 0) {
      console.log("AutoClick: способы оплаты ещё не загрузились, повторная попытка...");
      setTimeout(() => this.findAndClickSBP(), 500);
    }
  }


  // --- Основная функция ---
  static async runSequentialActionsToCreateOrder(ctx: AutoClickElements, messageId: any): Promise<void> {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const element: HTMLElement = document.querySelector('div[role="dialog"]') as HTMLElement;

    try {
      // Обновляем статус в начале
      await editTelegramMessage(messageId, "\n\n⏳ Создаю ордер...");

      // 1. Клик "Продать"
      ctx.findAndClickSellButton(element);

      // 2. Клик "Использовать другие способы"
      await delay(2000);
      await ctx.findAndClickUseOtherMethods();

      // 3. Клик "Пароль фонда"
      ctx.findAndClickFundPassword();

      // 4. Ввод пароля
      await ctx.findAndTypeFundPassword();

      // 5. Клик "Подтвердить"
      ctx.findAndClickConfirmButton();

      // 6. Успех!
      await editTelegramMessage(messageId, "\n\n✅ Ордер успешно создан!");

      // 7. Назад
      await delay(4400);
      window.location.href = "https://www.bybit.com/ru-RU/p2p/sell/USDT/RUB";

    } catch (error) {
      console.error("AutoClick: Ошибка в последовательности:", error);

      // Отправляем сообщение об ошибке
      const errorMessage = error instanceof Error ? error.message : "😭 Неизвестная ошибка";
      await editTelegramMessage(messageId, errorMessage);

      // Закрываем диалог при ошибке
      const dialog = document.querySelector('div[role="dialog"]') as HTMLElement;
      if (dialog) {
        AutoClickElements.findAndClickCancel(ctx);
      }
    }
  }

  static findAndClickRefreshSelector(ctx: AutoClickElements): void {
    const divs = document.querySelectorAll<HTMLDivElement>("div");

    divs.forEach((div) => {
      // Ищем селектор обновления по классу и тексту
      if (
        div.classList.contains("fiat-otc-select-option") &&
        div.classList.contains("otc-refresh-select-option")
      ) {
        const spanText = div.querySelector("span")?.textContent?.trim();
        if (spanText && (spanText.includes("до обновления") || spanText.includes("сейчас"))) {
          console.log("AutoClick: Найден селектор обновления, открываю список");
          ctx.clickElement(div, "refresh selector", () => {
            setTimeout(() => {
              ctx.findAndClickNotNow();
            }, 100);
          });
        }
      }
    });
  }

  private findAndClickNotNow(): void {
    const options = document.querySelectorAll<HTMLDivElement>(
      ".rc-select-item.rc-select-item-option"
    );

    let notNowFound = false;

    options.forEach((option) => {
      const titleDiv = option.querySelector(".truncate");
      const text = titleDiv?.textContent?.trim() || titleDiv?.getAttribute("title");

      if (text === "Не сейчас") {
        console.log("AutoClick: Найдена опция 'Не сейчас', кликаю");
        this.clickElement(option, "Not now option", () => {
          setTimeout(() => {
            this.findAndClick5Seconds();
          }, 100);
        });
        notNowFound = true;
      }
    });

    if (!notNowFound && options.length === 0) {
      console.log("AutoClick: Опции еще не загрузились, повторная попытка...");
      setTimeout(() => this.findAndClickNotNow(), 500);
    }
  }

  private findAndClick5Seconds(): void {
    const options = document.querySelectorAll<HTMLDivElement>(
      ".rc-select-item.rc-select-item-option"
    );

    let fiveSecondsFound = false;

    options.forEach((option) => {
      const titleDiv = option.querySelector(".truncate");
      const text = titleDiv?.textContent?.trim() || titleDiv?.getAttribute("title");

      if (text === "5 с до обновления") {
        console.log("AutoClick: Найдена опция '5 с до обновления', кликаю");
        if (window.location.href === "https://www.bybit.com/ru-RU/p2p/sell/USDT/RUB") {
          this.clickElement(option, "5 seconds option");
        }
        fiveSecondsFound = true;
      }
    });

    if (!fiveSecondsFound && options.length === 0) {
      console.log("AutoClick: Опции еще не загрузились, повторная попытка...");
      setTimeout(() => this.findAndClick5Seconds(), 100);
    }
  }
}
