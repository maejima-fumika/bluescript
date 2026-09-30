jest.mock('../src/core/logger', () => jest.requireActual('./logger-mock').createLoggerMock());
