/**
 * gallery-tech.js — Galería mínima para imágenes de snippets técnicos.
 *
 * Ciclo de vida:
 *   GalleryTech.init()     — llamar UNA vez al arrancar la app (pre-carga el índice).
 *   GalleryTech.refresh()  — llamar tras cualquier CRUD que afecte imágenes de portada.
 *   GalleryTech.open()     — abre el modal leyendo el caché ya calculado (instantáneo).
 */

const GalleryTech = (() => {
    let _items = [];
    let _index = 0;
    let _root = null;
    let _dirty = true;
    let _rafId = null;
    let _observer = null;

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
                        
                        const thumbUrl = typeof Attachments !== 'undefined' && Attachments.getThumbnailUrl
                            ? Attachments.getThumbnailUrl(snip.coverImage)
                            : url;

                        out.push({
                            url,
                            thumbUrl,
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
        if (typeof lucide !== 'undefined') lucide.createIcons({ node: _root });
        return _root;
    }

    function _initObserver() {
        if (_observer) _observer.disconnect();
        const grid = _root.querySelector('.tech-gallery-grid');
        _observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.onerror = function() {
                            this.onerror = null;
                            if (this.dataset.originalUrl) {
                                this.src = this.dataset.originalUrl;
                            }
                        };
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        _observer.unobserve(img);
                    }
                }
            });
        }, {
            root: grid,
            rootMargin: '250px',
            threshold: 0
        });
    }

    function _renderGrid() {
        if (!_dirty) return;
        if (_rafId) {
            cancelAnimationFrame(_rafId);
            _rafId = null;
        }

        const root = _ensureRoot();
        const countEl = root.querySelector('.tech-gallery-count');
        const grid = root.querySelector('.tech-gallery-grid');
        countEl.textContent = `${_items.length} imagen${_items.length === 1 ? '' : 'es'}`;
        grid.innerHTML = '';
        
        _initObserver();

        if (!_items.length) {
            grid.innerHTML = `
                <div class="tech-gallery-empty">
                    ${_icon('image-off', 34)}
                    <p>No hay imágenes técnicas guardadas.</p>
                </div>
            `;
            _dirty = false;
            return;
        }

        let i = 0;
        const BATCH_SIZE = 20;

        function renderBatch() {
            const fragment = document.createDocumentFragment();
            const end = Math.min(i + BATCH_SIZE, _items.length);

            for (; i < end; i++) {
                const item = _items[i];
                const idx = i;

                const btn = document.createElement('div');
                btn.className = 'tech-gallery-thumb';
                btn.role = 'button';
                btn.tabIndex = 0;
                btn.title = item.title;

                const img = document.createElement('img');
                img.alt = _escape(item.title);
                img.dataset.src = item.thumbUrl || item.url;
                img.dataset.originalUrl = item.url;

                const label = document.createElement('span');
                label.textContent = item.title;

                btn.appendChild(img);
                btn.appendChild(label);
                btn.addEventListener('click', () => openPreview(idx));
                fragment.appendChild(btn);
                
                _observer.observe(img);
            }

            grid.appendChild(fragment);

            if (i < _items.length) {
                _rafId = requestAnimationFrame(renderBatch);
            } else {
                _dirty = false;
                _rafId = null;
            }
        }

        _rafId = requestAnimationFrame(renderBatch);
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

    /**
     * Pre-carga el índice de imágenes en memoria.
     * Debe llamarse una sola vez cuando la app termina de inicializar Storage.
     */
    function init() {
        _items = _collectItems();
        _dirty = true;
    }

    /**
     * Re-indexa el caché tras una operación CRUD (crear/editar/borrar snippet).
     * Si la galería está abierta, actualiza la cuadrícula en tiempo real.
     */
    function refresh() {
        _items = _collectItems();
        _dirty = true;
        if (_root && _root.classList.contains('show')) {
            _renderGrid();
            if (typeof lucide !== 'undefined') lucide.createIcons({ node: _root });
        }
    }

    /**
     * Abre el modal leyendo el caché pre-cargado por init() / refresh().
     * Si por alguna razón el caché está vacío (p. ej. init() no se llamó aún),
     * lo recopila de forma diferida como fallback seguro.
     */
    function open() {
        if (!_items.length) {
            _items = _collectItems();
            _dirty = true;
        }
        _index = 0;
        const root = _ensureRoot();
        _renderGrid();
        closePreview();
        root.classList.add('show');
        document.addEventListener('keydown', _onKeydown);
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

    return { init, refresh, open, close, openPreview, closePreview, next, prev };
})();
