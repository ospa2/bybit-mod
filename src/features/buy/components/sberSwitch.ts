export function addOnlySberSwitch(): boolean {
   // Находим целевой div
   const targetDiv = document.getElementById('guide-step-two');

   if (!targetDiv) {
      console.error('Элемент guide-step-two не найден');
      return false;
   }

   // Проверяем, не добавлен ли уже свич
   if (document.getElementById('onlySberSwitchContainer')) {
      console.log('Свич уже добавлен');
      return true;
   }
   // Создаем контейнер для свича
   const switchContainer = document.createElement('div');
   switchContainer.id = 'onlySberSwitchContainer';
   switchContainer.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #f5f5f5;
    border-radius: 4px;
    margin-left: 8px;
    height: 40px;
  `;

   // Создаем текст label
   const labelText = document.createElement('span');
   labelText.textContent = 'Только Сбер';
   labelText.style.cssText = `
    font-size: 12px;
    font-weight: 500;
    color: #121214;
    white-space: nowrap;
  `;

   // Создаем wrapper для свича
   const switchWrapper = document.createElement('label');
   switchWrapper.style.cssText = `
    position: relative;
    display: inline-block;
    width: 40px;
    height: 20px;
    cursor: pointer;
  `;

   // Создаем чекбокс
   const switchInput = document.createElement('input');
   switchInput.type = 'checkbox';
   switchInput.id = 'onlySberSwitch';
   switchInput.style.cssText = `
    opacity: 0;
    width: 0;
    height: 0;
  `;

   // Создаем слайдер
   const slider = document.createElement('span');
   slider.style.cssText = `
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #ccc;
    transition: .3s;
    border-radius: 20px;
  `;

   const sliderButton = document.createElement('span');
   sliderButton.style.cssText = `
    position: absolute;
    content: "";
    height: 14px;
    width: 14px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: .3s;
    border-radius: 50%;
  `;

   slider.appendChild(sliderButton);

   // Получаем текущее значение из localStorage
   const currentValue = localStorage.getItem('onlySber') === 'true';
   switchInput.checked = currentValue;

   // Устанавливаем начальное состояние
   if (currentValue) {
      slider.style.backgroundColor = '#43B9B2';
      sliderButton.style.transform = 'translateX(20px)';
   }

   // Обработчик изменения состояния
   switchInput.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLInputElement;
      const isChecked = target.checked;
      localStorage.setItem('onlySber', isChecked.toString());

      if (isChecked) {
         slider.style.backgroundColor = '#43B9B2';
         sliderButton.style.transform = 'translateX(20px)';
      } else {
         slider.style.backgroundColor = '#ccc';
         sliderButton.style.transform = 'translateX(0)';
      }

      console.log('onlySber установлен в:', isChecked);
   });

   // Собираем элементы
   switchWrapper.appendChild(switchInput);
   switchWrapper.appendChild(slider);
   switchContainer.appendChild(labelText);
   switchContainer.appendChild(switchWrapper);

   // Вставляем в конец целевого div
   targetDiv.appendChild(switchContainer);

   console.log('Свич успешно добавлен');
   return true;
}