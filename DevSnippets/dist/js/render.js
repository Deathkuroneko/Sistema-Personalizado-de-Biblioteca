/**
 * render.js — Renderizado del DOM
 * DevSnippets | Gestor de Conocimiento Técnico
 *
 * Responsabilidades:
 *  - Leer Storage.getDB() y construir el árbol de elementos
 *  - Preservar el estado open/closed de los <details>
 *  - Inicializar SortableJS en los contenedores correspondientes
 *  - Inicializar Highlight.js en los bloques de código
 *  - Actualizar la barra de estadísticas
 *
 * DRAG & DROP — Solución para Tauri/WebView2:
 *  - Se usa un MutationObserver para detectar cuándo el nodo ya está
 *    insertado en el DOM, y sólo entonces se instancia Sortable.
 *  - Se configura `delay: 0` y `touchStartThreshold: 0` para máxima
 *    responsividad con el motor de puntero de WebView2.
 *  - La opción `handle: '.drag-handle'` acota el área de drag al ícono
 *    de grip, evitando el conflicto con el toggle nativo de <details>.
 *  - Los drag-handles usan `pointerdown.preventDefault()` para bloquear
 *    el toggle de <details> al iniciar un arrastre.
 */

const Render = (() => {
    const OPEN_KEY = 'devSnippets_openStates';

    // ── Helpers ──────────────────────────────────────────────
    function _escape(t = '') {
        return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function _icon(name, size = 14) {
        return `<svg data-lucide="${name}" width="${size}" height="${size}"></svg>`;
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
        el.id = id;
        el.className = className;
        if (openSet.has(id)) el.open = true;
        el.addEventListener('toggle', saveOpenStates, { passive: true });
        return el;
    }

    // ── Dropdown de acciones "⋮" ──────────────────────────────
    function _menuBtn(menuId, items) {
        const html = items.map(it => it === '---'
            ? `<div class="dropdown-divider"></div>`
            : `<button class="dropdown-item${it.cls ? ' ' + it.cls : ''}" onclick="${it.fn}">
                    ${_icon(it.icon, 14)} ${it.label}
               </button>`
        ).join('');

        return `
            <div class="dropdown">
                <button class="btn-icon" title="Opciones" onclick="App.toggleDropdown(event,'${menuId}')">
                    ${_icon('more-vertical', 16)}
                </button>
                <div id="${menuId}" class="dropdown-menu">${html}</div>
            </div>`;
    }

    // ── SortableJS: inicialización robusta para Tauri/WebView2 ─
    //
    // Problema: en WebView2, setTimeout(fn, 0) no garantiza que el nodo
    // ya esté en el DOM pintado. Usamos requestAnimationFrame anidado para
    // asegurar que el layout se haya completado antes de inicializar Sortable.
    //
    // Adicionalmente, la opción `forceFallback: true` habilita el drag
    // mediante eventos de puntero (pointer events) en lugar del HTML5
    // Drag & Drop API, que WebView2 maneja de forma inconsistente con
    // elementos <details>/<summary>.
    function _initSortable(container, options) {
        if (typeof Sortable === 'undefined') return null;
        // Doble rAF: primer frame = DOM insertado, segundo frame = layout calculado
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (!document.contains(container)) return; // nodo descartado tras re-render
                Sortable.create(container, {
                    animation: 150,
                    ghostClass: 'sortable-ghost',
                    chosenClass: 'sortable-chosen',
                    forceFallback: true,          // usa pointer events, evita conflicto <details>
                    fallbackTolerance: 4,          // px de tolerancia antes de iniciar drag
                    delay: 80,                     // ms de retención antes de activar drag
                    delayOnTouchOnly: false,
                    ...options,
                });
            });
        });
    }

    // ── Render principal ──────────────────────────────────────
    function render() {
        const db = Storage.getDB();
        const openSet = _getOpenSet();
        const container = document.getElementById('app-container');
        container.innerHTML = '';

        const stats = { titles: db.length, cats: 0, subs: 0, snips: 0 };

        if (db.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    ${_icon('library', 48)}
                    <h3>Biblioteca vacía</h3>
                    <p>Crea tu primer título para empezar a organizar snippets.</p>
                </div>`;
        }

        db.forEach((titleObj, tIdx) => {
            let titleSnipCount = 0;
            titleObj.categories.forEach(c => c.subtitles.forEach(s => titleSnipCount += s.snippets.length));

            const tEl = _makeDetails(`t_${titleObj.id}`, openSet, 'title-card');
            tEl.setAttribute('data-id', titleObj.id);

            tEl.innerHTML = `
                <summary class="title-summary">
                    <div class="summary-row">
                        <div class="summary-left">
                            <span class="arrow-icon">${_icon('chevron-right', 14)}</span>
                            <button class="drag-handle btn-icon" title="Arrastrar para reordenar" onclick="event.preventDefault();event.stopPropagation()">
                                ${_icon('grip-vertical', 14)}
                            </button>
                            ${_icon('folder', 16)}
                            <span class="summary-text title-name">${_escape(titleObj.title)}</span>
                            <span class="badge">${titleSnipCount}</span>
                        </div>
                        ${_menuBtn(`tm_${titleObj.id}`, [
                { icon: 'folder-plus', label: 'Añadir Categoría', fn: `Editor.addCategory(event,${tIdx})` },
                '---',
                { icon: 'pencil', label: 'Editar Título', fn: `Editor.editTitle(event,${tIdx})` },
                { icon: 'trash-2', label: 'Eliminar', fn: `Editor.deleteItem(event,'title',${tIdx})`, cls: 'danger' },
            ])}
                    </div>
                </summary>
                <div class="title-body" id="tb_${titleObj.id}"></div>
            `;

            const tBody = tEl.querySelector('.title-body');

            titleObj.categories.forEach((catObj, cIdx) => {
                stats.cats++;
                let catSnipCount = 0;
                catObj.subtitles.forEach(s => catSnipCount += s.snippets.length);

                const cEl = _makeDetails(`c_${catObj.id}`, openSet, `cat-card cat-${catObj.color || 'gray'}`);
                cEl.setAttribute('data-id', catObj.id);
                cEl.setAttribute('data-search', `${catObj.title} ${catObj.color}`.toLowerCase());

                cEl.innerHTML = `
                    <summary class="cat-summary">
                        <div class="summary-row">
                            <div class="summary-left">
                                <span class="arrow-icon">${_icon('chevron-right', 13)}</span>
                                <button class="drag-handle btn-icon" title="Arrastrar" onclick="event.preventDefault();event.stopPropagation()">
                                    ${_icon('grip-vertical', 13)}
                                </button>
                                ${_icon('tag', 13)}
                                <span class="summary-text">${_escape(catObj.title)}</span>
                                <span class="badge">${catSnipCount}</span>
                            </div>
                            ${_menuBtn(`cm_${catObj.id}`, [
                    { icon: 'plus', label: 'Añadir Subtítulo', fn: `Editor.addSubtitle(event,${tIdx},${cIdx})` },
                    '---',
                    { icon: 'pencil', label: 'Editar Categoría', fn: `Editor.editCategory(event,${tIdx},${cIdx})` },
                    { icon: 'trash-2', label: 'Eliminar', fn: `Editor.deleteItem(event,'cat',${tIdx},${cIdx})`, cls: 'danger' },
                ])}
                        </div>
                    </summary>
                    <div class="cat-body" id="cb_${catObj.id}"></div>
                `;

                const cBody = cEl.querySelector('.cat-body');

                catObj.subtitles.forEach((subObj, sIdx) => {
                    stats.subs++;

                    const sEl = _makeDetails(`s_${subObj.id}`, openSet, 'sub-card');
                    sEl.setAttribute('data-id', subObj.id);

                    // ── Asociaciones colapsables ──────────────────────
                    let assocHTML = '';
                    if (!subObj.isMain && subObj.parentIds && subObj.parentIds.length > 0) {
                        const links = subObj.parentIds.map(id => {
                            const pInfo = Storage.findSubtitleAndCategory(id);
                            return pInfo
                                ? `<li><button class="assoc-link" onclick="event.preventDefault(); event.stopPropagation(); App.navigateToSubtitle('${id}')">• ${_escape(pInfo.cat.title)} / ${_escape(pInfo.sub.title)} ↗</button></li>`
                                : '';
                        }).filter(Boolean).join('');

                        if (links) {
                            const count = subObj.parentIds.length;
                            assocHTML = `
                                <div class="sub-assoc">
                                    <button class="assoc-toggle" onclick="event.preventDefault(); event.stopPropagation(); this.closest('.assoc-collapsible').classList.toggle('open')">
                                        ${_icon('link', 11)}
                                        <span>Asociaciones (${count})</span>
                                        <span class="assoc-chevron">${_icon('chevron-down', 11)}</span>
                                    </button>
                                    <ul class="assoc-list">${links}</ul>
                                </div>`;
                        }
                    }

                    const iconHTML = subObj.isMain
                        ? `<span class="icon-main" title="Principal">${_icon('layers', 13)}</span>`
                        : `<span class="icon-sec" title="Secundario">${_icon('layers', 13)}</span>`;

                    sEl.innerHTML = `
                        <summary class="sub-summary">
                            <div class="summary-row">
                                <div class="summary-left">
                                    <span class="arrow-icon">${_icon('chevron-right', 13)}</span>
                                    <button class="drag-handle btn-icon" title="Arrastrar" onclick="event.preventDefault();event.stopPropagation()">
                                        ${_icon('grip-vertical', 13)}
                                    </button>
                                    ${iconHTML}
                                    <div class="sub-title-col">
                                        <div style="display:flex;align-items:center;">
                                            <span class="summary-text sub-name">${_escape(subObj.title)}</span>
                                            <span class="badge">${subObj.snippets.length}</span>
                                        </div>
                                        ${assocHTML ? `<div class="assoc-collapsible">${assocHTML}</div>` : ''}
                                    </div>
                                </div>
                                ${_menuBtn(`sm_${subObj.id}`, [
                        { icon: 'plus', label: 'Añadir Snippet', fn: `Editor.addSnippet(event,${tIdx},${cIdx},${sIdx})` },
                        '---',
                        { icon: 'pencil', label: 'Editar Subtítulo', fn: `Editor.editSubtitle(event,${tIdx},${cIdx},${sIdx})` },
                        { icon: 'trash-2', label: 'Eliminar', fn: `Editor.deleteItem(event,'sub',${tIdx},${cIdx},${sIdx})`, cls: 'danger' },
                    ])}
                            </div>
                        </summary>
                        <div class="sub-body" id="sb_${subObj.id}"></div>
                    `;

                    const sBody = sEl.querySelector('.sub-body');

                    subObj.snippets.forEach((snipObj, snIdx) => {
                        stats.snips++;
                        const card = _buildSnippetCard(snipObj, tIdx, cIdx, sIdx, snIdx);
                        sBody.appendChild(card);
                    });

                    // SortableJS para snippets — permite mover ENTRE subtítulos
                    _initSortable(sBody, {
                        group: 'snippets',
                        handle: '.drag-handle',
                        onEnd: evt => {
                            const fromSubEl = evt.from.closest('.sub-card');
                            const toSubEl = evt.to.closest('.sub-card');
                            if (!fromSubEl || !toSubEl) return;

                            const fromSubId = fromSubEl.dataset.id;
                            const toSubId = toSubEl.dataset.id;

                            Storage.saveStateForUndo();
                            const db = Storage.getDB();

                            let fromSub, toSub;
                            db.forEach(t => t.categories.forEach(c => c.subtitles.forEach(s => {
                                if (s.id === fromSubId) fromSub = s.snippets;
                                if (s.id === toSubId) toSub = s.snippets;
                            })));

                            if (fromSub && toSub) {
                                const [moved] = fromSub.splice(evt.oldIndex, 1);
                                toSub.splice(evt.newIndex, 0, moved);
                                Storage.save(false);
                                Sidebar.render();
                                _updateStats();
                            }
                        }
                    });

                    cBody.appendChild(sEl);
                });

                // SortableJS para reordenar subtítulos dentro de la categoría
                _initSortable(cBody, {
                    group: `subs-in-${tIdx}-${cIdx}`,
                    handle: '.drag-handle',
                    onEnd: evt => {
                        Storage.saveStateForUndo();
                        const arr = Storage.getDB()[tIdx].categories[cIdx].subtitles;
                        const [moved] = arr.splice(evt.oldIndex, 1);
                        arr.splice(evt.newIndex, 0, moved);
                        Storage.save(false);
                    }
                });

                tBody.appendChild(cEl);
            });

            // SortableJS para reordenar categorías dentro del título
            _initSortable(tBody, {
                group: `cats-in-${tIdx}`,
                handle: '.drag-handle',
                onEnd: evt => {
                    Storage.saveStateForUndo();
                    const arr = Storage.getDB()[tIdx].categories;
                    const [moved] = arr.splice(evt.oldIndex, 1);
                    arr.splice(evt.newIndex, 0, moved);
                    Storage.save(false);
                }
            });

            container.appendChild(tEl);
        });

        // SortableJS para reordenar títulos (nivel raíz)
        _initSortable(container, {
            group: 'titles',
            handle: '.drag-handle',
            onEnd: evt => {
                Storage.saveStateForUndo();
                const db = Storage.getDB();
                const [moved] = db.splice(evt.oldIndex, 1);
                db.splice(evt.newIndex, 0, moved);
                Storage.save(false);
            }
        });

        // Re-crear íconos Lucide en el DOM recién construido
        if (typeof lucide !== 'undefined') lucide.createIcons({ node: container });

        // Highlight.js en todos los bloques de código
        if (typeof hljs !== 'undefined') {
            document.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
        }

        _updateStats(stats);
        Sidebar.render();
        if (typeof lucide !== 'undefined') {
            lucide.createIcons({ node: document.getElementById('sidebar') });
        }
        Search.filter();
    }

    // ── Construir tarjeta de snippet ──────────────────────────
    function _buildSnippetCard(snipObj, tIdx, cIdx, sIdx, snIdx) {
        const card = document.createElement('div');
        card.className = 'snippet-card';
        card.dataset.id = snipObj.id;
        card.dataset.search = `${snipObj.title} ${snipObj.description} ${snipObj.code}`.toLowerCase();

        const escapedCode = _escape(snipObj.code);
        const lineNums = snipObj.code.split('\n').map((_, i) => i + 1).join('\n');
        const favCls = snipObj.fav ? 'active' : '';

        card.innerHTML = `
            <div class="snippet-view">
                <div class="snippet-header">
                    <div class="snippet-meta">
                        <h4 class="snippet-title">
                            <button class="btn-icon fav-btn ${favCls}" title="Favorito"
                                onclick="Editor.toggleFav(${tIdx},${cIdx},${sIdx},${snIdx})">
                                ${_icon('star', 15)}
                            </button>
                            ${_escape(snipObj.title)}
                        </h4>
                        ${snipObj.description ? `<p class="snippet-desc">${_escape(snipObj.description)}</p>` : ''}
                    </div>
                    <div style="display:flex;align-items:center;gap:4px;">
                        <button class="drag-handle btn-icon" title="Arrastrar para reordenar">
                            ${_icon('grip-vertical', 15)}
                        </button>
                        ${_menuBtn(`snm_${snipObj.id}`, [
            { icon: 'pencil', label: 'Editar Snippet', fn: `Editor.editSnippet(event,${tIdx},${cIdx},${sIdx},${snIdx})` },
            '---',
            { icon: 'trash-2', label: 'Eliminar', fn: `Editor.deleteItem(event,'snip',${tIdx},${cIdx},${sIdx},${snIdx})`, cls: 'danger' },
        ])}
                    </div>
                </div>
                <div class="code-block-wrapper">
                    <button class="copy-btn" onclick="App.copyCode(this, \`${escapedCode.replace(/\\/g, '\\\\').replace(/`/g, '\\`')}\`)">Copiar</button>
                    <div class="line-nums">${lineNums}</div>
                    <pre><code>${escapedCode}</code></pre>
                </div>
            </div>
            <div class="snippet-edit-zone hidden"></div>
        `;

        return card;
    }

    // ── Actualizar estadísticas ───────────────────────────────
    function _updateStats(stats) {
        if (!stats) {
            const db = Storage.getDB();
            stats = { titles: db.length, cats: 0, subs: 0, snips: 0 };
            db.forEach(t => { stats.cats += t.categories.length; t.categories.forEach(c => { stats.subs += c.subtitles.length; c.subtitles.forEach(s => stats.snips += s.snippets.length); }); });
        }
        const bar = document.getElementById('stats-bar');
        if (bar) bar.innerHTML = `
            <span><b>${stats.titles}</b> Títulos</span>
            <span><b>${stats.cats}</b> Categorías</span>
            <span><b>${stats.subs}</b> Subtítulos</span>
            <span><b>${stats.snips}</b> Snippets</span>
        `;
    }

    return { render, saveOpenStates };
})();
