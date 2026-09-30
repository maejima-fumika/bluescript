import { Command } from "commander";
import * as path from 'path';
import { logger } from "../../core/logger";
import { cwd } from "../../core/command-exec";
import { ProjectConfigHandler } from "../../config/project-config";
import { WorkspaceConfigHandler } from "../../config/workspace-config";
import { CommandHandler } from "../command";


class AddProjectHandler extends CommandHandler {
    private workspaceConfigHandler: WorkspaceConfigHandler;

    constructor() {
        super();
        this.workspaceConfigHandler = WorkspaceConfigHandler.find(cwd());
    }

    get workspaceName() {
        return this.workspaceConfigHandler.name;
    }

    add(projectPath: string, deviceName?: string): string {
        const projectRoot = path.resolve(cwd(), projectPath);
        const projectConfigHandler = ProjectConfigHandler.load(projectRoot);
        if (deviceName !== undefined && projectConfigHandler.getBoardName() !== 'esp32') {
            throw new Error(`--device-name is only available for esp32 projects.`);
        }

        this.workspaceConfigHandler.addProject(projectRoot, deviceName);
        // Validate the whole workspace before saving, e.g. device names must stay unique.
        this.workspaceConfigHandler.resolveProjects();
        this.workspaceConfigHandler.save();
        return projectConfigHandler.getConfig().projectName;
    }
}

export async function handleAddProjectCommand(projectPath: string, options: { deviceName?: string }) {
    try {
        const addHandler = new AddProjectHandler();
        const projectName = addHandler.add(projectPath, options.deviceName);
        logger.success(`Added ${projectName} to workspace ${addHandler.workspaceName}.`);
    } catch (error) {
        logger.error(`Failed to add the project to the workspace.`);
        logger.showError(error);
        process.exit(1);
    }
}

export function registerAddProjectCommand(program: Command) {
    program
        .command('add')
        .description('add an existing project to the workspace')
        .argument('<project-path>', 'path to the project directory')
        .option('-d, --device-name <device-name>', 'device name of the board that runs the project (esp32 only)')
        .action(handleAddProjectCommand);
}
