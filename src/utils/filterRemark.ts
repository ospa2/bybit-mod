import { stopPhrases } from '../config.ts';

export function filterRemark(description: string) {
  let filteredText = description;
  stopPhrases.forEach(phrase => {
    // Берём слово и убираем всё лишнее
    if (!phrase) return '';
    const escaped = phrase.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    // Регулярка: слово + любые буквенные окончания
    const regex = new RegExp(escaped + '[а-яА-ЯёЁ]*', 'gi');
    filteredText = filteredText.replace(regex, '');
  });

  filteredText = filteredText
    .replace(/[✅📌❌🔒🎯—]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+\./g, '.')
    .replace(/\s+,/g, ',')
    .replace(/\.{2,}/g, '.')
    .trim();
  return filteredText;
}
