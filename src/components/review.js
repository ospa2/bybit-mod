export function createReviewHTML(review, className) {
    function convertBybitTime(bybitTimestamp) {
        const date = new Date(bybitTimestamp);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    }
    // Предполагается, что у вас есть функция analyzeReview
    const analysis = analyzeReview(review.appraiseContent);
    const highlightClass = analysis.shouldHighlight ? 'highlighted-review' : '';
    const formattedDate = convertBybitTime(Number(review.updateDate)); // Конвертируем дату

    // Возвращаем HTML с датой и текстом отзыва
    return `
        <li class="${className} ${highlightClass}">           
            <p class="review-text">${formattedDate}: ${review.appraiseContent}</p>
        </li>
    `;
}