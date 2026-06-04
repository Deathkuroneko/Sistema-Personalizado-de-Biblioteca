/**
 * app.js — Coordinador principal y punto de entrada
 * DevSnippets | Gestor de Conocimiento Técnico
 */

const App = (() => {
    const THEME_KEY = 'devSnippets_theme';
    let _activeDropdown = null;
    let _toastTimeout   = null;
    let _typeFilter = 'all';
    let _searchWrapped = false;

    // ── Inicialización ────────────────────────────────────────
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
        if (typeof GalleryTech !== 'undefined') GalleryTech.init();
        _bindGlobalEvents();
        _syncTypeFilterButtons();
    }

    // ── Tema ──────────────────────────────────────────────────
    function _applyStoredTheme() {
        const stored = localStorage.getItem(THEME_KEY) || 'dark';
        document.documentElement.setAttribute('data-theme', stored);
        _updateThemeBtn(stored);
    }

    function _updateThemeBtn(theme) {
        const btn = document.getElementById('theme-btn');
        if (!btn) return;
        btn.title = theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro';
        // Actualizar icono Lucide
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

        // hljs usa temas CSS — el cambio se aplica automáticamente al atributo data-theme.
        // El observer de Render garantiza el resaltado de bloques aún no visibles (P-02).
        if (typeof Render !== 'undefined') Render.observeCodeBlocks();
    }

    // ── Dropdowns ─────────────────────────────────────────────
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

    // ── Filtro visual por tipo ────────────────────────────────
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

    // ── Toast de Notificaciones ───────────────────────────────
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
        document.getElementById('toast').classList.remove('show');
        if (ok) showToast('Acción deshecha.', false);
    }

    // ── Copiar Código ─────────────────────────────────────────
    function copyCode(btn, escapedCode) {
        // Decodificar HTML entities para copiar el código real
        const textarea = document.createElement('textarea');
        textarea.innerHTML = escapedCode;
        const realCode = textarea.value;

        navigator.clipboard.writeText(realCode).then(() => {
            btn.textContent = '✓ Copiado';
            btn.classList.add('copied');
            setTimeout(() => {
                btn.textContent = 'Copiar';
                btn.classList.remove('copied');
            }, 2000);
        }).catch(() => {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = realCode;
            ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select(); document.execCommand('copy');
            ta.remove();
            btn.textContent = '✓ Copiado';
            setTimeout(() => { btn.textContent = 'Copiar'; }, 2000);
        });
    }

    // ── Export / Import / Save ────────────────────────────────
    async function saveManual() {
        try {
            await Storage.save(false, true); // runCleanup=true: único punto de limpieza de adjuntos (P-03)
            showToast('Guardado correctamente.', false);
        } catch (e) {
            showToast('Error al guardar.', false);
        }
    }

    function exportJSON() {
        closeActiveDropdown();
        Storage.exportJSON();
    }

    // ── Navegación e Interacción ──────────────────────────────
    function expandParents(el) {
        let parent = el.parentElement;
        while (parent) {
            if (parent.tagName === 'DETAILS' && !parent.open) {
                parent.open = true;
            }
            parent = parent.parentElement;
        }
    }


    function navigateToSubtitle(subId) {
        const subEl = document.getElementById(`s_${subId}`);
        if (!subEl) return;
        
        expandParents(subEl);
        
        setTimeout(() => {
            subEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            subEl.classList.add('highlight-pulse');
            setTimeout(() => {
                subEl.classList.remove('highlight-pulse');
            }, 2000);
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

    // ── Eventos Globales ──────────────────────────────────────
    function _bindGlobalEvents() {
        // Cerrar dropdown al hacer click fuera
        document.addEventListener('click', () => closeActiveDropdown());

        // Ctrl+Z para deshacer
        document.addEventListener('keydown', e => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undoAction();
            }
            // Ctrl+Shift+Z para rehacer
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
                e.preventDefault();
                Storage.redo();
                showToast('Acción rehecha.', false);
            }
        });

        // Búsqueda
        const searchEl = document.getElementById('search-input');
        if (searchEl) searchEl.addEventListener('input', () => Search.filter());

        // Import file input
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
        expandParents, navigateToSubtitle
    };
})();

// ── Arrancar la aplicación cuando el DOM esté listo ──────────
document.addEventListener('DOMContentLoaded', () => App.init());
