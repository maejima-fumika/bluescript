import { Command } from "commander";
import chalk from "chalk";
import * as path from 'path';
import { logger } from "../../core/logger";
import { cwd } from "../../core/command-exec";
import * as fs from '../../core/fs';
import { WorkspaceConfigHandler } from "../../config/workspace-config";
import { CommandHandler } from "../command";


class CreateWorkspaceHandler extends CommandHandler {
    private workspaceRoot: string;
    private workspaceConfigHandler: WorkspaceConfigHandler;

    constructor(workspaceName: string) {
        super();
        this.workspaceRoot = path.join(cwd(), workspaceName);
        this.workspaceConfigHandler = WorkspaceConfigHandler.createTemplate(workspaceName, this.workspaceRoot);
    }

    create() {
        if (fs.exists(this.workspaceRoot)) {
            throw new Error(`${this.workspaceRoot} already exists.`);
        }
        fs.makeDir(this.workspaceRoot);
        this.workspaceConfigHandler.save();
    }
}

export async function handleCreateWorkspaceCommand(name: string) {
    try {
        const createHandler = new CreateWorkspaceHandler(name);
        createHandler.create();

        logger.br();
        logger.success(`Success to create a new workspace.`);
        logger.info(
            `Next step: go to the workspace directory, create projects with ${chalk.yellow('bscript project create')}, ` +
            `and add them with ${chalk.yellow('bscript workspace add')}`,
        );
    } catch (error) {
        logger.error(`Failed to create a new workspace.`);
        logger.showError(error);
        process.exit(1);
    }
}

export function registerCreateWorkspaceCommand(program: Command) {
    program
        .command('create')
        .description('create a new workspace')
        .argument('<workspace-name>', 'name of the new workspace')
        .action(handleCreateWorkspaceCommand);
}
