import { TFile, App, Notice, TFolder, TAbstractFile } from "obsidian";
import DEFAULT_SETTINGS from "./settings";
import { get } from "http";

new DEFAULT_SETTINGS();

export default class MocAdministrator {
    self_file: TFile;
    MocLinks: {
        parent: TFile | null | undefined;
        children: TFile[] | null | undefined;
        files: TFile[] | null | undefined;
    }
    settings
    private app: App;

    constructor(
        self_file: TFile,
        app: App,
        settings: InstanceType<typeof DEFAULT_SETTINGS> = new DEFAULT_SETTINGS()
    ) {
        this.self_file = self_file;
        this.app = app;
        this.settings = settings;
    }

    async connect(): Promise<void> {
        const mocString = await this.getStringMoc();
        await this.parseMocString(mocString);
    }

    private async getStringMoc() {
        const fileContent = await this.app.vault.read(this.self_file);
        const mocRegex = /<h1 class="moc-plugin-start">([\s\S]*?)<\/h1>([\s\S]*?)<div class="moc-plugin-end">/;
        const match = fileContent.match(mocRegex);
        if (match) {
            return match[2].trim();
        }
        return "";
    }

    private async parseMocString(mocString: string) {
        const lines = mocString.split("\n");
        const mocLinks: typeof this.MocLinks = {
            parent: undefined,
            children: undefined,
            files: undefined,
        };


        // for (const line of lines) {
        //     const parentMatch = line.match(/#### Parent:\n- \[\[(.*?)\]\]/);
        //     const childrenMatch = line.match(/#### Children:\n- \[\[(.*?)\]\]/g);
        //     const filesMatch = line.match(/#### Files:\n- \[\[(.*?)\]\]/g);



        //     if (parentMatch) {
        //         mocLinks.parent = this.app.vault.getFileByPath(parentMatch[1]);
        //     }

        //     if (childrenMatch) {
        //         mocLinks.children = childrenMatch.map(match => {const file = this.app.vault.getFileByPath(match[1]); return file ? file : null; });
        //     }

        //     if (filesMatch) {
        //         mocLinks.files = filesMatch.map(match => this.app.vault.getFileByPath(match[1]));
        //     }
        // }

        return mocLinks;
    }

    async insertMocToFile() {
        try {
            // const updatedContent = this.addMocLinksToContent(content, mocLinks);
            let content = await this.app.vault.read(this.self_file);

            // Verifica se a última linha já termina com uma quebra de linha
            const endsWithNewline = content.endsWith('\n');
            const header = new DEFAULT_SETTINGS().mocHeader;
            // Cria o MOC a partir dos links
            const moc = `
---
<h1 class="moc-plugin-start">${header}</h1>
#### Parent:

#### Children:

#### Files:

<div class="moc-plugin-end"> </div>
---`;
            // Se precisar concatenar, use \n se não terminar com \n
            const newContent = (endsWithNewline ? content : `${content}\n`) + moc;

            // Escreve de volta o conteúdo
            await this.app.vault.modify(this.self_file, newContent);

            new Notice('Texto adicionado com sucesso!');

        } catch (error) {
            new Notice(`Error inserting MOC links: ${error.message}`);
        }
    }

    mocUpdater = {
        ParentLinks: () => {
            // Implementar lógica para atualizar links de pais
        },
        ChildrenLinks: () => {
            // Implementar lógica para atualizar links de filhos
        },
        FilesLinks: () => {
            // Implementar lógica para atualizar links de arquivos
        },
        AllLinks: () => {
            this.mocUpdater.ParentLinks();
            this.mocUpdater.ChildrenLinks();
            this.mocUpdater.FilesLinks();
        }
    }

    private getDirectParent(AbsFile: TAbstractFile): TFolder {
        let parent = AbsFile.parent;
        if (!parent) {
            return this.app.vault.getRoot();
        }
        else {
            return parent;
        }

    }

    //Updates Files inside the ObjectAdministrator
    getFilesLinks(): typeof this.MocLinks.files {
        const { self_file } = this;
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

    getParentLink() {
        const { self_file } = this;
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
                new Notice(`Multiple Index Files with MOC found inside folder: ${parentFolder.path}
                    This might lead to errors in the plugin.`);
                return indexFilesChildren[0];
            }
            parentFolder = parentFolder.parent;
        }
        new Notice("Can't find parent MOC file for: " + self_file.name);
        return null;
    }


    getChildrenLinks() {
        const { self_file } = this;
        let childrenLinks: TFile[] = [];
        const recursiveChildrenFinder = (startingFolder: TFolder) => {
            startingFolder.children.forEach((child) => {
                if (child instanceof TFile) {
                    const frontmatterCopy = this.app.metadataCache.getFileCache(child)?.frontmatter;
                    if (frontmatterCopy && frontmatterCopy[this.settings.mocPropertyKey] === this.settings.mocPropertyValue) {
                        childrenLinks.push(child);
                    }
                }
                else if (child instanceof TFolder) {
                    recursiveChildrenFinder(child);
                }
            })

        }
        recursiveChildrenFinder(this.getDirectParent(self_file));
        return childrenLinks;
    }
}
