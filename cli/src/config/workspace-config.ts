import { z } from 'zod';
import * as path from 'path';
import * as fs from '../core/fs';
import { DEFAULT_DEVICE_NAME, ProjectConfigHandler } from './project-config';


export const WORKSPACE_CONFIG_FILE = 'bsworkspace.json';

const workspaceProjectSchema = z.object({
    path: z.string(),
    deviceName: z.string().optional(),
});

const workspaceConfigSchema = z.object({
    name: z.string(),
    projects: z.array(workspaceProjectSchema).default([]),
});

export type WorkspaceConfig = z.infer<typeof workspaceConfigSchema>;
export type WorkspaceProjectEntry = z.infer<typeof workspaceProjectSchema>;

export type WorkspaceProject = {
    name: string;
    project: ProjectConfigHandler;
    deviceName?: string;
};

export class WorkspaceConfigHandler {
    public root: string;
    private config: WorkspaceConfig;

    private constructor(config: WorkspaceConfig, root: string) {
        this.root = root;
        this.config = config;
    }

    /** Looks for bsworkspace.json in `from` and then in each parent directory. */
    public static find(from: string): WorkspaceConfigHandler {
        let dir = path.resolve(from);
        for (;;) {
            if (fs.exists(path.join(dir, WORKSPACE_CONFIG_FILE))) {
                return WorkspaceConfigHandler.load(dir);
            }
            const parent = path.dirname(dir);
            if (parent === dir) {
                throw new Error(
                    `Cannot find ${WORKSPACE_CONFIG_FILE} in ${from} or any of its parent directories.`,
                );
            }
            dir = parent;
        }
    }

    public static load(workspaceRoot: string): WorkspaceConfigHandler {
        const filePath = path.join(workspaceRoot, WORKSPACE_CONFIG_FILE);
        try {
            const fileContent = fs.readFile(filePath);
            const json = JSON.parse(fileContent);
            const parsedConfig = workspaceConfigSchema.parse(json);
            return new WorkspaceConfigHandler(parsedConfig, workspaceRoot);
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw new Error(`Workspace config validation failed in ${filePath}.`, { cause: error });
            }
            throw new Error(`Failed to load workspace config from ${filePath}.`, { cause: error });
        }
    }

    public static createTemplate(workspaceName: string, root: string): WorkspaceConfigHandler {
        const parsedConfig = workspaceConfigSchema.parse({ name: workspaceName });
        return new WorkspaceConfigHandler(parsedConfig, root);
    }

    public get name(): string {
        return this.config.name;
    }

    public getConfig(): Readonly<WorkspaceConfig> {
        return this.config;
    }

    /** `projectRoot` is resolved against the workspace root and stored relative to it. */
    public addProject(projectRoot: string, deviceName?: string) {
        const absoluteRoot = this.resolvePath(projectRoot);
        if (this.config.projects.some((entry) => this.resolvePath(entry.path) === absoluteRoot)) {
            throw new Error(`${absoluteRoot} is already in the workspace.`);
        }
        const entry: WorkspaceProjectEntry = { path: this.toRelativePath(absoluteRoot) };
        if (deviceName !== undefined) {
            entry.deviceName = deviceName;
        }
        this.config = {
            ...this.config,
            projects: [...this.config.projects, entry],
        };
    }

    /**
     * `projectRoot` is resolved against the workspace root.
     * Returns the path of the removed entry as stored in the config.
     */
    public removeProject(projectRoot: string): string {
        const absoluteRoot = this.resolvePath(projectRoot);
        const entry = this.config.projects.find((e) => this.resolvePath(e.path) === absoluteRoot);
        if (entry === undefined) {
            throw new Error(`${absoluteRoot} is not in the workspace.`);
        }
        this.config = {
            ...this.config,
            projects: this.config.projects.filter((e) => e !== entry),
        };
        return entry.path;
    }

    /**
     * Loads every project, validates the whole workspace, and returns the
     * projects named in `names` (all of them when `names` is empty).
     */
    public resolveProjects(names: readonly string[] = []): WorkspaceProject[] {
        if (this.config.projects.length === 0) {
            throw new Error(
                `Workspace ${this.name} has no projects. Add one with \`bscript workspace add <project-path>\`.`,
            );
        }
        const projects = this.config.projects.map((entry) => {
            const project = ProjectConfigHandler.load(this.resolvePath(entry.path));
            return { name: project.getConfig().projectName, project, deviceName: entry.deviceName };
        });
        validateProjects(projects);

        const unknownNames = names.filter((name) => !projects.some((p) => p.name === name));
        if (unknownNames.length > 0) {
            throw new Error(`Workspace ${this.name} has no project named ${unknownNames.join(', ')}.`);
        }
        return names.length > 0 ? projects.filter((p) => names.includes(p.name)) : projects;
    }

    public save(): void {
        try {
            const data = JSON.stringify(this.config, null, 2);
            fs.writeFile(path.join(this.root, WORKSPACE_CONFIG_FILE), data);
        } catch (error) {
            throw new Error(`Failed to save workspace config to ${this.root}.`, { cause: error });
        }
    }

    private resolvePath(projectPath: string): string {
        return path.resolve(this.root, projectPath);
    }

    private toRelativePath(absolutePath: string): string {
        const relativePath = path.relative(this.root, absolutePath);
        if (path.isAbsolute(relativePath)) {
            // On Windows, a path on another drive has no relative form.
            return relativePath;
        }
        const posixPath = relativePath.split(path.sep).join('/');
        if (posixPath === '') {
            return '.';
        }
        return posixPath === '..' || posixPath.startsWith('../') ? posixPath : `./${posixPath}`;
    }
}

function validateProjects(projects: readonly WorkspaceProject[]) {
    const errors: string[] = [];
    const names = new Set<string>();
    const roots = new Set<string>();
    const deviceOwners = new Map<string, string>();

    for (const { name, project, deviceName } of projects) {
        if (names.has(name)) {
            errors.push(`Project name "${name}" is used more than once.`);
        }
        names.add(name);

        const root = path.resolve(project.root);
        if (roots.has(root)) {
            errors.push(`Project ${root} is listed more than once.`);
        }
        roots.add(root);

        if (project.getBoardName() === 'esp32') {
            // Two boards with the same name make it random which board runs which project.
            const effectiveDeviceName = deviceName ?? DEFAULT_DEVICE_NAME;
            const owner = deviceOwners.get(effectiveDeviceName);
            if (owner !== undefined) {
                errors.push(
                    `${name}: device name "${effectiveDeviceName}" is already used by ${owner}. ` +
                    `Give each esp32 project a unique "deviceName" ` +
                    `(\`--device-name\` of \`bscript workspace add\`).`,
                );
            } else {
                deviceOwners.set(effectiveDeviceName, name);
            }
        } else if (deviceName !== undefined) {
            errors.push(`${name}: "deviceName" is only available for esp32 projects.`);
        }
    }

    if (errors.length > 0) {
        throw new Error(`Invalid workspace config:\n  ${errors.join('\n  ')}`);
    }
}
