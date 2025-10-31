export function disableBodyScroll(): void {
  // Сохраняем текущую позицию скролла
  const scrollY: number =
    window.pageYOffset || document.documentElement.scrollTop || 0;

  // Сохраняем позицию для восстановления
  document.body.setAttribute("data-scroll-y", scrollY.toString());

  // Блокируем скролл
  document.body.style.position = "fixed";
  document.body.style.top = `-${scrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.overflow = "hidden";

  // Добавляем класс для дополнительной стилизации
  document.body.classList.add("modal-open");
}

export function enableBodyScroll(): void {
  // Получаем сохраненную позицию
  const scrollY: string | null = document.body.getAttribute("data-scroll-y");

  // Убираем класс
  document.body.classList.remove("modal-open");

  // Восстанавливаем стили
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.overflow = "";

  // Восстанавливаем позицию скролла
  if (scrollY !== null) {
    window.scrollTo(0, parseInt(scrollY, 10));
    document.body.removeAttribute("data-scroll-y");
  }
}

export function getRowIndex(btn: HTMLElement): number {
  const row = btn.closest("tr");
  if (!row) return -1;

  // Ищем все строки, которые являются валидными строками объявлений
  const rows = [...document.querySelectorAll(".trade-table__tbody tr")].filter(
    (r) => r.querySelector(".trade-list-action-button button")
  );

  return rows.indexOf(row);
}