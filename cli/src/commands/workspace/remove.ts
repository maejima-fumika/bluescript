import { Command } from "commander";
import * as path from 'path';
import { logger } from "../../core/logger";
import { cwd } from "../../core/command-exec";
import { WorkspaceConfigHandler } from "../../config/workspace-config";
import { CommandHandler } from "../command";


class RemoveProjectHandler extends CommandHandler {
    private workspaceConfigHandler: WorkspaceConfigHandler;

    constructor() {
        super();
        this.workspaceConfigHandler = WorkspaceConfigHandler.find(cwd());
    }

    get workspaceName() {
        return this.workspaceConfigHandler.name;
    }

    // The project is not loaded, so a project whose directory was already deleted can still be removed.
    remove(projectPath: string): string {
        const projectRoot = path.resolve(cwd(), projectPath);
        const removedPath = this.workspaceConfigHandler.removeProject(projectRoot);
        this.workspaceConfigHandler.save();
        return removedPath;
    }
}

export async function handleRemoveProjectCommand(projectPath: string) {
    try {
        const removeHandler = new RemoveProjectHandler();
        const removedPath = removeHandler.remove(projectPath);
        logger.success(`Removed ${removedPath} from workspace ${removeHandler.workspaceName}.`);
    } catch (error) {
        logger.error(`Failed to remove the project from the workspace.`);
        logger.showError(error);
        process.exit(1);
    }
}

export function registerRemoveProjectCommand(program: Command) {
    program
        .command('remove')
        .description('remove a project from the workspace (the project files are kept)')
        .argument('<project-path>', 'path to the project directory')
        .action(handleRemoveProjectCommand);
}
