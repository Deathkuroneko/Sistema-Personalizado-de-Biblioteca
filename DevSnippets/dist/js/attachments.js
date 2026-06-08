/**
 * attachments.js — Gestión de imágenes y adjuntos
 * DevSnippets | Sistema Multi-Estructura
 *
 * En Tauri:
 *   - Copia el archivo seleccionado a Documents/DevSnippets/attachments/{media|technical}/
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
            const absPath = `${_docDirPath}DevSnippets\\${relativePath.replace(/\//g, '\\')}`;
            return window.__TAURI__.core.convertFileSrc(absPath, 'asset');
        }

        return null;
    }

    /**
     * Devuelve la URL del thumbnail de una imagen almacenada.
     * Muta el relativePath para apuntar a _thumb.jpg.
     */
    function getThumbnailUrl(relativePath) {
        if (!relativePath) return null;
        if (relativePath.startsWith('data:') || relativePath.startsWith('blob:')) return relativePath;

        if (_isTauri() && window.__TAURI__.core && window.__TAURI__.core.convertFileSrc && _docDirPath) {
            const lastSlash = relativePath.lastIndexOf('/');
            const lastDot = relativePath.lastIndexOf('.');
            
            let thumbRel = relativePath;
            if (lastSlash >= 0 && lastDot > lastSlash) {
                const dir = relativePath.substring(0, lastSlash);
                const name = relativePath.substring(lastSlash + 1, lastDot);
                thumbRel = `${dir}/thumb/${name}_thumb.avif`;
            } else if (lastDot > 0) {
                thumbRel = relativePath.substring(0, lastDot) + '_thumb.avif';
            }
            const absPath = `${_docDirPath}DevSnippets\\${thumbRel.replace(/\//g, '\\')}`;
            return window.__TAURI__.core.convertFileSrc(absPath, 'asset');
        }

        return relativePath; // fallback
    }

    function _normalizeAttachmentType(type) {
        return type === 'media' ? 'media' : 'technical';
    }

    /**
     * Abre el selector de archivo de imagen y procesa la selección.
     * @param {string} cardId - ID de la card (para nombrar el archivo)
     * @param {string} type - "media" o "technical"
     * @param {Function} onSuccess - cb({ relativePath, displayUrl })
     * @param {Function} onError   - cb(errorMessage)
     */
    async function selectAndCopy(cardId, type, onSuccess, onError) {
        if (typeof type === 'function') {
            onError = onSuccess;
            onSuccess = type;
            type = 'technical';
        }

        if (_isTauri()) {
            const invoke = window.__TAURI__.core.invoke || window.__TAURI__.invoke;
            try {
                const selectedPath = await invoke('plugin:dialog|open', {
                    options: {
                        multiple: false,
                        filters: [{ name: 'Imágenes', extensions: ['png', 'jpeg', 'jpg', 'webp', 'avif'] }]
                    }
                });
                if (!selectedPath) return; // User cancelled
                
                await _copyToAttachmentsTauri(selectedPath, cardId, type, onSuccess, onError);
            } catch (e) {
                console.error("[Attachments] Error abriendo selector de archivos Tauri:", e);
                if (onError) onError(e.message || 'Error al abrir selector de archivos');
            }
            return;
        }

        // Fallback browser mode
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
                _toBase64(file, onSuccess, onError);
            } catch (e) {
                if (onError) onError(e.message || 'Error al procesar imagen');
            }
        });

        input.click();
    }

    /**
     * Genera un thumbnail (JPEG 85%) usando Canvas de HTML5.
     * @param {File} file - El archivo original
     * @param {number} maxSize - Tamaño máximo para ancho o alto
     * @returns {Promise<Blob>}
     */
    async function _generateThumbnail(file, maxSize = 256) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxSize) {
                            height = Math.round((height * maxSize) / width);
                            width = maxSize;
                        }
                    } else {
                        if (height > maxSize) {
                            width = Math.round((width * maxSize) / height);
                            height = maxSize;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob(blob => {
                        if (blob) resolve(blob);
                        else reject(new Error('Canvas toBlob falló'));
                    }, 'image/webp', 0.85);
                };
                img.onerror = () => reject(new Error('Error cargando imagen para thumbnail'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('Error leyendo archivo para thumbnail'));
            reader.readAsDataURL(file);
        });
    }

    let _progressToast = null;

    /**
     * Pasa la ruta física a Rust para procesamiento (0ms UI freeze)
     */
    async function _copyToAttachmentsTauri(absPath, cardId, type, onSuccess, onError) {
        try {
            const attachmentType = _normalizeAttachmentType(type);
            const invoke = window.__TAURI__.core.invoke || window.__TAURI__.invoke;
            const listen = window.__TAURI__.event?.listen || window.__TAURI__.core?.listen;
            
            let unlisten = null;
            if (listen) {
                // P-14b: Escuchar eventos de progreso desde Rust
                unlisten = await listen('image-progress', (event) => {
                    if (event.payload.card_id === cardId) {
                        const msg = `[${event.payload.progress}%]<br/>${event.payload.status}`;
                        const progressEl = document.getElementById(`img-progress-${cardId}`);
                        if (progressEl) {
                            progressEl.innerHTML = `<span>${msg}</span>`;
                            progressEl.style.display = 'flex';
                        } else {
                            if (typeof App !== 'undefined') App.showToast(`[${event.payload.progress}%] ${event.payload.status}`, false);
                        }
                    }
                });
            }

            const thumbSize = attachmentType === 'media' ? 512 : 256;
            
            // Rust se encarga de leer el path absoluto y procesar
            const [relPath, thumbRelPath] = await invoke('process_and_save_image', {
                sourcePath: absPath,
                cardId: cardId,
                typeDir: attachmentType,
                thumbSize: thumbSize
            });

            if (unlisten) unlisten();
            
            const progressEl = document.getElementById(`img-progress-${cardId}`);
            if (progressEl) progressEl.style.display = 'none';

            // Construir URL de visualización
            let displayUrl = null;
            if (window.__TAURI__.core && window.__TAURI__.core.convertFileSrc && _docDirPath) {
                const absPath = `${_docDirPath}DevSnippets\\${relPath.replace(/\//g, '\\')}`;
                displayUrl = window.__TAURI__.core.convertFileSrc(absPath, 'asset');
            }

            console.debug('[Attachments] Imagen procesada (AVIF) y guardada en:', relPath);
            // Notify listeners in the UI that the attachment finished processing
            try {
                if (typeof window !== 'undefined' && window.dispatchEvent) {
                    window.dispatchEvent(new CustomEvent('attachment:processed', { detail: { cardId, relativePath: relPath, displayUrl } }));
                }
            } catch (e) { console.warn('[Attachments] Could not dispatch attachment:processed event', e); }

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
                
                const lastSlash = relativePath.lastIndexOf('/');
                const lastDot = relativePath.lastIndexOf('.');
                
                let thumbRel = relativePath;
                if (lastSlash >= 0 && lastDot > lastSlash) {
                    const dir = relativePath.substring(0, lastSlash);
                    const name = relativePath.substring(lastSlash + 1, lastDot);
                    thumbRel = `${dir}/thumb/${name}_thumb.avif`;
                } else if (lastDot > 0) {
                    thumbRel = relativePath.substring(0, lastDot) + '_thumb.avif';
                }
                const thumbDestPath = `DevSnippets/${thumbRel}`;

                const remover = fs.removeFile || fs.remove || fs.unlink;
                if (typeof remover === 'function') {
                    await remover(destPath, { baseDir: BaseDirectory.Document });
                    try { await remover(thumbDestPath, { baseDir: BaseDirectory.Document }); } catch (e) {}
                    console.debug('[Attachments] Imagen huérfana eliminada:', destPath);
                } else if (window.__TAURI__ && window.__TAURI__.tauri && window.__TAURI__.tauri.invoke) {
                    try {
                        await window.__TAURI__.tauri.invoke('plugin:fs|remove_file', { path: destPath, baseDir: BaseDirectory.Document });
                        try { await window.__TAURI__.tauri.invoke('plugin:fs|remove_file', { path: thumbDestPath, baseDir: BaseDirectory.Document }); } catch (e) {}
                        console.debug('[Attachments] Imagen huérfana eliminada (invoke):', destPath);
                    } catch (invErr) {
                        console.warn('[Attachments] invoke fallback failed for remove_file', invErr);
                    }
                } else {
                    console.debug('[Attachments] Imagen no eliminada: ninguna API de borrado disponible');
                }
            } else {
                console.debug(`[Attachments] Imagen no eliminada, está en uso por ${count} ficha(s):`, relativePath);
            }
        } catch (e) {
            console.warn('[Attachments] No se pudo eliminar imagen huérfana:', e);
        }
    }

    return {
        init,
        selectAndCopy,
        getDisplayUrl,
        getThumbnailUrl,
        resolveImageUrl,
        removeImage,
    };
})();
