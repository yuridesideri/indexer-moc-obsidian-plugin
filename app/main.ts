import {
    App,
    Editor,
    MarkdownView,
    Modal,
    Notice,
    Plugin,
    PluginSettingTab,
    Setting,
    TFile,
    TFolder,
} from "obsidian";

import { FileManagerUtils } from "./file-manager-utils";
import { SettingsTab } from "./settings";
import DEFAULT_SETTINGS from "./settings";



export default class MocPlugin extends Plugin {
    settings: InstanceType<typeof DEFAULT_SETTINGS>;
    FileManagerUtils: FileManagerUtils;

    async onload() {
        const { app } = this;

        await this.loadSettings();

        // Inicializar o FileManagerUtils
        this.FileManagerUtils = new FileManagerUtils(app);

        this.addRibbonIcon("notepad-text", "Read File", async (evt) => {
            // Usando o FileManagerUtils
            const activeFile = app.workspace.getActiveFile();
            if (activeFile) {
                const metadata = await this.FileManagerUtils.readFileMetadata(activeFile);
                console.log("Metadata:", metadata);
            }

            const filteredFilesTags = await this.FileManagerUtils.filterFilesByProperty("tags", "me_mostra");
            const filteredFilesCT = await this.FileManagerUtils.filterFilesByProperty("contentType", "moc");


            const mocProperty = this.settings.mocPropertyKey;
            const mocValue = this.settings.mocPropertyValue;
            const { templatePath } = this.settings;
            await this.FileManagerUtils.createIndexFile("new-index.md", "# MOC Content", mocProperty, mocValue, templatePath);
        });
    }

    onunload() { }

    async loadSettings() {
        this.settings = Object.assign(
            {},
            new DEFAULT_SETTINGS(),
            await this.loadData()
        );
        this.addSettingTab(new SettingsTab(this.app, this));
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    readVaultFolders(): TFolder[] {
        const folders = this.app.vault.getAllFolders();
        return folders;
    }

    async readMetadataFromFile() {
        const arquivo = this.app.workspace.getActiveFile();
        if (!arquivo) {
            new Notice("No file is currently open.");
            return;
        }
        const metadata = this.app.metadataCache.getFileCache(arquivo);

        // const conteudo = await this.app.vault.read(arquivo);
        return metadata;
    }

    async filterFilesByProperty(propertyName: string, propertyValue: any): Promise<TFile[]> {
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
}
class SampleModal extends Modal {
    constructor(app: App) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.setText("Woah!");
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

