/**
 * schema.js — Fábricas de datos por tipo de título
 * DevSnippets | Sistema Multi-Estructura
 *
 * Fuente única de verdad para la forma de cada objeto.
 * Al migrar a SQLite, este módulo mapea directamente a tablas/columnas.
 *
 * Tipos de Título:
 *   "technical" → categories → subtitles → snippets
 *   "media"     → collections → cards
 */

const Schema = (() => {

    // ── ID Generator ──────────────────────────────────────────
    function _id() {
        return '_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
    }

    // ══════════════════════════════════════════════════════════
    // TIPO: TÉCNICO
    // ══════════════════════════════════════════════════════════

    /** Título técnico (estructura existente) */
    function newTechnicalTitle(overrides = {}) {
        return {
            id:         _id(),
            type:       'technical',
            title:      '',
            categories: [],
            ...overrides,
        };
    }

    function newCategory(overrides = {}) {
        return {
            id:        _id(),
            title:     '',
            color:     'blue',
            subtitles: [],
            ...overrides,
        };
    }

    function newSubtitle(overrides = {}) {
        return {
            id:        _id(),
            title:     '',
            isMain:    true,
            parentIds: [],
            snippets:  [],
            ...overrides,
        };
    }

    function newSnippet(overrides = {}) {
        return {
            id:          _id(),
            coverImage:  null,
            title:       '',
            description: '',
            code:        '',
            contentType: 'code',
            fav:         false,
            ...overrides,
        };
    }

    // ══════════════════════════════════════════════════════════
    // TIPO: MEDIA / BIBLIOTECA
    // ══════════════════════════════════════════════════════════

    /** Título de tipo Biblioteca/Media */
    function newMediaTitle(overrides = {}) {
        return {
            id:          _id(),
            type:        'media',
            title:       '',
            collections: [],
            ...overrides,
        };
    }

    /**
     * Colección dentro de un título media.
     * Ejemplo: "Monogatari Series"
     */
    function newCollection(overrides = {}) {
        return {
            id:    _id(),
            title: '',
            cards: [],
            ...overrides,
        };
    }

    /**
     * Ficha/Card individual dentro de una colección.
     * Ejemplo: "Bakemonogatari"
     *
     * coverImage: ruta relativa interna ("attachments/xxx.jpg") o null
     * tags:       array de IDs de tags globales
     * customFields: array de { key, value } definidos por el usuario
     * links:      array de { label, url }
     */
    function newCard(overrides = {}) {
        return {
            id:           _id(),
            coverImage:   null,
            title:        '',
            altTitle:     '',
            synopsis:     '',
            status:       'Sin estado',
            mediaSubtype: 'episodic',
            year:         null,
            studio:       '',
            seasons:      null,
            chapters:     null,
            platform:     '',
            playtime:     '',
            progress:     '',
            notes:        '',
            links:        [],
            tags:         [],
            customFields: [],
            ...overrides,
        };
    }

    /** Link dentro de una ficha */
    function newLink(overrides = {}) {
        return { label: '', url: '', ...overrides };
    }

    /** Campo personalizado dentro de una ficha */
    function newCustomField(overrides = {}) {
        return { key: '', value: '', ...overrides };
    }

    // ══════════════════════════════════════════════════════════
    // TAGS GLOBALES
    // ══════════════════════════════════════════════════════════

    /** Tag global reutilizable entre todas las fichas */
    function newTag(overrides = {}) {
        return {
            id:    _id(),
            name:  '',
            color: 'blue',
            ...overrides,
        };
    }

    // ══════════════════════════════════════════════════════════
    // CONSTANTES
    // ══════════════════════════════════════════════════════════

    const TITLE_TYPES = {
        technical: { label: 'Técnico',          icon: 'code-2',   desc: 'Categorías → Subtítulos → Snippets' },
        media:     { label: 'Biblioteca / Media', icon: 'film',     desc: 'Colecciones → Fichas de información' },
    };

    const MEDIA_STATUSES = [
        'Sin estado',
        'Pendiente',
        'Viendo',
        'Jugando',
        'Completado',
        'En pausa',
        'Abandonado',
    ];

    const MEDIA_SUBTYPES = {
        episodic: { label: '🎬 Episódico (Anime, Serie)', fields: ['studio', 'seasons', 'chapters'] },
        game:     { label: '🎮 Juego', fields: ['studio', 'platform', 'playtime', 'progress'] },
        general:  { label: '📦 General', fields: [] }
    };

    const TAG_COLORS = ['blue', 'green', 'red', 'purple', 'yellow', 'cyan', 'orange', 'gray'];

    /** Crea un título del tipo indicado */
    function newTitle(type = 'technical', overrides = {}) {
        if (type === 'media') return newMediaTitle(overrides);
        return newTechnicalTitle(overrides);
    }

    return {
        // Generador de IDs (compartido)
        generateId: _id,

        // Tipo técnico
        newTitle,
        newTechnicalTitle,
        newCategory,
        newSubtitle,
        newSnippet,

        // Tipo media
        newMediaTitle,
        newCollection,
        newCard,
        newLink,
        newCustomField,

        // Tags
        newTag,

        // Constantes
        TITLE_TYPES,
        MEDIA_STATUSES,
        MEDIA_SUBTYPES,
        TAG_COLORS,
    };
})();
