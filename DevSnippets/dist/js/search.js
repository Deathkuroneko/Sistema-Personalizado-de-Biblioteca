/**
 * search.js — Búsqueda y filtrado en tiempo real
 * DevSnippets | Sistema Multi-Estructura
 *
 * Búsqueda global que filtra tanto elementos técnicos (categorías/subtítulos/snippets)
 * como elementos media (colecciones/fichas).
 */

const Search = (() => {
    let _query = '';

    function getQuery() { return _query; }

    function filter() {
        _query = (document.getElementById('search-input').value || '').toLowerCase().trim();
        const titles = document.querySelectorAll('.title-card[data-id]');

        if (!_query) {
            // Sin búsqueda: mostrar todo
            titles.forEach(tNode => {
                tNode.classList.remove('hidden');
                tNode.querySelectorAll('.cat-card, .sub-card, .snippet-card, .media-collection-card, .media-card').forEach(n => n.classList.remove('hidden'));
            });
            return;
        }

        titles.forEach(tNode => {
            let titleVisible = false;
            const type = tNode.getAttribute('data-type');
            const titleText = tNode.querySelector('.title-name')?.innerText.toLowerCase() || '';
            const titleMatch = titleText.includes(_query);

            if (type === 'media') {
                const collections = tNode.querySelectorAll('.media-collection-card[data-id]');
                collections.forEach(colNode => {
                    let colVisible = false;
                    const colText  = colNode.querySelector('.summary-text')?.innerText.toLowerCase() || '';
                    const colMatch = colText.includes(_query);

                    const cards = colNode.querySelectorAll('.media-card[data-id]');
                    cards.forEach(cardNode => {
                        const cardData = cardNode.dataset.search || '';
                        const cardMatch = cardData.includes(_query);

                        if (cardMatch || colMatch || titleMatch) {
                            cardNode.classList.remove('hidden'); colVisible = true;
                        } else {
                            cardNode.classList.add('hidden');
                        }
                    });

                    if (colVisible || colMatch || titleMatch) {
                        colNode.classList.remove('hidden'); titleVisible = true;
                        if (_query) colNode.open = true;
                    } else {
                        colNode.classList.add('hidden');
                    }
                });

            } else {
                // Technical
                const cats = tNode.querySelectorAll('.cat-card[data-id]');
                cats.forEach(cNode => {
                    let catVisible = false;
                    // P-04: data-search evita innerText + reflow en cada tecla
                    const catText = cNode.dataset.search || '';
                    const catMatch = catText.includes(_query);

                    const subs = cNode.querySelectorAll('.sub-card[data-id]');
                    subs.forEach(sNode => {
                        let subVisible = false;
                        // P-04: data-search evita innerText + reflow en cada tecla
                        const subText = sNode.dataset.search || '';
                        const subMatch = subText.includes(_query);

                        const snips = sNode.querySelectorAll('.snippet-card[data-id]');
                        snips.forEach(snNode => {
                            const snipData = snNode.dataset.search || '';
                            const snipMatch = snipData.includes(_query);

                            if (snipMatch || subMatch || catMatch || titleMatch) {
                                snNode.classList.remove('hidden'); subVisible = true;
                            } else {
                                snNode.classList.add('hidden');
                            }
                        });

                        if (subVisible || subMatch || catMatch || titleMatch) {
                            sNode.classList.remove('hidden'); catVisible = true;
                            if (_query) sNode.open = true;
                        } else {
                            sNode.classList.add('hidden');
                        }
                    });

                    if (catVisible || catMatch || titleMatch) {
                        cNode.classList.remove('hidden'); titleVisible = true;
                        if (_query) cNode.open = true;
                    } else {
                        cNode.classList.add('hidden');
                    }
                });
            }

            if (titleVisible || titleMatch) {
                tNode.classList.remove('hidden');
                if (_query) tNode.open = true;
            } else {
                tNode.classList.add('hidden');
            }
        });
    }

    function clear() {
        const input = document.getElementById('search-input');
        if (input) input.value = '';
        filter();
    }

    return { filter, clear, getQuery };
})();
