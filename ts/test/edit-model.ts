import { describe } from 'mocha';
import * as mocha from 'mocha';
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as kp from 'k8s-manifest-parser';

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

function numRange(start: number, end: number): number[] {
    const arr = Array.of<number>();
    for (let i = start; i <= end; ++i) {
        arr.push(i);
    }
    return arr;
}

function lineRangeText(document: vscode.TextDocument, startLine: number, endLine: number): string {
    return numRange(startLine, endLine).map((i) => document.lineAt(i).text)
                                       .join('\n');
}

function insertIndex(document: vscode.TextDocument, after: string, before: string): number {
    const text = after + before;
    const index = document.getText().indexOf(text);
    if (index < 0) {
        assert.fail(`Expected document to contain ${text} but it did not`);
    }
    return index + after.length;
}

function replaceRange(document: vscode.TextDocument, after: string, replace: string): kd.Range {
    const text = after + replace;
    const index = document.getText().indexOf(text);
    if (index < 0) {
        assert.fail(`Expected document to contain ${text} but it did not`);
    }
    return { start: index + after.length, end: index + text.length };
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
        assert.equal(lineText(doc, 'image: '), 'image: saferegistry.io/zotifier:latest');
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

describe('replacing text in a YAML document', () => {
    it('should work on the happy path', SIMPLE_MANIFEST_YAML, async (doc, wsedit) => {
        const targetRange = replaceRange(doc, 'image: zotifier:', 'latest');
        kd.combine(wsedit, doc, { kind: 'replace', at: targetRange, text: '1.0.0' });
        await vscode.workspace.applyEdit(wsedit);
        assert.equal(lineText(doc, 'image: '), 'image: zotifier:1.0.0');
    });
    it('should work if the replacement is shorter than the source', SIMPLE_MANIFEST_YAML, async (doc, wsedit) => {
        const targetRange = replaceRange(doc, 'image: zotifier:', 'latest');
        kd.combine(wsedit, doc, { kind: 'replace', at: targetRange, text: '1' });
        await vscode.workspace.applyEdit(wsedit);
        assert.equal(lineText(doc, 'image: '), 'image: zotifier:1');
    });
    it('should work if the replacement is longer than the source', SIMPLE_MANIFEST_YAML, async (doc, wsedit) => {
        const targetRange = replaceRange(doc, 'image: zotifier:', 'latest');
        kd.combine(wsedit, doc, { kind: 'replace', at: targetRange, text: '1234.123.4567' });
        await vscode.workspace.applyEdit(wsedit);
        assert.equal(lineText(doc, 'image: '), 'image: zotifier:1234.123.4567');
    });
    it('should work if the replacement is empty', SIMPLE_MANIFEST_YAML, async (doc, wsedit) => {
        const targetRange = replaceRange(doc, 'image: zotifier:', 'latest');
        kd.combine(wsedit, doc, { kind: 'replace', at: targetRange, text: '' });
        await vscode.workspace.applyEdit(wsedit);
        assert.equal(lineText(doc, 'image: '), 'image: zotifier:');
    });
    it('should be a no-op before start of document', SIMPLE_MANIFEST_YAML, async (doc, wsedit) => {
        const before = doc.getText();
        kd.combine(wsedit, doc, { kind: 'replace', at: { start: -3, end: 2 }, text: 'latest' });
        await vscode.workspace.applyEdit(wsedit);
        const after = doc.getText();
        assert.equal(after, before);
    });
    it('should be a no-op after end of document', SIMPLE_MANIFEST_YAML, async (doc, wsedit) => {
        const before = doc.getText();
        kd.combine(wsedit, doc, { kind: 'replace', at: { start: 1000, end: 1002 }, text: 'latest' });
        await vscode.workspace.applyEdit(wsedit);
        const after = doc.getText();
        assert.equal(after, before);
    });
});

describe('merging a value into a YAML document', () => {
    it('should be able to insert a map into an existing map', SIMPLE_MANIFEST_YAML, async (doc, wsedit) => {
        const map = kp.asTraversable(kp.parseYAML(doc.getText())[0]);
        const spec = map.map('spec');
        kd.combine(wsedit, doc, { kind: 'merge-values', into: spec, values: { imagePullPolicy: "Always" } });
        await vscode.workspace.applyEdit(wsedit);
        const expected = `
spec:
  action: Reticulate
  image: 'zotifier:latest'
  imagePullPolicy: Always
status:
`;  // TODO: prefer not to introduce quotes around value that was originally not quoted
        assert.equal(lineRangeText(doc, 4, 8), expected.trim());
    });
});

describe('inserting text into a JSON document', () => {
    it('should work on the happy path', SIMPLE_MANIFEST_JSON, async (doc, wsedit) => {
        const insertAt = insertIndex(doc, `"image": "`, `zotifier`);
        kd.combine(wsedit, doc, { kind: 'insert', at: insertAt, text: 'saferegistry.io/' });
        await vscode.workspace.applyEdit(wsedit);
        assert.equal(lineText(doc, '"image": '), '"image": "saferegistry.io/zotifier:latest"');
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

describe('replacing text in a JSON document', () => {
    it('should work on the happy path', SIMPLE_MANIFEST_JSON, async (doc, wsedit) => {
        const targetRange = replaceRange(doc, `"image": "zotifier:`, 'latest');
        kd.combine(wsedit, doc, { kind: 'replace', at: targetRange, text: '1.0.0' });
        await vscode.workspace.applyEdit(wsedit);
        assert.equal(lineText(doc, '"image": '), '"image": "zotifier:1.0.0"');
    });
    it('should work if the replacement is shorter than the source', SIMPLE_MANIFEST_JSON, async (doc, wsedit) => {
        const targetRange = replaceRange(doc, `"image": "zotifier:`, 'latest');
        kd.combine(wsedit, doc, { kind: 'replace', at: targetRange, text: '1' });
        await vscode.workspace.applyEdit(wsedit);
        assert.equal(lineText(doc, '"image": '), '"image": "zotifier:1"');
    });
    it('should work if the replacement is longer than the source', SIMPLE_MANIFEST_JSON, async (doc, wsedit) => {
        const targetRange = replaceRange(doc, `"image": "zotifier:`, 'latest');
        kd.combine(wsedit, doc, { kind: 'replace', at: targetRange, text: '1234.123.4567' });
        await vscode.workspace.applyEdit(wsedit);
        assert.equal(lineText(doc, '"image": '), '"image": "zotifier:1234.123.4567"');
    });
    it('should work if the replacement is empty', SIMPLE_MANIFEST_JSON, async (doc, wsedit) => {
        const targetRange = replaceRange(doc, `"image": "zotifier:`, 'latest');
        kd.combine(wsedit, doc, { kind: 'replace', at: targetRange, text: '' });
        await vscode.workspace.applyEdit(wsedit);
        assert.equal(lineText(doc, '"image": '), '"image": "zotifier:"');
    });
    it('should be a no-op before start of document', SIMPLE_MANIFEST_JSON, async (doc, wsedit) => {
        const before = doc.getText();
        kd.combine(wsedit, doc, { kind: 'replace', at: { start: -3, end: 2 }, text: 'latest' });
        await vscode.workspace.applyEdit(wsedit);
        const after = doc.getText();
        assert.equal(after, before);
    });
    it('should be a no-op after end of document', SIMPLE_MANIFEST_JSON, async (doc, wsedit) => {
        const before = doc.getText();
        kd.combine(wsedit, doc, { kind: 'replace', at: { start: 1000, end: 1002 }, text: 'latest' });
        await vscode.workspace.applyEdit(wsedit);
        const after = doc.getText();
        assert.equal(after, before);
    });
});
