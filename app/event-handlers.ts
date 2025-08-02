import { App, debounce, Notice, TAbstractFile, TFile, TFolder } from 'obsidian';
import MocPlugin from './main';
import { FileManagerUtils } from './file-manager-utils';
import MocAdministrator from './moc-management';
import { DEBOUNCE_TIMEOUTS } from './constants';

export default class EventHandlers {
    app: App;
    plugin: MocPlugin;
    fileManagerUtils: FileManagerUtils;
    private pluginInitiatedRenames: Set<string> = new Set();

    // Session tracking para distinguir user-initiated renames de cascading rename events
    // Quando o usuário renomeia uma pasta, Obsidian dispara eventos para todas as subpastas e arquivos
    // Este sistema rastreia a sessão para ignorar eventos cascateados e processar apenas o rename inicial
    private userRenameSession: {
        baseFolder?: string;           // Caminho original da pasta renomeada pelo usuário
        pluginRenamedFolder?: string;  // Caminho após plugin aplicar auto-renaming (ex: emoji prefix)
        timestamp?: number;            // Hora de início da sessão
        processed: Set<string>;        // Todos os caminhos processados nesta sessão
        resetTimer?: NodeJS.Timeout;   // Timer debounced para limpar sessão após inatividade
    } = { processed: new Set() };

    constructor(plugin: MocPlugin) {
        this.app = plugin.app;
        this.plugin = plugin;
        this.fileManagerUtils = new FileManagerUtils(plugin);
    }

    async loadEventHandlers() {
        //Debounceable-Needed Events
        const mocLinksAutoUpdateDebouncer = debounce(async (absFile: TAbstractFile) => {
            const mocAdministrator = new MocAdministrator(this.plugin, absFile as TFile);
            mocAdministrator.connect();
            await mocAdministrator.mocLinksAutoUpdate();
            //Previne ciclos viciosos
            mocLinksAutoUpdateDebouncer.cancel();
        }, DEBOUNCE_TIMEOUTS.MOC_LINKS_AUTO_UPDATE, true);

        const updateIndexMocTreeDebouncer = debounce(async (absFile: TAbstractFile) => {
            const mocAdministrator = new MocAdministrator(this.plugin, absFile as TFile);
            mocAdministrator.connect();
            await mocAdministrator.updateIndexMocTree();
        }, DEBOUNCE_TIMEOUTS.UPDATE_INDEX_MOC_TREE, true);

        // This could be altered in the future because of obsidian api problems
        const fileAutoRenamingDebouncer = debounce(async (absFile: TAbstractFile) => {
            await this.fileManagerUtils.fileAutoRenaming(absFile as TFile);
            fileAutoRenamingDebouncer.cancel();
        }, DEBOUNCE_TIMEOUTS.FILE_AUTO_RENAMING, true);


        //Creating a call stack for fast renaming files
        let promiseStack = Promise.resolve();

        //EventsHandlers
        this.plugin.registerEvent(this.app.vault.on("create", (absFile) => {
            //handle exclusion cases
            if (this.plugin.settings.pathExceptions.some(path => absFile.path.includes(path))) {
                return;
            }
            //
            if (absFile instanceof TFolder) {
                const fileNameAndPath = this.fileManagerUtils.createIndexFileNameAndPath(absFile);
                this.fileManagerUtils.createIndexFile(fileNameAndPath, "", this.plugin.settings.mocPropertyKey, this.plugin.settings.mocPropertyValue, this.plugin.settings.templatePath);
            }
        }));

        this.plugin.registerEvent(this.app.vault.on("rename", async (absFile, oldPath) => {
            //handle exclusion cases
            if (this.plugin.settings.pathExceptions.some(path => absFile.path.includes(path))) {
                return;
            }

            // Check if this rename was initiated by our plugin
            if (this.pluginInitiatedRenames.has(oldPath)) {
                // If this is a folder rename by our plugin, update the session to track the new path
                if (absFile instanceof TFolder) {
                    // Check if this folder is part of the current session
                    const normalizedOldPath = oldPath.replace(/^\/+|\/+$/g, '');
                    const normalizedBasePath = this.userRenameSession.baseFolder?.replace(/^\/+|\/+$/g, '');

                    // Update session if this matches the base folder or was processed in the current session
                    if (normalizedOldPath === normalizedBasePath ||
                        this.userRenameSession.processed.has(oldPath) ||
                        this.userRenameSession.processed.has(normalizedOldPath)) {
                        this.userRenameSession.pluginRenamedFolder = absFile.path;
                        this.resetSessionTimer(); // Reset timer to keep session alive
                    }
                }

                // Allow plugin-generated renames from index files to pass through for auto-renaming
                if (absFile instanceof TFile && this.fileManagerUtils.isIndexFile(absFile)) {
                    promiseStack = promiseStack.then(async () => {
                        await this.fileManagerUtils.fileAutoRenaming(absFile as TFile, (oldPath) => {
                            this.pluginInitiatedRenames.add(oldPath);
                        });
                    });
                }

                this.pluginInitiatedRenames.delete(oldPath);
                return;
            }

            // Detect if this is the start of a new user rename session or part of cascading events
            const isNewRenameSession = this.detectNewRenameSession(absFile, oldPath);

            if (isNewRenameSession) {
                this.startNewRenameSession(absFile, oldPath);
            } else if (this.isPartOfCurrentRenameSession(absFile, oldPath)) {
                // This is a cascading rename, ignore it
                return;
            }

            // Mark this path as processed in current session and reset the timer
            this.userRenameSession.processed.add(oldPath);

            // Also mark the new path as processed to track the rename chain
            if (absFile.path !== oldPath) {
                this.userRenameSession.processed.add(absFile.path);
            }

            this.resetSessionTimer();

            promiseStack = promiseStack.then(async () => {
                updateIndexMocTreeDebouncer(absFile);
            });

            try {
                // Para mover arquivos
                if (absFile.name === oldPath.split("/").pop()) {
                    // Para Index Moc Files que foram movidos (não renomeados): atualizar filename para corresponder nova pasta pai
                    if (absFile instanceof TFile && this.fileManagerUtils.isIndexFile(absFile)) {
                        promiseStack = promiseStack.then(async () => {
                            await this.fileManagerUtils.fileAutoRenaming(absFile as TFile, (oldPath) => {
                                this.pluginInitiatedRenames.add(oldPath);
                            });
                        });
                    }
                }
                // Para renomear arquivos/pastas
                else {
                    // Lidar com renomeação de pasta primeiro
                    if (this.plugin.settings.autoFolderEmoji !== "" && absFile instanceof TFolder) {
                        promiseStack = promiseStack.then(async () => {
                            await this.fileManagerUtils.folderAutoRenaming(absFile, (oldPath) => {
                                this.pluginInitiatedRenames.add(oldPath);
                            });

                            // Aguardar Obsidian atualizar cache de arquivos após rename da pasta
                            await new Promise(resolve => setTimeout(resolve, DEBOUNCE_TIMEOUTS.CACHE_REFRESH_DELAY));

                            // Atualizar index files na pasta renomeada
                            const filesInFolder = this.app.vault.getMarkdownFiles().filter(file =>
                                file.path.startsWith(absFile.path + "/")
                            );

                            const indexFiles = filesInFolder.filter(file =>
                                this.fileManagerUtils.isIndexFile(file)
                            );

                            // Processar index files sequencialmente
                            for (const indexFile of indexFiles) {
                                await this.fileManagerUtils.fileAutoRenaming(indexFile, (oldPath) => {
                                    this.pluginInitiatedRenames.add(oldPath);
                                });
                            }
                        });
                    }
                    // Se é um index file sendo renomeado diretamente (não como parte de folder rename)
                    else if (absFile instanceof TFile && this.fileManagerUtils.isIndexFile(absFile)) {
                        promiseStack = promiseStack.then(async () => {
                            await this.fileManagerUtils.fileAutoRenaming(absFile as TFile, (oldPath) => {
                                this.pluginInitiatedRenames.add(oldPath);
                            });
                        });
                    }
                }
            } catch (error) {
                console.error(`Error handling rename from ${oldPath} to ${absFile.path}:`, error);
            }
        }));

        this.plugin.registerEvent(this.app.vault.on("modify", (absFile) => {
            if (this.plugin.settings.pathExceptions.some(path => absFile.path.includes(path))) {
                return;
            }
            mocLinksAutoUpdateDebouncer(absFile)
            updateIndexMocTreeDebouncer(absFile);
        }));

        this.plugin.registerEvent(this.app.vault.on("delete", async (absFile) => {
            //handle exclusion cases
            if (this.plugin.settings.pathExceptions.some(path => absFile.path.includes(path))) {
                return;
            }
            updateIndexMocTreeDebouncer(absFile);

        }));

    }


    /**
     * Inicia uma nova sessão de rename com timer debounced
     * Isso rastreia o rename inicial iniciado pelo usuário para distingui-lo de eventos cascateados
     */
    private startNewRenameSession(absFile: TAbstractFile, oldPath: string): void {
        // Limpar timer existente se houver
        if (this.userRenameSession.resetTimer) {
            clearTimeout(this.userRenameSession.resetTimer);
        }

        this.userRenameSession.baseFolder = this.fileManagerUtils.getBaseFolderPath(absFile, oldPath);
        this.userRenameSession.timestamp = Date.now();
        this.userRenameSession.processed.clear();

        // Iniciar o timer de timeout da sessão
        this.resetSessionTimer();
    }

    /**
     * Reseta o timer da sessão (debounced)
     * Estende a sessão quando novos eventos de rename são detectados como parte da mesma operação
     */
    private resetSessionTimer(): void {
        // Limpar timer existente
        if (this.userRenameSession.resetTimer) {
            clearTimeout(this.userRenameSession.resetTimer);
        }

        // Definir novo timer para limpar sessão após timeout
        this.userRenameSession.resetTimer = setTimeout(() => {
            this.clearRenameSession();
        }, DEBOUNCE_TIMEOUTS.SESSION_TIMEOUT);
    }

    /**
     * Clears the current rename session
     */
    private clearRenameSession(): void {
        if (this.userRenameSession.resetTimer) {
            clearTimeout(this.userRenameSession.resetTimer);
        }

        this.userRenameSession.baseFolder = undefined;
        this.userRenameSession.pluginRenamedFolder = undefined;
        this.userRenameSession.timestamp = undefined;
        this.userRenameSession.processed.clear();
        this.userRenameSession.resetTimer = undefined;
    }

    /**
     * Detecta se este é o início de uma nova sessão de rename do usuário
     * Retorna true para renames genuínos iniciados pelo usuário, false para eventos cascateados
     */
    private detectNewRenameSession(absFile: TAbstractFile, oldPath: string): boolean {
        // Se não há sessão ativa, esta é uma nova sessão
        if (!this.userRenameSession.timestamp || !this.userRenameSession.baseFolder) {
            return true;
        }

        // Se este caminho não foi processado ainda e não é filho da pasta base
        const wasProcessed = this.userRenameSession.processed.has(oldPath);
        const isChild = this.isChildOfBaseFolder(oldPath);

        // Nova sessão se caminho não processado e não é filho da pasta base
        return !wasProcessed && !isChild;
    }

    /**
     * Checks if this rename is part of the current rename session (cascading effect)
     */
    private isPartOfCurrentRenameSession(absFile: TAbstractFile, oldPath: string): boolean {
        // If no active session, not part of current session
        if (!this.userRenameSession.timestamp || !this.userRenameSession.baseFolder) {
            return false;
        }

        // If this is a child of the base folder being renamed, it's part of the session
        return this.isChildOfBaseFolder(oldPath);
    }

    /**
     * Verifica se um caminho é filho da pasta base atual sendo renomeada
     * Isso inclui verificar contra:
     * - Caminho da pasta base original
     * - Caminho da pasta plugin-renamed (após emoji prefix ser adicionado)
     * - Quaisquer caminhos intermediários processados durante a cadeia de rename
     */
    private isChildOfBaseFolder(path: string): boolean {
        if (!this.userRenameSession.baseFolder) {
            return false;
        }

        // Verificar contra pasta base original
        if (this.fileManagerUtils.isChildOfPath(path, this.userRenameSession.baseFolder)) {
            return true;
        }

        // Verificar contra pasta plugin-renamed se existir
        if (this.userRenameSession.pluginRenamedFolder) {
            if (this.fileManagerUtils.isChildOfPath(path, this.userRenameSession.pluginRenamedFolder)) {
                return true;
            }
        }

        // Verificar se este caminho é filho de alguma pasta processada na sessão
        for (const processedPath of this.userRenameSession.processed) {
            if (this.fileManagerUtils.isChildOfPath(path, processedPath)) {
                return true;
            }
        }

        return false;
    }
}