import { handleAddProjectCommand } from '../../../src/commands/workspace/add';
import { BoardName } from '../../../src/config/board-utils';
import { ProjectConfigHandler } from '../../../src/config/project-config';
import * as fs from '../../../src/core/fs';
import * as path from 'path';
import { mockedCwd, mockedLogger, mockProcessExit } from '../mock-helpers';

describe('workspace add command', () => {
    const TEMP_DIR = path.join(__dirname, '../../../temp-files/workspace-add');
    const workspaceDir = path.join(TEMP_DIR, 'ws');
    const workspaceConfigFile = path.join(workspaceDir, 'bsworkspace.json');

    function createProject(projectRoot: string, board: BoardName) {
        fs.makeDir(projectRoot);
        ProjectConfigHandler.createTemplate(path.basename(projectRoot), board, projectRoot).save(projectRoot);
    }

    function savedProjects() {
        return JSON.parse(fs.readFile(workspaceConfigFile)).projects;
    }

    let exitSpy: jest.SpyInstance;

    beforeEach(() => {
        fs.removeDir(TEMP_DIR);
        fs.makeDir(workspaceDir);
        fs.writeFile(workspaceConfigFile, JSON.stringify({ name: 'ws', projects: [] }));
        createProject(path.join(workspaceDir, 'sensor'), 'esp32');
        createProject(path.join(workspaceDir, 'actuator'), 'esp32');
        createProject(path.join(workspaceDir, 'sim'), 'host');
        mockedCwd.mockReturnValue(workspaceDir);
        exitSpy = mockProcessExit();
    });

    afterEach(() => {
        exitSpy.mockRestore();
        jest.clearAllMocks();
    });

    afterAll(() => {
        fs.removeDir(TEMP_DIR);
    });

    it('should add a host project', async () => {
        await handleAddProjectCommand('./sim', {});

        expect(savedProjects()).toEqual([{ path: './sim' }]);
        expect(mockedLogger.success).toHaveBeenCalled();
        expect(process.exit).not.toHaveBeenCalled();
    });

    it('should add an esp32 project with a device name', async () => {
        await handleAddProjectCommand('sensor', { deviceName: 'BS-SENSOR' });

        expect(savedProjects()).toEqual([{ path: './sensor', deviceName: 'BS-SENSOR' }]);
    });

    it('should find the workspace from inside a project directory', async () => {
        mockedCwd.mockReturnValue(path.join(workspaceDir, 'sensor'));

        await handleAddProjectCommand('.', {});

        expect(savedProjects()).toEqual([{ path: './sensor' }]);
    });

    it('should reject a device name for a host project', async () => {
        await handleAddProjectCommand('sim', { deviceName: 'BS-SIM' });

        expect(process.exit).toHaveBeenCalledWith(1);
        expect(savedProjects()).toEqual([]);
    });

    it('should reject a second esp32 project using the default device name', async () => {
        await handleAddProjectCommand('sensor', {});
        await handleAddProjectCommand('actuator', {});

        expect(process.exit).toHaveBeenCalledWith(1);
        expect(savedProjects()).toEqual([{ path: './sensor' }]);
    });

    it('should reject a project that is already in the workspace', async () => {
        await handleAddProjectCommand('sim', {});
        await handleAddProjectCommand('./sim/', {});

        expect(process.exit).toHaveBeenCalledWith(1);
        expect(savedProjects()).toEqual([{ path: './sim' }]);
    });

    it('should reject a directory without bsconfig.json', async () => {
        fs.makeDir(path.join(workspaceDir, 'empty'));

        await handleAddProjectCommand('empty', {});

        expect(process.exit).toHaveBeenCalledWith(1);
        expect(savedProjects()).toEqual([]);
    });

    it('should exit with an error outside a workspace', async () => {
        mockedCwd.mockReturnValue(TEMP_DIR);

        await handleAddProjectCommand('ws/sim', {});

        expect(mockedLogger.error).toHaveBeenCalled();
        expect(process.exit).toHaveBeenCalledWith(1);
    });
});
