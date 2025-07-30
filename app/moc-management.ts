import { TFile, App, Notice, TFolder } from "obsidian";
import MocPlugin from "./main";
import { FileManagerUtils } from "./file-manager-utils";

export default class MocAdministrator {
    self_file: TFile;
    MocLinks: {
        parent: TFile | null | undefined;
        children: TFile[] | null | undefined;
        files: TFile[] | null | undefined;
    }
    settings
    plugin: MocPlugin;
    fileManager: FileManagerUtils;
    app: App;

    constructor(pluginInjector: MocPlugin, self_file: TFile) {
        this.app = pluginInjector.app;
        this.plugin = pluginInjector;
        this.self_file = self_file;
        this.settings = pluginInjector.settings
        this.fileManager = new FileManagerUtils(pluginInjector);
    }

    connect() {
        // const mocString = await this.getMocString();
        //If MOC STRING is empty, create a new one (Injection) - Será que eu faço isso junto?
        this.MocLinks = this.generateMocConnections();
        // await this.parseMocString(mocString);
    }



    private async getMocString() {
        const fileContent = await this.app.vault.read(this.self_file);
        const mocRegex = /<span class="moc-plugin-start">([\s\S]*?)<\/span>([\s\S]*?)<span class="moc-plugin-end">/;
        const match = fileContent.match(mocRegex);
        if (match) {
            return match[2].trim();
        }
        return "";
    }

    private parseMocString(mocString: string) {
        const lines = mocString.split("\n");
        const mocLinks: typeof this.MocLinks = {
            parent: undefined,
            children: undefined,
            files: undefined,
        };


        for (const line of lines) {
            const parentMatch = line.match(/#### Parent:\n- \[\[(.*?)\]\]/);
            const childrenMatch = line.match(/#### Children:\n- \[\[(.*?)\]\]/g);
            const filesMatch = line.match(/#### Files:\n- \[\[(.*?)\]\]/g);



            if (parentMatch) {
                mocLinks.parent = this.app.vault.getFileByPath(parentMatch[1]);
            }

            if (childrenMatch) {
                mocLinks.children = childrenMatch
                    .map(match => this.app.vault.getFileByPath(match[1]))
                    .filter((file): file is TFile => file !== null);
            }

            if (filesMatch) {
                mocLinks.files = filesMatch
                    .map(match => this.app.vault.getFileByPath(match[1]))
                    .filter((file): file is TFile => file !== null);
            }
        }

        return mocLinks;
    }

    async deleteMocString(resetLines: boolean = true): Promise<void> {
        let mocRegex: RegExp;
        if (resetLines) {
            mocRegex = /((?:^[ \t]*\r?\n)*)^---[\s\r\n]*<span class="moc-plugin-start">MOC Links:<\/span>[\s\S]*?<span class="moc-plugin-end">\s*<\/span>[\s\r\n]*---[\s\r\n]*((?:^[ \t]*\r?\n)*)$/gm;
        }
        else {
            mocRegex = /^---[\s\r\n]*<span class="moc-plugin-start">MOC Links:<\/span>[\s\S]*?<span class="moc-plugin-end">\s*<\/span>[\s\r\n]*---[\s\r\n]*/gm;
        }
        try {
            this.app.vault.process(this.self_file, (content) => {
                return content.replace(mocRegex, "");
            }).catch((err) => {
                console.error("Error deleting MOC string:", err);
            });
        } catch (err) {
            console.log(err)
        }
    }

    generateMocConnections(): typeof this.MocLinks {
        const mocLinks: typeof this.MocLinks = {
            parent: this.getParentLink(),
            children: this.getChildrenLinks(),
            files: this.getFilesLinks()
        };
        return mocLinks;
    }

    async updateMocLinks() {
        await this.deleteMocString(false);
        await this.mocInjectorToFile(0);

        //TODO: Update siblings
    }



    //Updates Files inside the ObjectAdministrator
    getFilesLinks(self_file = this.self_file): typeof this.MocLinks.files {
        let filesArr: typeof this.MocLinks.files = undefined;
        // Caso o pai seja o root, pega todos os arquivos do diretório raíz
        if (!self_file.parent) {
            // @ts-ignore
            filesArr = this.app.vault.getRoot().children.filter((absFile) => absFile instanceof TFile && absFile.path !== self_file.path);
        }
        else {
            // @ts-ignore
            filesArr = self_file.parent.children.filter((absFile) => absFile instanceof TFile && absFile.path !== self_file.path);
        }
        if (!filesArr || filesArr.length === 0) {
            return null;
        }

        return filesArr;
    }

    getParentLink(self_file = this.self_file) {
        let parentFolder = self_file.parent;
        if (!parentFolder) {
            return null;
        }
        parentFolder = parentFolder.parent;
        while (parentFolder) {
            // @ts-ignore
            const indexFilesChildren: TFile[] = parentFolder.children.filter((child) => {
                if (child instanceof TFile) {
                    const frontmatterCopy = this.app.metadataCache.getFileCache(child)?.frontmatter;
                    //Check if the frontmatter has the mocPropertyKey and mocPropertyValue
                    if (frontmatterCopy && frontmatterCopy[this.settings.mocPropertyKey] === this.settings.mocPropertyValue) {
                        return true;
                    }
                }
            });
            if (indexFilesChildren.length === 1) {
                return indexFilesChildren[0];
            }
            else if (indexFilesChildren.length > 1) {
                // new Notice(`Multiple Index Files with MOC found inside folder: ${parentFolder.path}
                //     This might lead to errors in the plugin.`);
                return indexFilesChildren[0];
            }
            parentFolder = parentFolder.parent;
        }
        // new Notice("Can't find parent MOC file for: " + self_file.name);
        return null;
    }


    getChildrenLinks(self_file = this.self_file) {
        const parentFolder = this.fileManager.getDirectParent(self_file);
        let childrenLinks: TFile[] = [];
        const recursiveChildrenFinder = (startingFolder: TFolder) => {
            let directChildrenFolders: TFolder[] = [];
            let directChildrenFiles: TFile[] = [];
            startingFolder.children.forEach((child) => {
                if (child instanceof TFile) {
                    const frontmatterCopy = this.app.metadataCache.getFileCache(child)?.frontmatter;
                    if (frontmatterCopy && frontmatterCopy[this.settings.mocPropertyKey] === this.settings.mocPropertyValue) {
                        directChildrenFiles.push(child);
                    }
                }
                else if (child instanceof TFolder) {
                    directChildrenFolders.push(child);
                }
            });
            if (directChildrenFiles.length === 0) {
                directChildrenFolders.forEach((folder) => {
                    recursiveChildrenFinder(folder);
                });
            }
            if (directChildrenFiles.length > 1) {
                // new Notice(`Multiple MOC files found in single folder: ${startingFolder.path}`);
            }

            childrenLinks = [...childrenLinks, ...directChildrenFiles];
        }
        parentFolder.children.forEach((child) => {
            if (child instanceof TFolder) {
                recursiveChildrenFinder(child);
            }
        });

        if (childrenLinks.length === 0) {
            // new Notice("No children MOC files found in the current folder.");
            return null;
        }

        return childrenLinks;
    }


    mocStringGenerator(): string {
        const header = this.settings.mocHeader;
        const { parent, children, files } = this.MocLinks;
        const parentLinkString = parent ? `${this.app.fileManager.generateMarkdownLink(parent, this.self_file.path)}` : "*None*";
        const childrenLinksString = children && children.length > 0 ? children.map(child => `- ${this.app.fileManager.generateMarkdownLink(child, this.self_file.path)}`).join("\n") : "- *None*";
        const filesLinksString = files && files.length > 0 ? files.map(file => `- ${this.app.fileManager.generateMarkdownLink(file, this.self_file.path)}`).join("\n") : "- *None*";
        const mocString = `---
<span class="moc-plugin-start">${header}</span>
#### Parent:
- ${parentLinkString}
#### Children:
${childrenLinksString}
#### Files:
${filesLinksString}
<span class="moc-plugin-end"> </span>
---`;

        return mocString;
    }

    async mocInjectorToFile(lineBreaks: number = 10): Promise<void> {
        try {
            const moc = this.mocStringGenerator();
            // Escreve de volta o conteúdo
            const returnValue = this.app.vault.process(this.self_file, (content) => {
                const endsWithNewline = content.endsWith('\n');
                const newContent = (endsWithNewline ? content : `${content}\n`) + (`${'\n'.repeat(lineBreaks)}`) + moc;
                return newContent;
            }).catch((err) => {
                console.error("Error inserting MOC links:", err);
            });
        } catch (error) {
            // console.log(error);
            new Notice(`Error inserting MOC links: ${error.message}, Check if the Moc Administrator is Connected to the file.`);
        }
    }

}
