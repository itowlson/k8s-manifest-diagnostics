import { describe, it } from 'mocha';
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

import * as kd from '../src/index';
import { withTempFileCopy } from './testutils/tempfile';

const TEST_DATA_DIR = path.join(__dirname, '../../ts/test/data');
const SIMPLE_MANIFEST = 'simple-manifest.yaml';

function lineText(document: vscode.TextDocument, containing: string): string {
    const index = document.getText().indexOf(containing);
    if (index < 0) {
        assert.fail(`Expected document to contain ${containing} but it did not`);
    }
    const position = document.positionAt(index);
    const line = document.lineAt(position.line);
    return line.text.trim();
}

function insertIndex(document: vscode.TextDocument, after: string, before: string): number {
    const text = after + before;
    const index = document.getText().indexOf(text);
    if (index < 0) {
        assert.fail(`Expected document to contain ${text} but it did not`);
    }
    return index + after.length;
}

async function withTestDocument(testFileName: string, fn: (doc: vscode.TextDocument) => Promise<void>): Promise<void> {
    const sourceFilePath = path.join(TEST_DATA_DIR, testFileName);
    await withTempFileCopy(sourceFilePath, async (tempFilePath) => {
        const document = await vscode.workspace.openTextDocument(tempFilePath);
        return await fn(document);
    });
}

describe('inserting text into a YAML document', () => {
    it('should work on the happy path', async () => {
        withTestDocument(SIMPLE_MANIFEST, async (doc) => {
            const wsedit = new vscode.WorkspaceEdit();

            const insertAt = insertIndex(doc, 'image: ', 'zotifier');
            kd.combine(wsedit, doc, { kind: 'insert', at: insertAt, text: 'saferegistry.io/' });
            await vscode.workspace.applyEdit(wsedit);
            assert.equal('image: saferegistry.io/zotifier:1.0.0', lineText(doc, 'image: '));
        });
    });
});
