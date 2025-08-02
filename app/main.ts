import {
    Notice,
    Plugin,
    TFile,
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

    async onload() {
        await this.loadSettings();

        this.FileManagerUtils = new FileManagerUtils(this);

        this.EventHandlers = new EventHandlers(this);
        this.EventHandlers.loadEventHandlers();

        //Atualiza MocString
        this.addCommand({
            id: "update-moc-string",
            name: "Update Moc-String on Command",
            callback: async () => {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile) {
                    const mocAdministrator = new MocAdministrator(this, activeFile);
                    await mocAdministrator.updateMocLinks();
                    new Notice(`MOC Links updated for ${activeFile.name}`);
                }
            },
        });


        //TODO: Make a separate file for commands and implement some useful ones.
        // this.addCommand({
        //     id: "unindex-file",
        //     name: "Unindex File",
        //     callback: async () => {
        //         const activeFile = this.app.workspace.getActiveFile();
        //         if (activeFile) {
        //             const mocAdministrator = new MocAdministrator(this, activeFile);
        //             await mocAdministrator.updateMocLinks();
        //             new Notice(`MOC Links updated for ${activeFile.name}`);
        //         }
        //     },
        // });

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