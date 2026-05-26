/**
 * editor.js — Creación y edición inline de elementos técnicos
 * DevSnippets | Sistema Multi-Estructura
 *
 * Gestiona:
 *  - Modal de selección de tipo al crear un Título
 *  - CRUD inline para tipo Técnico (Categorías / Subtítulos / Snippets)
 *  - deleteItem unificado (soporta tipos técnico y media)
 *
 * La edición de fichas Media está en editor-media.js
 */

const Editor = (() => {
    const COLORS = ['blue', 'green', 'red', 'purple', 'yellow', 'cyan', 'orange', 'gray'];

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
    // MODAL DE SELECCIÓN DE TIPO
    // ══════════════════════════════════════════════════════════

    function addTitle() {
        _openTypeModal();
    }

    function _openTypeModal() {
        const modal    = document.getElementById('type-modal');
        const backdrop = document.getElementById('type-modal-backdrop');
        if (!modal || !backdrop) return;

        modal.classList.add('show');
        backdrop.classList.add('show');

        // Botones de tipo
        modal.querySelectorAll('.type-option-btn').forEach(btn => {
            // Clonar para limpiar listeners anteriores
            const clone = btn.cloneNode(true);
            btn.parentNode.replaceChild(clone, btn);
            clone.addEventListener('click', () => {
                const type = clone.dataset.type;
                _closeTypeModal();
                _createTitle(type);
            });
        });

        // Cerrar con X
        const closeBtn = modal.querySelector('.type-modal-close');
        if (closeBtn) {
            const c2 = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(c2, closeBtn);
            c2.addEventListener('click', _closeTypeModal);
        }

        if (typeof lucide !== 'undefined') lucide.createIcons({ node: modal });
    }

    function _closeTypeModal() {
        document.getElementById('type-modal')?.classList.remove('show');
        document.getElementById('type-modal-backdrop')?.classList.remove('show');
    }

    function _createTitle(type) {
        Storage.saveStateForUndo();
        const titleObj = Schema.newTitle(type);
        Storage.getTitles().unshift(titleObj);
        Storage.save(true);

        setTimeout(() => {
            const summaryEl = document.querySelector(`#t_${titleObj.id} > summary`);
            if (summaryEl) {
                App.expandParents(summaryEl);
                _startTextEdit(summaryEl, 'title', 0, null, null, true);
            }
        }, 60);
    }

    // ── Cerrar modal con Escape ───────────────────────────────
    function initModalEvents() {
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') _closeTypeModal();
        });
        const backdrop = document.getElementById('type-modal-backdrop');
        if (backdrop) backdrop.addEventListener('click', _closeTypeModal);
    }

    // ══════════════════════════════════════════════════════════
    // TÍTULOS — edición inline
    // ══════════════════════════════════════════════════════════

    function editTitle(e, tIdx) {
        _stopAndClose(e);
        const summaryEl = document.querySelector(`#t_${Storage.getTitles()[tIdx].id} > summary`);
        if (summaryEl) _startTextEdit(summaryEl, 'title', tIdx, null, null, false);
    }

    // ══════════════════════════════════════════════════════════
    // CATEGORÍAS — edición inline (tipo técnico)
    // ══════════════════════════════════════════════════════════

    function addCategory(e, tIdx) {
        _stopAndClose(e);
        const titleObj = Storage.getTitles()[tIdx];
        const titleEl  = document.getElementById(`t_${titleObj.id}`);
        if (titleEl) titleEl.open = true;

        Storage.saveStateForUndo();
        const cat = Schema.newCategory();
        titleObj.categories.unshift(cat);
        Storage.save(true);

        setTimeout(() => {
            const summaryEl = document.querySelector(`#c_${cat.id} > summary`);
            if (summaryEl) {
                App.expandParents(summaryEl);
                _startCatEdit(summaryEl, tIdx, 0, true);
            }
        }, 60);
    }

    function editCategory(e, tIdx, cIdx) {
        _stopAndClose(e);
        const catId   = Storage.getTitles()[tIdx].categories[cIdx].id;
        const summaryEl = document.querySelector(`#c_${catId} > summary`);
        if (summaryEl) _startCatEdit(summaryEl, tIdx, cIdx, false);
    }

    // ══════════════════════════════════════════════════════════
    // SUBTÍTULOS
    // ══════════════════════════════════════════════════════════

    function addSubtitle(e, tIdx, cIdx) {
        _stopAndClose(e);
        const catObj = Storage.getTitles()[tIdx].categories[cIdx];
        const catEl  = document.getElementById(`c_${catObj.id}`);
        if (catEl) catEl.open = true;

        Storage.saveStateForUndo();
        const sub = Schema.newSubtitle();
        catObj.subtitles.unshift(sub);
        Storage.save(true);

        setTimeout(() => {
            const summaryEl = document.querySelector(`#s_${sub.id} > summary`);
            if (summaryEl) {
                App.expandParents(summaryEl);
                _startSubEdit(summaryEl, tIdx, cIdx, 0, true);
            }
        }, 60);
    }

    function editSubtitle(e, tIdx, cIdx, sIdx) {
        _stopAndClose(e);
        const subId   = Storage.getTitles()[tIdx].categories[cIdx].subtitles[sIdx].id;
        const summaryEl = document.querySelector(`#s_${subId} > summary`);
        if (summaryEl) _startSubEdit(summaryEl, tIdx, cIdx, sIdx, false);
    }

    // ══════════════════════════════════════════════════════════
    // SNIPPETS
    // ══════════════════════════════════════════════════════════

    function addSnippet(e, tIdx, cIdx, sIdx) {
        _stopAndClose(e);
        const subObj = Storage.getTitles()[tIdx].categories[cIdx].subtitles[sIdx];
        const subEl  = document.getElementById(`s_${subObj.id}`);
        if (subEl) subEl.open = true;

        Storage.saveStateForUndo();
        const snip = Schema.newSnippet();
        subObj.snippets.unshift(snip);
        Storage.save(true);

        setTimeout(() => {
            const card = document.querySelector(`.snippet-card[data-id="${snip.id}"]`);
            if (card) {
                App.expandParents(card);
                _startSnippetEdit(card, tIdx, cIdx, sIdx, 0, true);
            }
        }, 60);
    }

    function editSnippet(e, tIdx, cIdx, sIdx, snIdx) {
        _stopAndClose(e);
        const snipObj = Storage.getTitles()[tIdx].categories[cIdx].subtitles[sIdx].snippets[snIdx];
        // Initialize a draft buffer for this snippet so edits can be staged
        try { if (typeof Drafts !== 'undefined' && Drafts.start) Drafts.start(snipObj.id, snipObj); } catch (e) { console.warn('[Editor] Drafts.start failed', e); }
        const card    = document.querySelector(`.snippet-card[data-id="${snipObj.id}"]`);
        if (card) _startSnippetEdit(card, tIdx, cIdx, sIdx, snIdx, false);
    }

    // ══════════════════════════════════════════════════════════
    // DELETE — unificado para todos los tipos
    // ══════════════════════════════════════════════════════════

    function deleteItem(e, type, tIdx, cIdx, sIdx, snIdx) {
        _stopAndClose(e);
        const titles = Storage.getTitles();
        let name = '';

        switch (type) {
            case 'title':      name = titles[tIdx].title; break;
            case 'cat':        name = titles[tIdx].categories[cIdx].title; break;
            case 'sub':        name = titles[tIdx].categories[cIdx].subtitles[sIdx].title; break;
            case 'snip':       name = titles[tIdx].categories[cIdx].subtitles[sIdx].snippets[snIdx].title; break;
            case 'collection': name = titles[tIdx].collections[cIdx].title; break;
            case 'card':       name = titles[tIdx].collections[cIdx].cards[sIdx].title; break;
        }

        if (!confirm(`¿Eliminar permanentemente "${name || 'este elemento'}" y todo su contenido?`)) return;

        // Recoger portadas a eliminar físicamente del disco
        const coversToDelete = [];
        if (type === 'card') {
            const card = titles[tIdx]?.collections?.[cIdx]?.cards?.[sIdx];
            if (card && card.coverImage) coversToDelete.push(card.coverImage);
        } else if (type === 'collection') {
            const col = titles[tIdx]?.collections?.[cIdx];
            if (col && col.cards) {
                col.cards.forEach(c => {
                    if (c.coverImage) coversToDelete.push(c.coverImage);
                });
            }
        } else if (type === 'title') {
            const titleObj = titles[tIdx];
            if (titleObj && titleObj.type === 'media' && titleObj.collections) {
                titleObj.collections.forEach(col => {
                    if (col.cards) {
                        col.cards.forEach(c => {
                            if (c.coverImage) coversToDelete.push(c.coverImage);
                        });
                    }
                });
            }
        }

        Storage.saveStateForUndo();
        // If deleting a snippet, discard any in-progress draft first
        if (type === 'snip') {
            try {
                const snip = titles[tIdx].categories[cIdx].subtitles[sIdx].snippets[snIdx];
                if (snip && snip.id && typeof Drafts !== 'undefined' && Drafts.discard) Drafts.discard(snip.id);
            } catch (e) { /* ignore */ }
        }

        switch (type) {
            case 'title':      titles.splice(tIdx, 1); break;
            case 'cat':        titles[tIdx].categories.splice(cIdx, 1); break;
            case 'sub':        titles[tIdx].categories[cIdx].subtitles.splice(sIdx, 1); break;
            case 'snip':       titles[tIdx].categories[cIdx].subtitles[sIdx].snippets.splice(snIdx, 1); break;
            case 'collection': titles[tIdx].collections.splice(cIdx, 1); break;
            case 'card':       titles[tIdx].collections[cIdx].cards.splice(sIdx, 1); break;
        }

        Storage.save(true);

        // Eliminar físicamente del disco (si nadie más las usa)
        if (coversToDelete.length > 0 && typeof Attachments !== 'undefined' && Attachments.removeImage) {
            coversToDelete.forEach(cover => {
                Attachments.removeImage(cover);
            });
        }
        App.showToast(`"${name || 'Elemento'}" eliminado.`, true);
    }

    // ══════════════════════════════════════════════════════════
    // FAVORITO (snippets)
    // ══════════════════════════════════════════════════════════

    function toggleFav(tIdx, cIdx, sIdx, snIdx) {
        const snip = Storage.getSnip(tIdx, cIdx, sIdx, snIdx);
        snip.fav = !snip.fav;
        Storage.save(true);
    }

    // Actualizar título del bloque (editable inline)
    function updateBlockTitle(el, id) {
        if (!el || !id) return;
        const val = el.textContent.trim();
        const orig = el.dataset.orig || '';
        if (val === orig) return;
        // Persistir mediante storage wrapper
        Storage.editSnippetById(id, { blockTitle: val });
        App.showToast('Título de bloque guardado.', false);
    }

    // ══════════════════════════════════════════════════════════
    // EDICIÓN INLINE — Texto simple (Título)
    // ══════════════════════════════════════════════════════════

    function _startTextEdit(summaryEl, type, tIdx, cIdx, sIdx, isNew = false) {
        const textEl = summaryEl.querySelector('.summary-text');
        if (!textEl || summaryEl.dataset.editing) return;
        summaryEl.dataset.editing = '1';

        const original = textEl.innerText.trim();
        textEl.style.display = 'none';

        const input = document.createElement('input');
        input.type        = 'text';
        input.className   = 'inline-input';
        input.value       = isNew ? '' : original;
        input.placeholder = type === 'title' ? 'Ej: JavaScript, Anime, Videojuegos…' : 'Nombre…';
        textEl.parentNode.insertBefore(input, textEl);
        input.focus();

        const rollback = () => {
            if (!isNew) return;
            if (type === 'title') Storage.getTitles().splice(tIdx, 1);
            Storage.save(true);
        };

        const save = () => {
            const val = input.value.trim();
            if (!val) { rollback(); return; }
            if (isNew || val !== original) {
                Storage.saveStateForUndo();
                if (type === 'title') Storage.getTitles()[tIdx].title = val;
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
    // EDICIÓN INLINE — Categoría
    // ══════════════════════════════════════════════════════════

    function _startCatEdit(summaryEl, tIdx, cIdx, isNew = false) {
        const textEl = summaryEl.querySelector('.summary-text');
        if (!textEl || summaryEl.dataset.editing) return;
        summaryEl.dataset.editing = '1';

        const catObj   = Storage.getTitles()[tIdx].categories[cIdx];
        const leftDiv  = summaryEl.querySelector('.summary-left');
        const origHTML = leftDiv.innerHTML;

        leftDiv.innerHTML = '';

        const inputName = document.createElement('input');
        inputName.type        = 'text';
        inputName.className   = 'inline-input-sm';
        inputName.value       = isNew ? '' : catObj.title;
        inputName.placeholder = 'Ej: Model, Backend, API…';
        inputName.style.flex  = '1';

        const sel = document.createElement('select');
        sel.className = 'inline-select';
        COLORS.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c; opt.textContent = c.charAt(0).toUpperCase() + c.slice(1);
            if (c === catObj.color) opt.selected = true;
            sel.appendChild(opt);
        });

        const saveBtn   = _mkBtn('check', 14, 'var(--success-text)', 'Guardar');
        const cancelBtn = _mkBtn('x',     14, 'var(--text-muted)',   'Cancelar');

        leftDiv.appendChild(inputName);
        leftDiv.appendChild(sel);
        leftDiv.appendChild(saveBtn);
        leftDiv.appendChild(cancelBtn);
        inputName.focus();
        if (typeof lucide !== 'undefined') lucide.createIcons({ node: leftDiv });

        const rollback = () => {
            if (!isNew) return;
            Storage.getTitles()[tIdx].categories.splice(cIdx, 1);
            Storage.save(true);
        };

        const save = () => {
            const val = inputName.value.trim();
            if (!val) { _doCancel(); return; }
            Storage.saveStateForUndo();
            Storage.getTitles()[tIdx].categories[cIdx].title = val;
            Storage.getTitles()[tIdx].categories[cIdx].color = sel.value;
            delete summaryEl.dataset.editing;
            Storage.save(true);
        };

        const _doCancel = () => {
            delete summaryEl.dataset.editing;
            if (isNew) { rollback(); return; }
            leftDiv.innerHTML = origHTML;
        };

        saveBtn.onclick   = e => { e.stopPropagation(); e.preventDefault(); save(); };
        cancelBtn.onclick = e => { e.stopPropagation(); e.preventDefault(); _doCancel(); };
        inputName.onkeydown = ev => {
            if (ev.key === 'Enter')  { ev.preventDefault(); save(); }
            if (ev.key === 'Escape') _doCancel();
        };
    }

    // ══════════════════════════════════════════════════════════
    // EDICIÓN INLINE — Subtítulo
    // ══════════════════════════════════════════════════════════

    function _startSubEdit(summaryEl, tIdx, cIdx, sIdx, isNew = false) {
        const textEl = summaryEl.querySelector('.summary-text');
        if (!textEl || summaryEl.dataset.editing) return;
        summaryEl.dataset.editing = '1';

        const subObj   = Storage.getTitles()[tIdx].categories[cIdx].subtitles[sIdx];
        const leftDiv  = summaryEl.querySelector('.summary-left');
        const origHTML = leftDiv.innerHTML;

        leftDiv.innerHTML = '';

        const inputName = document.createElement('input');
        inputName.type        = 'text';
        inputName.className   = 'inline-input-sm';
        inputName.value       = isNew ? '' : subObj.title;
        inputName.placeholder = 'Nombre del subtítulo…';
        inputName.style.flex  = '1';

        const selType = document.createElement('select');
        selType.className = 'inline-select';
        [['main', '⭐ Principal'], ['sec', '↳ Secundario']].forEach(([v, l]) => {
            const opt = document.createElement('option');
            opt.value = v; opt.textContent = l;
            selType.appendChild(opt);
        });
        selType.value = subObj.isMain ? 'main' : 'sec';

        const assocContainer = document.createElement('div');
        assocContainer.className = 'assoc-container';
        assocContainer.style.display     = subObj.isMain ? 'none' : 'flex';
        assocContainer.style.flexDirection = 'column';
        assocContainer.style.gap         = '6px';
        assocContainer.style.marginTop   = '6px';

        const catsWithMain      = Storage.getAllCategoriesWithMainSubs(subObj.id);
        let currentAssociations = subObj.parentIds ? [...subObj.parentIds] : [];

        function renderAssociations() {
            assocContainer.innerHTML = '';
            if (catsWithMain.length === 0) {
                assocContainer.innerHTML = '<span style="font-size:0.8em;color:var(--text-subtle)">(Sin principales)</span>';
                return;
            }
            currentAssociations.forEach((assocId, idx) => {
                const row = document.createElement('div');
                row.style.display = 'flex'; row.style.gap = '4px';

                const selCat = document.createElement('select'); selCat.className = 'inline-select';
                const selSub = document.createElement('select'); selSub.className = 'inline-select';

                catsWithMain.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.cat.id; opt.textContent = c.cat.title;
                    selCat.appendChild(opt);
                });

                let initialCatId = catsWithMain[0].cat.id;
                const parentInfo = Storage.findSubtitleAndCategory(assocId);
                if (parentInfo) initialCatId = parentInfo.cat.id;
                selCat.value = initialCatId;

                const updateSubs = () => {
                    selSub.innerHTML = '';
                    const catInfo = catsWithMain.find(c => c.cat.id === selCat.value);
                    if (catInfo) {
                        catInfo.mainSubs.forEach(s => {
                            const opt = document.createElement('option');
                            opt.value = s.id; opt.textContent = s.title;
                            selSub.appendChild(opt);
                        });
                        selSub.value = assocId;
                        if (!selSub.value && selSub.options.length > 0) selSub.value = selSub.options[0].value;
                    }
                };

                selCat.onchange = () => { updateSubs(); currentAssociations[idx] = selSub.value; };
                selSub.onchange = () => { currentAssociations[idx] = selSub.value; };
                updateSubs();

                const btnDel = _mkBtn('trash-2', 13, 'var(--danger)', 'Eliminar');
                btnDel.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); currentAssociations.splice(idx, 1); renderAssociations(); };

                row.appendChild(selCat); row.appendChild(selSub); row.appendChild(btnDel);
                assocContainer.appendChild(row);
                if (typeof lucide !== 'undefined') lucide.createIcons({ node: row });
            });

            const btnAdd = document.createElement('button');
            btnAdd.className  = 'btn-icon';
            btnAdd.style.cssText = 'align-self:flex-start;font-size:0.8em;color:var(--primary)';
            btnAdd.innerHTML  = _icon('plus', 13) + ' Añadir Asociación';
            btnAdd.onclick = ev => {
                ev.preventDefault(); ev.stopPropagation();
                if (catsWithMain.length > 0) {
                    currentAssociations.push(catsWithMain[0].mainSubs[0].id);
                    renderAssociations();
                }
            };
            assocContainer.appendChild(btnAdd);
            if (typeof lucide !== 'undefined') lucide.createIcons({ node: btnAdd });
        }

        renderAssociations();
        selType.onchange = () => {
            assocContainer.style.display = selType.value === 'sec' ? 'flex' : 'none';
        };

        const saveBtn   = _mkBtn('check', 14, 'var(--success-text)', 'Guardar');
        const cancelBtn = _mkBtn('x',     14, 'var(--text-muted)',   'Cancelar');

        const topRow = document.createElement('div');
        topRow.style.cssText = 'display:flex;align-items:center;gap:6px';
        topRow.appendChild(inputName); topRow.appendChild(selType);
        topRow.appendChild(saveBtn);   topRow.appendChild(cancelBtn);

        leftDiv.style.flexDirection = 'column';
        leftDiv.style.alignItems    = 'stretch';
        leftDiv.appendChild(topRow);
        leftDiv.appendChild(assocContainer);
        inputName.focus();
        if (typeof lucide !== 'undefined') lucide.createIcons({ node: leftDiv });

        const rollback = () => {
            if (!isNew) return;
            Storage.getTitles()[tIdx].categories[cIdx].subtitles.splice(sIdx, 1);
            Storage.save(true);
        };

        const save = () => {
            const val = inputName.value.trim();
            if (!val) { _doCancel(); return; }
            const uniqueAssocs = [...new Set(currentAssociations)].filter(Boolean);
            Storage.saveStateForUndo();
            const s = Storage.getTitles()[tIdx].categories[cIdx].subtitles[sIdx];
            s.title    = val;
            s.isMain   = selType.value === 'main';
            s.parentIds = selType.value === 'sec' ? uniqueAssocs : [];
            delete summaryEl.dataset.editing;
            leftDiv.style.flexDirection = '';
            leftDiv.style.alignItems    = '';
            Storage.save(true);
        };

        const _doCancel = () => {
            delete summaryEl.dataset.editing;
            if (isNew) { rollback(); return; }
            leftDiv.style.flexDirection = '';
            leftDiv.style.alignItems    = '';
            leftDiv.innerHTML = origHTML;
        };

        saveBtn.onclick   = e => { e.stopPropagation(); e.preventDefault(); save(); };
        cancelBtn.onclick = e => { e.stopPropagation(); e.preventDefault(); _doCancel(); };
        inputName.onkeydown = ev => {
            if (ev.key === 'Enter')  { ev.preventDefault(); save(); }
            if (ev.key === 'Escape') _doCancel();
        };
    }

    // ══════════════════════════════════════════════════════════
    // EDICIÓN INLINE — Snippet
    // ══════════════════════════════════════════════════════════

    function _startSnippetEdit(card, tIdx, cIdx, sIdx, snIdx, isNew = false) {
        if (card.dataset.editing) return;
        card.dataset.editing = '1';
        card.classList.add('editing');

        const viewDiv = card.querySelector('.snippet-view');
        const editDiv = card.querySelector('.snippet-edit-zone');
        const snipObj = Storage.getTitles()[tIdx].categories[cIdx].subtitles[sIdx].snippets[snIdx];

        viewDiv.classList.add('hidden');
        editDiv.classList.remove('hidden');

        // If a draft exists, prefill from it so in-progress edits survive re-open
        const d = (typeof Drafts !== 'undefined' && Drafts.get) ? Drafts.get(snipObj.id) : null;
        const currentCover = (d && d.coverImage !== undefined) ? d.coverImage : snipObj.coverImage;

        const coverUrl = (currentCover && typeof Attachments !== 'undefined' && Attachments.getDisplayUrl) ? Attachments.getDisplayUrl(currentCover) : null;
        const isStaged = !!(d && Object.prototype.hasOwnProperty.call(d, 'coverImage') && d.coverImage !== snipObj.coverImage);

        editDiv.innerHTML = `
            <div class="snippet-edit-form">
                <input type="text" id="ef_title" class="inline-input-sm"
                    value="${_escape(snipObj.title)}"
                    placeholder="Nombre del snippet (ej: Ordenar Array)"
                    style="width:100%">
                <input type="text" id="ef_desc" class="inline-input-sm"
                    value="${_escape(snipObj.description)}"
                    placeholder="Descripción breve (opcional)"
                    style="width:100%">
                <select id="ef_contentType" class="inline-select" style="margin-bottom:6px;">
                    <option value="code">Code</option>
                    <option value="text">Text</option>
                </select>
                <textarea id="ef_code" class="inline-textarea" placeholder="Escribe el código aquí…"></textarea>
                <div class="snippet-image-editor">
                    ${ coverUrl ? `
                        <div class="image-preview">
                            <img src="${coverUrl}" alt="thumbnail">
                            ${ isStaged ? `<span class="draft-badge">Pendiente</span>` : '' }
                            <div class="img-actions">
                                <button id="ef_change_image" class="btn">Cambiar imagen</button>
                                <button id="ef_remove_image" class="btn btn-danger">Eliminar imagen</button>
                            </div>
                        </div>
                    ` : `<button id="ef_select_image" class="btn">Seleccionar imagen</button>` }
                </div>
                <div class="snippet-edit-actions">
                    <button id="ef_save" class="btn-primary">${_icon('check', 14)} Guardar</button>
                    <button id="ef_cancel" class="btn">${_icon('x', 14)} Cancelar</button>
                </div>
            </div>
        `;

        const codeTA = editDiv.querySelector('#ef_code');
        const contentSel = editDiv.querySelector('#ef_contentType');
        codeTA.value = d && d.code !== undefined ? d.code : (snipObj.code || '');
        contentSel.value = d && d.contentType ? d.contentType : (snipObj.contentType || 'code');
        // title/desc fields
        const titleEl = editDiv.querySelector('#ef_title');
        const descEl = editDiv.querySelector('#ef_desc');
        if (d) { if (d.title !== undefined) titleEl.value = d.title; if (d.description !== undefined) descEl.value = d.description; }

        const autoResize = () => { codeTA.style.height = 'auto'; codeTA.style.height = codeTA.scrollHeight + 'px'; };
        codeTA.addEventListener('input', autoResize);
        setTimeout(autoResize, 0);

        if (typeof lucide !== 'undefined') lucide.createIcons({ node: editDiv });
        editDiv.querySelector('#ef_title').focus();

        const rollback = () => {
            if (!isNew) return;
            Storage.getTitles()[tIdx].categories[cIdx].subtitles[sIdx].snippets.splice(snIdx, 1);
            Storage.save(true);
            try { if (typeof Drafts !== 'undefined' && Drafts.discard) Drafts.discard(snipObj.id); } catch (e) { console.warn('[Editor] Drafts.discard failed', e); }
        };

        const save = () => {
            const title = editDiv.querySelector('#ef_title').value.trim();
            const desc  = editDiv.querySelector('#ef_desc').value.trim();
            const code  = codeTA.value;
            const contentType = contentSel.value || 'code';
            if (!title) {
                editDiv.querySelector('#ef_title').style.borderColor = 'var(--danger)';
                return;
            }
            if (contentType === 'code' && !code.trim()) {
                codeTA.style.borderColor = 'var(--danger)';
                return;
            }
            Storage.saveStateForUndo();
            const payload = { title, description: desc, code, contentType };
            const d = (typeof Drafts !== 'undefined' && Drafts.get) ? Drafts.get(snipObj.id) : null;
            if (d) {
                if (d.coverImage !== undefined) payload.coverImage = d.coverImage;
                if (d.blockTitle !== undefined) payload.blockTitle = d.blockTitle;
                if (d.fav !== undefined) payload.fav = d.fav;
            }
            if (typeof Storage !== 'undefined' && Storage.editSnippetById) {
                Storage.editSnippetById(snipObj.id, payload);
            } else {
                const s = Storage.getTitles()[tIdx].categories[cIdx].subtitles[sIdx].snippets[snIdx];
                Object.assign(s, payload);
                Storage.save(true);
            }
            try { if (typeof Drafts !== 'undefined' && Drafts.discard) Drafts.discard(snipObj.id); } catch(e){}
            delete card.dataset.editing;
        };

        const cancel = () => {
            delete card.dataset.editing;
            card.classList.remove('editing');
            if (isNew) { rollback(); return; }
            editDiv.classList.add('hidden');
            editDiv.innerHTML = '';
            viewDiv.classList.remove('hidden');
            try { if (typeof Drafts !== 'undefined' && Drafts.discard) Drafts.discard(snipObj.id); } catch (e) { console.warn('[Editor] Drafts.discard failed', e); }
        };

        editDiv.querySelector('#ef_save').onclick   = save;
        editDiv.querySelector('#ef_cancel').onclick = cancel;
        codeTA.addEventListener('keydown', ev => {
            if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') { ev.preventDefault(); save(); }
        });

        // Image selection / change / remove handlers
        const selectBtn = editDiv.querySelector('#ef_select_image');
        const changeBtn = editDiv.querySelector('#ef_change_image');
        const removeBtn = editDiv.querySelector('#ef_remove_image');

        const refreshImageUI = (relativePath, displayUrl) => {
            // Update draft only so the image is staged until commit
            try { if (typeof Drafts !== 'undefined' && Drafts.update) Drafts.update(snipObj.id, { coverImage: relativePath }); } catch (e) { console.warn('[Editor] Drafts.update failed', e); }
            // re-open editor to reflect changes (preview from draft)
            setTimeout(() => { _startSnippetEdit(card, tIdx, cIdx, sIdx, snIdx, false); }, 40);
        };

        if (selectBtn) {
            selectBtn.onclick = () => {
                if (typeof Attachments === 'undefined' || !Attachments.selectAndCopy) return App.showToast('Funcionalidad de attachments no disponible', false);
                Attachments.selectAndCopy(snipObj.id, (res) => {
                    if (res && res.relativePath) {
                        refreshImageUI(res.relativePath, res.displayUrl);
                    }
                }, (err) => { App.showToast('Error al copiar imagen: ' + err, false); });
            };
        }

        if (changeBtn) {
            changeBtn.onclick = () => {
                if (typeof Attachments === 'undefined' || !Attachments.selectAndCopy) return App.showToast('Funcionalidad de attachments no disponible', false);
                Attachments.selectAndCopy(snipObj.id, (res) => {
                    if (res && res.relativePath) {
                        refreshImageUI(res.relativePath, res.displayUrl);
                    }
                }, (err) => { App.showToast('Error al copiar imagen: ' + err, false); });
            };
        }

        if (removeBtn) {
            removeBtn.onclick = () => {
                // Stage removal in draft; actual cleanup will occur after commit via Storage.cleanup
                try { if (typeof Drafts !== 'undefined' && Drafts.update) Drafts.update(snipObj.id, { coverImage: null }); } catch (e) { console.warn('[Editor] Drafts.update failed', e); }
                setTimeout(() => { _startSnippetEdit(card, tIdx, cIdx, sIdx, snIdx, false); }, 40);
            };
        }
    }

    // ── Helper: crear botón icon ──────────────────────────────
    function _mkBtn(iconName, size, color, title) {
        const btn = document.createElement('button');
        btn.className = 'btn-icon';
        btn.title     = title;
        btn.innerHTML = _icon(iconName, size);
        btn.style.color = color;
        return btn;
    }

    return {
        addTitle, editTitle,
        addCategory, editCategory,
        addSubtitle, editSubtitle,
        addSnippet, editSnippet,
        deleteItem, toggleFav,
        updateBlockTitle,
        initModalEvents,
    };
})();
