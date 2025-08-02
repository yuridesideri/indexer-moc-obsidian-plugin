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
import EventHandlers from './event-handlers';



export default class MocPlugin extends Plugin {
    settings: InstanceType<typeof DEFAULT_SETTINGS>;
    FileManagerUtils: FileManagerUtils;
    EventHandlers: EventHandlers;
    BlockEventList: TFile[] = [];

    async onload() {
        const { app } = this;

        await this.loadSettings();

        this.FileManagerUtils = new FileManagerUtils(this);

        this.EventHandlers = new EventHandlers(this);
        this.EventHandlers.loadEventHandlers();

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


        this.addRibbonIcon("loader-pinwheel", "Inject to Active File", async (evt) => {
            const activeFile = this.app.workspace.getActiveFile();
            if (activeFile) {
                const mocAdmin = new MocAdministrator(this, activeFile);
                mocAdmin.connect();
                await mocAdmin.mocInjectorToFile();
            }
            else {
                new Notice("No active file found.");
            }
        });


        //Deleta MocString
        this.addCommand({
            id: "delete-moc-string",
            name: "Async Example",
            callback: async () => {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile) {
                    console.log("Start Reading File");
                    const cache = await this.app.fileManager.renameFile(activeFile, "NewFileName.md");
                    console.log("File Read", cache);
                }

            },
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
}