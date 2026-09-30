jest.mock('../src/core/logger', () => jest.requireActual('./logger-mock').createLoggerMock());


jest.mock('../src/core/fs', () => {
    return {
        ...jest.requireActual('../src/core/fs'),
        downloadAndUnzip: jest.fn()
    }
})


jest.mock('../src/core/command-exec');
// jest.mock('../src/core/fs');
jest.mock('inquirer');
