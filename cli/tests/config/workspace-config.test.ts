import * as path from 'path';
import * as fs from '../../src/core/fs';
import { BoardName } from '../../src/config/board-utils';
import { ProjectConfigHandler } from '../../src/config/project-config';
import { WORKSPACE_CONFIG_FILE, WorkspaceConfigHandler } from '../../src/config/workspace-config';

const TEMP_DIR = path.join(__dirname, '../../temp-files/workspace-config');
const WORKSPACE_ROOT = path.join(TEMP_DIR, 'ws');

function createProject(projectRoot: string, projectName: string, board: BoardName) {
    fs.makeDir(projectRoot);
    ProjectConfigHandler.createTemplate(projectName, board, projectRoot).save(projectRoot);
}

function createWorkspace(projects: { path: string, deviceName?: string }[] = []) {
    fs.makeDir(WORKSPACE_ROOT);
    fs.writeFile(
        path.join(WORKSPACE_ROOT, WORKSPACE_CONFIG_FILE),
        JSON.stringify({ name: 'ws', projects }),
    );
    return WorkspaceConfigHandler.load(WORKSPACE_ROOT);
}

describe('WorkspaceConfigHandler', () => {
    beforeEach(() => {
        fs.removeDir(TEMP_DIR);
        fs.makeDir(TEMP_DIR);
    });

    afterAll(() => {
        fs.removeDir(TEMP_DIR);
    });

    describe('find', () => {
        it('finds the workspace from a subdirectory', () => {
            createWorkspace();
            const subDir = path.join(WORKSPACE_ROOT, 'sensor', 'src');
            fs.makeDir(subDir);

            const handler = WorkspaceConfigHandler.find(subDir);

            expect(handler.root).toBe(WORKSPACE_ROOT);
            expect(handler.name).toBe('ws');
        });

        it('throws when no workspace config exists', () => {
            expect(() => WorkspaceConfigHandler.find(TEMP_DIR)).toThrow(WORKSPACE_CONFIG_FILE);
        });
    });

    describe('load', () => {
        it('throws when the config does not match the schema', () => {
            fs.makeDir(WORKSPACE_ROOT);
            fs.writeFile(path.join(WORKSPACE_ROOT, WORKSPACE_CONFIG_FILE), JSON.stringify({ projects: [] }));

            expect(() => WorkspaceConfigHandler.load(WORKSPACE_ROOT)).toThrow('validation failed');
        });
    });

    describe('createTemplate and save', () => {
        it('saves a workspace with no projects', () => {
            fs.makeDir(WORKSPACE_ROOT);

            WorkspaceConfigHandler.createTemplate('ws', WORKSPACE_ROOT).save();

            const saved = JSON.parse(fs.readFile(path.join(WORKSPACE_ROOT, WORKSPACE_CONFIG_FILE)));
            expect(saved).toEqual({ name: 'ws', projects: [] });
        });
    });

    describe('addProject', () => {
        it('stores paths relative to the workspace root', () => {
            const handler = createWorkspace();

            handler.addProject(path.join(WORKSPACE_ROOT, 'apps', 'sensor'), 'BS-SENSOR');
            handler.addProject('./sim');
            handler.addProject(path.join(TEMP_DIR, 'outside'));

            expect(handler.getConfig().projects).toEqual([
                { path: './apps/sensor', deviceName: 'BS-SENSOR' },
                { path: './sim' },
                { path: '../outside' },
            ]);
        });

        it('throws when the project is already in the workspace', () => {
            const handler = createWorkspace([{ path: './sim' }]);

            expect(() => handler.addProject(path.join(WORKSPACE_ROOT, 'sim'))).toThrow('already in the workspace');
        });
    });

    describe('removeProject', () => {
        it('removes the entry with the same resolved path and returns its stored path', () => {
            const handler = createWorkspace([
                { path: './sensor', deviceName: 'BS-SENSOR' },
                { path: './sim' },
            ]);

            const removedPath = handler.removeProject(path.join(WORKSPACE_ROOT, 'sensor/'));

            expect(removedPath).toBe('./sensor');
            expect(handler.getConfig().projects).toEqual([{ path: './sim' }]);
        });

        it('throws when the project is not in the workspace', () => {
            const handler = createWorkspace([{ path: './sim' }]);

            expect(() => handler.removeProject('./sensor')).toThrow('not in the workspace');
        });
    });

    describe('resolveProjects', () => {
        beforeEach(() => {
            createProject(path.join(WORKSPACE_ROOT, 'sensor'), 'sensor', 'esp32');
            createProject(path.join(WORKSPACE_ROOT, 'actuator'), 'actuator', 'esp32');
            createProject(path.join(WORKSPACE_ROOT, 'sim'), 'sim', 'host');
        });

        it('returns every project with its device name', () => {
            const handler = createWorkspace([
                { path: './sensor', deviceName: 'BS-SENSOR' },
                { path: './actuator', deviceName: 'BS-ACTUATOR' },
                { path: './sim' },
            ]);

            const projects = handler.resolveProjects();

            expect(projects.map((p) => [p.name, p.deviceName])).toEqual([
                ['sensor', 'BS-SENSOR'],
                ['actuator', 'BS-ACTUATOR'],
                ['sim', undefined],
            ]);
            expect(projects[2].project.root).toBe(path.join(WORKSPACE_ROOT, 'sim'));
        });

        it('returns only the named projects', () => {
            const handler = createWorkspace([
                { path: './sensor', deviceName: 'BS-SENSOR' },
                { path: './sim' },
            ]);

            expect(handler.resolveProjects(['sim']).map((p) => p.name)).toEqual(['sim']);
        });

        it('throws for an unknown project name', () => {
            const handler = createWorkspace([{ path: './sim' }]);

            expect(() => handler.resolveProjects(['sim', 'missing'])).toThrow('missing');
        });

        it('throws when the workspace has no projects', () => {
            const handler = createWorkspace();

            expect(() => handler.resolveProjects()).toThrow('has no projects');
        });

        it('throws when two projects have the same name', () => {
            createProject(path.join(WORKSPACE_ROOT, 'sim2'), 'sim', 'host');
            const handler = createWorkspace([{ path: './sim' }, { path: './sim2' }]);

            expect(() => handler.resolveProjects()).toThrow('"sim" is used more than once');
        });

        it('throws when two esp32 projects use the same device name', () => {
            const handler = createWorkspace([
                { path: './sensor', deviceName: 'BOARD' },
                { path: './actuator', deviceName: 'BOARD' },
            ]);

            expect(() => handler.resolveProjects()).toThrow('"BOARD" is already used by sensor');
        });

        it('treats a missing device name as the default name', () => {
            const handler = createWorkspace([
                { path: './sensor' },
                { path: './actuator', deviceName: 'BLUESCRIPT' },
            ]);

            expect(() => handler.resolveProjects()).toThrow('"BLUESCRIPT" is already used by sensor');
        });

        it('allows one esp32 project to use the default device name', () => {
            const handler = createWorkspace([
                { path: './sensor' },
                { path: './actuator', deviceName: 'BS-ACTUATOR' },
            ]);

            expect(() => handler.resolveProjects()).not.toThrow();
        });

        it('throws when a host project has a device name', () => {
            const handler = createWorkspace([{ path: './sim', deviceName: 'BS-SIM' }]);

            expect(() => handler.resolveProjects()).toThrow('only available for esp32 projects');
        });

        it('throws when a project config cannot be loaded', () => {
            const handler = createWorkspace([{ path: './missing' }]);

            expect(() => handler.resolveProjects()).toThrow('Failed to load project config');
        });
    });
});
