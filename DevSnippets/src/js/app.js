/**
 * src/js/app.js — Coordinador principal (fuente)
 * Copiado desde dist para mantener paridad y exponer `toggleExpand`.
 */

const App = (() => {
    const THEME_KEY = 'devSnippets_theme';
    let _activeDropdown = null;
    let _toastTimeout   = null;
    let _typeFilter = 'all';
    let _searchWrapped = false;

    async function init() {
        _applyStoredTheme();
        if (typeof Attachments !== 'undefined') await Attachments.init();
        await Storage.load();
        await Storage.migrateFromLegacy();
        if (typeof Editor !== 'undefined') Editor.initModalEvents();
        if (typeof EditorMedia !== 'undefined') EditorMedia.init();
        Sidebar.init();
        _wrapSearchFilter();
        Render.render();
        _bindGlobalEvents();
        _syncTypeFilterButtons();
    }

    function _applyStoredTheme() {
        const stored = localStorage.getItem(THEME_KEY) || 'dark';
        document.documentElement.setAttribute('data-theme', stored);
        _updateThemeBtn(stored);
    }

    function _updateThemeBtn(theme) {
        const btn = document.getElementById('theme-btn');
        if (!btn) return;
        btn.title = theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro';
        const svg = btn.querySelector('svg');
        if (svg) svg.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
        if (typeof lucide !== 'undefined') lucide.createIcons({ node: btn });
    }

    function toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const next    = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem(THEME_KEY, next);
        _updateThemeBtn(next);
        if (typeof hljs !== 'undefined') {
            document.querySelectorAll('pre code').forEach(b => hljs.highlightElement(b));
        }
    }

    function toggleDropdown(e, id) {
        e.preventDefault();
        e.stopPropagation();
        const menu = document.getElementById(id);
        if (!menu) return;

        if (_activeDropdown && _activeDropdown !== menu) {
            _activeDropdown.classList.remove('show');
        }
        menu.classList.toggle('show');
        _activeDropdown = menu.classList.contains('show') ? menu : null;
        if (typeof lucide !== 'undefined') lucide.createIcons({ node: menu });
    }

    function closeActiveDropdown() {
        if (_activeDropdown) {
            _activeDropdown.classList.remove('show');
            _activeDropdown = null;
        }
    }

    function _wrapSearchFilter() {
        if (_searchWrapped || typeof Search === 'undefined' || !Search.filter) return;
        const originalFilter = Search.filter.bind(Search);
        Search.filter = () => {
            originalFilter();
            applyTypeFilter();
        };
        _searchWrapped = true;
    }

    function _syncTypeFilterButtons() {
        document.querySelectorAll('.type-filter-btn[data-filter-type]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filterType === _typeFilter);
        });
    }

    function setTypeFilter(type = 'all') {
        _typeFilter = ['all', 'media', 'technical'].includes(type) ? type : 'all';
        _syncTypeFilterButtons();
        if (typeof Search !== 'undefined' && Search.filter) Search.filter();
        else applyTypeFilter();
    }

    function applyTypeFilter() {
        document.querySelectorAll('.title-card[data-type]').forEach(card => {
            const shouldHide = _typeFilter !== 'all' && card.dataset.type !== _typeFilter;
            card.classList.toggle('type-hidden', shouldHide);
        });
    }

    function showToast(msg, showUndo = false) {
        const toast   = document.getElementById('toast');
        const toastMsg = document.getElementById('toast-msg');
        const undoBtn = document.getElementById('toast-undo-btn');
        if (!toast) return;

        toastMsg.textContent = msg;
        if (undoBtn) undoBtn.style.display = showUndo && Storage.canUndo() ? 'inline-flex' : 'none';

        toast.classList.add('show');
        clearTimeout(_toastTimeout);
        _toastTimeout = setTimeout(() => toast.classList.remove('show'), 5000);
    }

    function undoAction() {
        const ok = Storage.undo();
        const t = document.getElementById('toast');
        if (t) t.classList.remove('show');
        if (ok) showToast('Acción deshecha.', false);
    }

    function copyCode(btn, escapedCode) {
        const textarea = document.createElement('textarea');
        textarea.innerHTML = escapedCode;
        const realCode = textarea.value;

        navigator.clipboard.writeText(realCode).then(() => {
            btn.textContent = '✓ Copiado';
            btn.classList.add('copied');
            setTimeout(() => {
                btn.textContent = '';
                btn.classList.remove('copied');
            }, 1500);
        }).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = realCode;
            ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select(); document.execCommand('copy');
            ta.remove();
            btn.textContent = '✓ Copiado';
            setTimeout(() => { btn.textContent = ''; }, 1500);
        });
    }

    async function saveManual() {
        try {
            await Storage.save(false);
            showToast('Guardado correctamente.', false);
        } catch (e) {
            showToast('Error al guardar.', false);
        }
    }

    function exportJSON() {
        closeActiveDropdown();
        Storage.exportJSON();
    }

    function expandParents(el) {
        let parent = el.parentElement;
        while (parent) {
            if (parent.tagName === 'DETAILS' && !parent.open) parent.open = true;
            parent = parent.parentElement;
        }
    }

    function toggleExpand(btn) {
        if (!btn) return;
        const card = btn.closest('.snippet-card');
        if (!card) return;
        const collapsed = card.classList.toggle('collapsed');
        btn.setAttribute('aria-expanded', (!collapsed).toString());
        const iconName = collapsed ? 'chevron-down' : 'chevron-up';
        btn.innerHTML = _icon(iconName, 14);
        if (typeof lucide !== 'undefined') lucide.createIcons({ node: btn });
    }

    function navigateToSubtitle(subId) {
        const subEl = document.getElementById(`s_${subId}`);
        if (!subEl) return;
        expandParents(subEl);
        setTimeout(() => {
            subEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            subEl.classList.add('highlight-pulse');
            setTimeout(() => subEl.classList.remove('highlight-pulse'), 2000);
        }, 50);
    }

    function importJSON(event) {
        closeActiveDropdown();
        Storage.importJSON(
            event.target.files[0],
            () => showToast('Biblioteca importada con éxito.', false),
            err => alert('Error al importar: ' + err.message)
        );
        event.target.value = '';
    }

    function _bindGlobalEvents() {
        document.addEventListener('click', () => closeActiveDropdown());
        document.addEventListener('keydown', e => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault(); undoAction();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
                e.preventDefault(); Storage.redo(); showToast('Acción rehecha.', false);
            }
        });
        const searchEl = document.getElementById('search-input');
        if (searchEl) searchEl.addEventListener('input', () => Search.filter());
        const importEl = document.getElementById('import-file');
        if (importEl) importEl.addEventListener('change', importJSON);
    }

    return {
        init,
        toggleTheme,
        toggleDropdown, closeActiveDropdown,
        showToast, undoAction,
        copyCode,
        setTypeFilter, applyTypeFilter,
        saveManual, exportJSON,
        expandParents, navigateToSubtitle,
        toggleExpand
    };
})();

document.addEventListener('DOMContentLoaded', () => { if (typeof App !== 'undefined' && App.init) App.init(); });
