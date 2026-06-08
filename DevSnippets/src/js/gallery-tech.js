/**
 * gallery-tech.js — Galería mínima para imágenes de snippets técnicos.
 */

const GalleryTech = (() => {
    let _items = [];
    let _index = 0;
    let _root = null;

    function _escape(text = '') {
        return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function _icon(name, size = 16) {
        return `<svg data-lucide="${name}" width="${size}" height="${size}"></svg>`;
    }

    function _collectItems() {
        const out = [];
        const titles = typeof Storage !== 'undefined' && Storage.getTitles ? Storage.getTitles() : [];

        titles.forEach(title => {
            if (title.type === 'media') return;
            (title.categories || []).forEach(cat => {
                (cat.subtitles || []).forEach(sub => {
                    (sub.snippets || []).forEach(snip => {
                        if (!snip.coverImage) return;
                        const url = typeof Attachments !== 'undefined' && Attachments.getDisplayUrl
                            ? Attachments.getDisplayUrl(snip.coverImage)
                            : snip.coverImage;
                        if (!url) return;
                        out.push({
                            url,
                            title: snip.title || '(Sin título)',
                            description: snip.description || '',
                            path: snip.coverImage,
                        });
                    });
                });
            });
        });

        return out;
    }

    function _ensureRoot() {
        if (_root) return _root;

        _root = document.createElement('div');
        _root.className = 'tech-gallery';
        _root.innerHTML = `
            <div class="tech-gallery-backdrop" data-gallery-close="1"></div>
            <section class="tech-gallery-panel" role="dialog" aria-modal="true" aria-label="Galería técnica">
                <header class="tech-gallery-header">
                    <div>
                        <h3>Galería Tech</h3>
                        <span class="tech-gallery-count"></span>
                    </div>
                    <button class="btn-icon" type="button" title="Cerrar" onclick="GalleryTech.close()">${_icon('x', 18)}</button>
                </header>
                <div class="tech-gallery-grid"></div>
                <div class="tech-gallery-preview hidden">
                    <button class="btn-icon tech-gallery-close-preview" type="button" title="Cerrar preview" onclick="GalleryTech.closePreview()">${_icon('x', 18)}</button>
                    <button class="btn-icon tech-gallery-nav tech-gallery-prev" type="button" title="Anterior" onclick="GalleryTech.prev()">${_icon('chevron-left', 24)}</button>
                    <figure>
                        <img class="tech-gallery-preview-img" alt="">
                        <figcaption>
                            <strong class="tech-gallery-preview-title"></strong>
                            <span class="tech-gallery-preview-desc"></span>
                        </figcaption>
                    </figure>
                    <button class="btn-icon tech-gallery-nav tech-gallery-next" type="button" title="Siguiente" onclick="GalleryTech.next()">${_icon('chevron-right', 24)}</button>
                </div>
            </section>
        `;

        _root.addEventListener('click', event => {
            if (event.target && event.target.dataset && event.target.dataset.galleryClose) close();
        });
        document.body.appendChild(_root);
        return _root;
    }

    function _renderGrid() {
        const root = _ensureRoot();
        const countEl = root.querySelector('.tech-gallery-count');
        const grid = root.querySelector('.tech-gallery-grid');
        countEl.textContent = `${_items.length} imagen${_items.length === 1 ? '' : 'es'}`;
        grid.innerHTML = '';

        if (!_items.length) {
            grid.innerHTML = `
                <div class="tech-gallery-empty">
                    ${_icon('image-off', 34)}
                    <p>No hay imágenes técnicas guardadas.</p>
                </div>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons({ node: grid });
            return;
        }

        _items.forEach((item, idx) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'tech-gallery-thumb';
            btn.title = item.title;
            btn.innerHTML = `
                <img alt="${_escape(item.title)}">
                <span>${_escape(item.title)}</span>
            `;
            const imgEl = btn.querySelector('img');
            imgEl.src = item.url;
            imgEl.addEventListener('error', () => {
                // Remove stale thumbnail from grid and update count
                try {
                    btn.remove();
                    _items = _items.filter(it => it.path !== item.path);
                    const countEl = root.querySelector('.tech-gallery-count');
                    if (countEl) countEl.textContent = `${_items.length} imagen${_items.length === 1 ? '' : 'es'}`;
                    if (typeof App !== 'undefined') App.showToast('Imagen no encontrada, eliminada de la galería', false);
                } catch (e) {}
            });
            btn.addEventListener('click', () => openPreview(idx));
            grid.appendChild(btn);
        });
    }

    function _onKeydown(event) {
        if (!_root || !_root.classList.contains('show')) return;
        if (event.key === 'Escape') {
            if (!_root.querySelector('.tech-gallery-preview').classList.contains('hidden')) closePreview();
            else close();
        }
        if (event.key === 'ArrowLeft') prev();
        if (event.key === 'ArrowRight') next();
    }

    function open() {
        _items = _collectItems();
        _index = 0;
        const root = _ensureRoot();
        _renderGrid();
        closePreview();
        root.classList.add('show');
        document.addEventListener('keydown', _onKeydown);
        if (typeof lucide !== 'undefined') lucide.createIcons({ node: root });
    }

    function close() {
        if (!_root) return;
        _root.classList.remove('show');
        document.removeEventListener('keydown', _onKeydown);
    }

    function openPreview(index) {
        if (!_items.length) return;
        _index = (index + _items.length) % _items.length;
        const item = _items[_index];
        const preview = _root.querySelector('.tech-gallery-preview');
        const img = preview.querySelector('.tech-gallery-preview-img');
        preview.querySelector('.tech-gallery-preview-title').textContent = item.title;
        preview.querySelector('.tech-gallery-preview-desc').textContent = item.description;
        img.src = item.url;
        img.alt = item.title;
        preview.classList.remove('hidden');
    }

    function closePreview() {
        if (!_root) return;
        _root.querySelector('.tech-gallery-preview').classList.add('hidden');
    }

    function next() {
        if (!_items.length) return;
        openPreview(_index + 1);
    }

    function prev() {
        if (!_items.length) return;
        openPreview(_index - 1);
    }

    return { open, close, openPreview, closePreview, next, prev };
})();
