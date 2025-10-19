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

    // 1. Ищем кнопки с текстом "Подтвердить с помощью ключа доступа"
    const buttons: HTMLButtonElement[] = element.querySelectorAll?.("button")
      ? Array.from(element.querySelectorAll("button"))
      : element.tagName === "BUTTON"
      ? [element as HTMLButtonElement]
      : [];


    buttons.forEach((button) => {//клик на подтвердить с помощью ключа доступа(ордер на продажу)
      const buttonText = button.textContent?.trim();
      if (
        buttonText &&
        buttonText.includes("Подтвердить с помощью ключа доступа")
      ) {
        console.log("AutoClick: Найдена кнопка подтверждения, выполняю клик");
        this.clickElement(button, "button");
      }
    });

    // 2. Ищем span с текстом "Все"
    const spans: HTMLSpanElement[] = element.querySelectorAll?.("span")
      ? Array.from(element.querySelectorAll("span"))
      : element.tagName === "SPAN"
      ? [element as HTMLSpanElement]
      : [];

    spans.forEach((span) => {//найти кнопку выбрать способ оплаты
      const spanText = span.textContent?.trim();
      if (spanText === "Все" && span.classList.contains("amount-input-all")) {
        console.log('AutoClick: Найден span "Все", выполняю клик');
        this.clickElement(span, "span");
      }
    });

    // 3. Ищем селект "Выбрать способ оплаты"
    const divs: HTMLDivElement[] = element.querySelectorAll?.("div")
      ? Array.from(element.querySelectorAll("div"))
      : element.tagName === "DIV"
      ? [element as HTMLDivElement]
      : [];

    divs.forEach((div) => {//клик на селект "Выбрать способ оплаты"
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

  private findAndClickSBP(): void {
    const sbpDivs = document.querySelectorAll<HTMLDivElement>(
      "div.payment-select__list-wrapper"
    );

    sbpDivs.forEach((div) => {
      const sbpSpan = div.querySelector("span");
      const text = sbpSpan?.textContent?.trim();
      if (
        text &&
        [
          "Наличные",
          "Bank Transfer",
          "Mobile Top-up",
          "Cash Deposit to Bank",
        ].includes(text)
      ) {
        console.log("AutoClick: Найден SBP, выполняю клик");
        this.clickElement(div, "SBP div");
      }
    });

    if (sbpDivs.length === 0) {
      console.log("AutoClick: SBP еще не загрузился, повторная попытка...");
      setTimeout(() => this.findAndClickSBP(), 500);
    }
  }

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

      if (type === "span") {
        let i = 0;
        const interval = setInterval(() => {
          if (i > 10) {
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
}
