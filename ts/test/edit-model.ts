import { describe } from 'mocha';
import * as mocha from 'mocha';
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

import * as kd from '../src/index';
import { withTempFileCopy } from './testutils/tempfile';

const TEST_DATA_DIR = path.join(__dirname, '../../ts/test/data');
const SIMPLE_MANIFEST_YAML = 'simple-manifest.yaml';
const SIMPLE_MANIFEST_JSON = 'simple-manifest.json';

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
        await fn(document);
    });
}

async function editTestDocument(testFileName: string, fn: (doc: vscode.TextDocument, wsedit: vscode.WorkspaceEdit) => Promise<void>): Promise<void> {
    await withTestDocument(testFileName, async (doc) => {
        const wsedit = new vscode.WorkspaceEdit();
        await fn(doc, wsedit);
    });
}

function it(title: string, testFileName: string, fn: (doc: vscode.TextDocument, wsedit: vscode.WorkspaceEdit) => Promise<void>): mocha.Test {
    return mocha.it(title, async () => {
        await editTestDocument(testFileName, fn);
    });
}

describe('inserting text into a YAML document', () => {
    it('should work on the happy path', SIMPLE_MANIFEST_YAML, async (doc, wsedit) => {
        const insertAt = insertIndex(doc, 'image: ', 'zotifier');
        kd.combine(wsedit, doc, { kind: 'insert', at: insertAt, text: 'saferegistry.io/' });
        await vscode.workspace.applyEdit(wsedit);
        assert.equal('image: saferegistry.io/zotifier:1.0.0', lineText(doc, 'image: '));
    });
    it('should be a no-op before start of document', SIMPLE_MANIFEST_YAML, async (doc, wsedit) => {
        const before = doc.getText();
        kd.combine(wsedit, doc, { kind: 'insert', at: -3, text: 'saferegistry.io/' });
        await vscode.workspace.applyEdit(wsedit);
        const after = doc.getText();
        assert.equal(after, before);
    });
    it('should be a no-op after end of document', SIMPLE_MANIFEST_YAML, async (doc, wsedit) => {
        const before = doc.getText();
        kd.combine(wsedit, doc, { kind: 'insert', at: 1000, text: 'saferegistry.io/' });
        await vscode.workspace.applyEdit(wsedit);
        const after = doc.getText();
        assert.equal(after, before);
    });
});

describe('inserting text into a JSON document', () => {
    it('should work on the happy path', SIMPLE_MANIFEST_JSON, async (doc, wsedit) => {
        const insertAt = insertIndex(doc, `"image": "`, `zotifier`);
        kd.combine(wsedit, doc, { kind: 'insert', at: insertAt, text: 'saferegistry.io/' });
        await vscode.workspace.applyEdit(wsedit);
        assert.equal('"image": "saferegistry.io/zotifier:1.0.0"', lineText(doc, '"image": '));
    });
    it('should be a no-op before start of document', SIMPLE_MANIFEST_JSON, async (doc, wsedit) => {
        const before = doc.getText();
        kd.combine(wsedit, doc, { kind: 'insert', at: -3, text: 'saferegistry.io/' });
        await vscode.workspace.applyEdit(wsedit);
        const after = doc.getText();
        assert.equal(after, before);
    });
    it('should be a no-op after end of document', SIMPLE_MANIFEST_JSON, async (doc, wsedit) => {
        const before = doc.getText();
        kd.combine(wsedit, doc, { kind: 'insert', at: 1000, text: 'saferegistry.io/' });
        await vscode.workspace.applyEdit(wsedit);
        const after = doc.getText();
        assert.equal(after, before);
    });
});
