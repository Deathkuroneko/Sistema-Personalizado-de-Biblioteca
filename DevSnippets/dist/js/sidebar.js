/**
 * sidebar.js — Panel lateral de navegación
 * DevSnippets | Sistema Multi-Estructura
 *
 * Soporte dual:
 *  - Técnico: Categorías → Subtítulos
 *  - Media:   Colecciones → Fichas
 */

const Sidebar = (() => {
    const COLLAPSED_KEY  = 'devSnippets_sidebar';
    const EXPANDED_KEY   = 'devSnippets_sidebarExpanded';

    const COLOR_DOT = {
        blue: '#1f6feb', green: '#238636', red: '#da3633', purple: '#8957e5',
        yellow: '#d29922', cyan: '#388bfd', orange: '#bd561d', gray: '#6e7681',
    };

    let _expandedSections = _loadExpanded();

    function _loadExpanded() {
        try { return new Set(JSON.parse(localStorage.getItem(EXPANDED_KEY)) || []); }
        catch { return new Set(); }
    }
    function _saveExpanded() {
        localStorage.setItem(EXPANDED_KEY, JSON.stringify([..._expandedSections]));
    }

    function init() {
        if (localStorage.getItem(COLLAPSED_KEY) === 'true') {
            document.getElementById('sidebar').classList.add('collapsed');
        }
    }

    function toggle() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
        localStorage.setItem(COLLAPSED_KEY, sidebar.classList.contains('collapsed'));
    }

    function render() {
        const nav = document.getElementById('sidebar-nav');
        if (!nav) return;
        nav.innerHTML = '';
        const titles = Storage.getTitles();

        if (titles.length === 0) {
            nav.innerHTML = `<p class="nav-empty">Sin títulos aún</p>`;
            return;
        }

        titles.forEach((titleObj) => {
            if (titleObj.type === 'media') {
                nav.appendChild(_renderMediaTitle(titleObj));
            } else {
                nav.appendChild(_renderTechnicalTitle(titleObj));
            }
        });

        if (typeof lucide !== 'undefined') lucide.createIcons({ node: nav });
    }

    // ── RENDER TÍTULO TÉCNICO ─────────────────────────────────
    function _renderTechnicalTitle(titleObj) {
        const titleKey = `t_${titleObj.id}`;
        const isExpanded = _expandedSections.has(titleKey);

        const section = document.createElement('div');
        section.className = 'nav-section';

        const titleRow = _createTitleRow(titleObj, titleKey, isExpanded, 'folder', section);
        section.appendChild(titleRow);

        const children = document.createElement('div');
        children.className = `nav-children${isExpanded ? '' : ' nav-hidden'}`;

        (titleObj.categories || []).forEach(cat => {
            const catKey  = `c_${cat.id}`;
            const catKey2 = `cat_${cat.id}`;
            const isCatExpanded = _expandedSections.has(catKey2);
            const dotColor = COLOR_DOT[cat.color] || COLOR_DOT.gray;

            const catRow = document.createElement('div');
            catRow.className = 'nav-cat-item';
            catRow.innerHTML = `
                <button class="nav-expand-btn nav-expand-sm${isCatExpanded ? ' open' : ''}" data-key="${catKey2}" title="Expandir/Colapsar">
                    ${_icon('chevron-right', 10)}
                </button>
                <span class="nav-dot" style="background:${dotColor}"></span>
                <span class="nav-label" title="${_escapeAttr(cat.title)}">${_escape(cat.title)}</span>
            `;

            catRow.querySelector('.nav-label').addEventListener('click', (e) => {
                e.stopPropagation();
                _openAndScroll(titleKey, catKey);
            });

            const subList = document.createElement('div');
            subList.className = `nav-sub-list${isCatExpanded ? '' : ' nav-hidden'}`;

            catRow.querySelector('.nav-expand-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                _toggleExpand(e.currentTarget, subList, catKey2);
            });

            (cat.subtitles || []).forEach(sub => {
                const subKey = `s_${sub.id}`;
                const subItem = document.createElement('div');
                subItem.className = `nav-sub-item${sub.isMain ? '' : ' nav-sub-sec'}`;
                subItem.dataset.navId = subKey;
                subItem.innerHTML = `
                    <span class="nav-sub-icon">${sub.isMain ? '—' : '↳'}</span>
                    <span class="nav-label" title="${_escapeAttr(sub.title)}">${_escape(sub.title)}</span>
                    ${sub.snippets && sub.snippets.length > 0 ? `<span class="nav-sub-count">${sub.snippets.length}</span>` : ''}
                `;
                subItem.addEventListener('click', () => _openAndScroll(titleKey, catKey, subKey));
                subList.appendChild(subItem);
            });

            children.appendChild(catRow);
            if ((cat.subtitles || []).length > 0) children.appendChild(subList);
        });

        section.appendChild(children);
        return section;
    }

    // ── RENDER TÍTULO MEDIA ───────────────────────────────────
    function _renderMediaTitle(titleObj) {
        const titleKey = `t_${titleObj.id}`;
        const isExpanded = _expandedSections.has(titleKey);

        const section = document.createElement('div');
        section.className = 'nav-section';

        const titleRow = _createTitleRow(titleObj, titleKey, isExpanded, 'film', section);
        section.appendChild(titleRow);

        const children = document.createElement('div');
        children.className = `nav-children${isExpanded ? '' : ' nav-hidden'}`;

        (titleObj.collections || []).forEach(col => {
            const colKey  = `col_${col.id}`;
            const colKey2 = `colx_${col.id}`;
            const isColExpanded = _expandedSections.has(colKey2);

            const colRow = document.createElement('div');
            colRow.className = 'nav-cat-item';
            colRow.innerHTML = `
                <button class="nav-expand-btn nav-expand-sm${isColExpanded ? ' open' : ''}" data-key="${colKey2}" title="Expandir/Colapsar">
                    ${_icon('chevron-right', 10)}
                </button>
                <span class="nav-dot" style="background:var(--text-subtle)"></span>
                <span class="nav-label" title="${_escapeAttr(col.title)}">${_escape(col.title)}</span>
            `;

            colRow.querySelector('.nav-label').addEventListener('click', (e) => {
                e.stopPropagation();
                _openAndScroll(titleKey, colKey);
            });

            const cardList = document.createElement('div');
            cardList.className = `nav-sub-list nav-media-list${isColExpanded ? '' : ' nav-hidden'}`;

            colRow.querySelector('.nav-expand-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                _toggleExpand(e.currentTarget, cardList, colKey2);
            });

            (col.cards || []).forEach(card => {
                const cardKey = card.id;
                const cardItem = document.createElement('div');
                cardItem.className = `nav-sub-item nav-media-item`;
                cardItem.dataset.navId = cardKey;
                cardItem.innerHTML = `
                    <span class="nav-label" title="${_escapeAttr(card.title)}">${_escape(card.title)}</span>
                `;
                // Hacer click abre el drawer
                cardItem.addEventListener('click', () => {
                    _openAndScroll(titleKey, colKey);
                    // Buscar índices
                    let tIdx = -1, cIdx = -1, cdIdx = -1;
                    const titles = Storage.getTitles();
                    tIdx = titles.findIndex(t => t.id === titleObj.id);
                    if (tIdx > -1) {
                        cIdx = titles[tIdx].collections.findIndex(c => c.id === col.id);
                        if (cIdx > -1) {
                            cdIdx = titles[tIdx].collections[cIdx].cards.findIndex(cd => cd.id === card.id);
                        }
                    }
                    if (tIdx > -1 && cIdx > -1 && cdIdx > -1) {
                        EditorMedia.editCard(null, tIdx, cIdx, cdIdx);
                        _setActive(cardKey);
                    }
                });
                cardList.appendChild(cardItem);
            });

            children.appendChild(colRow);
            if ((col.cards || []).length > 0) children.appendChild(cardList);
        });

        section.appendChild(children);
        return section;
    }

    // ── HELPERS COMUNES ───────────────────────────────────────
    function _createTitleRow(titleObj, titleKey, isExpanded, iconName, section) {
        const titleRow = document.createElement('div');
        titleRow.className = 'nav-title-item';
        titleRow.innerHTML = `
            <button class="nav-expand-btn${isExpanded ? ' open' : ''}" data-key="${titleKey}" title="Expandir/Colapsar">
                ${_icon('chevron-right', 12)}
            </button>
            ${_icon(iconName, 13)}
            <span class="nav-label" title="${_escapeAttr(titleObj.title)}">${_escape(titleObj.title)}</span>
        `;

        titleRow.querySelector('.nav-label').addEventListener('click', (e) => {
            e.stopPropagation();
            _openAndScroll(titleKey);
        });

        titleRow.querySelector('.nav-expand-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            const childList = section.querySelector('.nav-children');
            if (childList) _toggleExpand(e.currentTarget, childList, titleKey);
        });
        return titleRow;
    }

    function _toggleExpand(btn, container, key) {
        const expanding = !btn.classList.contains('open');
        btn.classList.toggle('open', expanding);
        container.classList.toggle('nav-hidden', !expanding);
        if (expanding) _expandedSections.add(key);
        else _expandedSections.delete(key);
        _saveExpanded();
    }

    function _openAndScroll(titleId, parentId, childId) {
        const tEl = document.getElementById(titleId);
        if (tEl) tEl.open = true;
        if (parentId) {
            const pEl = document.getElementById(parentId);
            if (pEl) pEl.open = true;
        }
        if (childId) {
            const cEl = document.getElementById(childId);
            if (cEl) {
                cEl.open = true;
                setTimeout(() => { cEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
            }
            _setActive(childId);
        } else if (parentId) {
            const pEl = document.getElementById(parentId);
            if (pEl) { pEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); _setActive(parentId); }
        } else {
            if (tEl) { tEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); _setActive(titleId); }
        }
    }

    function _setActive(navId) {
        document.querySelectorAll('.nav-title-item, .nav-cat-item, .nav-sub-item').forEach(el => el.classList.remove('nav-active'));
        const target = document.querySelector(`[data-nav-id="${navId}"]`);
        if (target) target.classList.add('nav-active');
    }

    function _icon(name, size = 16) { return `<svg data-lucide="${name}" width="${size}" height="${size}" style="flex-shrink:0"></svg>`; }
    function _escape(t = '') { return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    function _escapeAttr(t = '') { return String(t).replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

    return { init, toggle, render };
})();
