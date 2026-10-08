#!/usr/bin/env node

import { Command } from 'commander';
import { logger } from './core/logger';
import packageJson from '../package.json';

import { registerSetupCommand } from './commands/board/setup/index';
import { registerRemoveCommand } from './commands/board/remove';
import { registerFlashRuntimeCommand } from './commands/board/flash-runtime';
import { registerBuildRuntimeCommand } from './commands/board/build-runtime';
import { registerListCommand } from './commands/board/list';
import { registerCreateProjectCommand } from './commands/project/create';
import { registerRunCommand } from './commands/project/run';
import { registerFullcleanCommand } from './commands/board/full-clean';
import { registerReplCommand } from './commands/repl';
import { registerInstallCommand } from './commands/project/install';
import { registerUninstallCommand } from './commands/project/uninstall';
import { registerUpdateCommand } from './commands/board/update';
import { registerCheckCommand } from './commands/project/check';
import { registerCreateWorkspaceCommand } from './commands/workspace/create';
import { registerAddProjectCommand } from './commands/workspace/add';
import { registerRemoveProjectCommand } from './commands/workspace/remove';
import { registerWorkspaceRunCommand } from './commands/workspace/run';


function registerBoardCommands(program: Command) {
    const boardCommand = program
        .command('board')
        .description('manage board environments and configurations');

    registerSetupCommand(boardCommand);
    registerRemoveCommand(boardCommand);
    registerFlashRuntimeCommand(boardCommand);
    registerBuildRuntimeCommand(boardCommand);
    registerListCommand(boardCommand);
    registerFullcleanCommand(boardCommand);
    registerUpdateCommand(boardCommand);
}

function registerProjectCommands(program: Command) {
    const projectCommand = program
        .command('project')
        .description('manage projects')

    registerCreateProjectCommand(projectCommand);
    registerRunCommand(projectCommand);
    registerInstallCommand(projectCommand);
    registerUninstallCommand(projectCommand);
    registerCheckCommand(projectCommand);
}

function registerWorkspaceCommands(program: Command) {
    const workspaceCommand = program
        .command('workspace')
        .description('manage workspaces and run multiple projects at the same time');

    registerCreateWorkspaceCommand(workspaceCommand);
    registerAddProjectCommand(workspaceCommand);
    registerRemoveProjectCommand(workspaceCommand);
    registerWorkspaceRunCommand(workspaceCommand);
}

function main() {
    const command = new Command();

    command
        .name('bscript')
        .description('A new CLI for the BlueScript microcontroller language')
        .version(packageJson.version, '-v, --version', 'Output the current version');

    registerBoardCommands(command);
    registerProjectCommands(command);
    registerWorkspaceCommands(command);
    registerReplCommand(command);

    command.parse(process.argv);
}

try {
    main();
} catch (error) {
    logger.error('An unexpected error occurred:');
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
}