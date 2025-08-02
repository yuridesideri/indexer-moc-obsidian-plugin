/**
 * Constantes do plugin MOC
 * Centraliza valores de configuração e timeouts utilizados em diferentes partes do código
 */

// Timeouts para debounce de eventos (em milissegundos)
export const DEBOUNCE_TIMEOUTS = {
    MOC_LINKS_AUTO_UPDATE: 15000,    // 15 segundos
    UPDATE_INDEX_MOC_TREE: 100,      // 100ms
    FILE_AUTO_RENAMING: 50,          // 50ms
    SESSION_TIMEOUT: 500,            // 500ms para sessões de rename
    CACHE_REFRESH_DELAY: 200,        // 200ms para aguardar atualização do cache do Obsidian
} as const;

// Padrões de arquivos
export const FILE_PATTERNS = {
    MOC_SPAN_START: '<span class="moc-plugin-start">',
    MOC_SPAN_END: '<span class="moc-plugin-end">',
    MOC_REGEX: /<span class="moc-plugin-start">([\s\S]*?)<\/span>([\s\S]*?)<span class="moc-plugin-end">/,
} as const;

// Configurações padrão
export const DEFAULT_CONFIG = {
    LINE_BREAKS_DEFAULT: 10,
} as const;
