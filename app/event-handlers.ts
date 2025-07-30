import { App, debounce, Notice, TAbstractFile, TFile, TFolder } from 'obsidian';
import MocPlugin from './main';
import { FileManagerUtils } from './file-manager-utils';
import MocAdministrator from './moc-management';

export default class EventHandlers {
    app: App;
    plugin: MocPlugin;
    fileManagerUtils: FileManagerUtils;

    constructor(plugin: MocPlugin) {
        this.app = plugin.app;
        this.plugin = plugin;
        this.fileManagerUtils = new FileManagerUtils(plugin);
    }

    async loadEventHandlers() {
        //Debounceable-Needed Events
        const mocLinksAutoUpdateDebouncer = debounce(async (absFile: TAbstractFile) => {
            await this.mocLinksAutoUpdate(absFile);
            mocLinksAutoUpdateDebouncer.cancel();
        }, 30000, true); //30seg

        //EventsHandlers
        this.plugin.registerEvent(this.app.vault.on("create", (absFile) => {
            if (absFile instanceof TFolder) {
                const fileNameAndPath = this.fileManagerUtils.createIndexFileNameAndPath(absFile);
                this.fileManagerUtils.createIndexFile(fileNameAndPath, "", this.plugin.settings.mocPropertyKey, this.plugin.settings.mocPropertyValue, this.plugin.settings.templatePath);
            }
        }));

        this.plugin.registerEvent(this.app.vault.on("rename", async (absFile, oldPath) => {
            //For moving files
            if (absFile.name === oldPath.split("/").pop()) {
                await this.fileManagerUtils.fileAutoRenaming(absFile as TFile);
                await this.updateIndexMocTree();
            }
            // For renaming files
            else {
                // console.log("Fui renomeado de:", oldPath, "para:", absFile.path)
                //Se for TFolder
                if (this.plugin.settings.autoFolderEmoji !== "" && absFile instanceof TFolder) {
                    await this.fileManagerUtils.folderAutoRenaming(absFile);

                }
            }
        }));

        this.plugin.registerEvent(this.app.vault.on("modify", (absFile) => mocLinksAutoUpdateDebouncer(absFile)));

        this.plugin.registerEvent(this.app.vault.on("delete", async (absFile) => {
            // await this.updateIndexMocTree()
        }));

    }


    async mocLinksAutoUpdate(absFile: TAbstractFile): Promise<void> {
        if (this.fileManagerUtils.isIndexFile(absFile)) {
            const mocAdministrator = new MocAdministrator(this.plugin, absFile as TFile);
            mocAdministrator.connect();
            await mocAdministrator.updateMocLinks();
        }
    }

    async updateIndexMocTree(): Promise<void> {
        const files = this.app.vault.getMarkdownFiles().filter(file => this.fileManagerUtils.isIndexFile(file));
        files.forEach(async (file: TFile) => {
            const fileName = file.name;
            await this.mocLinksAutoUpdate(file);
        })
    }
}