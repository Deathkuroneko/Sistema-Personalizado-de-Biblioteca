/**
 * editor-media.js — Editor de fichas Media (Drawer Lateral)
 * DevSnippets | Sistema Multi-Estructura
 *
 * Provee:
 *  - addCollection / editCollection → edición inline en el summary
 *  - addCard / editCard → abre el drawer lateral
 *
 * El drawer es un panel deslizable desde la derecha que contiene
 * el formulario completo de una ficha media.
 */

const EditorMedia = (() => {

    // ── Estado del drawer ─────────────────────────────────────
    let _drawerOpen   = false;
    let _currentCard  = null; // { tIdx, colIdx, cardIdx }

    function _icon(name, size = 14) {
        return `<svg data-lucide="${name}" width="${size}" height="${size}"></svg>`;
    }
    function _escape(t = '') {
        return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function _stopAndClose(e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        App.closeActiveDropdown();
    }

    // ══════════════════════════════════════════════════════════
    // COLECCIONES — edición inline
    // ══════════════════════════════════════════════════════════

    function addCollection(e, tIdx) {
        _stopAndClose(e);
        const titleObj = Storage.getTitles()[tIdx];
        const titleEl  = document.getElementById(`t_${titleObj.id}`);
        if (titleEl) titleEl.open = true;

        Storage.saveStateForUndo();
        const col = Schema.newCollection();
        titleObj.collections.unshift(col);
        Storage.save(true);

        setTimeout(() => {
            const summaryEl = document.querySelector(`#col_${col.id} > summary`);
            if (summaryEl) {
                App.expandParents(summaryEl);
                summaryEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                _startCollectionEdit(summaryEl, tIdx, 0, true);
            }
        }, 60);
    }

    function editCollection(e, tIdx, colIdx) {
        _stopAndClose(e);
        const col = Storage.getTitles()[tIdx].collections[colIdx];
        const summaryEl = document.querySelector(`#col_${col.id} > summary`);
        if (summaryEl) _startCollectionEdit(summaryEl, tIdx, colIdx, false);
    }

    function _startCollectionEdit(summaryEl, tIdx, colIdx, isNew) {
        const textEl = summaryEl.querySelector('.summary-text');
        if (!textEl || summaryEl.dataset.editing) return;
        summaryEl.dataset.editing = '1';

        const original = textEl.innerText.trim();
        textEl.style.display = 'none';

        const input = document.createElement('input');
        input.type        = 'text';
        input.className   = 'inline-input';
        input.value       = isNew ? '' : original;
        input.placeholder = 'Nombre de la colección…';
        textEl.parentNode.insertBefore(input, textEl);
        input.focus();

        const rollback = () => {
            if (!isNew) return;
            Storage.getTitles()[tIdx].collections.splice(colIdx, 1);
            Storage.save(true);
        };

        const save = () => {
            const val = input.value.trim();
            if (!val) { rollback(); return; }
            if (isNew || val !== original) {
                Storage.saveStateForUndo();
                Storage.getTitles()[tIdx].collections[colIdx].title = val;
                Storage.save(true);
            } else {
                cancel();
            }
        };

        const cancel = () => {
            delete summaryEl.dataset.editing;
            input.remove();
            textEl.style.display = '';
            if (isNew) rollback();
        };

        input.onkeydown = ev => {
            if (ev.key === 'Enter')  { ev.preventDefault(); input.onblur = null; save(); }
            if (ev.key === 'Escape') { input.onblur = null; cancel(); }
        };
        input.onblur = save;
    }

    // ══════════════════════════════════════════════════════════
    // FICHAS — Drawer Lateral
    // ══════════════════════════════════════════════════════════

    function addCard(e, tIdx, colIdx) {
        _stopAndClose(e);
        const col = Storage.getTitles()[tIdx].collections[colIdx];
        const colEl = document.getElementById(`col_${col.id}`);
        if (colEl) colEl.open = true;

        Storage.saveStateForUndo();
        const card = Schema.newCard();
        col.cards.unshift(card);
        Storage.save(true);

        // Abrir drawer y scroll para la nueva card
        setTimeout(() => {
            const cardEl = document.querySelector(`.media-card[data-id="${card.id}"]`);
            if (cardEl) {
                App.expandParents(cardEl);
                cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            _currentCard = { tIdx, colIdx, cardIdx: 0 };
            openDrawer(tIdx, colIdx, 0);
        }, 60);
    }

    function editCard(e, tIdx, colIdx, cardIdx) {
        if (e) _stopAndClose(e);
        _currentCard = { tIdx, colIdx, cardIdx };
        openDrawer(tIdx, colIdx, cardIdx);
    }

    // ── Abrir / Cerrar Drawer ─────────────────────────────────
    function openDrawer(tIdx, colIdx, cardIdx) {
        const drawer    = document.getElementById('media-drawer');
        const backdrop  = document.getElementById('media-drawer-backdrop');
        if (!drawer || !backdrop) return;

        _renderDrawerContent(tIdx, colIdx, cardIdx);

        drawer.classList.add('open');
        backdrop.classList.add('show');
        _drawerOpen = true;
        document.body.style.overflow = 'hidden';
    }

    function closeDrawer() {
        const drawer   = document.getElementById('media-drawer');
        const backdrop = document.getElementById('media-drawer-backdrop');
        if (drawer)   drawer.classList.remove('open');
        if (backdrop) backdrop.classList.remove('show');
        _drawerOpen = false;
        document.body.style.overflow = '';
        _currentCard = null;
    }

    // ── Contenido del Drawer ──────────────────────────────────
    function _renderDrawerContent(tIdx, colIdx, cardIdx) {
        const drawer = document.getElementById('media-drawer');
        const body   = document.getElementById('media-drawer-body');
        if (!body) return;

        const cardObj  = Storage.getTitles()[tIdx].collections[colIdx].cards[cardIdx];
        // Copia de trabajo — se guarda solo al hacer "Guardar"
        let workCard   = JSON.parse(JSON.stringify(cardObj));

        // ── Header del drawer ─────────────────────────────────
        const header = document.getElementById('media-drawer-title');
        if (header) header.textContent = workCard.title || 'Nueva Ficha';

        // ── Portada ───────────────────────────────────────────
        const imgUrl = Attachments.getDisplayUrl(workCard.coverImage);

        body.innerHTML = `
        <div class="drawer-cover-section" style="display: flex; flex-direction: column; align-items: center; gap: 8px; margin-bottom: 16px;">
            <div class="drawer-cover-wrap" id="drawer-cover-wrap">
                ${imgUrl
                    ? `<img id="drawer-cover-img" src="${imgUrl}" alt="Portada" class="drawer-cover-img">`
                    : `<div id="drawer-cover-placeholder" class="drawer-cover-placeholder">${_icon('image', 40)}</div>`
                }
                <button type="button" class="drawer-cover-btn" id="drawer-cover-btn" title="Cambiar portada">
                    ${_icon('camera', 16)} Portada
                </button>
            </div>
            <button type="button" class="btn-text danger-hover" id="drawer-cover-remove-btn" style="display: ${workCard.coverImage ? 'inline-flex' : 'none'}; align-items: center; gap: 4px; border: none; background: transparent; cursor: pointer; color: var(--text-subtle); padding: 4px 8px; font-size: 0.85em;">
                ${_icon('trash-2', 13)} Eliminar Portada
            </button>
        </div>

        <div class="drawer-fields">
            <!-- Campos predefinidos -->
            <div class="drawer-field-group">
                <label class="drawer-label">Título</label>
                <input type="text" id="df_title" class="inline-input-sm" value="${_escape(workCard.title)}" placeholder="Título principal">
            </div>
            <div class="drawer-field-group">
                <label class="drawer-label">Título Alternativo</label>
                <input type="text" id="df_altTitle" class="inline-input-sm" value="${_escape(workCard.altTitle)}" placeholder="化物語, Alternative Name…">
            </div>
            <div class="drawer-field-group">
                <label class="drawer-label">Sinopsis / Descripción</label>
                <textarea id="df_synopsis" class="inline-textarea" rows="3" placeholder="Sinopsis breve…">${_escape(workCard.synopsis)}</textarea>
            </div>

            <div class="drawer-row-2">
                <div class="drawer-field-group">
                    <label class="drawer-label">Subtipo de Media</label>
                    <select id="df_mediaSubtype" class="inline-select" style="width:100%">
                        ${Object.entries(Schema.MEDIA_SUBTYPES).map(([k, v]) =>
                            `<option value="${k}" ${workCard.mediaSubtype === k ? 'selected' : ''}>${v.label}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="drawer-field-group">
                    <label class="drawer-label">Estado</label>
                    <select id="df_status" class="inline-select" style="width:100%">
                        ${Schema.MEDIA_STATUSES.map(s =>
                            `<option value="${s}" ${workCard.status === s ? 'selected' : ''}>${s}</option>`
                        ).join('')}
                    </select>
                </div>
            </div>

            <div class="drawer-row-2">
                <div class="drawer-field-group" data-field="year">
                    <label class="drawer-label">Año</label>
                    <input type="number" id="df_year" class="inline-input-sm" value="${workCard.year || ''}" placeholder="2009" min="1900" max="2099">
                </div>
                <div class="drawer-field-group" data-field="studio">
                    <label class="drawer-label" id="lbl_studio">Estudio / Autor</label>
                    <input type="text" id="df_studio" class="inline-input-sm" value="${_escape(workCard.studio)}" placeholder="Studio Shaft, Nintendo…">
                </div>
            </div>

            <div class="drawer-row-2">
                <div class="drawer-field-group" data-field="seasons">
                    <label class="drawer-label">Temporadas</label>
                    <input type="number" id="df_seasons" class="inline-input-sm" value="${workCard.seasons || ''}" placeholder="1" min="1">
                </div>
                <div class="drawer-field-group" data-field="chapters">
                    <label class="drawer-label">Capítulos</label>
                    <input type="number" id="df_chapters" class="inline-input-sm" value="${workCard.chapters || ''}" placeholder="12" min="1">
                </div>
            </div>

            <div class="drawer-row-2">
                <div class="drawer-field-group" data-field="platform">
                    <label class="drawer-label">Plataforma</label>
                    <input type="text" id="df_platform" class="inline-input-sm" value="${_escape(workCard.platform)}" placeholder="PC, Switch, PS5…">
                </div>
                <div class="drawer-field-group" data-field="playtime">
                    <label class="drawer-label">Horas Jugadas</label>
                    <input type="text" id="df_playtime" class="inline-input-sm" value="${_escape(workCard.playtime)}" placeholder="40h, 120h…">
                </div>
            </div>

            <div class="drawer-row-2" data-field="progress-row">
                <div class="drawer-field-group" data-field="progress" style="width:100%">
                    <label class="drawer-label">Progreso</label>
                    <input type="text" id="df_progress" class="inline-input-sm" value="${_escape(workCard.progress)}" placeholder="Episodio 5, 80% completado…">
                </div>
            </div>

            <div class="drawer-field-group">
                <label class="drawer-label">Notas personales</label>
                <textarea id="df_notes" class="inline-textarea" rows="2" placeholder="Notas, opiniones…">${_escape(workCard.notes)}</textarea>
            </div>

            <!-- Links -->
            <div class="drawer-section">
                <div class="drawer-section-header">
                    <span>${_icon('link', 13)} Links</span>
                    <button type="button" class="btn-icon" id="btn-add-link" title="Añadir link">
                        ${_icon('plus', 13)}
                    </button>
                </div>
                <div id="links-container" class="links-container"></div>
            </div>

            <!-- Tags -->
            <div class="drawer-section">
                <div class="drawer-section-header">
                    <span>${_icon('tag', 13)} Tags</span>
                </div>
                <div id="tags-selector-container" class="tags-selector-container"></div>
            </div>

            <!-- Campos personalizados -->
            <div class="drawer-section">
                <div class="drawer-section-header">
                    <span>${_icon('sliders', 13)} Campos personalizados</span>
                    <button type="button" class="btn-icon" id="btn-add-field" title="Añadir campo">
                        ${_icon('plus', 13)}
                    </button>
                </div>
                <div id="custom-fields-container" class="custom-fields-container"></div>
            </div>
        </div>

        <!-- Acciones finales -->
        <div class="drawer-actions">
            <button type="button" id="drawer-save-btn" class="btn-primary">
                ${_icon('check', 15)} Guardar
            </button>
            <button type="button" id="drawer-cancel-btn" class="btn">
                ${_icon('x', 15)} Cancelar
            </button>
        </div>
        `;

        if (typeof lucide !== 'undefined') lucide.createIcons({ node: body });

        // ── Lógica de visibilidad de subtipos ──────────────────
        const _updateSubtypeFields = () => {
            const subtype = document.getElementById('df_mediaSubtype').value;
            const fieldsToShow = Schema.MEDIA_SUBTYPES[subtype]?.fields || [];

            // Cambiar label de studio
            const lblStudio = document.getElementById('lbl_studio');
            if (lblStudio) {
                if (subtype === 'game') {
                    lblStudio.textContent = 'Desarrollador';
                } else if (subtype === 'episodic') {
                    lblStudio.textContent = 'Estudio / Autor';
                } else {
                    lblStudio.textContent = 'Autor / Estudio';
                }
            }

            // Campos condicionales
            const condFields = ['studio', 'seasons', 'chapters', 'platform', 'playtime', 'progress'];
            condFields.forEach(f => {
                const container = document.querySelector(`.drawer-field-group[data-field="${f}"]`);
                if (container) {
                    const show = fieldsToShow.includes(f) || (f === 'studio' && subtype === 'general');
                    container.style.display = show ? '' : 'none';
                }
            });

            // Ocultar row del progreso si progress está oculto
            const progressRow = document.querySelector('.drawer-row-2[data-field="progress-row"]');
            if (progressRow) {
                const showProgress = fieldsToShow.includes('progress');
                progressRow.style.display = showProgress ? '' : 'none';
            }
        };

        const subtypeSelect = document.getElementById('df_mediaSubtype');
        subtypeSelect.addEventListener('change', _updateSubtypeFields);
        _updateSubtypeFields();

        // ── Portada: click para eliminar ──────────────────────
        const removeCoverBtn = document.getElementById('drawer-cover-remove-btn');
        removeCoverBtn.addEventListener('click', () => {
            workCard.coverImage = null;
            const wrap = document.getElementById('drawer-cover-wrap');
            let img = document.getElementById('drawer-cover-img');
            if (img) img.remove();
            let ph = document.getElementById('drawer-cover-placeholder');
            if (!ph) {
                ph = document.createElement('div');
                ph.id = 'drawer-cover-placeholder';
                ph.className = 'drawer-cover-placeholder';
                ph.innerHTML = _icon('image', 40);
                wrap.prepend(ph);
                if (typeof lucide !== 'undefined') lucide.createIcons({ node: ph });
            }
            removeCoverBtn.style.display = 'none';
        });

        // ── Portada: click para cambiar ───────────────────────
        document.getElementById('drawer-cover-btn').addEventListener('click', () => {
            Attachments.selectAndCopy(cardObj.id, 'media', ({ relativePath, displayUrl }) => {
                workCard.coverImage = relativePath;
                const wrap = document.getElementById('drawer-cover-wrap');
                // Actualizar preview
                let img = document.getElementById('drawer-cover-img');
                if (!img) {
                    img = document.createElement('img');
                    img.id = 'drawer-cover-img';
                    img.className = 'drawer-cover-img';
                    const ph = document.getElementById('drawer-cover-placeholder');
                    if (ph) ph.remove();
                    wrap.prepend(img);
                }
                img.src = displayUrl || relativePath;
                
                removeCoverBtn.style.display = 'inline-flex';

                // Actualizar header con título actual
                const titleInput = document.getElementById('df_title');
                if (titleInput) {
                    const h = document.getElementById('media-drawer-title');
                    if (h) h.textContent = titleInput.value || 'Ficha';
                }
            }, err => App.showToast('Error al cargar imagen: ' + err, false));
        });

        // ── Links ─────────────────────────────────────────────
        const linksContainer = document.getElementById('links-container');
        const renderLinks = () => {
            linksContainer.innerHTML = '';
            (workCard.links || []).forEach((link, idx) => {
                const row = document.createElement('div');
                row.className = 'link-row';
                row.innerHTML = `
                    <input type="text" class="inline-input-sm link-label" value="${_escape(link.label)}" placeholder="Etiqueta (MAL, Wiki…)">
                    <input type="url"  class="inline-input-sm link-url"   value="${_escape(link.url)}"   placeholder="https://…">
                    <button type="button" class="btn-icon danger-hover" title="Eliminar link">
                        ${_icon('trash-2', 13)}
                    </button>
                `;
                row.querySelector('.link-label').addEventListener('input', e => { link.label = e.target.value; });
                row.querySelector('.link-url').addEventListener('input',   e => { link.url   = e.target.value; });
                row.querySelector('.btn-icon').addEventListener('click',   () => {
                    workCard.links.splice(idx, 1);
                    renderLinks();
                });
                linksContainer.appendChild(row);
                if (typeof lucide !== 'undefined') lucide.createIcons({ node: row });
            });
        };
        renderLinks();

        document.getElementById('btn-add-link').addEventListener('click', () => {
            workCard.links.push(Schema.newLink());
            renderLinks();
        });

        // ── Tags ──────────────────────────────────────────────
        const tagsContainer = document.getElementById('tags-selector-container');
        Tags.renderSelector(tagsContainer, workCard.tags, newIds => {
            workCard.tags = newIds;
        });

        // ── Campos personalizados ─────────────────────────────
        const cfContainer = document.getElementById('custom-fields-container');
        const renderCF = () => {
            cfContainer.innerHTML = '';
            (workCard.customFields || []).forEach((cf, idx) => {
                const row = document.createElement('div');
                row.className = 'cf-row';
                row.innerHTML = `
                    <input type="text" class="inline-input-sm cf-key"   value="${_escape(cf.key)}"   placeholder="Campo (Episodios…)">
                    <input type="text" class="inline-input-sm cf-value" value="${_escape(cf.value)}" placeholder="Valor (15…)">
                    <button type="button" class="btn-icon danger-hover" title="Eliminar campo">
                        ${_icon('trash-2', 13)}
                    </button>
                `;
                row.querySelector('.cf-key').addEventListener('input',   e => { cf.key   = e.target.value; });
                row.querySelector('.cf-value').addEventListener('input', e => { cf.value = e.target.value; });
                row.querySelector('.btn-icon').addEventListener('click', () => {
                    workCard.customFields.splice(idx, 1);
                    renderCF();
                });
                cfContainer.appendChild(row);
                if (typeof lucide !== 'undefined') lucide.createIcons({ node: row });
            });
        };
        renderCF();

        document.getElementById('btn-add-field').addEventListener('click', () => {
            workCard.customFields.push(Schema.newCustomField());
            renderCF();
        });

        // ── Guardar / Cancelar ────────────────────────────────
        document.getElementById('drawer-save-btn').addEventListener('click', () => {
            _saveDrawer(tIdx, colIdx, cardIdx, workCard);
        });
        document.getElementById('drawer-cancel-btn').addEventListener('click', () => {
            closeDrawer();
        });

        // Actualizar título del drawer al escribir
        const titleInput = document.getElementById('df_title');
        titleInput.addEventListener('input', () => {
            const h = document.getElementById('media-drawer-title');
            if (h) h.textContent = titleInput.value || 'Ficha';
        });
    }

    // ── Persistir cambios del drawer ──────────────────────────
    function _saveDrawer(tIdx, colIdx, cardIdx, workCard) {
        const title = document.getElementById('df_title').value.trim();
        if (!title) {
            document.getElementById('df_title').style.borderColor = 'var(--danger)';
            return;
        }

        // Recoger campos del formulario
        workCard.title        = title;
        workCard.altTitle     = document.getElementById('df_altTitle').value.trim();
        workCard.synopsis     = document.getElementById('df_synopsis').value.trim();
        workCard.status       = document.getElementById('df_status').value;
        workCard.year         = parseInt(document.getElementById('df_year').value) || null;
        workCard.mediaSubtype = document.getElementById('df_mediaSubtype').value;
        workCard.studio       = document.getElementById('df_studio').value.trim();
        workCard.seasons      = parseInt(document.getElementById('df_seasons').value) || null;
        workCard.chapters     = parseInt(document.getElementById('df_chapters').value) || null;
        workCard.platform     = document.getElementById('df_platform').value.trim();
        workCard.playtime     = document.getElementById('df_playtime').value.trim();
        workCard.progress     = document.getElementById('df_progress').value.trim();
        workCard.notes        = document.getElementById('df_notes').value.trim();
        // links, tags, customFields ya se actualizaron en tiempo real

        Storage.saveStateForUndo();
        // Aplicar workCard al card real
        const realCard = Storage.getTitles()[tIdx].collections[colIdx].cards[cardIdx];

        // Limpieza inteligente de imágenes huérfanas al reemplazar o eliminar
        const oldImage = realCard.coverImage;
        const newImage = workCard.coverImage;

        Object.assign(realCard, workCard);

        Storage.save(true);

        if (oldImage && oldImage !== newImage) {
            Attachments.removeImage(oldImage);
        }

        closeDrawer();
        App.showToast(`"${realCard.title}" guardado.`, false);
    }

    // ── Init (llamado desde App.init) ─────────────────────────
    function init() {
        // Cerrar drawer con Escape
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && _drawerOpen) closeDrawer();
        });
        // Cerrar con backdrop
        const backdrop = document.getElementById('media-drawer-backdrop');
        if (backdrop) backdrop.addEventListener('click', closeDrawer);
    }

    return {
        init,
        addCollection, editCollection,
        addCard, editCard,
        openDrawer, closeDrawer,
    };
})();
