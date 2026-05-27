/**
 * render-technical.js — Renderer del tipo "Técnico"
 * DevSnippets | Sistema Multi-Estructura
 *
 * Contiene toda la lógica de renderizado para títulos de tipo "technical":
 *   Título → Categorías → Subtítulos → Snippets
 *
 * Extraído de render.js para mantener separación por tipo.
 */

const RenderTechnical = (() => {

    // ── Helpers (locales) ─────────────────────────────────────
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

    function _normalizeSnippetBlocks(snipObj) {
        const blocks = Array.isArray(snipObj.blocks) && snipObj.blocks.length
            ? snipObj.blocks
            : [{ type: snipObj.contentType || 'code', blockTitle: snipObj.blockTitle || '', content: snipObj.code || '' }];

        return blocks.map(block => ({
            type: block && block.type === 'text' ? 'text' : 'code',
            blockTitle: block && block.blockTitle ? String(block.blockTitle) : '',
            content: block && block.content !== undefined ? String(block.content) : '',
        }));
    }

    function _copyButton(content) {
        const copyArg = JSON.stringify(_escape(content)).replace(/'/g, '&#39;');
        return `<button class="copy-btn" title="Copiar" onclick='App.copyCode(this, ${copyArg})'>${_icon('copy',14)}</button>`;
    }

    function _collapseButton() {
        return `<button class="copy-btn block-collapse-btn" title="Contraer/Expandir" onclick="(function(btn){ const wrapper = btn.closest('.code-block-wrapper, .text-block-wrapper'); if (!wrapper) return; wrapper.classList.toggle('block-collapsed-local'); btn.textContent = wrapper.classList.contains('block-collapsed-local') ? '+' : '-'; })(this)">-</button>`;
    }

    function _renderSnippetBlock(block) {
        const fallbackTitle = block.type === 'code' ? 'Código' : 'Texto';
        const blockTitle = _escape(block.blockTitle || fallbackTitle);
        const escapedContent = _escape(block.content || '');

        if (block.type === 'code') {
            return `<div class="code-block-wrapper">
                    <div class="block-header">
                        <div class="block-title">${blockTitle}</div>
                        <div class="block-actions">${_copyButton(block.content || '')}${_collapseButton()}</div>
                    </div>
                    <div class="code-block-body">
                        <div class="line-nums">${(block.content || '').split('\n').map((_, i) => i + 1).join('\n')}</div>
                        <pre><code>${escapedContent}</code></pre>
                    </div>
               </div>`;
        }

        return `<div class="text-block-wrapper">
                    <div class="block-header">
                        <div class="block-title">${blockTitle}</div>
                        <div class="block-actions">${_copyButton(block.content || '')}${_collapseButton()}</div>
                    </div>
                    <div class="text-block">${escapedContent.replace(/\n/g, '<br>')}</div>
               </div>`;
    }

    // ── Sortable robusto para Tauri/WebView2 ──────────────────
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
                    delayOnTouchOnly: false,
                    ...options,
                });
            });
        });
    }

    // ── Render de un título técnico completo ──────────────────
    function renderTitle(titleObj, tIdx, openSet, makeDetails) {
        let titleSnipCount = 0;
        titleObj.categories.forEach(c => c.subtitles.forEach(s => titleSnipCount += s.snippets.length));

        const tEl = makeDetails(`t_${titleObj.id}`, openSet, 'title-card title-card--technical');
        tEl.setAttribute('data-id', titleObj.id);
        tEl.setAttribute('data-type', 'technical');

        tEl.innerHTML = `
            <summary class="title-summary">
                <div class="summary-row">
                    <div class="summary-left">
                        <span class="arrow-icon">${_icon('chevron-right', 14)}</span>
                        <button class="drag-handle btn-icon" title="Arrastrar para reordenar" onclick="event.preventDefault();event.stopPropagation()">
                            ${_icon('grip-vertical', 14)}
                        </button>
                        ${_icon('code-2', 16)}
                        <span class="summary-text title-name">${_escape(titleObj.title)}</span>
                        <span class="badge">${titleSnipCount}</span>
                    </div>
                    ${_menuBtn(`tm_${titleObj.id}`, [
                        { icon: 'folder-plus', label: 'Añadir Categoría', fn: `Editor.addCategory(event,${tIdx})` },
                        '---',
                        { icon: 'pencil', label: 'Editar Título', fn: `const f=Storage.findTitleById('${titleObj.id}'); if(f) Editor.editTitle(event,f.tIdx)` },
                        { icon: 'trash-2', label: 'Eliminar', fn: `const f=Storage.findTitleById('${titleObj.id}'); if(f) Editor.deleteItem(event,'title',f.tIdx)`, cls: 'danger' },
                    ])}
                </div>
            </summary>
            <div class="title-body" id="tb_${titleObj.id}"></div>
        `;

        const tBody = tEl.querySelector('.title-body');
        const stats = { cats: 0, subs: 0, snips: 0 };

        titleObj.categories.forEach((catObj, cIdx) => {
            stats.cats++;
            const catEl = _renderCategory(catObj, tIdx, cIdx, openSet, makeDetails, stats);
            tBody.appendChild(catEl);
        });

        // Sortable: categorías
        _initSortable(tBody, {
            group: `cats-in-${tIdx}`,
            handle: '.drag-handle',
            onEnd: evt => {
                Storage.saveStateForUndo();
                const arr = Storage.getTitles()[tIdx].categories;
                const [moved] = arr.splice(evt.oldIndex, 1);
                arr.splice(evt.newIndex, 0, moved);
                Storage.save(false);
            }
        });

        return { el: tEl, stats };
    }

    function _renderCategory(catObj, tIdx, cIdx, openSet, makeDetails, stats) {
        let catSnipCount = 0;
        catObj.subtitles.forEach(s => catSnipCount += s.snippets.length);

        const cEl = makeDetails(`c_${catObj.id}`, openSet, `cat-card cat-${catObj.color || 'gray'}`);
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
                        { icon: 'pencil', label: 'Editar Categoría', fn: `const f=Storage.findCategoryById('${catObj.id}'); if(f) Editor.editCategory(event,f.tIdx,f.cIdx)` },
                        { icon: 'trash-2', label: 'Eliminar', fn: `const f=Storage.findCategoryById('${catObj.id}'); if(f) Editor.deleteItem(event,'cat',f.tIdx,f.cIdx)`, cls: 'danger' },
                    ])}
                </div>
            </summary>
            <div class="cat-body" id="cb_${catObj.id}"></div>
        `;

        const cBody = cEl.querySelector('.cat-body');

        catObj.subtitles.forEach((subObj, sIdx) => {
            stats.subs++;
            const sEl = _renderSubtitle(subObj, tIdx, cIdx, sIdx, openSet, makeDetails, stats);
            cBody.appendChild(sEl);
        });

        // Sortable: subtítulos
        _initSortable(cBody, {
            group: `subs-in-${tIdx}-${cIdx}`,
            handle: '.drag-handle',
            onEnd: evt => {
                Storage.saveStateForUndo();
                const arr = Storage.getTitles()[tIdx].categories[cIdx].subtitles;
                const [moved] = arr.splice(evt.oldIndex, 1);
                arr.splice(evt.newIndex, 0, moved);
                Storage.save(false);
            }
        });

        return cEl;
    }

    function _renderSubtitle(subObj, tIdx, cIdx, sIdx, openSet, makeDetails, stats) {
        const sEl = makeDetails(`s_${subObj.id}`, openSet, 'sub-card');
        sEl.setAttribute('data-id', subObj.id);

        // Asociaciones
        let assocHTML = '';
        if (!subObj.isMain && subObj.parentIds && subObj.parentIds.length > 0) {
            const links = subObj.parentIds.map(id => {
                const pInfo = Storage.findSubtitleAndCategory(id);
                return pInfo
                    ? `<li><button class="assoc-link" onclick="event.preventDefault();event.stopPropagation();App.navigateToSubtitle('${id}')">• ${_escape(pInfo.cat.title)} / ${_escape(pInfo.sub.title)} ↗</button></li>`
                    : '';
            }).filter(Boolean).join('');

            if (links) {
                const count = subObj.parentIds.length;
                assocHTML = `
                    <div class="sub-assoc">
                        <button class="assoc-toggle" onclick="event.preventDefault();event.stopPropagation();this.closest('.assoc-collapsible').classList.toggle('open')">
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
            : `<span class="icon-sec"  title="Secundario">${_icon('layers', 13)}</span>`;

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
                        { icon: 'pencil', label: 'Editar Subtítulo', fn: `const f=Storage.findSubtitleById('${subObj.id}'); if(f) Editor.editSubtitle(event,f.tIdx,f.cIdx,f.sIdx)` },
                        { icon: 'trash-2', label: 'Eliminar', fn: `const f=Storage.findSubtitleById('${subObj.id}'); if(f) Editor.deleteItem(event,'sub',f.tIdx,f.cIdx,f.sIdx)`, cls: 'danger' },
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

        // Sortable: snippets (cross-subtítulo)
        _initSortable(sBody, {
            group: 'snippets',
            handle: '.drag-handle',
            onEnd: evt => {
                const fromSubEl = evt.from.closest('.sub-card');
                const toSubEl   = evt.to.closest('.sub-card');
                if (!fromSubEl || !toSubEl) return;

                Storage.saveStateForUndo();
                const db = Storage.getTitles();
                let fromSub, toSub;
                db.forEach(t => {
                    if (t.type !== 'technical') return;
                    t.categories.forEach(c => c.subtitles.forEach(s => {
                        if (s.id === fromSubEl.dataset.id) fromSub = s.snippets;
                        if (s.id === toSubEl.dataset.id)   toSub   = s.snippets;
                    }));
                });
                if (fromSub && toSub) {
                    const [moved] = fromSub.splice(evt.oldIndex, 1);
                    toSub.splice(evt.newIndex, 0, moved);
                    Storage.save(false);
                    Sidebar.render();
                }
            }
        });

        return sEl;
    }

    // ── Snippet Card ──────────────────────────────────────────
    function _buildSnippetCard(snipObj, tIdx, cIdx, sIdx, snIdx) {
        const card = document.createElement('div');
        const blocks = _normalizeSnippetBlocks(snipObj);
        const searchText = blocks.map(block => `${block.blockTitle} ${block.content}`).join(' ');
        card.className  = 'snippet-card';
        card.dataset.id = snipObj.id;
        card.dataset.search = `${snipObj.title} ${snipObj.description} ${snipObj.code || ''} ${searchText}`.toLowerCase();

        const favCls = snipObj.fav ? 'active' : '';
        const codeBlockHTML = blocks.map(_renderSnippetBlock).join('');

        card.innerHTML = `
            <div class="snippet-view">
                <div class="snippet-header">
                    <div class="snippet-meta">
                        <h4 class="snippet-title">
                            <button class="btn-icon fav-btn ${favCls}" title="Favorito"
                                onclick="Storage.toggleFavById('${snipObj.id}')">
                                ${_icon('star', 15)}
                            </button>
                            ${_escape(snipObj.title)}
                        </h4>
                        ${snipObj.description ? `<p class="snippet-desc">${_escape(snipObj.description)}</p>` : ''}
                    </div>
                    ${ (snipObj.coverImage && typeof Attachments !== 'undefined') ? (function(){ const url = Attachments.getDisplayUrl(snipObj.coverImage); return url ? `<div class="snippet-thumbnail" onclick="ViewMedia.openImage('${url.replace(/'/g, "\\'")}', '${_escape(snipObj.title||'')}')"><img src="${url}" alt="thumbnail"></div>` : ''; })() : '' }
                    <div style="display:flex;align-items:center;gap:4px;">
                        <button class="drag-handle btn-icon" title="Arrastrar para reordenar">
                            ${_icon('grip-vertical', 15)}
                        </button>
                        ${_menuBtn(`snm_${snipObj.id}`, [
                            { icon: 'pencil', label: 'Editar Snippet', fn: `const f=Storage.findSnippetById('${snipObj.id}'); if(f) Editor.editSnippet(event,f.tIdx,f.cIdx,f.sIdx,f.snIdx)` },
                            '---',
                            { icon: 'trash-2', label: 'Eliminar', fn: `const f=Storage.findSnippetById('${snipObj.id}'); if(f) Editor.deleteItem(event,'snip',f.tIdx,f.cIdx,f.sIdx,f.snIdx)`, cls: 'danger' },
                        ])}
                    </div>
                </div>
                ${codeBlockHTML}
            </div>
            <div class="snippet-edit-zone hidden"></div>
        `;

        return card;
    }

    return { renderTitle };
})();
