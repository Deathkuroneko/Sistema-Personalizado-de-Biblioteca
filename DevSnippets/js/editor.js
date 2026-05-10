/**
 * editor.js — Creación y edición inline de todos los elementos
 * DevSnippets | Gestor de Conocimiento Técnico
 */

const Editor = (() => {
    const COLORS = ['blue', 'green', 'red', 'purple', 'yellow', 'cyan', 'orange', 'gray'];

    // ── Helpers ───────────────────────────────────────────────
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

    // ── TÍTULOS ───────────────────────────────────────────────
    function addTitle() {
        Storage.saveStateForUndo();
        const id = Storage.generateId();
        // Título vacío: el usuario lo nombrará inline
        Storage.getDB().unshift({ id, title: '', categories: [] });
        Storage.save(true);

        setTimeout(() => {
            const summaryEl = document.querySelector(`#t_${id} > summary`);
            if (summaryEl) {
                App.expandParents(summaryEl);
                _startTextEdit(summaryEl, 'title', 0, null, null, true);
            }
        }, 60);
    }

    function editTitle(e, tIdx) {
        _stopAndClose(e);
        const summaryEl = document.querySelector(`#t_${Storage.getDB()[tIdx].id} > summary`);
        if (summaryEl) _startTextEdit(summaryEl, 'title', tIdx, null, null, false);
    }

    // ── CATEGORÍAS ────────────────────────────────────────────
    function addCategory(e, tIdx) {
        _stopAndClose(e);
        const titleId = Storage.getDB()[tIdx].id;
        const titleEl = document.getElementById(`t_${titleId}`);
        if (titleEl) titleEl.open = true;

        Storage.saveStateForUndo();
        const id = Storage.generateId();
        Storage.getDB()[tIdx].categories.unshift({ id, title: '', color: 'blue', subtitles: [] });
        Storage.save(true);

        setTimeout(() => {
            const summaryEl = document.querySelector(`#c_${id} > summary`);
            if (summaryEl) {
                App.expandParents(summaryEl);
                _startCatEdit(summaryEl, tIdx, 0, true);
            }
        }, 60);
    }

    function editCategory(e, tIdx, cIdx) {
        _stopAndClose(e);
        const catId   = Storage.getDB()[tIdx].categories[cIdx].id;
        const summaryEl = document.querySelector(`#c_${catId} > summary`);
        if (summaryEl) _startCatEdit(summaryEl, tIdx, cIdx, false);
    }

    // ── SUBTÍTULOS ────────────────────────────────────────────
    function addSubtitle(e, tIdx, cIdx) {
        _stopAndClose(e);
        const catObj = Storage.getDB()[tIdx].categories[cIdx];
        const catEl  = document.getElementById(`c_${catObj.id}`);
        if (catEl) catEl.open = true;

        Storage.saveStateForUndo();
        const id = Storage.generateId();
        setTimeout(() => {
            const summaryEl = document.querySelector(`#s_${id} > summary`);
            if (summaryEl) {
                App.expandParents(summaryEl);
                _startSubEdit(summaryEl, tIdx, cIdx, 0, true);
            }
        }, 60);
    }

    function editSubtitle(e, tIdx, cIdx, sIdx) {
        _stopAndClose(e);
        const subId   = Storage.getDB()[tIdx].categories[cIdx].subtitles[sIdx].id;
        const summaryEl = document.querySelector(`#s_${subId} > summary`);
        if (summaryEl) _startSubEdit(summaryEl, tIdx, cIdx, sIdx, false);
    }

    // ── SNIPPETS ──────────────────────────────────────────────
    function addSnippet(e, tIdx, cIdx, sIdx) {
        _stopAndClose(e);
        const subObj = Storage.getDB()[tIdx].categories[cIdx].subtitles[sIdx];
        const subEl  = document.getElementById(`s_${subObj.id}`);
        if (subEl) subEl.open = true;

        Storage.saveStateForUndo();
        const id = Storage.generateId();
        subObj.snippets.unshift({ id, title: '', description: '', code: '', fav: false });
        Storage.save(true);

        setTimeout(() => {
            const card = document.querySelector(`.snippet-card[data-id="${id}"]`);
            if (card) {
                App.expandParents(card);
                _startSnippetEdit(card, tIdx, cIdx, sIdx, 0, true);
            }
        }, 60);
    }

    function editSnippet(e, tIdx, cIdx, sIdx, snIdx) {
        _stopAndClose(e);
        const snipObj = Storage.getDB()[tIdx].categories[cIdx].subtitles[sIdx].snippets[snIdx];
        const card    = document.querySelector(`.snippet-card[data-id="${snipObj.id}"]`);
        if (card) _startSnippetEdit(card, tIdx, cIdx, sIdx, snIdx, false);
    }

    // ── Edición de texto simple (título / subtítulo) ──────────
    // isNew=true → si el usuario cancela o deja vacío, se borra el elemento recién creado
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
        input.placeholder = type === 'title' ? 'Ej: JavaScript, Python…' : 'Ej: Bucles, Validaciones…';
        textEl.parentNode.insertBefore(input, textEl);
        input.focus();

        const rollback = () => {
            if (!isNew) return;
            const db = Storage.getDB();
            if (type === 'title') db.splice(tIdx, 1);
            Storage.save(true);
        };

        const save = () => {
            const val = input.value.trim();
            if (!val) {
                rollback();
                return;
            }
            // Solo guardar si cambió (o es nuevo)
            if (isNew || val !== original) {
                Storage.saveStateForUndo();
                if (type === 'title') Storage.getDB()[tIdx].title = val;
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

    // ── Edición de Categoría (nombre + color) ─────────────────
    function _startCatEdit(summaryEl, tIdx, cIdx, isNew = false) {
        const textEl = summaryEl.querySelector('.summary-text');
        if (!textEl || summaryEl.dataset.editing) return;
        summaryEl.dataset.editing = '1';

        const catObj   = Storage.getDB()[tIdx].categories[cIdx];
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

        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn-icon';
        saveBtn.title     = 'Guardar';
        saveBtn.innerHTML = _icon('check', 14);
        saveBtn.style.color = 'var(--success-text)';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn-icon';
        cancelBtn.title     = 'Cancelar';
        cancelBtn.innerHTML = _icon('x', 14);
        cancelBtn.style.color = 'var(--text-muted)';

        leftDiv.appendChild(inputName);
        leftDiv.appendChild(sel);
        leftDiv.appendChild(saveBtn);
        leftDiv.appendChild(cancelBtn);
        inputName.focus();

        if (typeof lucide !== 'undefined') lucide.createIcons({ node: leftDiv });

        const rollback = () => {
            if (!isNew) return;
            Storage.getDB()[tIdx].categories.splice(cIdx, 1);
            Storage.save(true);
        };

        const save = () => {
            const val = inputName.value.trim();
            if (!val) { _doCancel(); return; }
            Storage.saveStateForUndo();
            Storage.getDB()[tIdx].categories[cIdx].title = val;
            Storage.getDB()[tIdx].categories[cIdx].color = sel.value;
            delete summaryEl.dataset.editing;
            Storage.save(true);
        };

        const _doCancel = () => {
            delete summaryEl.dataset.editing;
            if (isNew) { rollback(); return; }
            leftDiv.innerHTML = origHTML;
        };

        saveBtn.onclick  = e => { e.stopPropagation(); e.preventDefault(); save(); };
        cancelBtn.onclick = e => { e.stopPropagation(); e.preventDefault(); _doCancel(); };
        inputName.onkeydown = ev => {
            if (ev.key === 'Enter')  { ev.preventDefault(); save(); }
            if (ev.key === 'Escape') _doCancel();
        };
    }

    // ── Edición de Subtítulo (nombre + tipo + padre) ──────────
    function _startSubEdit(summaryEl, tIdx, cIdx, sIdx, isNew = false) {
        const textEl = summaryEl.querySelector('.summary-text');
        if (!textEl || summaryEl.dataset.editing) return;
        summaryEl.dataset.editing = '1';

        const subObj   = Storage.getDB()[tIdx].categories[cIdx].subtitles[sIdx];
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
        const optMain = document.createElement('option');
        optMain.value = 'main'; optMain.textContent = '⭐ Principal';
        const optSec = document.createElement('option');
        optSec.value = 'sec'; optSec.textContent = '↳ Secundario';
        selType.appendChild(optMain);
        selType.appendChild(optSec);
        selType.value = subObj.isMain ? 'main' : 'sec';

        const assocContainer = document.createElement('div');
        assocContainer.className = 'assoc-container';
        assocContainer.style.display = subObj.isMain ? 'none' : 'flex';
        assocContainer.style.flexDirection = 'column';
        assocContainer.style.gap = '6px';
        assocContainer.style.marginTop = '6px';

        const catsWithMain = Storage.getAllCategoriesWithMainSubs(subObj.id);
        let currentAssociations = subObj.parentIds ? [...subObj.parentIds] : [];

        function renderAssociations() {
            assocContainer.innerHTML = '';
            if (catsWithMain.length === 0) {
                assocContainer.innerHTML = '<span style="font-size:0.8em;color:var(--text-subtle)">(Sin principales)</span>';
                return;
            }

            currentAssociations.forEach((assocId, idx) => {
                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.gap = '4px';

                const selCat = document.createElement('select');
                selCat.className = 'inline-select';
                const selSub = document.createElement('select');
                selSub.className = 'inline-select';

                catsWithMain.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.cat.id;
                    opt.textContent = c.cat.title;
                    selCat.appendChild(opt);
                });

                let initialCatId = catsWithMain[0].cat.id;
                const parentInfo = Storage.findSubtitleAndCategory(assocId);
                if (parentInfo) {
                    initialCatId = parentInfo.cat.id;
                }
                selCat.value = initialCatId;

                const updateSubs = () => {
                    selSub.innerHTML = '';
                    const catInfo = catsWithMain.find(c => c.cat.id === selCat.value);
                    if (catInfo) {
                        catInfo.mainSubs.forEach(s => {
                            const opt = document.createElement('option');
                            opt.value = s.id;
                            opt.textContent = s.title;
                            selSub.appendChild(opt);
                        });
                        selSub.value = assocId;
                        if (!selSub.value && selSub.options.length > 0) {
                            selSub.value = selSub.options[0].value;
                        }
                    }
                };

                selCat.onchange = () => {
                    updateSubs();
                    currentAssociations[idx] = selSub.value;
                };
                selSub.onchange = () => {
                    currentAssociations[idx] = selSub.value;
                };

                updateSubs();

                const btnDel = document.createElement('button');
                btnDel.className = 'btn-icon';
                btnDel.innerHTML = _icon('trash-2', 13);
                btnDel.style.color = 'var(--danger)';
                btnDel.onclick = (e) => {
                    e.preventDefault(); e.stopPropagation();
                    currentAssociations.splice(idx, 1);
                    renderAssociations();
                };

                row.appendChild(selCat);
                row.appendChild(selSub);
                row.appendChild(btnDel);
                assocContainer.appendChild(row);
                
                if (typeof lucide !== 'undefined') lucide.createIcons({ node: row });
            });

            const btnAdd = document.createElement('button');
            btnAdd.className = 'btn-icon';
            btnAdd.style.alignSelf = 'flex-start';
            btnAdd.innerHTML = _icon('plus', 13) + ' Añadir Asociación';
            btnAdd.style.fontSize = '0.8em';
            btnAdd.style.color = 'var(--primary)';
            btnAdd.onclick = (e) => {
                e.preventDefault(); e.stopPropagation();
                if (catsWithMain.length > 0) {
                    const firstSub = catsWithMain[0].mainSubs[0].id;
                    currentAssociations.push(firstSub);
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

        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn-icon';
        saveBtn.title     = 'Guardar';
        saveBtn.innerHTML = _icon('check', 14);
        saveBtn.style.color = 'var(--success-text)';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn-icon';
        cancelBtn.title     = 'Cancelar';
        cancelBtn.innerHTML = _icon('x', 14);
        cancelBtn.style.color = 'var(--text-muted)';

        const topRow = document.createElement('div');
        topRow.style.display = 'flex';
        topRow.style.alignItems = 'center';
        topRow.style.gap = '6px';
        
        topRow.appendChild(inputName);
        topRow.appendChild(selType);
        topRow.appendChild(saveBtn);
        topRow.appendChild(cancelBtn);

        leftDiv.style.flexDirection = 'column';
        leftDiv.style.alignItems = 'stretch';
        
        leftDiv.appendChild(topRow);
        leftDiv.appendChild(assocContainer);
        inputName.focus();

        if (typeof lucide !== 'undefined') lucide.createIcons({ node: leftDiv });

        const rollback = () => {
            if (!isNew) return;
            Storage.getDB()[tIdx].categories[cIdx].subtitles.splice(sIdx, 1);
            Storage.save(true);
        };

        const save = () => {
            const val = inputName.value.trim();
            if (!val) { _doCancel(); return; }
            
            // Lógica anti-duplicados para asociaciones
            const uniqueAssocs = [...new Set(currentAssociations)].filter(id => id);

            Storage.saveStateForUndo();
            const s = Storage.getDB()[tIdx].categories[cIdx].subtitles[sIdx];
            s.title = val;
            s.isMain = selType.value === 'main';
            s.parentIds = selType.value === 'sec' ? uniqueAssocs : [];
            
            delete summaryEl.dataset.editing;
            leftDiv.style.flexDirection = '';
            leftDiv.style.alignItems = '';
            Storage.save(true);
        };

        const _doCancel = () => {
            delete summaryEl.dataset.editing;
            if (isNew) { rollback(); return; }
            leftDiv.style.flexDirection = '';
            leftDiv.style.alignItems = '';
            leftDiv.innerHTML = origHTML;
        };

        saveBtn.onclick  = e => { e.stopPropagation(); e.preventDefault(); save(); };
        cancelBtn.onclick = e => { e.stopPropagation(); e.preventDefault(); _doCancel(); };
        inputName.onkeydown = ev => {
            if (ev.key === 'Enter')  { ev.preventDefault(); save(); }
            if (ev.key === 'Escape') _doCancel();
        };
    }

    // ── Edición Inline de Snippet ─────────────────────────────
    function _startSnippetEdit(card, tIdx, cIdx, sIdx, snIdx, isNew = false) {
        if (card.dataset.editing) return;
        card.dataset.editing = '1';
        card.classList.add('editing');

        const viewDiv = card.querySelector('.snippet-view');
        const editDiv = card.querySelector('.snippet-edit-zone');
        const snipObj = Storage.getDB()[tIdx].categories[cIdx].subtitles[sIdx].snippets[snIdx];

        viewDiv.classList.add('hidden');
        editDiv.classList.remove('hidden');

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
                <textarea id="ef_code" class="inline-textarea"
                    placeholder="Escribe el código aquí…"></textarea>
                <div class="snippet-edit-actions">
                    <button id="ef_save" class="btn-primary">
                        ${_icon('check', 14)} Guardar
                    </button>
                    <button id="ef_cancel" class="btn">
                        ${_icon('x', 14)} Cancelar
                    </button>
                </div>
            </div>
        `;

        // Asignar código por propiedad para no romper caracteres especiales
        const codeTA = editDiv.querySelector('#ef_code');
        codeTA.value = snipObj.code;

        // Auto-resize textarea
        const autoResize = () => { codeTA.style.height = 'auto'; codeTA.style.height = codeTA.scrollHeight + 'px'; };
        codeTA.addEventListener('input', autoResize);
        setTimeout(autoResize, 0);

        if (typeof lucide !== 'undefined') lucide.createIcons({ node: editDiv });

        editDiv.querySelector('#ef_title').focus();

        const rollback = () => {
            if (!isNew) return;
            Storage.getDB()[tIdx].categories[cIdx].subtitles[sIdx].snippets.splice(snIdx, 1);
            Storage.save(true);
        };

        const save = () => {
            const title = editDiv.querySelector('#ef_title').value.trim();
            const desc  = editDiv.querySelector('#ef_desc').value.trim();
            const code  = codeTA.value;
            if (!title || !code.trim()) {
                // Resaltar campos requeridos
                if (!title) editDiv.querySelector('#ef_title').style.borderColor = 'var(--danger)';
                if (!code.trim()) codeTA.style.borderColor = 'var(--danger)';
                return;
            }
            Storage.saveStateForUndo();
            const s = Storage.getDB()[tIdx].categories[cIdx].subtitles[sIdx].snippets[snIdx];
            s.title = title; s.description = desc; s.code = code;
            delete card.dataset.editing;
            Storage.save(true);
        };

        const cancel = () => {
            delete card.dataset.editing;
            card.classList.remove('editing');
            if (isNew) { rollback(); return; }
            editDiv.classList.add('hidden');
            editDiv.innerHTML = '';
            viewDiv.classList.remove('hidden');
        };

        editDiv.querySelector('#ef_save').onclick   = save;
        editDiv.querySelector('#ef_cancel').onclick = cancel;

        // Ctrl+Enter para guardar desde textarea
        codeTA.addEventListener('keydown', ev => {
            if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') { ev.preventDefault(); save(); }
        });
    }

    // ── Delete ────────────────────────────────────────────────
    function deleteItem(e, type, tIdx, cIdx, sIdx, snIdx) {
        _stopAndClose(e);
        const db = Storage.getDB();
        let name = '';
        if (type === 'title') name = db[tIdx].title;
        if (type === 'cat')   name = db[tIdx].categories[cIdx].title;
        if (type === 'sub')   name = db[tIdx].categories[cIdx].subtitles[sIdx].title;
        if (type === 'snip')  name = db[tIdx].categories[cIdx].subtitles[sIdx].snippets[snIdx].title;

        if (!confirm(`¿Eliminar permanentemente "${name || 'este elemento'}" y todo su contenido?`)) return;

        Storage.saveStateForUndo();
        if (type === 'title') db.splice(tIdx, 1);
        if (type === 'cat')   db[tIdx].categories.splice(cIdx, 1);
        if (type === 'sub')   db[tIdx].categories[cIdx].subtitles.splice(sIdx, 1);
        if (type === 'snip')  db[tIdx].categories[cIdx].subtitles[sIdx].snippets.splice(snIdx, 1);

        Storage.save(true);
        App.showToast(`"${name || 'Elemento'}" eliminado.`, true);
    }

    // ── Favorito ──────────────────────────────────────────────
    function toggleFav(tIdx, cIdx, sIdx, snIdx) {
        const snip = Storage.getSnip(tIdx, cIdx, sIdx, snIdx);
        snip.fav = !snip.fav;
        Storage.save(true);
    }

    return {
        addTitle, editTitle,
        addCategory, editCategory,
        addSubtitle, editSubtitle,
        addSnippet, editSnippet,
        deleteItem, toggleFav,
    };
})();
