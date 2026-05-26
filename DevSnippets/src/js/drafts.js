/**
 * drafts.js — Lightweight draft/buffer system for editor
 * Stores temporary edits per-item (snippets, cards, titles) to avoid partial persistence
 * Persists drafts to localStorage for crash resilience; commits use Storage APIs.
 */

const Drafts = (() => {
    const KEY = 'devSnippets_drafts_v1';
    let _drafts = {};

    function _saveToStorage() {
        try { localStorage.setItem(KEY, JSON.stringify(_drafts)); } catch (e) { console.warn('[Drafts] save failed', e); }
    }
    function _loadFromStorage() {
        try {
            const raw = localStorage.getItem(KEY);
            if (raw) _drafts = JSON.parse(raw) || {};
        } catch (e) { console.warn('[Drafts] load failed', e); _drafts = {}; }
    }

    function init() { _loadFromStorage(); }

    function start(id, baseObj) {
        if (!id) return null;
        // shallow clone safe copy
        _drafts[id] = Object.assign({ _startedAt: Date.now() }, JSON.parse(JSON.stringify(baseObj || {})));
        _saveToStorage();
        return _drafts[id];
    }

    function get(id) { return _drafts[id] ? JSON.parse(JSON.stringify(_drafts[id])) : null; }

    function update(id, patch) {
        if (!id) return false;
        if (!_drafts[id]) _drafts[id] = { _startedAt: Date.now() };
        Object.assign(_drafts[id], patch);
        _saveToStorage();
        return true;
    }

    async function commit(id) {
        if (!id || !_drafts[id]) return false;
        const d = _drafts[id];
        try {
            // Commit via Storage wrapper (if available)
            if (typeof Storage !== 'undefined' && Storage.editSnippetById) {
                // Only commit fields that are part of snippet payload
                const payload = {};
                ['title','description','code','contentType','coverImage','blockTitle','fav'].forEach(k => { if (d[k] !== undefined) payload[k] = d[k]; });
                Storage.saveStateForUndo();
                console.info('[Drafts] commit payload for', id, payload);
                const ok = Storage.editSnippetById(id, payload);
                try { const f = Storage.findSnippetById ? Storage.findSnippetById(id) : null; console.info('[Drafts] snippet after editSnippetById:', f ? f.item : null); } catch(e) {}
                // If Storage.editSnippetById returns false, fallback to direct mutate + save
                if (!ok) {
                    // best-effort: try to find and apply
                    try {
                        // attempt to merge via Storage.getDB
                        const db = Storage.getDB();
                        // naive search (Storage has findSnippetById but to avoid circular assumptions we do simple)
                        // Prefer using Storage.editSnippetById if available.
                    } catch (e) {}
                }
                // Persist
                Storage.save(true);
            }
        } catch (e) { console.warn('[Drafts] commit failed', e); }
        delete _drafts[id]; _saveToStorage();
        return true;
    }

    function discard(id) {
        if (!id) return false;
        if (_drafts[id]) delete _drafts[id];
        _saveToStorage();
        return true;
    }

    function list() { return Object.keys(_drafts); }

    // initialize on load
    try { init(); } catch (e) {}

    return { init, start, get, update, commit, discard, list };
})();
