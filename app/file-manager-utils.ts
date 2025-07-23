import { App, TFile, TFolder, Notice } from "obsidian";
import DEFAULT_SETTINGS from "./settings";
import MocAdministrator from "./moc-management";

export class FileManagerUtils {
    private app: App;

    constructor(app: App) {
        this.app = app;
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
            const mocAdministrator = new MocAdministrator(file, this.app);
            await mocAdministrator.insertMocToFile();
            await mocAdministrator.connect();

            return file;
        } catch (error) {
            new Notice(`Error creating MOC file: ${error.message}`);
            return;
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

