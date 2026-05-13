/**
 * sidebar.js — Panel lateral de navegación
 * DevSnippets | Gestor de Conocimiento Técnico
 *
 * Mejora 4: Sidebar jerárquico con Títulos → Categorías → Subtítulos
 * Cada nivel es colapsable independientemente, con navegación suave y
 * highlight del elemento activo.
 */

const Sidebar = (() => {
    const COLLAPSED_KEY  = 'devSnippets_sidebar';
    const EXPANDED_KEY   = 'devSnippets_sidebarExpanded';  // secciones abiertas en el nav

    const COLOR_DOT = {
        blue: '#1f6feb', green: '#238636', red: '#da3633', purple: '#8957e5',
        yellow: '#d29922', cyan: '#388bfd', orange: '#bd561d', gray: '#6e7681',
    };

    // IDs de secciones expandidas persistidas
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
        const db = Storage.getDB();

        if (db.length === 0) {
            nav.innerHTML = `<p class="nav-empty">Sin títulos aún</p>`;
            return;
        }

        db.forEach((titleObj) => {
            const titleKey = `t_${titleObj.id}`;
            const isExpanded = _expandedSections.has(titleKey);

            // ── Sección de Título ────────────────────────────
            const section = document.createElement('div');
            section.className = 'nav-section';

            // Botón de expansión + click de navegación
            const titleRow = document.createElement('div');
            titleRow.className = 'nav-title-item';
            titleRow.innerHTML = `
                <button class="nav-expand-btn${isExpanded ? ' open' : ''}" data-key="${titleKey}" title="Expandir/Colapsar">
                    ${_icon('chevron-right', 12)}
                </button>
                ${_icon('folder', 13)}
                <span class="nav-label" title="${_escapeAttr(titleObj.title)}">${_escape(titleObj.title)}</span>
            `;

            // Navegar al hacer clic en la etiqueta
            titleRow.querySelector('.nav-label').addEventListener('click', (e) => {
                e.stopPropagation();
                const el = document.getElementById(titleKey);
                if (el) {
                    el.open = true;
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    _setActive(titleKey);
                }
            });

            // Toggle expand/collapse sección
            titleRow.querySelector('.nav-expand-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                const btn = e.currentTarget;
                const childList = section.querySelector('.nav-children');
                if (!childList) return;
                const expanding = !btn.classList.contains('open');
                btn.classList.toggle('open', expanding);
                childList.classList.toggle('nav-hidden', !expanding);
                if (expanding) { _expandedSections.add(titleKey); }
                else           { _expandedSections.delete(titleKey); }
                _saveExpanded();
            });

            section.appendChild(titleRow);

            // ── Hijos: Categorías ────────────────────────────
            const children = document.createElement('div');
            children.className = `nav-children${isExpanded ? '' : ' nav-hidden'}`;

            (titleObj.categories || []).forEach((cat) => {
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
                    const titleEl = document.getElementById(`t_${titleObj.id}`);
                    const catEl   = document.getElementById(catKey);
                    if (titleEl) titleEl.open = true;
                    if (catEl) {
                        catEl.open = true;
                        catEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        _setActive(catKey);
                    }
                });

                // ── Nietos: Subtítulos ───────────────────────
                const subList = document.createElement('div');
                subList.className = `nav-sub-list${isCatExpanded ? '' : ' nav-hidden'}`;

                catRow.querySelector('.nav-expand-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    const btn = e.currentTarget;
                    const expanding = !btn.classList.contains('open');
                    btn.classList.toggle('open', expanding);
                    subList.classList.toggle('nav-hidden', !expanding);
                    if (expanding) { _expandedSections.add(catKey2); }
                    else           { _expandedSections.delete(catKey2); }
                    _saveExpanded();
                });

                (cat.subtitles || []).forEach((sub) => {
                    const subKey = `s_${sub.id}`;
                    const subItem = document.createElement('div');
                    subItem.className = `nav-sub-item${sub.isMain ? '' : ' nav-sub-sec'}`;
                    subItem.dataset.navId = subKey;
                    subItem.innerHTML = `
                        <span class="nav-sub-icon">${sub.isMain ? '—' : '↳'}</span>
                        <span class="nav-label" title="${_escapeAttr(sub.title)}">${_escape(sub.title)}</span>
                        ${sub.snippets && sub.snippets.length > 0 ? `<span class="nav-sub-count">${sub.snippets.length}</span>` : ''}
                    `;
                    subItem.addEventListener('click', () => {
                        const titleEl = document.getElementById(`t_${titleObj.id}`);
                        const catEl   = document.getElementById(catKey);
                        const subEl   = document.getElementById(subKey);
                        if (titleEl) titleEl.open = true;
                        if (catEl)   catEl.open = true;
                        if (subEl) {
                            subEl.open = true;
                            setTimeout(() => {
                                subEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }, 50);
                            _setActive(subKey);
                        }
                    });
                    subList.appendChild(subItem);
                });

                children.appendChild(catRow);
                if ((cat.subtitles || []).length > 0) {
                    children.appendChild(subList);
                }
            });

            section.appendChild(children);
            nav.appendChild(section);
        });

        // Re-renderizar íconos Lucide dentro del nav
        if (typeof lucide !== 'undefined') lucide.createIcons({ node: nav });
    }

    // Resalta el elemento activo en el sidebar
    function _setActive(navId) {
        document.querySelectorAll('.nav-title-item, .nav-cat-item, .nav-sub-item').forEach(el => {
            el.classList.remove('nav-active');
        });
        // Marcar el item del nav que corresponda al id
        const target = document.querySelector(`[data-nav-id="${navId}"]`);
        if (target) target.classList.add('nav-active');
    }

    function _icon(name, size = 16) {
        return `<svg data-lucide="${name}" width="${size}" height="${size}" style="flex-shrink:0"></svg>`;
    }
    function _escape(t = '') {
        return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }
    function _escapeAttr(t = '') {
        return String(t).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    return { init, toggle, render };
})();
