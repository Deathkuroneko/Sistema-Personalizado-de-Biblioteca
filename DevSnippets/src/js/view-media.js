/**
 * view-media.js — Modal de Solo Lectura para Fichas Media (src)
 */

const ViewMedia = (() => {
    let _modal = null;
    let _backdrop = null;

    function _initHTML() {
        if (document.getElementById('media-view-modal')) return;
        _backdrop = document.createElement('div');
        _backdrop.id = 'media-view-backdrop';
        _backdrop.className = 'media-view-backdrop';
        document.body.appendChild(_backdrop);
        _modal = document.createElement('div');
        _modal.id = 'media-view-modal';
        _modal.className = 'media-view-modal';
        document.body.appendChild(_modal);
        _backdrop.addEventListener('click', closeCard);
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && _modal.classList.contains('show')) closeCard(); });
    }

    function _escape(t = '') { return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    function _icon(name, size = 16) { return `<svg data-lucide="${name}" width="${size}" height="${size}"></svg>`; }

    function openCard(tIdx, colIdx, cardIdx) {
        _initHTML();
        // Ensure modal uses normal media viewer layout (clear any lightbox inline styles)
        _modal.classList.remove('lightbox');
        _modal.removeAttribute('style');
        const cardObj = Storage.getTitles()[tIdx].collections[colIdx].cards[cardIdx];
        if (!cardObj) return;
        const imgUrl = Attachments.getDisplayUrl(cardObj.coverImage);
        const coverHTML = imgUrl ? `<img src="${imgUrl}" class="mview-cover" alt="Portada">` : `<div class="mview-placeholder">${_icon('image',48)}</div>`;
        _modal.innerHTML = `<div class="mview-left">${coverHTML}<button class="btn-icon mview-close-btn" onclick="ViewMedia.closeCard()">${_icon('x',20)}</button></div><div class="mview-right"><div class="mview-header"><h2 class="mview-title">${_escape(cardObj.title||'(Sin título)')}</h2></div></div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons({ node: _modal });
        _backdrop.style.opacity = '1'; _backdrop.style.pointerEvents = 'auto'; _modal.classList.add('show');
    }

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

    return { openCard, closeCard, openImage };
})();