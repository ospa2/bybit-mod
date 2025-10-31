export function startPriceTimer(): void {
    const timerElement = document.querySelector<HTMLElement>('#price-timer');
    if (!timerElement) return;

    let seconds = 29;
    const interval = setInterval(() => {
        timerElement.textContent = `${seconds}s`;
        seconds--;

        if (seconds < 10) {
            timerElement.style.color = '#ff4757';
        }

        if (seconds < 0) {
            seconds = 29;
            timerElement.style.color = '#81858c';
            // Здесь можно добавить обновление цены
        }
    }, 1000);

    // Очищаем интервал при закрытии модального окна
    const observer = new MutationObserver((mutations: MutationRecord[]) => {
        for (const mutation of mutations) {
            mutation.removedNodes.forEach((node) => {
                if (node instanceof HTMLElement && node.querySelector('#price-timer')) {
                    clearInterval(interval);
                    observer.disconnect();
                }
            });
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

 export function convertBybitTime(bybitTimestamp: string) {
      const bbtt = Number(bybitTimestamp);
      const date = new Date(bbtt);
      const d = String(date.getDate()).padStart(2, "0");
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const y = date.getFullYear();

      return `${d}.${m}.${y}`;
   }