import { App, PluginSettingTab, Setting, TFile, TFolder } from "obsidian";
import MocPlugin from "./main";
import MocAdministrator from "./moc-management";


export default class DEFAULT_SETTINGS {
    mocPropertyKey = "moc-property";
    mocPropertyValue = "defaultValue";
    templatePath?: string = undefined;
    pathExceptions: string[] = [];
    mocHeader: string = "MOC Links:";
    autoRenameIndexFile: boolean = false;
    indexFilePrefix: string = "Index - ";
    indexFileSuffix: string = "";
    autoFolderEmoji: string = "";
}

export class SettingsTab extends PluginSettingTab {
    plugin: MocPlugin;

    constructor(app: App, plugin: MocPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();
        //Moc Property Key
        new Setting(containerEl)
            .setName("Moc Property Key")
            .setDesc("Set your desired property key to be used in MOC files")
            .addText((text) =>
                text
                    .setPlaceholder("Moc property key")
                    .setValue(this.plugin.settings.mocPropertyKey)
                    .onChange(async (value) => {
                        this.plugin.settings.mocPropertyKey = value;
                        await this.plugin.saveSettings();
                    })
            );
        //Moc Property Value
        new Setting(containerEl)
            .setName("Moc Property Value")
            .setDesc("Set your desired property value (to be found inside your property key) to be used in MOC files")
            .addText((text) =>
                text
                    .setPlaceholder("Moc property value")
                    .setValue(this.plugin.settings.mocPropertyValue)
                    .onChange(async (value) => {
                        this.plugin.settings.mocPropertyValue = value;
                        await this.plugin.saveSettings();
                    })
            );
        //Template Path
        new Setting(containerEl)
            .setName("Template Path")
            .setDesc("Set the path to your template file (optional)")
            .addText((text) => {
                text
                    .setPlaceholder("Template path")
                    .onChange(async (value) => {
                        this.plugin.settings.templatePath = value;
                        await this.plugin.saveSettings();
                    });
                if (this.plugin.settings.templatePath) {
                    text.setValue(this.plugin.settings.templatePath);
                }
            });
        containerEl.createDiv({ text: "Ex: path/to/your/template.md", cls: ["setting-item-description", "space-separator"] });

        new Setting(containerEl)
            .setName("Path Exceptions")
            .setDesc("Set paths to be ignored by the plugin (separated by line breaks)").addTextArea((textArea) => {
                textArea
                    .setPlaceholder("Path exceptions")
                    .setValue(this.plugin.settings.pathExceptions.join("\n"))
                    .onChange(async (value) => {
                        this.plugin.settings.pathExceptions = value.split("\n").map((item) => item.trim());
                        await this.plugin.saveSettings();
                    });
            });

        //Index File Prefix
        new Setting(containerEl)
            .setName("Index File Prefix")
            .setDesc("Set the prefix for the index file name.")
            .addText((text) =>
                text
                    .setPlaceholder("Index File Prefix")
                    .setValue(this.plugin.settings.indexFilePrefix)
                    .onChange(async (value) => {
                        this.plugin.settings.indexFilePrefix = value;
                        await this.plugin.saveSettings();
                    })
            );
        //Index File Suffix
        new Setting(containerEl)
            .setName("Index File Suffix")
            .setDesc("Set the suffix for the index file name.")
            .addText((text) =>
                text
                    .setPlaceholder("Index File Suffix")
                    .setValue(this.plugin.settings.indexFileSuffix)
                    .onChange(async (value) => {
                        this.plugin.settings.indexFileSuffix = value;
                        await this.plugin.saveSettings();
                    })
            );
        //Auto-Emoji Folders
        new Setting(containerEl)
            .setName("Auto-Emoji Folders")
            .setDesc("Automatically add specified emoji to folder names' prefixes when created.")
            .addText((text) =>
                text
                    .setPlaceholder("Enter emoji")
                    .setValue(this.plugin.settings.autoFolderEmoji)
                    .onChange(async (value) => {
                        this.plugin.settings.autoFolderEmoji = value;
                        await this.plugin.saveSettings();
                    })
            );
        //Index File Auto-Rename from Folder Name
        new Setting(containerEl)
            .setName("Index File Auto-Rename from Folder Name Radical")
            .setDesc("Automatically rename the index file to match the folder name when creating a new MOC file.")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.autoRenameIndexFile)
                    .onChange(async (value) => {
                        this.plugin.settings.autoRenameIndexFile = value;
                        await this.plugin.saveSettings();
                    })
            );

        //Update Moc Tree
        new Setting(containerEl)
            .setName("Update File Tree")
            .setDesc("Automatically update the File Moc tree and defined settings on click.")
            .addButton((button) =>
                button
                    .setButtonText("Update")
                    .onClick(async () => {
                        // await this.plugin.updateMocTree();
                        const anyFile = this.app.vault.getFiles().find(file => file instanceof TFile);
                        const mocAdmin = new MocAdministrator(this.plugin, anyFile as TFile);
                        const allFolders = this.app.vault.getAllFolders().filter(file => file instanceof TFolder);

                        for (const folder of allFolders) {
                            await this.plugin.FileManagerUtils.folderAutoRenaming(folder as TFolder);
                        }
                        console.log(allFolders);

                        mocAdmin.updateIndexMocTree();
                    }))
    }

}

