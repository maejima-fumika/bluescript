import { handleRemoveProjectCommand } from '../../../src/commands/workspace/remove';
import * as fs from '../../../src/core/fs';
import * as path from 'path';
import { mockedCwd, mockedLogger, mockProcessExit } from '../mock-helpers';

describe('workspace remove command', () => {
    const TEMP_DIR = path.join(__dirname, '../../../temp-files/workspace-remove');
    const workspaceDir = path.join(TEMP_DIR, 'ws');
    const workspaceConfigFile = path.join(workspaceDir, 'bsworkspace.json');
    const initialProjects = [
        { path: './sensor', deviceName: 'BS-SENSOR' },
        { path: './sim' },
    ];

    function savedProjects() {
        return JSON.parse(fs.readFile(workspaceConfigFile)).projects;
    }

    let exitSpy: jest.SpyInstance;

    beforeEach(() => {
        fs.removeDir(TEMP_DIR);
        fs.makeDir(path.join(workspaceDir, 'sensor'));
        fs.writeFile(workspaceConfigFile, JSON.stringify({ name: 'ws', projects: initialProjects }));
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

    it('should remove a project and keep its files', async () => {
        await handleRemoveProjectCommand('./sensor/');

        expect(savedProjects()).toEqual([{ path: './sim' }]);
        expect(fs.exists(path.join(workspaceDir, 'sensor'))).toBe(true);
        expect(mockedLogger.success).toHaveBeenCalled();
        expect(process.exit).not.toHaveBeenCalled();
    });

    it('should remove a project whose directory no longer exists', async () => {
        await handleRemoveProjectCommand('sim');

        expect(savedProjects()).toEqual([{ path: './sensor', deviceName: 'BS-SENSOR' }]);
        expect(process.exit).not.toHaveBeenCalled();
    });

    it('should resolve the path from inside a subdirectory', async () => {
        mockedCwd.mockReturnValue(path.join(workspaceDir, 'sensor'));

        await handleRemoveProjectCommand('.');

        expect(savedProjects()).toEqual([{ path: './sim' }]);
    });

    it('should reject a project that is not in the workspace', async () => {
        await handleRemoveProjectCommand('actuator');

        expect(process.exit).toHaveBeenCalledWith(1);
        expect(savedProjects()).toEqual(initialProjects);
    });

    it('should exit with an error outside a workspace', async () => {
        mockedCwd.mockReturnValue(TEMP_DIR);

        await handleRemoveProjectCommand('ws/sim');

        expect(mockedLogger.error).toHaveBeenCalled();
        expect(process.exit).toHaveBeenCalledWith(1);
    });
});
