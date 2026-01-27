import { editTelegramMessage, } from "../api/telegramNotifier";

export class AutoClickElements {
  private isActive = false;

  constructor() {
    this.start();
  }

  private start(): void {
    if (this.isActive) return;
    this.isActive = true;

    console.log("AutoClick: Мониторинг всех элементов запущен");
  }

  static findAndClickCancel(ctx: AutoClickElements): void {
    document.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape",
      code: "Escape",
      keyCode: 27,
      which: 27,
      bubbles: true
    }));
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
          ctx.clickElement(button, "button");
        }
      });
    }
  }


  /**
   * Универсальный метод ожидания появления элемента или выполнения условия.
   * Работает на requestAnimationFrame для мгновенной реакции.
   */
  private waitFor<T>(
    checkFn: () => T | null | undefined,
    errorMessage: string,
    timeout: number = 10000
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const check = () => {
        try {
          const result = checkFn();
          if (result) {
            resolve(result);
            return;
          }
        } catch (e) {
          // Игнорируем ошибки внутри проверки, пока идет ожидание
        }

        if (Date.now() - startTime > timeout) {
          reject(new Error(errorMessage));
          return;
        }

        requestAnimationFrame(check);
      };

      check();
    });
  }

  // --- Шаг 0: Получение диалога ---
  private async getDialog(): Promise<HTMLElement> {
    return this.waitFor(
      () => document.querySelector<HTMLElement>('div[role="dialog"]'),
      "\n\n😭 Диалог не появился"
    );
  }

  // --- Шаг 1 ---
  private async findAndClickSellButton(dialog: HTMLElement): Promise<void> {
    // 1. Ждем и кликаем на "Все"


    this.clickMax();

    // 2. Ждем и выбираем способ оплаты
    const paymentSelector = await this.waitFor(
      () => {
        const divs = Array.from(dialog.querySelectorAll<HTMLDivElement>("div.cursor-pointer"));
        return divs.find((div) => div.textContent?.includes("Выбрать способ оплаты"));
      },
      "😭 Не найден селектор оплаты"
    );

    await new Promise<void>((resolve) => {
      this.clickElement(paymentSelector, "payment selector", () => resolve());
    });

    // Предполагаем, что этот метод также должен быть async и ждать рендера списка
    // Если он синхронный — он может не успеть выбрать элемент до проверки кнопки "Продажа"
    // Но waitFor ниже всё равно будет ждать активации кнопки
    await this.findAndClickSBP();

    // 3. Кнопка "Продажа" — Ждем перехода в состояние ENABLED
    const sellButton = await this.waitFor(
      () => {
        const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>("button"));
        return buttons.find((btn) => {
          const text = btn.textContent?.trim();
          const isSell = text?.includes("Продажа");

          // Критическая проверка состояния
          const isInteractive = !btn.disabled && !btn.classList.contains("disabled");

          return isSell && isInteractive;
        });
      },
      "😭 Кнопка 'Продажа' не стала активной за отведенное время"
    );

    this.clickElement(sellButton, "button");
  }

  // --- Шаг 2 ---
  private async findAndClickUseOtherMethods(): Promise<void> {
    const targetElement = await this.waitFor(
      () => {
        const divs = document.querySelectorAll<HTMLDivElement>("div[style]"); // Можно оптимизировать селектор если есть классы
        for (const div of divs) {
          const span = div.querySelector("span");
          if (span?.textContent?.trim() === "Использовать другие способы") {
            return { div, span };
          }
        }
        return null;
      },
      "\n\n😭 Не смог найти 'Использовать другие способы'"
    );

    targetElement.span.click();
    this.clickElement(targetElement.div, "use-other-methods");
  }

  // --- Шаг 3 ---
  private async findAndClickFundPasswordOption(): Promise<void> {
    const option = await this.waitFor(
      () => {
        const options = document.querySelectorAll<HTMLDivElement>("div.custom-option");
        return Array.from(options).find(opt => opt.textContent?.includes("Финансовый пароль"));
      },
      "\n\n😭 Не смог найти опцию 'Финансовый пароль'"
    );

    this.clickElement(option, "fund-password");
  }

  // --- Шаг 4 ---
  private async findAndTypeFundPassword(password = "qCJjubprde927d$"): Promise<void> {
    const input = await this.waitFor(
      () => document.querySelector<HTMLInputElement>('input[placeholder="Введите финансовый пароль"]'),
      "😭 Не найден инпут финансового пароля"
    );

    // React/Angular хак для установки значения
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set;

    nativeInputValueSetter?.call(input, password);

    ["input", "change", "keyup", "keydown"].forEach(event => {
      input.dispatchEvent(new Event(event, { bubbles: true }));
    });
  }

  // --- Шаг 5 ---
  private async findAndClickConfirmButton(): Promise<void> {
    // Ждем кнопку "Подтвердить".
    const btn = await this.waitFor(
      () => {
        const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("button"));
        // Добавлена проверка !disabled, чтобы не кликать по неактивной кнопке
        return buttons.find(b => b.textContent?.trim() === "Подтвердить" && !b.disabled);
      },
      "\n\n😭 Не смог найти кнопку 'Подтвердить'"
    );

    // Если UI лагает и кнопка есть, но листенер не повешен, делаем несколько попыток
    // вместо бесконечного setInterval
    for (let i = 0; i < 5; i++) {
      try {
        this.clickElement(btn, "confirm");
        // Если клик сработал и диалог закрылся/изменился - отлично.
        // Проверку успеха клика можно добавить здесь (например, исчезновение кнопки)
        return;
      } catch (e) {
        await new Promise(r => setTimeout(r, 100));
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

      if (callback) callback();
    } catch (error) {
      if (error instanceof Error) {
        console.log(`AutoClick: Ошибка при клике на ${type}:`, error.message);
      }
    }
  }
  private clickMax(
  ): void {
    try {

      const element = document.querySelector('.amount-input-all');
      let i = 0;
      const interval = setInterval(() => {
        if (i > 1) {
          clearInterval(interval);
        }
        i++;
        (element as HTMLInputElement).focus();
        (element as HTMLElement).click();
        console.log(element?.getBoundingClientRect())
      }, 300);
    }
    catch (error) {
      if (error instanceof Error) {
        console.log(`AutoClick: Ошибка при клике на span:`, error.message);
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
        this.clickElement(div, "SBP div");
      }
    });

    if (sbpDivs.length === 0) {
      console.log("AutoClick: способы оплаты ещё не загрузились, повторная попытка...");
      setTimeout(() => this.findAndClickSBP(), 500);
    }
  }


  static async clickEveryButtonExceptOne(ctx: AutoClickElements): Promise<void> {
    // 1. Получаем диалог (ждем его появления)
    const dialog = await ctx.getDialog();

    // 2. Логика внутри диалога (Продажа -> Выбор метода)
    await ctx.findAndClickSellButton(dialog);

    // 3. Переход к другим методам (ждем появления нового окна/элементов)
    await ctx.findAndClickUseOtherMethods();

    // 4. Выбор фин. пароля
    await ctx.findAndClickFundPasswordOption();

    // 5. Ввод пароля
    await ctx.findAndTypeFundPassword();
  }

  static async clickLastButton(ctx: AutoClickElements, messageId: any): Promise<void> {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // 5. Клик "Подтвердить"
    await ctx.findAndClickConfirmButton();

    // 6. Успех!
    await editTelegramMessage(messageId, "\n\n✅ Ордер успешно создан!");

    // 7. Назад
    await delay(6400);
    window.location.href = "https://www.bybit.com/ru-RU/p2p/sell/USDT/RUB";
  }
  // --- Оркестратор ---
  static async runSequentialActionsToCreateOrder(ctx: AutoClickElements, messageId: any): Promise<void> {
    try {
      await editTelegramMessage(messageId, "\n\n⏳ Создаю ордер...");

      await this.clickEveryButtonExceptOne(ctx)

      // 7. Завершение (если есть clickLastButton)
      await this.clickLastButton(ctx, messageId);

    } catch (error) {
      console.error("AutoClick: Ошибка в последовательности:", error);

      const errorMessage = error instanceof Error ? error.message : "😭 Неизвестная ошибка";
      await editTelegramMessage(messageId, errorMessage);

      // Попытка закрыть диалог при ошибке
      // try-catch внутри, чтобы не перетереть основную ошибку
      try {
        const dialog = document.querySelector('div[role="dialog"]') as HTMLElement;
        if (dialog) AutoClickElements.findAndClickCancel(ctx);
      } catch (_) { }
    }
  }
}
