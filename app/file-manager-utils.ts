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

    async createIndexFile(filePathWithName: string, content: string, propertyName: string, propertyValue: string | string[], templatePath?: string): Promise<TFile | undefined> {
        //If there's a template, use it!
        if (templatePath) {
            try {
                const templateFile = this.app.vault.getFileByPath(templatePath);
                if (templateFile) {
                    content = await this.app.vault.read(templateFile);
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

    async fileAutoRenaming(file: TFile): Promise<void> {
        if (this.isIndexFile(file)) {
            const parentFolder = this.getDirectParent(file);
            const newFileName = this.createIndexFileNameAndPath(parentFolder);
            if (newFileName !== file.path) {
                try {
                    await this.app.fileManager.renameFile(file, newFileName);
                    const newFileNameOnly = newFileName.split('/').pop() || newFileName;
                    new Notice(`File renamed to: ${newFileNameOnly}`);
                } catch (error) {
                    console.error("Error renaming file:", error);
                }
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

    async folderAutoRenaming(absFile: TAbstractFile): Promise<void> {
        if (absFile instanceof TFolder) {
            const folder = absFile as TFolder;
            const folderName = this.insertEmojiInFolderName(folder.name);
            if (folderName !== folder.name) {
                await this.app.fileManager.renameFile(folder, `${folder.parent?.path}/${folderName}`);
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
                if (metadata.frontmatter[propertyName] === propertyValue && Object.keys(metadata.frontmatter).includes(propertyName)) {
                    return true;
                }
            }
        }

        return false;
    }


    insertEmojiInFolderName(folderName: string): string {
        const emoji = this.plugin.settings.autoFolderEmoji;
        if (folderName.startsWith(emoji)) {
            return folderName; // No change needed if it already starts with the emoji
        }
        return emoji ? `${emoji}${folderName}` : folderName;
    }

}