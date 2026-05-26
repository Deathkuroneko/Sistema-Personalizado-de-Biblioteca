/**
 * tags.js — Sistema global de tags reutilizables
 * DevSnippets | Sistema Multi-Estructura
 *
 * Los tags se almacenan en Storage.getTags() (raíz del DB).
 * Pueden asignarse a fichas media; en el futuro también a snippets.
 */

const Tags = (() => {
    let _editingTagId = null;

    const COLOR_HEX = {
        blue:   '#58a6ff', green:  '#56d364', red:    '#f85149',
        purple: '#bc8cff', yellow: '#e3b341', cyan:   '#79c0ff',
        orange: '#ffa657', gray:   '#8b949e',
    };

    // ── CRUD ──────────────────────────────────────────────────
    function create(name, color = 'blue') {
        if (!name.trim()) return null;
        Storage.saveStateForUndo();
        const tag = Schema.newTag({ name: name.trim(), color });
        Storage.getTags().push(tag);
        Storage.save(false);
        return tag;
    }

    function update(tagId, { name, color } = {}) {
        const tag = Storage.findTagById(tagId);
        if (!tag) return;
        Storage.saveStateForUndo();
        if (name  !== undefined) tag.name  = name.trim();
        if (color !== undefined) tag.color = color;
        Storage.save(false);
    }

    function remove(tagId) {
        const tags = Storage.getTags();
        const idx  = tags.findIndex(t => t.id === tagId);
        if (idx === -1) return;
        Storage.saveStateForUndo();
        tags.splice(idx, 1);
        // Limpiar referencias en todas las fichas media
        Storage.getTitles().forEach(title => {
            if (title.type !== 'media') return;
            (title.collections || []).forEach(col => {
                (col.cards || []).forEach(card => {
                    card.tags = (card.tags || []).filter(id => id !== tagId);
                });
            });
        });
        Storage.save(false);
    }

    function getAll() { return Storage.getTags(); }

    function getHex(color) { return COLOR_HEX[color] || COLOR_HEX.gray; }

    // ── Render de badges de tag ───────────────────────────────
    /**
     * Genera el HTML de los badges de los tags de una card.
     * @param {string[]} tagIds — array de IDs de tags
     */
    function renderBadges(tagIds = []) {
        if (!tagIds.length) return '';
        return tagIds.map(id => {
            const tag = Storage.findTagById(id);
            if (!tag) return '';
            const hex = getHex(tag.color);
            return `<span class="tag-badge" style="--tag-color:${hex}">${_escape(tag.name)}</span>`;
        }).filter(Boolean).join('');
    }

    /**
     * Renderiza el selector multi de tags dentro de un contenedor dado.
     * Marca los ya seleccionados. Llama a onChange(newTagIds) al cambiar.
     *
     * @param {HTMLElement} container
     * @param {string[]} selectedIds — IDs actualmente seleccionados
     * @param {Function} onChange    — cb(updatedIds: string[])
     */
    function renderSelector(container, selectedIds, onChange) {
        const allTags = getAll();
        container.innerHTML = '';

        if (allTags.length === 0) {
            container.innerHTML = `<span class="tags-empty-hint">Sin tags — crea uno abajo.</span>`;
        }

        const grid = document.createElement('div');
        grid.className = 'tags-selector-grid';

        allTags.forEach(tag => {
            const hex    = getHex(tag.color);
            const isOn   = selectedIds.includes(tag.id);

            if (_editingTagId === tag.id) {
                // Renderizar inputs de edición inline
                const wrapper = document.createElement('div');
                wrapper.className = 'tag-pill-wrapper tag-pill-wrapper--editing';
                wrapper.style.display = 'inline-flex';
                wrapper.style.alignItems = 'center';
                wrapper.style.gap = '4px';
                wrapper.style.background = 'var(--bg-card)';
                wrapper.style.border = `1px solid var(--primary)`;
                wrapper.style.borderRadius = '12px';
                wrapper.style.padding = '2px 8px';

                const editInput = document.createElement('input');
                editInput.type = 'text';
                editInput.className = 'inline-input-sm';
                editInput.value = tag.name;
                editInput.style.width = '85px';
                editInput.style.border = 'none';
                editInput.style.background = 'transparent';
                editInput.style.padding = '0';
                editInput.style.color = 'var(--text-main)';
                editInput.style.fontSize = '11px';

                const editSel = document.createElement('select');
                editSel.className = 'inline-select';
                editSel.style.border = 'none';
                editSel.style.background = 'transparent';
                editSel.style.padding = '0';
                editSel.style.fontSize = '10px';
                editSel.style.width = '70px';
                editSel.style.color = 'var(--text-subtle)';
                Schema.TAG_COLORS.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c;
                    opt.textContent = c.charAt(0).toUpperCase() + c.slice(1);
                    if (c === tag.color) opt.selected = true;
                    editSel.appendChild(opt);
                });

                const btnSave = document.createElement('button');
                btnSave.type = 'button';
                btnSave.className = 'btn-icon tag-crud-btn success-hover';
                btnSave.innerHTML = `<svg data-lucide="check" width="12" height="12"></svg>`;
                btnSave.title = 'Guardar';
                btnSave.style.padding = '2px';
                btnSave.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const newName = editInput.value.trim();
                    if (newName) {
                        update(tag.id, { name: newName, color: editSel.value });
                        _editingTagId = null;
                        renderSelector(container, selectedIds, onChange);
                        // Forzar el re-render de la vista completa para reflejar cambios en las fichas
                        if (typeof Render !== 'undefined' && Render.render) {
                            Render.render();
                        }
                    }
                });

                const btnCancel = document.createElement('button');
                btnCancel.type = 'button';
                btnCancel.className = 'btn-icon tag-crud-btn';
                btnCancel.innerHTML = `<svg data-lucide="x" width="12" height="12"></svg>`;
                btnCancel.title = 'Cancelar';
                btnCancel.style.padding = '2px';
                btnCancel.addEventListener('click', (e) => {
                    e.stopPropagation();
                    _editingTagId = null;
                    renderSelector(container, selectedIds, onChange);
                });

                wrapper.appendChild(editInput);
                wrapper.appendChild(editSel);
                wrapper.appendChild(btnSave);
                wrapper.appendChild(btnCancel);
                grid.appendChild(wrapper);
                if (typeof lucide !== 'undefined') lucide.createIcons({ node: wrapper });
                return;
            }

            const wrapper = document.createElement('div');
            wrapper.className = 'tag-pill-wrapper';
            wrapper.style.display = 'inline-flex';
            wrapper.style.alignItems = 'center';
            wrapper.style.gap = '2px';
            wrapper.style.background = isOn ? `color-mix(in srgb, ${hex} 20%, transparent)` : 'var(--bg-card)';
            wrapper.style.border = `1px solid ${isOn ? hex : 'var(--border)'}`;
            wrapper.style.borderRadius = '12px';
            wrapper.style.padding = '0 6px 0 0';
            wrapper.style.overflow = 'hidden';

            const pill   = document.createElement('button');
            pill.type    = 'button';
            pill.className = `tag-pill${isOn ? ' selected' : ''}`;
            pill.style.setProperty('--tag-color', hex);
            pill.style.border = 'none';
            pill.style.background = 'transparent';
            pill.textContent = tag.name;
            pill.title = `Seleccionar tag "${tag.name}"`;
            pill.dataset.id = tag.id;

            pill.addEventListener('click', () => {
                const idx = selectedIds.indexOf(tag.id);
                if (idx === -1) selectedIds.push(tag.id);
                else selectedIds.splice(idx, 1);
                onChange([...selectedIds]);
                renderSelector(container, selectedIds, onChange);
            });

            // Botón editar tag
            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'btn-icon tag-crud-btn primary-hover';
            editBtn.innerHTML = `<svg data-lucide="pencil" width="12" height="12"></svg>`;
            editBtn.style.padding = '2px';
            editBtn.style.color = 'var(--text-subtle)';
            editBtn.title = 'Editar tag global';
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                _editingTagId = tag.id;
                renderSelector(container, selectedIds, onChange);
            });

            // Botón eliminar tag (papelera)
            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'btn-icon tag-crud-btn danger-hover';
            delBtn.innerHTML = `<svg data-lucide="trash-2" width="12" height="12"></svg>`;
            delBtn.style.padding = '2px';
            delBtn.style.color = 'var(--text-subtle)';
            delBtn.title = 'Eliminar tag global';

            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`¿Eliminar el tag "${tag.name}" permanentemente de todas las fichas?`)) {
                    remove(tag.id);
                    // Actualizar selectedIds si estaba marcado
                    const idx = selectedIds.indexOf(tag.id);
                    if (idx !== -1) selectedIds.splice(idx, 1);
                    onChange([...selectedIds]);
                    renderSelector(container, selectedIds, onChange);
                    if (typeof Render !== 'undefined' && Render.render) {
                        Render.render();
                    }
                }
            });

            wrapper.appendChild(pill);
            wrapper.appendChild(editBtn);
            wrapper.appendChild(delBtn);
            grid.appendChild(wrapper);
        });

        container.appendChild(grid);

        // ── Crear nuevo tag inline ────────────────────────────
        const createRow = document.createElement('div');
        createRow.className = 'tag-create-row';
        createRow.innerHTML = `
            <input type="text" class="inline-input-sm tag-new-input" placeholder="Nuevo tag…" maxlength="30">
            <select class="inline-select tag-color-sel">
                ${Schema.TAG_COLORS.map(c =>
                    `<option value="${c}" style="background:${getHex(c)}">${c.charAt(0).toUpperCase()+c.slice(1)}</option>`
                ).join('')}
            </select>
            <button type="button" class="btn-icon tag-create-btn" title="Crear tag">
                <svg data-lucide="plus" width="14" height="14"></svg>
            </button>
        `;

        const nameInput  = createRow.querySelector('.tag-new-input');
        const colorSel   = createRow.querySelector('.tag-color-sel');
        const createBtn  = createRow.querySelector('.tag-create-btn');

        const doCreate = () => {
            const n = nameInput.value.trim();
            if (!n) return;
            const newTag = create(n, colorSel.value);
            if (newTag) {
                selectedIds.push(newTag.id);
                onChange([...selectedIds]);
                // Re-renderizar el selector completo
                renderSelector(container, selectedIds, onChange);
                if (typeof Render !== 'undefined' && Render.render) {
                    Render.render();
                }
            }
        };

        createBtn.addEventListener('click', doCreate);
        nameInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); doCreate(); }
        });

        container.appendChild(createRow);
        if (typeof lucide !== 'undefined') lucide.createIcons({ node: container });
    }

    function _escape(t = '') {
        return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    return {
        create, update, remove, getAll, getHex,
        renderBadges, renderSelector,
    };
})();
