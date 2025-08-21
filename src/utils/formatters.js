export function filterRemark(description) {
    let filteredText = description;

    // 1. Оборачиваем каждую стоп-фразу в HTML-тег <strong>
    stopPhrases.forEach(phrase => {
        // Создаем регулярное выражение для поиска фразы без учета регистра и по всему тексту
        const regex = new RegExp(phrase.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
        // Заменяем найденную фразу на ту же фразу, обернутую в <strong>
        filteredText = filteredText.replace(regex, '');
    });

    // 2. Убираем лишние символы и эмодзи
    filteredText = filteredText.replace(/[✅📌❌🔒🎯—]/g, '');

    // 3. Очищаем текст от лишних пробелов, точек и переносов строк
    filteredText = filteredText
        .replace(/\s+/g, ' ')
        .replace(/\s+\./g, '.')
        .replace(/\s+,/g, ',')
        .replace(/\.{2,}/g, '.')
        .trim();

    return filteredText;
}