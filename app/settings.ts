import { App, PluginSettingTab, Setting } from "obsidian";
import MocPlugin from "./main";


export default class DEFAULT_SETTINGS {
    mocPropertyKey = "moc-property";
    mocPropertyValue = "defaultValue";
    templatePath?: string = undefined;
    mocHeader: string = "MOC Links:";
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
        containerEl.createDiv({ text: "Ex: path/to/your/template.md", cls: "setting-item-description" });

    }
}
