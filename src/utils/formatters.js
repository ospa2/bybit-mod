import { stopPhrases } from '../config.js';

export function filterRemark(description) {
  let filteredText = description;

  stopPhrases.forEach(phrase => {
    // Берём слово и убираем всё лишнее
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
