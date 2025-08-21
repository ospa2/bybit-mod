export function startPriceTimer() {
    const timerElement = document.querySelector('#price-timer');
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
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.removedNodes.forEach((node) => {
                if (node.querySelector && node.querySelector('#price-timer')) {
                    clearInterval(interval);
                    observer.disconnect();
                }
            });
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
}