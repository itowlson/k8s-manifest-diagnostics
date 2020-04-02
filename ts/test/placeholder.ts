import { describe, it } from 'mocha';
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

import * as t from '../src/index';

const TESTDATADIR = path.join(__dirname, '../../ts/test/data');

describe('the package', () => {
    it('should work', () => {
        const result = t.hello('world');
        assert.equal('Hello, world', result);
    });
    it('should work with VS Code', async () => {
        const testDocPath = path.join(TESTDATADIR, 'placeholder.yaml');
        const doc = await vscode.workspace.openTextDocument(testDocPath);
        const text = doc.getText().substr(0, 10);
        const result = t.hello(text);
        assert.equal('Hello, apiVersion', result);
    });
});
