/**
 * render.js — Orquestador de renderizado
 * DevSnippets | Sistema Multi-Estructura
 *
 * Responsabilidades:
 *  - Leer Storage.getTitles() y enrutar cada título a su renderer
 *  - Preservar el estado open/closed de los <details>
 *  - Actualizar la barra de estadísticas (unificada por tipo)
 *  - Delegar a RenderTechnical o RenderMedia según title.type
 *
 * NO contiene lógica de dominio: esa vive en render-technical.js
 * y render-media.js.
 */

const Render = (() => {
    const OPEN_KEY = 'devSnippets_openStates';

    // ── Lazy highlight con IntersectionObserver (P-02) ────────
    let _hljsObserver = null;

    function _getHljsObserver() {
        if (_hljsObserver) return _hljsObserver;
        if (typeof hljs === 'undefined' || typeof IntersectionObserver === 'undefined') return null;
        _hljsObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const block = entry.target;
                _hljsObserver.unobserve(block);
                if (block.dataset.highlighted) return;
                const langClass = Array.from(block.classList).find(c => c.startsWith('language-'));
                if (!langClass || langClass === 'language-undefined') {
                    block.classList.remove('language-undefined');
                    block.classList.add('language-plaintext');
                }
                try { hljs.highlightElement(block); } catch (err) { console.error('[hljs] error', err); }
            });
        }, { rootMargin: '200px 0px' });
        return _hljsObserver;
    }

    function _observeCodeBlocks(container) {
        const observer = _getHljsObserver();
        if (!observer) return;
        (container || document).querySelectorAll('pre code').forEach(block => {
            if (!block.dataset.highlighted) observer.observe(block);
        });
    }

    // ── Estado de acordeones ──────────────────────────────────
    function saveOpenStates() {
        const ids = [...document.querySelectorAll('details[open][id]')].map(d => d.id);
        localStorage.setItem(OPEN_KEY, JSON.stringify(ids));
    }

    function _getOpenSet() {
        try { return new Set(JSON.parse(localStorage.getItem(OPEN_KEY)) || []); }
        catch { return new Set(); }
    }

    function _makeDetails(id, openSet, className) {
        const el = document.createElement('details');
        el.id        = id;
        el.className = className;
        if (openSet.has(id)) el.open = true;
        el.addEventListener('toggle', saveOpenStates, { passive: true });
        // ── Guardia de toggle (Paso 1 — Auditoría details/summary) ──────────
        // En fase de captura, antes de que el browser active el toggle nativo,
        // cancelamos el evento si el click proviene de un elemento interactivo
        // (button, input, select, a, contenteditable) que está dentro del <summary>.
        // Esto elimina: toggles inesperados, blur prematuros y clicks cancelados.
        el.addEventListener('click', function(e) {
            const summary = el.querySelector(':scope > summary');
            if (!summary || !summary.contains(e.target)) return;
            if (e.target.closest('button, input, select, a, [contenteditable="true"]')) {
                e.preventDefault();
            }
        }, true); // capturing = true → se ejecuta antes del toggle nativo
        return el;
    }

    // ── Render principal ──────────────────────────────────────
    function render() {
        const titles    = Storage.getTitles();
        const openSet   = _getOpenSet();
        const container = document.getElementById('app-container');
        // Desconectar observer antes de destruir nodos (P-02)
        if (_hljsObserver) _hljsObserver.disconnect();
        container.innerHTML = '';

        // Estadísticas acumuladas
        const stats = {
            titles:      titles.length,
            // técnico (P-06)
            techTitles: 0, cats: 0, subs: 0, snips: 0,
            // media (P-06)
            mediaTitles: 0, collections: 0, cards: 0,
        };

        if (titles.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg data-lucide="library" width="48" height="48"></svg>
                    <h3>Biblioteca vacía</h3>
                    <p>Crea tu primer título para empezar. Puedes elegir entre tipo <strong>Técnico</strong> o <strong>Biblioteca / Media</strong>.</p>
                </div>`;
            if (typeof lucide !== 'undefined') lucide.createIcons({ node: container });
        }

        titles.forEach((titleObj, tIdx) => {
            let el, typeStats;

            if (titleObj.type === 'media') {
                ({ el, stats: typeStats } = RenderMedia.renderTitle(titleObj, tIdx, openSet, _makeDetails));
                stats.mediaTitles++; // P-06
                stats.collections += typeStats.collections;
                stats.cards       += typeStats.cards;
            } else {
                // default: technical
                ({ el, stats: typeStats } = RenderTechnical.renderTitle(titleObj, tIdx, openSet, _makeDetails));
                stats.techTitles++; // P-06
                stats.cats  += typeStats.cats;
                stats.subs  += typeStats.subs;
                stats.snips += typeStats.snips;
            }

            container.appendChild(el);
        });

        // SortableJS: reordenar títulos (nivel raíz)
        _initRootSortable(container);

        // Íconos Lucide
        if (typeof lucide !== 'undefined') lucide.createIcons({ node: container });

        // Highlight.js: lazy highlight via IntersectionObserver (P-02)
        _observeCodeBlocks(container);

        _updateStats(stats);
        Sidebar.render();
        if (typeof lucide !== 'undefined') {
            lucide.createIcons({ node: document.getElementById('sidebar') });
        }
        Search.filter();
    }

    function _initRootSortable(container) {
        if (typeof Sortable === 'undefined') return;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (!document.contains(container)) return;
                Sortable.create(container, {
                    group: { name: 'root-titles', pull: false, put: false },
                    animation: 150,
                    ghostClass: 'sortable-ghost',
                    chosenClass: 'sortable-chosen',
                    forceFallback: true,
                    fallbackTolerance: 4,
                    fallbackOnBody: true,
                    swapThreshold: 0.65,
                    delay: 80,
                    handle: '.drag-handle',
                    onStart: evt => {
                        // Colapsar al arrastrar para evitar conflictos con sortables hijos
                        if (evt.item.tagName === 'DETAILS') {
                            evt.item.dataset.wasOpen = evt.item.open;
                            evt.item.open = false;
                        }
                    },
                    onEnd: evt => {
                        if (evt.item.dataset.wasOpen === 'true') {
                            evt.item.open = true;
                        }
                        // Solo guardar si cambió de posición
                        if (evt.oldIndex !== evt.newIndex) {
                            Storage.saveStateForUndo();
                            const db = Storage.getTitles();
                            const [moved] = db.splice(evt.oldIndex, 1);
                            db.splice(evt.newIndex, 0, moved);
                            Storage.save(false);
                            // Se requiere re-render completo para actualizar los data-id y grupos de sortables anidados
                            Render.render();
                        }
                    }
                });
            });
        });
    }

    // ── Actualizar estadísticas ───────────────────────────────
    function _updateStats(stats) {
        if (!stats) {
            // Recalcular desde cero
            const titles = Storage.getTitles();
            stats = { titles: titles.length, techTitles: 0, mediaTitles: 0, cats: 0, subs: 0, snips: 0, collections: 0, cards: 0 };
            titles.forEach(t => {
                if (t.type === 'media') {
                    stats.mediaTitles++;
                    stats.collections += (t.collections || []).length;
                    (t.collections || []).forEach(c => { stats.cards += (c.cards || []).length; });
                } else {
                    stats.techTitles++;
                    stats.cats += (t.categories || []).length;
                    (t.categories || []).forEach(c => {
                        stats.subs += (c.subtitles || []).length;
                        (c.subtitles || []).forEach(s => { stats.snips += (s.snippets || []).length; });
                    });
                }
            });
        }

        const bar = document.getElementById('stats-bar');
        if (!bar) return;

        // P-06: leer contadores del stats acumulado, sin tocar el DOM
        const techTitles  = stats.techTitles  || 0;
        const mediaTitles = stats.mediaTitles || 0;
        const metric = (value, label) => `<span class="metric-pill"><b>${value}</b><span>${label}</span></span>`;
        const group = (type, label, metrics) => `
            <span class="metric-group metric-group--${type}">
                <span class="metric-group-label">${label}</span>
                ${metrics.join('')}
            </span>`;

        const parts = [];
        if (techTitles > 0 || stats.cats > 0 || stats.snips > 0) {
            parts.push(group('tech', 'TECH', [
                metric(techTitles, 'Técnicos'),
                metric(stats.cats, 'Categorías'),
                metric(stats.subs, 'Subtítulos'),
                metric(stats.snips, 'Snippets'),
            ]));
        }
        if (mediaTitles > 0 || stats.collections > 0 || stats.cards > 0) {
            parts.push(group('media', 'MEDIA', [
                metric(mediaTitles, 'Media'),
                metric(stats.collections, 'Colecciones'),
                metric(stats.cards, 'Fichas'),
            ]));
        }
        bar.innerHTML = parts.length ? parts.join('<span class="metric-separator" aria-hidden="true"></span>') : metric(stats.titles, 'Títulos');
    }

    return { render, saveOpenStates, observeCodeBlocks: _observeCodeBlocks };
})();
