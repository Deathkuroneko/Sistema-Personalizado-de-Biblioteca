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
        container.innerHTML = '';

        // Estadísticas acumuladas
        const stats = {
            titles:      titles.length,
            // técnico
            cats: 0, subs: 0, snips: 0,
            // media
            collections: 0, cards: 0,
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
                stats.collections += typeStats.collections;
                stats.cards       += typeStats.cards;
            } else {
                // default: technical
                ({ el, stats: typeStats } = RenderTechnical.renderTitle(titleObj, tIdx, openSet, _makeDetails));
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

        // Highlight.js: defer to idle/next frame to avoid doing heavy JS during paint
        if (typeof hljs !== 'undefined') {
            const highlightAll = () => document.querySelectorAll('pre code').forEach(b => {
                try {
                    const langClass = Array.from(b.classList).find(c => c.startsWith('language-'));
                    if (!langClass || langClass === 'language-undefined') {
                        b.classList.remove('language-undefined');
                        b.classList.add('language-plaintext');
                    }
                    if (!b.dataset.highlighted) {
                        hljs.highlightElement(b);
                    }
                } catch (err) { console.error('hljs highlightElement error', err); }
            });
            if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
                try { requestIdleCallback(highlightAll, { timeout: 300 }); }
                catch (e) { requestAnimationFrame(highlightAll); }
            } else {
                requestAnimationFrame(highlightAll);
            }
        }

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
            stats = { titles: titles.length, cats: 0, subs: 0, snips: 0, collections: 0, cards: 0 };
            titles.forEach(t => {
                if (t.type === 'media') {
                    stats.collections += (t.collections || []).length;
                    (t.collections || []).forEach(c => { stats.cards += (c.cards || []).length; });
                } else {
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

        const techTitles = document.querySelectorAll('.title-card[data-type="technical"]').length;
        const mediaTitles = document.querySelectorAll('.title-card[data-type="media"]').length;
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

    return { render, saveOpenStates };
})();
