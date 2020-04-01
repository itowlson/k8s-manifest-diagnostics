import { describe, it } from 'mocha';
import * as assert from 'assert';

import * as t from '../../src/index';

describe('the package', () => {
    it('should work', () => {
        const result = t.hello('world');
        assert.equal('Hello, world', result);
    });
});
