import {
    App,
    Editor,
    MarkdownView,
    Modal,
    Notice,
    Plugin,
    PluginSettingTab,
    Setting,
    TAbstractFile,
    TFile,
    TFolder,
} from "obsidian";

import { FileManagerUtils } from "./file-manager-utils";
import { SettingsTab } from "./settings";
import DEFAULT_SETTINGS from "./settings";
import MocAdministrator from "./moc-management";



export default class MocPlugin extends Plugin {
    settings: InstanceType<typeof DEFAULT_SETTINGS>;
    FileManagerUtils: FileManagerUtils;

    async onload() {
        const { app } = this;

        await this.loadSettings();

        // Inicializar o FileManagerUtils
        this.FileManagerUtils = new FileManagerUtils(this);

        this.addRibbonIcon("notepad-text", "Create File", async (evt) => {
            const mocProperty = this.settings.mocPropertyKey;
            const mocValue = this.settings.mocPropertyValue;
            const { templatePath } = this.settings;
            const root = app.vault.getRoot();
            const activeFile = app.workspace.getActiveFile();
            const activeFolder = activeFile?.parent;
            const fileNameAndPath = this.FileManagerUtils.createIndexFileNameAndPath(activeFolder || root);


            const content = `# This is a test file for MOC
This file is created to test the MOC functionality in Obsidian.




`
            await this.FileManagerUtils.createIndexFile(fileNameAndPath, content, mocProperty, mocValue, templatePath);
        });


        this.addRibbonIcon("loader-pinwheel", "Read Active File", async (evt) => {
            const activeFile = this.app.workspace.getActiveFile();
            if (activeFile) {
                const mocAdmin = new MocAdministrator(this, activeFile);
                await mocAdmin.connect();
                await mocAdmin.mocInjectorToFile();
            }
            else {
                new Notice("No active file found.");
            }
        });

        if (this.settings.autoFolderEmoji !== "") {
            console.log("Auto Folder Emoji is enabled:", this.settings.autoFolderEmoji);
            this.registerEvent(this.app.vault.on("rename", async (absFile: TAbstractFile) => {
                if (absFile instanceof TFolder) {
                    const folder = absFile as TFolder;
                    const folderName = this.FileManagerUtils.parseEmojiFolderName(folder.name);
                    if (folderName !== folder.name) {
                        await this.app.fileManager.renameFile(folder, `${folder.parent?.path}/${folderName}`);
                        new Notice(`Folder renamed to: ${folderName}`);
                    }
                }
            }));
        }

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
}