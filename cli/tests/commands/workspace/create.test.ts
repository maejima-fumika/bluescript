import { handleCreateWorkspaceCommand } from '../../../src/commands/workspace/create';
import * as fs from '../../../src/core/fs';
import * as path from 'path';
import { mockedCwd, mockedLogger, mockProcessExit } from '../mock-helpers';

describe('workspace create command', () => {
    const DUMMY_CWD = path.join(__dirname, '../../../temp-files/workspace-create');
    const workspaceName = 'test-workspace';
    const workspaceDir = path.join(DUMMY_CWD, workspaceName);
    const workspaceConfigFile = path.join(workspaceDir, 'bsworkspace.json');

    beforeEach(() => {
        fs.removeDir(DUMMY_CWD);
        fs.makeDir(DUMMY_CWD);
        mockedCwd.mockReturnValue(DUMMY_CWD);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        fs.removeDir(DUMMY_CWD);
    });

    it('should create a workspace directory with an empty config', async () => {
        // --- Act ---
        await handleCreateWorkspaceCommand(workspaceName);

        // --- Assert ---
        expect(JSON.parse(fs.readFile(workspaceConfigFile))).toEqual({
            name: workspaceName,
            projects: [],
        });
        expect(mockedLogger.success).toHaveBeenCalled();
    });

    it('should exit with an error if the directory already exists', async () => {
        // --- Arrange ---
        const exitSpy = mockProcessExit();
        fs.makeDir(workspaceDir);

        // --- Act ---
        await handleCreateWorkspaceCommand(workspaceName);

        // --- Assert ---
        expect(mockedLogger.error).toHaveBeenCalled();
        expect(process.exit).toHaveBeenCalledWith(1);
        expect(fs.exists(workspaceConfigFile)).toBe(false);

        // --- Clean up ---
        exitSpy.mockRestore();
    });
});
