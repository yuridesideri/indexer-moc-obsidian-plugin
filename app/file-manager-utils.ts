import { App, TFile, TFolder, Notice } from "obsidian";

export class FileManagerUtils {
    private app: App;

    constructor(app: App) {
        this.app = app;
    }

    async createMocFile(filePath: string, content: string): Promise<TFile | null> {
        try {
            const file = await this.app.vault.create(filePath, content);
            new Notice(`MOC file created: ${filePath}`);
            await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
                frontmatter['nova-propriedade'] = 'valor';
            });
            return file;
        } catch (error) {
            new Notice(`Error creating MOC file: ${error.message}`);
            return null;
        }


    }

    async readFileMetadata(file: TFile) {
        return this.app.metadataCache.getFileCache(file);
    }

    getAllVaultFolders(): TFolder[] {
        return this.app.vault.getAllFolders();
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
}

