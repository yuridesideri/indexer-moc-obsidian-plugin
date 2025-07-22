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
// Remember to rename these classes and interfaces!

interface MyPluginSettings {
    mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
    mySetting: "default",
};

export default class MyPlugin extends Plugin {
    settings: MyPluginSettings;
    FileManagerUtils: FileManagerUtils;

    async onload() {
        const {app} = this;

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
            
            console.log("Filtered files by tags:", filteredFilesTags);
            console.log("Filtered files by contentType:", filteredFilesCT);

            await this.FileManagerUtils.createMocFile("new-moc.md", "# MOC Content");
        });
    }

    onunload() { }

    async loadSettings() {
        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            await this.loadData()
        );
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

class SampleSettingTab extends PluginSettingTab {
    plugin: MyPlugin;

    constructor(app: App, plugin: MyPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName("Setting #1")
            .setDesc("It's a secret")
            .addText((text) =>
                text
                    .setPlaceholder("Enter your secret")
                    .setValue(this.plugin.settings.mySetting)
                    .onChange(async (value) => {
                        this.plugin.settings.mySetting = value;
                        await this.plugin.saveSettings();
                    })
            );
    }
}
