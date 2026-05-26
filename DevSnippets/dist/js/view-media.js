/**
 * view-media.js — Modal de Solo Lectura para Fichas Media
 * DevSnippets | Sistema Multi-Estructura
 */

const ViewMedia = (() => {
    let _modal = null;
    let _backdrop = null;

    function _initHTML() {
        if (document.getElementById('media-view-modal')) return;

        // Backdrop
        _backdrop = document.createElement('div');
        _backdrop.id = 'media-view-backdrop';
        _backdrop.className = 'media-view-backdrop';
        _backdrop.style.position = 'fixed';
        _backdrop.style.top = '0';
        _backdrop.style.left = '0';
        _backdrop.style.right = '0';
        _backdrop.style.bottom = '0';
        _backdrop.style.background = 'rgba(0,0,0,0.6)';
        _backdrop.style.backdropFilter = 'blur(4px)';
        _backdrop.style.zIndex = '9000';
        _backdrop.style.opacity = '0';
        _backdrop.style.pointerEvents = 'none';
        _backdrop.style.transition = 'opacity 0.25s ease';
        document.body.appendChild(_backdrop);

        // Modal
        _modal = document.createElement('div');
        _modal.id = 'media-view-modal';
        _modal.className = 'media-view-modal';
        document.body.appendChild(_modal);

        // Eventos de cierre
        _backdrop.addEventListener('click', closeCard);
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && _modal.classList.contains('show')) {
                closeCard();
            }
        });
    }

    function _escape(t = '') {
        return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function _icon(name, size = 16) {
        return `<svg data-lucide="${name}" width="${size}" height="${size}"></svg>`;
    }

    function openCard(tIdx, colIdx, cardIdx) {
        _initHTML();
        // restore default modal layout in case a lightbox left inline styles
        _modal.classList.remove('lightbox');
        _modal.removeAttribute('style');
        const cardObj = Storage.getTitles()[tIdx].collections[colIdx].cards[cardIdx];
        if (!cardObj) return;

        // Construir HTML interno
        const imgUrl = Attachments.getDisplayUrl(cardObj.coverImage);
        const coverHTML = imgUrl
            ? `<img src="${imgUrl}" class="mview-cover" alt="Portada">`
            : `<div class="mview-placeholder">${_icon('image', 48)}</div>`;

        const tagsHTML = Tags.renderBadges(cardObj.tags || []);

        // Información dinámica según mediaSubtype
        let subtypeInfo = '';
        if (cardObj.mediaSubtype === 'episodic') {
            if (cardObj.seasons) subtypeInfo += `<div class="mview-kv"><span class="mview-k">Temporadas</span><span class="mview-v">${cardObj.seasons}</span></div>`;
            if (cardObj.chapters) subtypeInfo += `<div class="mview-kv"><span class="mview-k">Capítulos</span><span class="mview-v">${cardObj.chapters}</span></div>`;
            if (cardObj.studio) subtypeInfo += `<div class="mview-kv"><span class="mview-k">Estudio/Autor</span><span class="mview-v">${_escape(cardObj.studio)}</span></div>`;
        } else if (cardObj.mediaSubtype === 'game') {
            if (cardObj.platform) subtypeInfo += `<div class="mview-kv"><span class="mview-k">Plataforma</span><span class="mview-v">${_escape(cardObj.platform)}</span></div>`;
            if (cardObj.playtime) subtypeInfo += `<div class="mview-kv"><span class="mview-k">Horas Jugadas</span><span class="mview-v">${_escape(cardObj.playtime)}</span></div>`;
            if (cardObj.progress) subtypeInfo += `<div class="mview-kv"><span class="mview-k">Progreso</span><span class="mview-v">${_escape(cardObj.progress)}</span></div>`;
            if (cardObj.studio) subtypeInfo += `<div class="mview-kv"><span class="mview-k">Desarrollador</span><span class="mview-v">${_escape(cardObj.studio)}</span></div>`;
        } else {
            if (cardObj.studio) subtypeInfo += `<div class="mview-kv"><span class="mview-k">Autor/Estudio</span><span class="mview-v">${_escape(cardObj.studio)}</span></div>`;
        }

        if (cardObj.year) subtypeInfo += `<div class="mview-kv"><span class="mview-k">Año</span><span class="mview-v">${cardObj.year}</span></div>`;

        // Campos personalizados
        let customHTML = '';
        if (cardObj.customFields && cardObj.customFields.length > 0) {
            customHTML = cardObj.customFields.map(f => `
                <div class="mview-kv">
                    <span class="mview-k">${_escape(f.key)}</span>
                    <span class="mview-v">${_escape(f.value)}</span>
                </div>
            `).join('');
        }

        const detailsGridHTML = (subtypeInfo || customHTML) 
            ? `<div class="mview-section"><h4 class="mview-section-title">Detalles</h4><div class="mview-grid">${subtypeInfo}${customHTML}</div></div>`
            : '';

        // Links
        let linksHTML = '';
        if (cardObj.links && cardObj.links.length > 0) {
            linksHTML = `
                <div class="mview-section">
                    <h4 class="mview-section-title">Enlaces</h4>
                    <div class="mview-links">
                        ${cardObj.links.map(l => `<a href="${_escape(l.url)}" target="_blank" class="mview-link">${_icon('external-link', 14)} ${_escape(l.label)}</a>`).join('')}
                    </div>
                </div>
            `;
        }

        _modal.innerHTML = `
            <div class="mview-left">
                ${coverHTML}
                <button class="btn-icon mview-close-btn" onclick="ViewMedia.closeCard()" title="Cerrar (Esc)">
                    ${_icon('x', 20)}
                </button>
            </div>
            <div class="mview-right">
                <div class="mview-header">
                    <h2 class="mview-title">${_escape(cardObj.title || '(Sin título)')}</h2>
                    ${cardObj.altTitle ? `<p class="mview-alt">${_escape(cardObj.altTitle)}</p>` : ''}
                    <div class="mview-meta-row">
                        <span class="mview-meta-item">${_icon('activity', 14)} ${cardObj.status}</span>
                        ${cardObj.mediaSubtype ? `<span class="mview-meta-item">${_icon('box', 14)} ${Schema.MEDIA_SUBTYPES[cardObj.mediaSubtype]?.label || cardObj.mediaSubtype}</span>` : ''}
                    </div>
                    ${tagsHTML ? `<div class="mview-tags">${tagsHTML}</div>` : ''}
                </div>

                ${cardObj.synopsis ? `<div class="mview-section"><h4 class="mview-section-title">Sinopsis</h4><p class="mview-synopsis">${_escape(cardObj.synopsis)}</p></div>` : ''}
                
                ${detailsGridHTML}
                ${linksHTML}

                ${cardObj.notes ? `<div class="mview-section"><h4 class="mview-section-title">Notas</h4><div class="mview-notes">${_escape(cardObj.notes)}</div></div>` : ''}
            </div>
        `;

        if (typeof lucide !== 'undefined') lucide.createIcons({ node: _modal });

        // Show
        _backdrop.style.opacity = '1';
        _backdrop.style.pointerEvents = 'auto';
        _modal.classList.add('show');
    }

    // Abrir imagen suelta por URL (thumbnail -> preview) — lightbox simple
    function openImage(url, title) {
        if (!url) return;
        _initHTML();

        // Use a lightbox class to avoid clobbering media-view styles
        _modal.classList.add('lightbox');
        _modal.innerHTML = '';

        const wrapper = document.createElement('div');
        wrapper.className = 'lightbox-wrapper';
        wrapper.style.position = 'relative';
        wrapper.style.display = 'inline-block';
        wrapper.style.background = 'transparent';

        const img = document.createElement('img');
        img.src = url;
        img.alt = title || 'Imagen';
        img.className = 'lightbox-img';
        img.style.maxWidth = '90vw';
        img.style.maxHeight = '90vh';
        img.style.width = 'auto';
        img.style.height = 'auto';
        img.style.display = 'block';
        img.style.borderRadius = '6px';
        img.style.boxShadow = '0 8px 30px rgba(0,0,0,0.6)';

        wrapper.appendChild(img);

        if (title) {
            const titleOverlay = document.createElement('div');
            titleOverlay.className = 'lightbox-title';
            titleOverlay.textContent = title;
            titleOverlay.style.position = 'absolute';
            titleOverlay.style.left = '12px';
            titleOverlay.style.bottom = '12px';
            titleOverlay.style.background = 'rgba(0,0,0,0.45)';
            titleOverlay.style.color = '#fff';
            titleOverlay.style.padding = '6px 10px';
            titleOverlay.style.borderRadius = '6px';
            titleOverlay.style.fontSize = '0.9em';
            titleOverlay.style.pointerEvents = 'none';
            wrapper.appendChild(titleOverlay);
        }

        const closeBtn = document.createElement('button');
        closeBtn.className = 'btn-icon lightbox-close';
        closeBtn.title = 'Cerrar (Esc)';
        closeBtn.innerHTML = _icon('x', 16);
        closeBtn.style.position = 'absolute';
        closeBtn.style.top = '8px';
        closeBtn.style.right = '8px';
        closeBtn.style.zIndex = '10001';
        closeBtn.style.background = 'rgba(0,0,0,0.45)';
        closeBtn.style.color = '#fff';
        closeBtn.style.border = 'none';
        closeBtn.style.padding = '6px';
        closeBtn.style.borderRadius = '50%';
        closeBtn.style.cursor = 'pointer';
        closeBtn.onclick = closeCard;
        wrapper.appendChild(closeBtn);

        _modal.appendChild(wrapper);

        if (typeof lucide !== 'undefined') lucide.createIcons({ node: _modal });

        // Show
        _backdrop.style.opacity = '1';
        _backdrop.style.pointerEvents = 'auto';
        _modal.classList.add('show');
    }

    function closeCard() {
        if (_backdrop) {
            _backdrop.style.opacity = '0';
            _backdrop.style.pointerEvents = 'none';
        }
        if (_modal) {
            _modal.classList.remove('show');
            // remove lightbox flag and inline styles to restore media modal behavior
            _modal.classList.remove('lightbox');
            setTimeout(() => {
                if (!_modal.classList.contains('show')) {
                    _modal.innerHTML = '';
                    _modal.removeAttribute('style');
                }
            }, 250);
        }
    }

    return {
        openCard,
        closeCard,
        openImage
    };
})();
