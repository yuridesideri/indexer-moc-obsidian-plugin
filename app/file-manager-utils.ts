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

    async createIndexFile(filePath: string, content: string, propertyName: string, propertyValue: string | string[], templatePath?: string): Promise<TFile | undefined> {
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
            const file = await this.app.vault.create(filePath, content);
            new Notice(`MOC file created: ${filePath}`);
            await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
                frontmatter[propertyName] = propertyValue;
            });
            const mocAdministrator = new MocAdministrator(this.plugin, file);
            await mocAdministrator.connect();
            await mocAdministrator.mocInjectorToFile();


            return file;
        } catch (error) {
            new Notice(`Error creating MOC file: ${error.message}`);
            return;
        }
    }

    createIndexFileNameAndPath(folder: TFolder): string {
        folder = folder || this.app.vault.getRoot();
        let folderName = folder?.name.replace(/\s+/g, "-");
        if (folder.isRoot()) {
            folderName = folder.vault.getName();
        }
        return `${folder.path}/${this.plugin.settings.indexFilePrefix}${this.plugin.settings.autoRenameIndexFile ? folderName : ""}${this.plugin.settings.indexFileSuffix}.md`;
    }

    async readFileMetadata(file: TFile) {
        return this.app.metadataCache.getFileCache(file);
    }

    async filterFilesByProperty(propertyName: string, propertyValue: any): Promise<TFile[]> {
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

    getDirectParent(AbsFile: TAbstractFile): TFolder {
        let parent = AbsFile.parent;
        if (!parent) {
            return this.app.vault.getRoot();
        }
        else {
            return parent;
        }

    }

    async filterAllFilesByProperty(propertyName: string, propertyValue: any): Promise<TFile[]> {
        const files = this.app.vault.getMarkdownFiles();
        const filteredFiles: TFile[] = [];

        for (const file of files) {
            const metadata = this.app.metadataCache.getFileCache(file);
            if (metadata && metadata.frontmatter) {
                if (metadata.frontmatter[propertyName] === propertyValue || metadata.frontmatter[propertyName]?.includes(propertyValue)) {
                    filteredFiles.push(file);
                }
            }
        }

        return filteredFiles;
    }


    parseEmojiFolderName(folderName: string): string {
        const emoji = this.plugin.settings.autoFolderEmoji;
        if (folderName.startsWith(emoji)) {
            return folderName; // No change needed if it already starts with the emoji
        }
        return emoji ? `${emoji}${folderName}` : folderName;
    }

}