/**
 * attachments.js — Gestión de imágenes y adjuntos
 * DevSnippets | Sistema Multi-Estructura
 *
 * En Tauri:
 *   - Copia el archivo seleccionado a Documents/DevSnippets/attachments/
 *   - Usa convertFileSrc() para generar una URL segura para <img>
 *   - Requiere "core:allow-asset" en capabilities/default.json
 *
 * En browser (localStorage mode):
 *   - Convierte a base64 data URL directamente
 */

const Attachments = (() => {
    let _docDirPath = '';

    // ── Detección de entorno ──────────────────────────────────
    function _isTauri() {
        return !!(window.__TAURI__ && window.__TAURI__.fs);
    }

    async function init() {
        if (_isTauri() && window.__TAURI__.path) {
            _docDirPath = await window.__TAURI__.path.documentDir();
            // Asegurar que termine con separador
            if (!_docDirPath.endsWith('\\') && !_docDirPath.endsWith('/')) {
                _docDirPath += '\\'; // En Windows la mayoría de las veces
            }
        }
    }

    /**
     * Convierte una ruta relativa interna (ej: "attachments/img.jpg")
     * en una URL utilizable por <img>.
     *
     * En Tauri: usa convertFileSrc con el protocolo "asset"
     * En browser: devuelve la base64 almacenada tal cual
     */
    function resolveImageUrl(relativePath) {
        if (!relativePath) return null;

        // Si es base64, devolverla directamente
        if (relativePath.startsWith('data:')) return relativePath;

        if (_isTauri() && window.__TAURI__.core && window.__TAURI__.core.convertFileSrc && _docDirPath) {
            const absPath = `${_docDirPath}DevSnippets\\${relativePath}`;
            return window.__TAURI__.core.convertFileSrc(absPath, 'asset');
        }

        // Fallback: si no hay Tauri, devolver null (no hay forma de resolver)
        return null;
    }

    /**
     * Abre el selector de archivo de imagen y procesa la selección.
     * @param {string} cardId - ID de la card (para nombrar el archivo)
     * @param {Function} onSuccess - cb({ relativePath, displayUrl })
     * @param {Function} onError   - cb(errorMessage)
     */
    function selectAndCopy(cardId, onSuccess, onError) {
        const input = document.createElement('input');
        input.type   = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';
        document.body.appendChild(input);

        input.addEventListener('change', async () => {
            const file = input.files[0];
            input.remove();
            if (!file) return;

            try {
                if (_isTauri()) {
                    await _copyToAttachments(file, cardId, onSuccess, onError);
                } else {
                    _toBase64(file, onSuccess, onError);
                }
            } catch (e) {
                if (onError) onError(e.message || 'Error al procesar imagen');
            }
        });

        input.click();
    }

    /**
     * Copia el archivo a Documents/DevSnippets/attachments/
     * usando el plugin tauri-plugin-fs.
     */
    async function _copyToAttachments(file, cardId, onSuccess, onError) {
        try {
            const { copyFile, BaseDirectory } = window.__TAURI__.fs;

            // Nombre único: timestamp + extensión
            const ext      = file.name.split('.').pop().toLowerCase();
            const uniqueId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now();
            const safeName = `${cardId}_${uniqueId}.${ext}`;
            const relPath  = `attachments/${safeName}`;
            const destPath = `DevSnippets/${relPath}`;

            // Leer el archivo como ArrayBuffer y escribirlo
            const buffer = await file.arrayBuffer();
            const { writeFile, BaseDirectory: BD } = window.__TAURI__.fs;
            await writeFile(destPath, new Uint8Array(buffer), { baseDir: BD.Document });

            // Construir URL de visualización
            let displayUrl = null;
            if (window.__TAURI__.core && window.__TAURI__.core.convertFileSrc && _docDirPath) {
                const absPath = `${_docDirPath}DevSnippets\\${relPath}`;
                displayUrl = window.__TAURI__.core.convertFileSrc(absPath, 'asset');
            }

            console.info('[Attachments] Imagen copiada a:', destPath);
            if (onSuccess) onSuccess({ relativePath: relPath, displayUrl });

        } catch (e) {
            console.error('[Attachments] Error copiando imagen:', e);
            // Fallback: base64
            console.warn('[Attachments] Fallback a base64');
            _toBase64(file, onSuccess, onError);
        }
    }

    /**
     * Fallback: convierte la imagen a base64 data URL.
     * Útil en modo browser o si falla la copia.
     */
    function _toBase64(file, onSuccess, onError) {
        const reader = new FileReader();
        reader.onload = e => {
            const dataUrl = e.target.result;
            if (onSuccess) onSuccess({ relativePath: dataUrl, displayUrl: dataUrl });
        };
        reader.onerror = () => {
            if (onError) onError('No se pudo leer el archivo de imagen');
        };
        reader.readAsDataURL(file);
    }

    /**
     * Devuelve la URL de display para una imagen almacenada.
     * Si relativePath es base64, la devuelve directamente.
     * Si es ruta relativa y estamos en Tauri, usa convertFileSrc.
     */
    function getDisplayUrl(relativePath) {
        if (!relativePath) return null;
        if (relativePath.startsWith('data:')) return relativePath;

        if (_isTauri() && window.__TAURI__.core && window.__TAURI__.core.convertFileSrc && _docDirPath) {
            // Reemplazar barras por si acaso a barras seguras y unir absolute path
            const cleanRel = relativePath.replace(/\//g, '\\');
            const fullPath = `${_docDirPath}DevSnippets\\${cleanRel}`;
            return window.__TAURI__.core.convertFileSrc(fullPath, 'asset');
        }

        return null;
    }

    /**
     * Elimina silenciosamente un attachment físico de disco.
     * Verifica primero que ninguna otra ficha de la DB esté usando el mismo relativePath.
     */
    async function removeImage(relativePath) {
        if (!relativePath || relativePath.startsWith('data:')) return;
        if (!_isTauri()) return;

        try {
            // Verificar si alguien más usa esta imagen (puede pasar si clonaron o editaron el JSON)
            const titles = Storage.getTitles();
            let count = 0;
            for (const t of titles) {
                // Count usage in media cards
                if (t.type === 'media') {
                    for (const col of (t.collections || [])) {
                        for (const card of (col.cards || [])) {
                            if (card.coverImage === relativePath) count++;
                        }
                    }
                }
                // Count usage in technical snippets
                if (t.categories) {
                    for (const cat of (t.categories || [])) {
                        for (const sub of (cat.subtitles || [])) {
                            for (const snip of (sub.snippets || [])) {
                                if (snip.coverImage === relativePath) count++;
                            }
                        }
                    }
                }
            }

            // Si nadie más la usa, la borramos físicamente
            if (count === 0) {
                const fs = window.__TAURI__.fs;
                const { BaseDirectory } = fs;
                const destPath = `DevSnippets/${relativePath}`;
                const remover = fs.removeFile || fs.remove || fs.unlink;
                if (typeof remover === 'function') {
                    await remover(destPath, { baseDir: BaseDirectory.Document });
                    console.info('[Attachments] Imagen huérfana eliminada:', destPath);
                } else if (window.__TAURI__ && window.__TAURI__.tauri && window.__TAURI__.tauri.invoke) {
                    try {
                        await window.__TAURI__.tauri.invoke('plugin:fs|remove_file', { path: destPath, baseDir: BaseDirectory.Document });
                        console.info('[Attachments] Imagen huérfana eliminada (invoke):', destPath);
                    } catch (invErr) {
                        console.warn('[Attachments] invoke fallback failed for remove_file', invErr);
                    }
                } else {
                    console.info('[Attachments] Imagen no eliminada: ninguna API de borrado disponible');
                }
            } else {
                console.info(`[Attachments] Imagen no eliminada, está en uso por ${count} ficha(s):`, relativePath);
            }
        } catch (e) {
            console.warn('[Attachments] No se pudo eliminar imagen huérfana:', e);
        }
    }

    return {
        init,
        selectAndCopy,
        getDisplayUrl,
        resolveImageUrl,
        removeImage,
    };
})();
