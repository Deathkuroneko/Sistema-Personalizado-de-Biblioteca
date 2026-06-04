/**
 * storage.js — Capa de persistencia y gestión de datos
 * DevSnippets | Sistema Multi-Estructura
 *
 * DB Root v2: { titles: [...], tags: [...] }
 * (antes era un Array raíz — se migra automáticamente)
 *
 * TODO (SQLite): Reemplazar load/save por tauri-plugin-sql
 */

const Storage = (() => {
    const DB_KEY = 'devSnippets_db';
    const UNDO_LIMIT = 30;

    // DB root v2
    let _db = { titles: [], tags: [] };
    let _undoStack = [];
    let _redoStack = [];

    // ── ID Generator ──────────────────────────────────────────
    function generateId() {
        return '_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
    }

    // ── Migración v1 → v2 (Array → { titles, tags }) ─────────
    function _migrateRootFormat(raw) {
        // Si ya es el formato nuevo, devolver tal cual
        if (raw && typeof raw === 'object' && !Array.isArray(raw) && Array.isArray(raw.titles)) {
            return raw;
        }
        // Si es un array (formato v1), wrapearlo
        if (Array.isArray(raw)) {
            console.debug('[Storage] Migrando DB v1 (Array) → v2 ({ titles, tags }) ✓');
            return { titles: raw, tags: [] };
        }
        return { titles: [], tags: [] };
    }

    // ── Migración de estructura interna de títulos ────────────
    function _migrateTitles(titles) {
        let changed = false;
        titles = titles.map(titleObj => {
            // Añadir type si no existe (todos los existentes son técnicos)
            if (!titleObj.type) {
                titleObj.type = 'technical';
                changed = true;
            }

            if (!titleObj.id) { titleObj.id = generateId(); changed = true; }

            // Migraciones para tipo técnico
            if (titleObj.type === 'technical') {
                // Migrar estructura antigua (subcategories sin categorías)
                if (titleObj.subcategories && !titleObj.categories) {
                    changed = true;
                    titleObj.categories = [{
                        id: generateId(), title: 'General', color: 'gray',
                        subtitles: titleObj.subcategories.map(s => ({
                            id: generateId(), title: s.title,
                            snippets: (s.snippets || []).map(sn => ({ id: generateId(), fav: false, ...sn }))
                        }))
                    }];
                    delete titleObj.subcategories;
                }

                if (!titleObj.categories) { titleObj.categories = []; changed = true; }

                titleObj.categories.forEach(cat => {
                    if (!cat.id) { cat.id = generateId(); changed = true; }
                    if (!cat.color) { cat.color = 'gray'; changed = true; }
                    if (!cat.subtitles) { cat.subtitles = []; changed = true; }

                    cat.subtitles.forEach(sub => {
                        if (!sub.id) { sub.id = generateId(); changed = true; }
                        if (sub.isMain === undefined) { sub.isMain = true; changed = true; }

                        if (sub.parentIds === undefined) {
                            sub.parentIds = sub.parentId ? [sub.parentId] : [];
                            delete sub.parentId;
                            changed = true;
                        }
                        if (!sub.snippets) { sub.snippets = []; changed = true; }

                        sub.snippets.forEach(snip => {
                            if (!snip.id) { snip.id = generateId(); changed = true; }
                            if (snip.fav === undefined) { snip.fav = false; changed = true; }
                            if (!snip.description) { snip.description = ''; changed = true; }
                            if (!snip.contentType) { snip.contentType = 'code'; changed = true; }
                            if (snip.blockTitle === undefined) { snip.blockTitle = ''; changed = true; }
                            if (snip.blocks !== undefined && !Array.isArray(snip.blocks)) { snip.blocks = []; changed = true; }
                        });
                    });
                });
            }

            // Migraciones para tipo media
            if (titleObj.type === 'media') {
                if (!titleObj.collections) { titleObj.collections = []; changed = true; }
                titleObj.collections.forEach(col => {
                    if (!col.id) { col.id = generateId(); changed = true; }
                    if (!col.cards) { col.cards = []; changed = true; }
                    col.cards.forEach(card => {
                        if (!card.id) { card.id = generateId(); changed = true; }
                        if (!card.tags) { card.tags = []; changed = true; }
                        if (!card.customFields) { card.customFields = []; changed = true; }
                        if (!card.links) { card.links = []; changed = true; }
                        if (!card.status) { card.status = 'Sin estado'; changed = true; }
                    });
                });
            }

            return titleObj;
        });

        return { titles, changed };
    }

    // ── Tauri v2 Detection ────────────────────────────────────
    function _isTauri() {
        return !!(window.__TAURI__ && window.__TAURI__.fs);
    }
    function _getFS() { return window.__TAURI__.fs; }

    const FILE_NAME = 'snippets.json';
    const DIR_NAME = 'DevSnippets';
    const ATT_DIR = 'DevSnippets/attachments';

    // ── Load ──────────────────────────────────────────────────
    async function load() {
        const isTauri = _isTauri();
        console.debug('[Storage] load() — isTauri=' + isTauri);
        try {
            let raw = null;
            if (isTauri) {
                const { exists, readTextFile, mkdir, BaseDirectory } = _getFS();
                const filePath = `${DIR_NAME}/${FILE_NAME}`;
                try {
                    const dirExists = await exists(DIR_NAME, { baseDir: BaseDirectory.Document });
                    if (!dirExists) {
                        await mkdir(DIR_NAME, { baseDir: BaseDirectory.Document, recursive: true });
                    }
                    // Crear subcarpeta attachments si no existe
                    const attExists = await exists(ATT_DIR, { baseDir: BaseDirectory.Document });
                    if (!attExists) {
                        await mkdir(ATT_DIR, { baseDir: BaseDirectory.Document, recursive: true });
                    }
                    const fileExists = await exists(filePath, { baseDir: BaseDirectory.Document });
                    if (fileExists) {
                        raw = await readTextFile(filePath, { baseDir: BaseDirectory.Document });
                        console.debug('[Storage] Archivo leído OK, bytes:', raw?.length);
                    }
                } catch (fsErr) {
                    console.error('[Storage] Error FS — fallback a localStorage:', fsErr);
                    raw = localStorage.getItem(DB_KEY);
                }
            } else {
                raw = localStorage.getItem(DB_KEY);
            }

            const parsed = raw ? JSON.parse(raw) : null;

            // Migrar formato raíz (Array → { titles, tags })
            const rootObj = _migrateRootFormat(parsed);

            // Migrar títulos internamente
            const { titles, changed } = _migrateTitles(rootObj.titles || []);
            rootObj.titles = titles;
            if (!Array.isArray(rootObj.tags)) rootObj.tags = [];

            _db = rootObj;
            console.debug('[Storage] DB lista. Títulos:', _db.titles.length, '| Tags:', _db.tags.length);
            if (changed) await _persist();

        } catch (e) {
            console.error('[Storage] Error cargando datos:', e);
            _db = { titles: [], tags: [] };
        }
        return _db;
    }

    // ── Save / Persist ────────────────────────────────────────
    async function _persist() {
        const json = JSON.stringify(_db, null, 2);
        if (_isTauri()) {
            try {
                const { writeTextFile, BaseDirectory } = _getFS();
                await writeTextFile(`${DIR_NAME}/${FILE_NAME}`, json, { baseDir: BaseDirectory.Document });
                console.debug('[Storage] Guardado en disco OK');
            } catch (e) {
                console.error('[Storage] Error al escribir en disco:', e);
                localStorage.setItem(DB_KEY, json);
                throw e;
            }
        } else {
            localStorage.setItem(DB_KEY, json);
        }
    }

    // runCleanup=false por defecto: el scan de archivos huérfanos solo ocurre
    // en guardados explícitos del usuario, no en cada operación CRUD (P-03).
    async function save(reRender = true, runCleanup = false, refreshGallery = false) {
        if (reRender && typeof Render !== 'undefined') {
            Render.render();
        }
        if (refreshGallery && typeof GalleryTech !== 'undefined') {
            GalleryTech.refresh();
        }
        try {
            await _persist();
            if (runCleanup) {
                try { await cleanupAttachments(); } catch (e) { console.warn('[Storage] cleanupAttachments failed:', e); }
            }
        } catch (e) {
            if (typeof App !== 'undefined') App.showToast('Error al guardar: ' + e.message, false);
        }
    }

    // ── Undo / Redo ───────────────────────────────────────────
    function saveStateForUndo() {
        _undoStack.push(JSON.stringify(_db));
        _redoStack = [];
        if (_undoStack.length > UNDO_LIMIT) _undoStack.shift();
    }

    function undo() {
        if (_undoStack.length === 0) return false;
        _redoStack.push(JSON.stringify(_db));
        _db = JSON.parse(_undoStack.pop());
        save(true, false, true);
        return true;
    }

    function redo() {
        if (_redoStack.length === 0) return false;
        _undoStack.push(JSON.stringify(_db));
        _db = JSON.parse(_redoStack.pop());
        save(true, false, true);
        return true;
    }

    function canUndo() { return _undoStack.length > 0; }
    function canRedo() { return _redoStack.length > 0; }

    // ── Getters / Setters ─────────────────────────────────────
    function getDB() { return _db; }
    function getTitles() { return _db.titles; }
    function getTags() { return _db.tags; }

    /** Compatibilidad con código legacy que usaba getDB() como array */
    function setDB(d) {
        if (Array.isArray(d)) {
            _db = { titles: d, tags: _db.tags || [] };
        } else {
            _db = d;
        }
    }

    // ── Rutas de attachments ──────────────────────────────────
    function getAttachmentsDir() { return ATT_DIR; }
    function getDocDir() { return DIR_NAME; }

    // ── Export / Import ───────────────────────────────────────
    function exportJSON() {
        const date = new Date().toISOString().split('T')[0];
        const json = JSON.stringify(_db, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dev-snippets-${date}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    function importJSON(file, onSuccess, onError) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const parsed = JSON.parse(e.target.result);
                saveStateForUndo();
                const rootObj = _migrateRootFormat(parsed);
                const { titles } = _migrateTitles(rootObj.titles || []);
                rootObj.titles = titles;
                if (!Array.isArray(rootObj.tags)) rootObj.tags = [];
                _db = rootObj;
                save(true, false, true);
                if (onSuccess) onSuccess();
            } catch (err) {
                if (onError) onError(err);
            }
        };
        reader.readAsText(file);
    }

    // ── Migración legacy (snippetsDBUltra) ────────────────────
    async function migrateFromLegacy() {
        const MIGRATED_KEY = 'devSnippets_migrated';
        const LEGACY_KEY = 'snippetsDBUltra';
        if (localStorage.getItem(MIGRATED_KEY)) return;
        const legacyRaw = localStorage.getItem(LEGACY_KEY);
        if (!legacyRaw) { localStorage.setItem(MIGRATED_KEY, '1'); return; }
        if (_db.titles.length > 0) { localStorage.setItem(MIGRATED_KEY, '1'); return; }
        try {
            const legacyData = JSON.parse(legacyRaw);
            if (Array.isArray(legacyData) && legacyData.length > 0) {
                _db.titles = legacyData;
                await _persist();
                console.debug('[Storage] Datos migrados desde snippetsDBUltra ✓');
            }
        } catch (e) {
            console.warn('[Storage] No se pudo migrar datos legacy:', e);
        }
        localStorage.setItem(MIGRATED_KEY, '1');
    }

    // ── CRUD Helpers — Técnico ────────────────────────────────
    function getTitle(tIdx) { return _db.titles[tIdx]; }
    function getCat(tIdx, cIdx) { return _db.titles[tIdx].categories[cIdx]; }
    function getSub(tIdx, cIdx, sIdx) { return _db.titles[tIdx].categories[cIdx].subtitles[sIdx]; }
    function getSnip(tIdx, cIdx, sIdx, snIdx) {
        return _db.titles[tIdx].categories[cIdx].subtitles[sIdx].snippets[snIdx];
    }
    function getMainSubtitles(tIdx, cIdx) {
        return _db.titles[tIdx].categories[cIdx].subtitles.filter(s => s.isMain);
    }
    function findSubtitleAndCategory(subId) {
        for (let t of _db.titles) {
            if (t.type !== 'technical') continue;
            for (let c of t.categories) {
                for (let s of c.subtitles) {
                    if (s.id === subId) return { cat: c, sub: s };
                }
            }
        }
        return null;
    }
    function getAllCategoriesWithMainSubs(excludeSubId = null) {
        const result = [];
        _db.titles.forEach(t => {
            if (t.type !== 'technical') return;
            t.categories.forEach(c => {
                const mainSubs = c.subtitles.filter(s => s.isMain && s.id !== excludeSubId);
                if (mainSubs.length > 0) result.push({ cat: c, mainSubs });
            });
        });
        return result;
    }

    // ── CRUD Helpers — Media ──────────────────────────────────
    function getCollection(tIdx, colIdx) { return _db.titles[tIdx].collections[colIdx]; }
    function getCard(tIdx, colIdx, cardIdx) { return _db.titles[tIdx].collections[colIdx].cards[cardIdx]; }

    // ── CRUD Helpers — Tags ───────────────────────────────────
    function findTagById(id) { return _db.tags.find(t => t.id === id) || null; }

    // ── Find by ID helpers (return item + indices)
    function findTitleById(id) {
        for (let tIdx = 0; tIdx < _db.titles.length; tIdx++) {
            const t = _db.titles[tIdx];
            if (t.id === id) return { item: t, tIdx };
        }
        return null;
    }

    function findCategoryById(id) {
        for (let tIdx = 0; tIdx < _db.titles.length; tIdx++) {
            const t = _db.titles[tIdx];
            if (!t.categories) continue;
            for (let cIdx = 0; cIdx < t.categories.length; cIdx++) {
                const c = t.categories[cIdx];
                if (c.id === id) return { item: c, tIdx, cIdx };
            }
        }
        return null;
    }

    function findSubtitleById(id) {
        for (let tIdx = 0; tIdx < _db.titles.length; tIdx++) {
            const t = _db.titles[tIdx];
            if (t.type !== 'technical' || !t.categories) continue;
            for (let cIdx = 0; cIdx < t.categories.length; cIdx++) {
                const c = t.categories[cIdx];
                if (!c.subtitles) continue;
                for (let sIdx = 0; sIdx < c.subtitles.length; sIdx++) {
                    const s = c.subtitles[sIdx];
                    if (s.id === id) return { item: s, tIdx, cIdx, sIdx };
                }
            }
        }
        return null;
    }

    function findSnippetById(id) {
        for (let tIdx = 0; tIdx < _db.titles.length; tIdx++) {
            const t = _db.titles[tIdx];
            if (t.type !== 'technical' || !t.categories) continue;
            for (let cIdx = 0; cIdx < t.categories.length; cIdx++) {
                const c = t.categories[cIdx];
                if (!c.subtitles) continue;
                for (let sIdx = 0; sIdx < c.subtitles.length; sIdx++) {
                    const s = c.subtitles[sIdx];
                    if (!s.snippets) continue;
                    for (let snIdx = 0; snIdx < s.snippets.length; snIdx++) {
                        const sn = s.snippets[snIdx];
                        if (sn.id === id) return { item: sn, tIdx, cIdx, sIdx, snIdx };
                    }
                }
            }
        }
        return null;
    }

    function findCollectionById(id) {
        for (let tIdx = 0; tIdx < _db.titles.length; tIdx++) {
            const t = _db.titles[tIdx];
            if (t.type !== 'media' || !t.collections) continue;
            for (let colIdx = 0; colIdx < t.collections.length; colIdx++) {
                const col = t.collections[colIdx];
                if (col.id === id) return { item: col, tIdx, colIdx };
            }
        }
        return null;
    }

    function findCardById(id) {
        for (let tIdx = 0; tIdx < _db.titles.length; tIdx++) {
            const t = _db.titles[tIdx];
            if (t.type !== 'media' || !t.collections) continue;
            for (let colIdx = 0; colIdx < t.collections.length; colIdx++) {
                const col = t.collections[colIdx];
                if (!col.cards) continue;
                for (let cardIdx = 0; cardIdx < col.cards.length; cardIdx++) {
                    const card = col.cards[cardIdx];
                    if (card.id === id) return { item: card, tIdx, colIdx, cardIdx };
                }
            }
        }
        return null;
    }

    // ── Wrappers using IDs (safe for dynamic UIs)
    function editSnippetById(id, newData) {
        const found = findSnippetById(id);
        if (!found) return false;
        saveStateForUndo();
        console.debug('[Storage] editSnippetById', id, newData);
        Object.assign(found.item, newData);
        console.debug('[Storage] snippet before save:', JSON.parse(JSON.stringify(found.item)));
        const refreshGallery = ('coverImage' in newData || 'title' in newData || 'description' in newData);
        save(true, false, refreshGallery);
        console.debug('[Storage] snippet after save (in-memory):', JSON.parse(JSON.stringify(found.item)));
        return true;
    }

    function deleteSnippetById(id) {
        const found = findSnippetById(id);
        if (!found) return false;
        const { tIdx, cIdx, sIdx, snIdx } = found;
        saveStateForUndo();
        try { if (typeof Drafts !== 'undefined' && Drafts.discard) Drafts.discard(id); } catch (e) { }
        _db.titles[tIdx].categories[cIdx].subtitles[sIdx].snippets.splice(snIdx, 1);
        save(true, false, true);
        return true;
    }

    function toggleFavById(id, value) {
        const found = findSnippetById(id);
        if (!found) return false;
        saveStateForUndo();
        if (typeof value === 'boolean') found.item.fav = value;
        else found.item.fav = !found.item.fav;
        save(true);
        return true;
    }

    function editCardById(id, newData) {
        const found = findCardById(id);
        if (!found) return false;
        saveStateForUndo();
        Object.assign(found.item, newData);
        save(true);
        return true;
    }

    function deleteCardById(id) {
        const found = findCardById(id);
        if (!found) return false;
        const { tIdx, colIdx, cardIdx } = found;
        saveStateForUndo();
        _db.titles[tIdx].collections[colIdx].cards.splice(cardIdx, 1);
        save(true);
        return true;
    }

    function toggleCardFavById(id, value) {
        const found = findCardById(id);
        if (!found) return false;
        saveStateForUndo();
        if (typeof value === 'boolean') found.item.fav = value;
        else found.item.fav = !found.item.fav;
        save(true);
        return true;
    }

    // ── ID-based wrappers for titles/categories/subtitles
    function editCategoryById(id, newData) {
        const found = findCategoryById(id);
        if (!found) return false;
        saveStateForUndo();
        Object.assign(found.item, newData);
        save(true);
        return true;
    }

    function deleteCategoryById(id) {
        const found = findCategoryById(id);
        if (!found) return false;
        const { tIdx, cIdx } = found;
        saveStateForUndo();
        _db.titles[tIdx].categories.splice(cIdx, 1);
        save(true, false, true);
        return true;
    }

    function editSubtitleById(id, newData) {
        const found = findSubtitleById(id);
        if (!found) return false;
        saveStateForUndo();
        Object.assign(found.item, newData);
        save(true);
        return true;
    }

    function deleteSubtitleById(id) {
        const found = findSubtitleById(id);
        if (!found) return false;
        const { tIdx, cIdx, sIdx } = found;
        saveStateForUndo();
        _db.titles[tIdx].categories[cIdx].subtitles.splice(sIdx, 1);
        save(true, false, true);
        return true;
    }

    function editTitleById(id, newData) {
        const found = findTitleById(id);
        if (!found) return false;
        saveStateForUndo();
        Object.assign(found.item, newData);
        save(true);
        return true;
    }

    function deleteTitleById(id) {
        const found = findTitleById(id);
        if (!found) return false;
        const { tIdx } = found;
        saveStateForUndo();
        _db.titles.splice(tIdx, 1);
        save(true, false, true);
        return true;
    }

    // ── Attachment cleanup helpers ──────────────────────────
    function _collectAttachmentRefsFromObj(obj, set) {
        if (!obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) {
            obj.forEach(i => _collectAttachmentRefsFromObj(i, set));
            return;
        }
        for (const k of Object.keys(obj)) {
            const v = obj[k];
            if (typeof v === 'string' && v.replace(/\\/g, '/').includes('attachments/')) {
                const normalized = v.replace(/\\/g, '/');
                const idx = normalized.indexOf('attachments/');
                const ref = normalized.slice(idx);
                if (ref) {
                    set.add(ref);
                    // Proteger también el thumbnail asociado
                    const lastSlash = ref.lastIndexOf('/');
                    const lastDot = ref.lastIndexOf('.');
                    if (lastSlash >= 0 && lastDot > lastSlash) {
                        const dir = ref.substring(0, lastSlash);
                        const name = ref.substring(lastSlash + 1, lastDot);
                        set.add(`${dir}/thumb/${name}_thumb.jpg`);
                    }
                }
            } else if (typeof v === 'object' && v !== null) {
                _collectAttachmentRefsFromObj(v, set);
            }
        }
    }

    async function _listAttachmentFiles(fs, dir, baseRel = 'attachments') {
        const { readDir, BaseDirectory } = fs;
        const entries = await readDir(dir, { baseDir: BaseDirectory.Document });
        const files = [];
        for (const e of entries) {
            const name = e.name;
            if (!name) continue;
            const rel = `${baseRel}/${name}`;
            const path = `${dir}/${name}`;
            if (e.children || e.isDirectory) {
                try {
                    files.push(...await _listAttachmentFiles(fs, path, rel));
                } catch (err) {
                    console.warn('[Storage] Failed to scan attachment subdir', path, err);
                }
            } else {
                files.push({ rel, path });
            }
        }
        return files;
    }

    async function cleanupAttachments() {
        if (!_isTauri()) return; // Only operate in Tauri (filesystem available)
        try {
            const fs = _getFS();
            const { readDir, BaseDirectory } = fs;
            const used = new Set();
            // Collect all referenced attachment paths across DB
            _db.titles.forEach(t => _collectAttachmentRefsFromObj(t, used));

            const attDir = ATT_DIR; // already includes DevSnippets/attachments
            const files = await _listAttachmentFiles(fs, attDir);
            for (const file of files) {
                if (!used.has(file.rel)) {
                    try {
                        const targetPath = file.path;
                        const remover = fs.removeFile || fs.remove || fs.unlink;
                        if (typeof remover === 'function') {
                            await remover(targetPath, { baseDir: BaseDirectory.Document });
                        } else if (window.__TAURI__ && window.__TAURI__.tauri && window.__TAURI__.tauri.invoke) {
                            await window.__TAURI__.tauri.invoke('plugin:fs|remove_file', { path: targetPath, baseDir: BaseDirectory.Document });
                        } else {
                            throw new Error('No fs remove function available');
                        }
                        console.debug('[Storage] Removed orphan attachment:', file.rel);
                    } catch (remErr) {
                        console.warn('[Storage] Failed to remove attachment', file.rel, remErr);
                    }
                }
            }
        } catch (err) {
            console.warn('[Storage] cleanupAttachments error:', err);
        }
    }

    return {
        generateId, load, save, saveStateForUndo, migrateFromLegacy,
        undo, redo, canUndo, canRedo,
        getDB, setDB, getTitles, getTags,
        getAttachmentsDir, getDocDir,
        exportJSON, importJSON,
        // Técnico
        getTitle, getCat, getSub, getSnip, getMainSubtitles,
        findSubtitleAndCategory, getAllCategoriesWithMainSubs,
        // Media
        getCollection, getCard,
        // Tags
        findTagById,
        // Find by ID helpers
        findTitleById, findCategoryById, findSubtitleById, findSnippetById,
        findCollectionById, findCardById,
        // ID-based action wrappers
        editSnippetById, deleteSnippetById, toggleFavById,
        editCardById, deleteCardById, toggleCardFavById,
        // Titles / Categories / Subtitles
        editCategoryById, deleteCategoryById,
        editSubtitleById, deleteSubtitleById,
        editTitleById, deleteTitleById,
        // Attachment maintenance
        cleanupAttachments,
    };
})();
