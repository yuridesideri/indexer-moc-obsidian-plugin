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

        this.plugin.registerEvent(this.app.vault.on("rename", async (absFile) => {
            if (this.plugin.settings.autoFolderEmoji !== "") {
                await this.fileManagerUtils.folderAutoRenaming(absFile)
            }
            await this.updateIndexMocTree();
            await this.fileManagerUtils.fileAutoRenaming(absFile as TFile);
            
        }));

        this.plugin.registerEvent(this.app.vault.on("modify", (absFile) => mocLinksAutoUpdateDebouncer(absFile)));

        this.plugin.registerEvent(this.app.vault.on("delete", async (absFile) => {
            await this.updateIndexMocTree()
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
        const folders = [this.app.vault.getRoot(), ...this.app.vault.getAllFolders()];

        folders.forEach(async (folder: TFolder) => {
            const children = folder.children;
            children.forEach(async (child: TAbstractFile) => {
                await this.mocLinksAutoUpdate(child);
            })
        })
    }
}