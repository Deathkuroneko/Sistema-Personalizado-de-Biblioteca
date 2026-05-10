/**
 * sidebar.js — Panel lateral de navegación
 * DevSnippets | Gestor de Conocimiento Técnico
 */

const Sidebar = (() => {
    const COLLAPSED_KEY = 'devSnippets_sidebar';

    const COLOR_DOT = {
        blue: '#1f6feb', green: '#238636', red: '#da3633', purple: '#8957e5',
        yellow: '#d29922', cyan: '#388bfd', orange: '#bd561d', gray: '#6e7681',
    };

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
            nav.innerHTML = `<p style="font-size:0.8em;color:var(--text-subtle);padding:8px 10px;">Sin títulos aún</p>`;
            return;
        }

        db.forEach((titleObj, tIdx) => {
            const section = document.createElement('div');
            section.className = 'nav-section';

            const titleItem = document.createElement('div');
            titleItem.className = 'nav-title-item';
            titleItem.innerHTML = `
                ${_icon('folder', 14)}
                <span style="overflow:hidden;text-overflow:ellipsis;">${_escape(titleObj.title)}</span>
            `;
            titleItem.onclick = () => {
                const el = document.getElementById(`t_${titleObj.id}`);
                if (el) { el.open = true; el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
            };
            section.appendChild(titleItem);

            // Categorías bajo el título
            (titleObj.categories || []).forEach((cat, cIdx) => {
                const catItem = document.createElement('div');
                catItem.className = 'nav-cat-item';
                const dotColor = COLOR_DOT[cat.color] || COLOR_DOT.gray;
                catItem.innerHTML = `
                    <span class="nav-dot" style="background:${dotColor}"></span>
                    <span style="overflow:hidden;text-overflow:ellipsis;">${_escape(cat.title)}</span>
                `;
                catItem.onclick = () => {
                    const titleEl = document.getElementById(`t_${titleObj.id}`);
                    const catEl   = document.getElementById(`c_${cat.id}`);
                    if (titleEl) titleEl.open = true;
                    if (catEl)   { catEl.open = true; catEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
                };
                section.appendChild(catItem);
            });

            nav.appendChild(section);
        });
    }

    function _icon(name, size = 16) {
        return `<svg data-lucide="${name}" width="${size}" height="${size}" style="flex-shrink:0"></svg>`;
    }
    function _escape(t) {
        return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    return { init, toggle, render };
})();
