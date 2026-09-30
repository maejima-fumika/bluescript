import { collectErrorMessages } from '../../../src/core/logger/error-format';

describe('collectErrorMessages', () => {
    it('returns the message of the error and of every cause', () => {
        const error = new Error('outer', { cause: new Error('inner', { cause: new Error('root') }) });

        expect(collectErrorMessages(error)).toEqual(['outer', 'inner', 'root']);
    });

    it('reports a cause that is not an Error', () => {
        const error = new Error('outer', { cause: 'not an error' });

        expect(collectErrorMessages(error)).toEqual(['outer', 'Unknown Error: not an error']);
    });

    it('reports a thrown value that is not an Error', () => {
        expect(collectErrorMessages('oops')).toEqual(['Unknown Error: oops']);
    });
});
