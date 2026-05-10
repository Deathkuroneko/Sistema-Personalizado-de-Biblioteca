/**
 * search.js — Búsqueda y filtrado en tiempo real
 * DevSnippets | Gestor de Conocimiento Técnico
 *
 * Preparado para futura indexación (mini-índice en memoria).
 */

const Search = (() => {
    let _query = '';

    function getQuery() { return _query; }

    function filter() {
        _query = (document.getElementById('search-input').value || '').toLowerCase().trim();
        const titles = document.querySelectorAll('.title-card[data-id]');

        if (!_query) {
            // Sin búsqueda: mostrar todo, sin forzar apertura
            titles.forEach(tNode => {
                tNode.classList.remove('hidden');
                tNode.querySelectorAll('.cat-card, .sub-card, .snippet-card').forEach(n => n.classList.remove('hidden'));
            });
            return;
        }

        titles.forEach(tNode => {
            let titleVisible = false;

            // Coincidencia en el nombre del título
            const titleText = tNode.querySelector('.title-name')?.innerText.toLowerCase() || '';
            const titleMatch = titleText.includes(_query);

            const cats = tNode.querySelectorAll('.cat-card[data-id]');
            cats.forEach(cNode => {
                let catVisible = false;
                const catText  = cNode.querySelector('.summary-text')?.innerText.toLowerCase() || '';
                const catMatch = catText.includes(_query);

                const subs = cNode.querySelectorAll('.sub-card[data-id]');
                subs.forEach(sNode => {
                    let subVisible = false;
                    const subText  = sNode.querySelector('.sub-name')?.innerText.toLowerCase() || '';
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
