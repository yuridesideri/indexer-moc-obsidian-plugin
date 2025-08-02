import { App, TFile, TFolder, Notice, TAbstractFile } from 'obsidian';
import MocAdministrator from "./moc-management";
import MocPlugin from "./main";

export class FileManagerUtils {
    private app: App;
    private plugin: MocPlugin;

    constructor(plugininjector: MocPlugin) {
        this.app = plugininjector.app;
        this.plugin = plugininjector;
    }

    async createIndexFile(filePathWithName: string, content: string, propertyName: string, propertyValue: string | string[], templatePathOverwritten?: string): Promise<TFile | undefined> {
        //If there's a template, use it!
        let templatePath = templatePathOverwritten || this.plugin.settings.templatePath;
        if (templatePath) {
            try {
                const templateFile = this.app.vault.getFileByPath(templatePath);
                if (templateFile) {
                    content = await this.app.vault.read(templateFile);
                    console.log(content);
                } else {
                    new Notice(`Template file not found: ${templatePath}`);
                }
            } catch (error) {
                new Notice(`Error reading template file: ${error.message}`);
            }
        }
        //Create the MOC file with the specified content and frontmatter
        try {
            const file = await this.app.vault.create(filePathWithName, content);
            new Notice(`MOC file created: ${filePathWithName}`);
            await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
                frontmatter[propertyName] = propertyValue;
            });
            const mocAdministrator = new MocAdministrator(this.plugin, file);
            mocAdministrator.connect();
            await mocAdministrator.mocInjectorToFile();


            return file;
        } catch (error) {
            new Notice(`Error creating MOC file: ${error.message}`);
            return;
        }
    }

    createIndexFileNameAndPath(folder: TFolder): string {
        folder = folder || this.app.vault.getRoot();
        let folderNameCopy = folder?.name.replace(/\p{Emoji_Presentation}/gu, "");
        if (folder.isRoot()) {
            folderNameCopy = folder.vault.getName();
        }
        return `${folder.isRoot() ? "" : folder.path + "/"}${this.plugin.settings.indexFilePrefix}${this.plugin.settings.autoRenameIndexFile ? folderNameCopy.trim() : ""}${this.plugin.settings.indexFileSuffix}.md`;
    }

    async fileAutoRenaming(file: TFile, trackRename?: (oldPath: string) => void): Promise<void> {
        if (!this.isIndexFile(file)) {
            return;
        }

        const fileExists = await this.app.vault.adapter.exists(file.path);
        if (!fileExists) {
            return;
        }

        this.plugin.BlockEventList.push(file);
        const parentFolder = this.getDirectParent(file);
        const newFileName = this.createIndexFileNameAndPath(parentFolder);

        if (newFileName !== file.path) {
            try {
                if (trackRename) {
                    trackRename(file.path);
                }

                await this.app.fileManager.renameFile(file, newFileName);

                const newFileNameOnly = newFileName.split("/").pop() || "";
                if (newFileNameOnly !== "") {
                    new Notice(`Index file renamed to: ${newFileNameOnly}`);
                }
            } catch (error) {
                console.error("Error renaming index file:", error);
            }
        }
    }

    async readFileMetadata(file: TFile) {
        return this.app.metadataCache.getFileCache(file);
    }

    filterFilesByProperty(propertyName: string, propertyValue: any): TFile[] {
        const files = this.app.vault.getMarkdownFiles();
        const filteredFiles: TFile[] = [];

        for (const file of files) {
            const metadata = this.app.metadataCache.getFileCache(file);
            if (metadata && metadata.frontmatter) {
                if (metadata.frontmatter[propertyName] === propertyValue ||
                    metadata.frontmatter[propertyName]?.includes(propertyValue)) {
                    filteredFiles.push(file);
                }
            }
        }

        return filteredFiles;
    }

    async folderAutoRenaming(absFile: TFolder, trackRename?: (oldPath: string) => void): Promise<void> {
        if (absFile instanceof TFolder) {
            const folder = absFile as TFolder;
            const folderName = this.insertEmojiInFolderName(folder.name);
            if (folderName !== folder.name) {
                const newPath = `${folder.parent?.path ? folder.parent.path + "/" : ""}${folderName}`;

                // Track that we're about to rename this folder
                if (trackRename) {
                    trackRename(folder.path);
                }

                await this.app.fileManager.renameFile(folder, newPath);
                new Notice(`Folder renamed to: ${folderName}`);
            }
        }
    }


    getDirectParent(AbsFile: TAbstractFile): TFolder {
        let parent = AbsFile.parent;
        if (!parent) {
            return this.app.vault.getRoot();
        }
        else {
            return parent;
        }

    }

    isIndexFile(absFile: TAbstractFile): boolean {
        if (absFile instanceof TFile) {
            const metadata = this.app.metadataCache.getFileCache(absFile);
            const propertyName = this.plugin.settings.mocPropertyKey;
            const propertyValue = this.plugin.settings.mocPropertyValue;

            if (metadata && metadata.frontmatter) {
                return metadata.frontmatter[propertyName] === propertyValue &&
                    Object.keys(metadata.frontmatter).includes(propertyName);
            }
        }
        return false;
    }


    insertEmojiInFolderName(folderName: string): string {
        const emoji = this.plugin.settings.autoFolderEmoji;
        if (folderName.startsWith(emoji)) {
            return folderName; // No change needed if it already starts with the emoji
        }
        folderName = folderName.replace(/\p{Emoji_Presentation}/gu, "");

        return emoji ? `${emoji}${folderName}` : folderName;
    }

    /**
     * Obtém o caminho da pasta base para a sessão de rename
     */
    getBaseFolderPath(absFile: TAbstractFile, oldPath: string): string {
        if (absFile instanceof TFolder) {
            return oldPath;
        }
        // Para arquivos, obter o caminho da pasta pai
        return oldPath.substring(0, oldPath.lastIndexOf('/'));
    }

    /**
     * Determina se a pasta renomeada é a pasta raiz sendo renomeada pelo usuário,
     * não uma pasta filha afetada por um rename de pasta pai
     */
    isRootRenamedFolder(renamedFolder: TFolder, oldPath: string): boolean {
        const oldParentPath = oldPath.substring(0, oldPath.lastIndexOf('/'));
        const newParentPath = renamedFolder.path.substring(0, renamedFolder.path.lastIndexOf('/'));

        // Se caminhos pai são iguais, este é um rename direto, não um rename cascateado
        return oldParentPath === newParentPath;
    }

    /**
     * Normaliza um caminho removendo barras no início e fim
     */
    normalizePath(path: string): string {
        return path.replace(/^\/+|\/+$/g, '');
    }

    /**
     * Verifica se um caminho é filho de uma pasta base
     */
    isChildOfPath(childPath: string, basePath: string): boolean {
        const normalizedBase = this.normalizePath(basePath);
        const normalizedChild = this.normalizePath(childPath);

        return normalizedChild === normalizedBase || normalizedChild.startsWith(normalizedBase + '/');
    }

}