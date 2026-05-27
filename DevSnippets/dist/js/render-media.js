/**
 * render-media.js — Renderer del tipo "Media / Biblioteca"
 * DevSnippets | Sistema Multi-Estructura
 *
 * Renderiza: Título Media → Colecciones → Fichas/Cards
 */

const RenderMedia = (() => {

    function _escape(t = '') {
        return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function _icon(name, size = 14) {
        return `<svg data-lucide="${name}" width="${size}" height="${size}"></svg>`;
    }
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

    function _initSortable(container, options) {
        if (typeof Sortable === 'undefined') return;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (!document.contains(container)) return;
                Sortable.create(container, {
                    animation: 150,
                    ghostClass: 'sortable-ghost',
                    chosenClass: 'sortable-chosen',
                    forceFallback: true,
                    fallbackTolerance: 4,
                    delay: 80,
                    ...options,
                });
            });
        });
    }

    // ── STATUS BADGE ──────────────────────────────────────────
    const STATUS_CLASS = {
        'Completado': 'status--completed',
        'Viendo':     'status--watching',
        'Pendiente':  'status--pending',
        'En pausa':   'status--paused',
        'Abandonado': 'status--dropped',
        'Sin estado': 'status--none',
    };

    function _statusBadge(status) {
        const cls = STATUS_CLASS[status] || 'status--none';
        return `<span class="media-status-badge ${cls}">${_escape(status || 'Sin estado')}</span>`;
    }

    // ── RENDER TÍTULO MEDIA ───────────────────────────────────
    function renderTitle(titleObj, tIdx, openSet, makeDetails) {
        const totalCards = (titleObj.collections || []).reduce((n, c) => n + (c.cards || []).length, 0);

        const tEl = makeDetails(`t_${titleObj.id}`, openSet, 'title-card title-card--media');
        tEl.setAttribute('data-id', titleObj.id);
        tEl.setAttribute('data-type', 'media');

        tEl.innerHTML = `
            <summary class="title-summary">
                <div class="summary-row">
                    <div class="summary-left">
                        <span class="arrow-icon">${_icon('chevron-right', 14)}</span>
                        <button class="drag-handle btn-icon" title="Arrastrar" onclick="event.preventDefault();event.stopPropagation()">
                            ${_icon('grip-vertical', 14)}
                        </button>
                        ${_icon('film', 16)}
                        <span class="summary-text title-name">${_escape(titleObj.title)}</span>
                        <span class="badge">${totalCards}</span>
                        <span class="type-badge type-badge--media">MEDIA</span>
                    </div>
                    ${_menuBtn(`tm_${titleObj.id}`, [
                        { icon: 'folder-plus', label: 'Nueva Colección', fn: `EditorMedia.addCollection(event,${tIdx})` },
                        '---',
                        { icon: 'pencil', label: 'Editar Título', fn: `Editor.editTitle(event,${tIdx})` },
                        { icon: 'trash-2', label: 'Eliminar', fn: `Editor.deleteItem(event,'title',${tIdx})`, cls: 'danger' },
                    ])}
                </div>
            </summary>
            <div class="title-body media-title-body" id="tb_${titleObj.id}"></div>
        `;

        const tBody = tEl.querySelector('.title-body');
        const stats = { collections: 0, cards: 0 };

        (titleObj.collections || []).forEach((colObj, colIdx) => {
            stats.collections++;
            const colEl = _renderCollection(colObj, tIdx, colIdx, openSet, makeDetails, stats);
            tBody.appendChild(colEl);
        });

        // Sortable: colecciones
        _initSortable(tBody, {
            group: `collections-in-${tIdx}`,
            handle: '.drag-handle',
            fallbackOnBody: true,
            swapThreshold: 0.65,
            onStart: evt => {
                if (evt.item.tagName === 'DETAILS') {
                    evt.item.dataset.wasOpen = evt.item.open;
                    evt.item.open = false;
                }
            },
            onEnd: evt => {
                if (evt.item.dataset.wasOpen === 'true') {
                    evt.item.open = true;
                }
                if (evt.oldIndex !== evt.newIndex) {
                    Storage.saveStateForUndo();
                    const arr = Storage.getTitles()[tIdx].collections;
                    const [moved] = arr.splice(evt.oldIndex, 1);
                    arr.splice(evt.newIndex, 0, moved);
                    Storage.save(false);
                    // Re-render completo para sincronizar data-ids en inner sortables
                    Render.render();
                }
            }
        });

        return { el: tEl, stats };
    }

    // ── RENDER COLECCIÓN ──────────────────────────────────────
    function _renderCollection(colObj, tIdx, colIdx, openSet, makeDetails, stats) {
        const cardCount = (colObj.cards || []).length;

        const cEl = makeDetails(`col_${colObj.id}`, openSet, 'media-collection-card');
        cEl.setAttribute('data-id', colObj.id);
        cEl.setAttribute('data-search', colObj.title.toLowerCase());

        cEl.innerHTML = `
            <summary class="media-col-summary">
                <div class="summary-row">
                    <div class="summary-left">
                        <span class="arrow-icon">${_icon('chevron-right', 13)}</span>
                        <button class="drag-handle btn-icon" title="Arrastrar" onclick="event.preventDefault();event.stopPropagation()">
                            ${_icon('grip-vertical', 13)}
                        </button>
                        ${_icon('library', 14)}
                        <span class="summary-text">${_escape(colObj.title)}</span>
                        <span class="badge">${cardCount}</span>
                    </div>
                    ${_menuBtn(`colm_${colObj.id}`, [
                        { icon: 'plus', label: 'Añadir Ficha', fn: `EditorMedia.addCard(event,${tIdx},${colIdx})` },
                        '---',
                        { icon: 'pencil', label: 'Editar Colección', fn: `EditorMedia.editCollection(event,${tIdx},${colIdx})` },
                        { icon: 'trash-2', label: 'Eliminar', fn: `Editor.deleteItem(event,'collection',${tIdx},${colIdx})`, cls: 'danger' },
                    ])}
                </div>
            </summary>
            <div class="media-col-body" id="colb_${colObj.id}"></div>
        `;

        const cBody = cEl.querySelector('.media-col-body');

        // Grid de cards
        const grid = document.createElement('div');
        grid.className = 'media-cards-grid';

        (colObj.cards || []).forEach((cardObj, cardIdx) => {
            stats.cards++;
            const cardEl = _buildCard(cardObj, tIdx, colIdx, cardIdx);
            grid.appendChild(cardEl);
        });

        cBody.appendChild(grid);

        // Sortable: cards dentro de colección
        _initSortable(grid, {
            group: 'media-cards',
            handle: '.drag-handle',
            onEnd: evt => {
                const fromColEl = evt.from.closest('.media-collection-card');
                const toColEl   = evt.to.closest('.media-collection-card');
                if (!fromColEl || !toColEl) return;

                Storage.saveStateForUndo();
                const titles = Storage.getTitles();
                let fromCards, toCards;
                titles.forEach(t => {
                    if (t.type !== 'media') return;
                    (t.collections || []).forEach(c => {
                        if (c.id === fromColEl.dataset.id) fromCards = c.cards;
                        if (c.id === toColEl.dataset.id)   toCards   = c.cards;
                    });
                });
                if (fromCards && toCards) {
                    const [moved] = fromCards.splice(evt.oldIndex, 1);
                    toCards.splice(evt.newIndex, 0, moved);
                    Storage.save(false);
                    Sidebar.render();
                }
            }
        });

        return cEl;
    }

    // ── RENDER FICHA / CARD ───────────────────────────────────
    function _buildCard(cardObj, tIdx, colIdx, cardIdx) {
        const wrapper = document.createElement('div');
        wrapper.className  = 'media-card';
        wrapper.dataset.id = cardObj.id;
        wrapper.dataset.search = [
            cardObj.title, cardObj.altTitle, cardObj.synopsis,
            cardObj.studio, cardObj.status,
            (cardObj.tags || []).map(id => { const t = Storage.findTagById(id); return t ? t.name : ''; }).join(' ')
        ].join(' ').toLowerCase();

        // Portada
        const imgUrl = Attachments.getDisplayUrl(cardObj.coverImage);
        const coverHTML = imgUrl
            ? `<img src="${imgUrl}" alt="${_escape(cardObj.title)}" class="media-card-cover" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
            : '';
        const placeholderHTML = `<div class="media-card-cover-placeholder" style="${imgUrl ? 'display:none' : ''}">${_icon('image', 32)}</div>`;

        // Render de Tags (max 3 para la card, el resto se ven en el modal)
        const visibleTags = (cardObj.tags || []).slice(0, 3);
        const tagsHTML = Tags.renderBadges(visibleTags);

        // Metadata reducida (Temporadas, Capítulos, etc según subtipo)
        const metaItems = [];
        if (cardObj.mediaSubtype === 'episodic') {
            if (cardObj.seasons) metaItems.push(`<span>${cardObj.seasons} Temp.</span>`);
            if (cardObj.chapters) metaItems.push(`<span>${cardObj.chapters} Cap.</span>`);
        } else if (cardObj.mediaSubtype === 'game') {
            if (cardObj.platform) metaItems.push(`<span>${_escape(cardObj.platform)}</span>`);
            if (cardObj.playtime) metaItems.push(`<span>${_escape(cardObj.playtime)}</span>`);
        }
        if (cardObj.year) metaItems.push(`<span>${cardObj.year}</span>`);

        const metaHTML = metaItems.length ? `<div class="media-card-meta">${metaItems.join('<span class="meta-sep">·</span>')}</div>` : '';

        wrapper.innerHTML = `
            <div class="media-card-cover-wrap">
                ${coverHTML}${placeholderHTML}
                <div class="media-card-overlay">
                    <h4 class="media-card-title">${_escape(cardObj.title || '(Sin título)')}</h4>
                    ${metaHTML}
                    ${cardObj.synopsis ? `<p class="media-card-synopsis">${_escape(cardObj.synopsis)}</p>` : ''}
                    ${tagsHTML ? `<div class="media-card-tags">${tagsHTML}</div>` : ''}
                </div>
                ${_statusBadge(cardObj.status)}
            </div>
            <div class="media-card-controls">
                <button class="drag-handle btn-icon media-drag-handle" title="Arrastrar" onclick="event.preventDefault();event.stopPropagation()">
                    ${_icon('grip-vertical', 13)}
                </button>
                ${_menuBtn(`cardm_${cardObj.id}`, [
                    { icon: 'pencil', label: 'Editar Ficha', fn: `const f=Storage.findCardById('${cardObj.id}'); if(f) EditorMedia.editCard(event,f.tIdx,f.colIdx,f.cardIdx)` },
                    '---',
                    { icon: 'trash-2', label: 'Eliminar', fn: `const f=Storage.findCardById('${cardObj.id}'); if(f) Editor.deleteItem(event,'card',f.tIdx,f.colIdx,f.cardIdx)`, cls: 'danger' },
                ])}
            </div>
        `;

        // Click en la card abre la vista de detalle (busca índices dinámicamente)
        const _cardId_for_click = cardObj.id;
        wrapper.addEventListener('click', (e) => {
            // Prevenir si se hizo clic en el botón de opciones
            if (e.target.closest('.media-card-controls')) return;
            if (typeof ViewMedia !== 'undefined') {
                const f = Storage.findCardById(_cardId_for_click);
                if (f) ViewMedia.openCard(f.tIdx, f.colIdx, f.cardIdx);
            }
        });

        return wrapper;
    }

    return { renderTitle };
})();
