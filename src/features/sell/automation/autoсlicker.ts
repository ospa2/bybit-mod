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

  // --- Шаг 3 ---
  private findAndClickSellButtons(element: HTMLElement): void {
    const buttons: HTMLButtonElement[] = element.querySelectorAll?.("button")
      ? Array.from(element.querySelectorAll("button"))
      : element.tagName === "BUTTON"
        ? [element as HTMLButtonElement]
        : [];

    buttons.forEach((button) => {
      const buttonText = button.textContent?.trim();
      if (buttonText && buttonText.includes("Продажа")) {
        console.log("AutoClick: Найдена кнопка Продажа, выполняю клик");
        this.clickElement(button, "button");
      }
    });
  }
  static findAndClickCancel(ctx: AutoClickElements, element: HTMLElement): void {
    const buttons: HTMLButtonElement[] = element.querySelectorAll?.("button")
      ? Array.from(element.querySelectorAll("button"))
      : element.tagName === "BUTTON"
        ? [element as HTMLButtonElement]
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

  // --- Шаг 4 ---
  private findAndClickUseOtherMethods(timeout: number = 10000): Promise<void> {
    // Мы возвращаем Promise, который "разрешится" (resolve) при успехе
    // или "отклонится" (reject) при таймауте.
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const interval = 200; // Интервал опроса

      const tryToFind = () => {
        let foundElement: { div: HTMLDivElement, span: HTMLSpanElement } | null = null;
        const divs = document.querySelectorAll<HTMLDivElement>("div[style]");

        // Используем for...of, чтобы можно было использовать 'break'
        for (const div of divs) {
          const span = div.querySelector("span");
          const text = span?.textContent?.trim();
          if (text === "Использовать другие способы" && span) {
            foundElement = { div, span };
            break; // Элемент найден, выходим из цикла
          }
        }

        // 1. Успех: Элемент найден
        if (foundElement) {
          console.log("AutoClick: Найден 'Использовать другие способы', кликаю");
          foundElement.span?.click();


          this.clickElement(foundElement.div, "use-other-methods");

          resolve(); // Сообщаем Promise, что все успешно
          return;
        }

        // 2. Ошибка: Таймаут истек
        if (Date.now() - startTime > timeout) {
          console.error("AutoClick: Таймаут 6с. Элемент 'Использовать другие способы' не найден.");
          const dialog = document.querySelector('div[role="dialog"]') as HTMLElement;
          AutoClickElements.findAndClickCancel(this, dialog);
          reject(new Error("Таймаут ожидания 'Использовать другие способы'")); // Сообщаем об ошибке
          return;
        }

        // 3. Попытка: Элемент не найден, таймаут не истек
        // Пробуем снова через 200 мс
        setTimeout(tryToFind, interval);
      };

      // Запускаем первую попытку
      tryToFind();
    });
  }

  // --- Шаг 5 ---
  private findAndClickFundPassword(): void {
    const options = document.querySelectorAll<HTMLDivElement>("div.custom-option");
    options.forEach((option) => {
      const text = option.textContent?.trim();
      if (text && text.includes("Финансовый пароль")) {
        console.log("AutoClick: Найден 'Финансовый пароль', кликаю");
        this.clickElement(option, "fund-password");
      }
    });
  }

  // --- Шаг 6: Введите финансовый пароль (input) ---
  private findAndTypeFundPassword(password = "qCJjubprde927d$"): void {
    const input = document.querySelector<HTMLInputElement>(
      'input[placeholder="Введите финансовый пароль"]'
    );

    if (!input) {
      setTimeout(() => this.findAndTypeFundPassword(password), 500);
      return;
    }

    console.log("AutoClick: найден инпут финансового пароля, ввожу данные...");

    // Устанавливаем значение напрямую
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set;
    nativeInputValueSetter?.call(input, password);

    // События имитации ввода
    const events = ["input", "change", "keyup", "keydown"];
    events.forEach((eventName) => {
      input.dispatchEvent(new Event(eventName, { bubbles: true }));
    });

    // На всякий случай подождём и кликнем “Подтвердить”
    setTimeout(() => {
      this.findAndClickConfirmButton()
    }, 1000);
  }

  // --- Шаг 7 ---
  private findAndClickConfirmButton(): void {
    const buttons = document.querySelectorAll<HTMLButtonElement>("button");
    buttons.forEach((btn) => {
      const text = btn.textContent?.trim();
      if (text === "Подтвердить") {
        console.log("AutoClick: Найдена кнопка Подтвердить, кликаю");
        this.clickElement(btn, "confirm");
      }
    });
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


  static async runSequentialActionsToCreateOrder(ctx: AutoClickElements, element: HTMLElement): Promise<void> {
    // Вспомогательная функция для создания пауз
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      // 1. Клик "Продать"
      await delay(100);
      ctx.findAndClickSellButtons(element);

      // 2. Клик "Использовать другие способы"
      // Ждем 2с (как в оригинале) перед *началом* поиска
      await delay(2000);
      // Теперь мы ЖДЕМ (до 6 секунд) выполнения findAndClickUseOtherMethods
      await ctx.findAndClickUseOtherMethods(); // таймаут 6000 мс по умолчанию

      // 3. Клик "Пароль фонда"
      // Этот шаг выполнится через 200 мс *ПОСЛЕ* *успешного* клика "Другие способы"
      await delay(200);
      ctx.findAndClickFundPassword();

      // 4. Ввод пароля
      await delay(200); // (2400 - 2200)
      ctx.findAndTypeFundPassword();

      // 5. Клик "Подтвердить"
      await delay(200); // (2600 - 2400)
      ctx.findAndClickConfirmButton();

      // 6. Назад
      await delay(4400); // (6000 - 2600)

      window.location.href = "https://www.bybit.com/ru-RU/p2p/sell/USDT/RUB";

    } catch (error) {
      console.error("AutoClick: Ошибка в последовательности, цепочка прервана:", error);
      // Если что-то пошло не так (например, таймаут 6с),
      // выполнение здесь остановится, и мы не пойдем дальше.
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
        if (spanText && spanText.includes("до обновления")) {
          console.log("AutoClick: Найден селектор обновления, открываю список");
          ctx.clickElement(div, "refresh selector", () => {
            setTimeout(() => {
              ctx.findAndClickNotNow();
            }, 500);
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
          }, 500);
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
        this.clickElement(option, "5 seconds option");
        fiveSecondsFound = true;
      }
    });

    if (!fiveSecondsFound && options.length === 0) {
      console.log("AutoClick: Опции еще не загрузились, повторная попытка...");
      setTimeout(() => this.findAndClick5Seconds(), 500);
    }
  }
}
