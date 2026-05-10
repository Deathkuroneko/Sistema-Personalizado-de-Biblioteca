/**
 * app.js — Coordinador principal y punto de entrada
 * DevSnippets | Gestor de Conocimiento Técnico
 */

const App = (() => {
    const THEME_KEY = 'devSnippets_theme';
    let _activeDropdown = null;
    let _toastTimeout   = null;

    // ── Inicialización ────────────────────────────────────────
    async function init() {
        _applyStoredTheme();
        await Storage.load();
        await _migrateFromLegacy();   // migrar datos del archivo viejo si el DB nuevo está vacío
        Sidebar.init();
        Render.render();
        _bindGlobalEvents();
    }

    // ── Migración desde versión anterior (snippetsDBUltra) ────
    // Si el nuevo DB está vacío pero el viejo tiene datos, los importa automáticamente.
    // Se ejecuta solo una vez; marca el flag 'devSnippets_migrated' para no repetir.
    async function _migrateFromLegacy() {
        const MIGRATED_KEY = 'devSnippets_migrated';
        const LEGACY_KEY   = 'snippetsDBUltra';

        if (localStorage.getItem(MIGRATED_KEY)) return; // ya migrado

        const legacyRaw = localStorage.getItem(LEGACY_KEY);
        if (!legacyRaw) { localStorage.setItem(MIGRATED_KEY, '1'); return; }

        // Si la base de datos actual ya tiene datos, no migramos
        const currentDB = Storage.getDB();
        if (currentDB.length > 0) { localStorage.setItem(MIGRATED_KEY, '1'); return; }

        try {
            const legacyData = JSON.parse(legacyRaw);
            if (Array.isArray(legacyData) && legacyData.length > 0) {
                Storage.setDB(legacyData);
                await Storage.save(false);
                console.info('[DevSnippets] Datos migrados desde snippetsDBUltra ✓');
            }
        } catch (e) {
            console.warn('[DevSnippets] No se pudo migrar datos legacy:', e);
        }

        localStorage.setItem(MIGRATED_KEY, '1');
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

        // Highlight.js debe re-colorear con el nuevo tema
        if (typeof hljs !== 'undefined') {
            document.querySelectorAll('pre code').forEach(b => hljs.highlightElement(b));
        }
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
        saveManual, exportJSON,
        expandParents, navigateToSubtitle
    };
})();

// ── Arrancar la aplicación cuando el DOM esté listo ──────────
document.addEventListener('DOMContentLoaded', () => App.init());
