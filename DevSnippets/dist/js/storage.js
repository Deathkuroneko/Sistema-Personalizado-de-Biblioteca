/**
 * storage.js — Capa de persistencia y gestión de datos
 * DevSnippets | Gestor de Conocimiento Técnico
 *
 * TODO (Tauri): Reemplazar las funciones load() y save() por llamadas
 * a la API de Tauri para leer/escribir archivos reales en disco:
 *   import { readTextFile, writeTextFile } from '@tauri-apps/api/fs';
 */

const Storage = (() => {
    const DB_KEY    = 'devSnippets_db';
    const UNDO_LIMIT = 30;

    let _db         = [];
    let _undoStack  = [];
    let _redoStack  = [];

    // ── ID Generator ──────────────────────────────────────────
    function generateId() {
        return '_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
    }

    // ── Migración de datos desde versiones anteriores ─────────
    function _migrate(data) {
        let changed = false;
        data = data.map(titleObj => {
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

            // Asegurar IDs y campos requeridos en todos los niveles
            if (!titleObj.id) { titleObj.id = generateId(); changed = true; }
            if (!titleObj.categories) { titleObj.categories = []; changed = true; }

            titleObj.categories.forEach(cat => {
                if (!cat.id)       { cat.id = generateId(); changed = true; }
                if (!cat.color)    { cat.color = 'gray'; changed = true; }
                if (!cat.subtitles){ cat.subtitles = []; changed = true; }

                cat.subtitles.forEach(sub => {
                    if (!sub.id)      { sub.id = generateId(); changed = true; }
                    if (sub.isMain === undefined) { sub.isMain = true; changed = true; }
                    
                    // Migración de parentId a parentIds
                    if (sub.parentIds === undefined) {
                        sub.parentIds = sub.parentId ? [sub.parentId] : [];
                        delete sub.parentId;
                        changed = true;
                    }
                    if (!sub.snippets){ sub.snippets = []; changed = true; }

                    sub.snippets.forEach(snip => {
                        if (!snip.id)              { snip.id = generateId(); changed = true; }
                        if (snip.fav === undefined) { snip.fav = false; changed = true; }
                        if (!snip.description)      { snip.description = ''; changed = true; }
                    });
                });
            });

            return titleObj;
        });

        return { data, changed };
    }

    const FILE_NAME = 'snippets.json';
    const DIR_NAME = 'DevSnippets';

    // ── Tauri v2 Detection ───────────────────────────────────
    // Requiere "withGlobalTauri": true en tauri.conf.json > app
    // Esto inyecta window.__TAURI__ con todas las APIs del plugin.
    function _isTauri() {
        return !!(window.__TAURI__ && window.__TAURI__.fs);
    }

    function _getFS() {
        return window.__TAURI__.fs;
    }

    // ── Load ─────────────────────────────────────────────────
    async function load() {
        const isTauri = _isTauri();
        console.info('[Storage] load() — isTauri=' + isTauri, window.__TAURI__ ? '(window.__TAURI__ existe)' : '(window.__TAURI__ NO existe)');
        try {
            let raw = null;
            if (isTauri) {
                const { exists, readTextFile, mkdir, BaseDirectory } = _getFS();
                const filePath = `${DIR_NAME}/${FILE_NAME}`;
                try {
                    const dirExists = await exists(DIR_NAME, { baseDir: BaseDirectory.Document });
                    if (!dirExists) {
                        await mkdir(DIR_NAME, { baseDir: BaseDirectory.Document, recursive: true });
                        console.info('[Storage] Carpeta creada: Documentos/' + DIR_NAME);
                    }
                    const fileExists = await exists(filePath, { baseDir: BaseDirectory.Document });
                    if (fileExists) {
                        raw = await readTextFile(filePath, { baseDir: BaseDirectory.Document });
                        console.info('[Storage] Archivo leído OK, bytes:', raw?.length);
                    } else {
                        console.info('[Storage] Archivo no existe aún — se creará al primer save().');
                    }
                } catch (fsErr) {
                    console.error('[Storage] Error FS — fallback a localStorage:', fsErr);
                    raw = localStorage.getItem(DB_KEY);
                }
            } else {
                raw = localStorage.getItem(DB_KEY);
                console.info('[Storage] Usando localStorage, datos:', raw ? 'Sí (' + (raw?.length ?? 0) + ' bytes)' : 'Vacío');
            }

            const parsed = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(parsed)) throw new Error('Formato inválido');
            const { data, changed } = _migrate(parsed);
            _db = data;
            console.info('[Storage] DB lista. Títulos:', _db.length);
            if (changed) await _persist();
        } catch (e) {
            console.error('[Storage] Error cargando datos:', e);
            _db = [];
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
                console.info('[Storage] Guardado en disco OK — Documentos/' + DIR_NAME + '/' + FILE_NAME);
            } catch (e) {
                console.error('[Storage] Error al escribir en disco, fallback a localStorage:', e);
                localStorage.setItem(DB_KEY, json);
                throw e;
            }
        } else {
            localStorage.setItem(DB_KEY, json);
        }
    }

    async function save(reRender = true) {
        if (reRender && typeof Render !== 'undefined') Render.render();
        try {
            await _persist();
        } catch (e) {
            if (typeof App !== 'undefined') App.showToast('Error al guardar: ' + e.message, false);
        }
    }

    // ── Undo / Redo ───────────────────────────────────────────
    function saveStateForUndo() {
        _undoStack.push(JSON.stringify(_db));
        _redoStack = []; // Limpiar redo al hacer nueva acción
        if (_undoStack.length > UNDO_LIMIT) _undoStack.shift();
    }

    function undo() {
        if (_undoStack.length === 0) return false;
        _redoStack.push(JSON.stringify(_db));
        _db = JSON.parse(_undoStack.pop());
        save(true);
        return true;
    }

    function redo() {
        if (_redoStack.length === 0) return false;
        _undoStack.push(JSON.stringify(_db));
        _db = JSON.parse(_redoStack.pop());
        save(true);
        return true;
    }

    function canUndo() { return _undoStack.length > 0; }
    function canRedo() { return _redoStack.length > 0; }

    // ── Getters ───────────────────────────────────────────────
    function getDB()   { return _db; }
    function setDB(d)  { _db = d; }

    // ── Export / Import ───────────────────────────────────────
    function exportJSON() {
        const date = new Date().toISOString().split('T')[0];
        const json = JSON.stringify(_db, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
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
                if (!Array.isArray(parsed)) throw new Error('Formato inválido');
                saveStateForUndo();
                const { data } = _migrate(parsed);
                _db = data;
                save(true);
                if (onSuccess) onSuccess();
            } catch (err) {
                if (onError) onError(err);
            }
        };
        reader.readAsText(file);
    }

    // ── CRUD Helpers ──────────────────────────────────────────
    function getTitle(tIdx)                       { return _db[tIdx]; }
    function getCat(tIdx, cIdx)                   { return _db[tIdx].categories[cIdx]; }
    function getSub(tIdx, cIdx, sIdx)             { return _db[tIdx].categories[cIdx].subtitles[sIdx]; }
    function getSnip(tIdx, cIdx, sIdx, snIdx)     { return _db[tIdx].categories[cIdx].subtitles[sIdx].snippets[snIdx]; }

    function getMainSubtitles(tIdx, cIdx) {
        return _db[tIdx].categories[cIdx].subtitles.filter(s => s.isMain);
    }

    function findSubtitleAndCategory(subId) {
        for (let t of _db) {
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
        _db.forEach(t => {
            t.categories.forEach(c => {
                const mainSubs = c.subtitles.filter(s => s.isMain && s.id !== excludeSubId);
                if (mainSubs.length > 0) {
                    result.push({ cat: c, mainSubs });
                }
            });
        });
        return result;
    }

    return {
        generateId, load, save, saveStateForUndo,
        undo, redo, canUndo, canRedo,
        getDB, setDB,
        exportJSON, importJSON,
        getTitle, getCat, getSub, getSnip, getMainSubtitles,
        findSubtitleAndCategory, getAllCategoriesWithMainSubs,
    };
})();
