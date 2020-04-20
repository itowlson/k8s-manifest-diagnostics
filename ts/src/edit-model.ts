import * as kp from 'k8s-manifest-parser';
import * as _ from 'lodash';
import * as vscode from 'vscode';
import * as yaml from 'js-yaml';

import { cantHappen } from './utils/never';
import { objectOf, mapNodeOf } from './utils/parser-model';

export interface InsertTextEdit {
    readonly kind: 'insert';
    readonly at: number;
    readonly text: string;
}

export interface ReplaceTextEdit {
    readonly kind: 'replace';
    readonly at: Range;
    readonly text: string;
}

export interface MergeValuesEdit {
    readonly kind: 'merge-values';
    readonly into: kp.MapTraversalEntry | kp.MapValue;
    readonly values: object;
}

export interface Range {
    readonly start: number;
    readonly end: number;
}

type SingleManifestEdit = InsertTextEdit | ReplaceTextEdit | MergeValuesEdit;

export type ManifestEdit = SingleManifestEdit | SingleManifestEdit[];

export function combine(wsedit: vscode.WorkspaceEdit, document: vscode.TextDocument, manifestEdit: ManifestEdit): void {
    if (Array.isArray(manifestEdit)) {
        for (const edit of manifestEdit) {
            combineOne(wsedit, document, edit);
        }
        return;
    } else {
        combineOne(wsedit, document, manifestEdit);
    }
}

function combineOne(wsedit: vscode.WorkspaceEdit, document: vscode.TextDocument, manifestEdit: SingleManifestEdit): void {
    switch (manifestEdit.kind) {
        case 'insert':
            combineOneInsert(wsedit, document, manifestEdit);
            return;
        case 'replace':
            combineOneReplace(wsedit, document, manifestEdit);
            return;
        case 'merge-values':
            combineOneMergeValues(wsedit, document, manifestEdit);
            return;
        default:
            cantHappen(manifestEdit);
            return;
    }
}

function combineOneInsert(wsedit: vscode.WorkspaceEdit, document: vscode.TextDocument, manifestEdit: InsertTextEdit): void {
    if (manifestEdit.at < 0 || manifestEdit.at > document.getText().length) {
        return;
    }
    // We can't escape characters in any meaningful way so this has to be the responsibility of the caller
    wsedit.insert(document.uri, document.positionAt(manifestEdit.at), manifestEdit.text);
}

function combineOneReplace(wsedit: vscode.WorkspaceEdit, document: vscode.TextDocument, manifestEdit: ReplaceTextEdit): void {
    if (manifestEdit.at.start < 0 || manifestEdit.at.end > document.getText().length) {
        return;
    }
    // We can't escape characters in any meaningful way so this has to be the responsibility of the caller
    const range = new vscode.Range(document.positionAt(manifestEdit.at.start), document.positionAt(manifestEdit.at.end));
    wsedit.replace(document.uri, range, manifestEdit.text);
}

function combineOneMergeValues(wsedit: vscode.WorkspaceEdit, document: vscode.TextDocument, manifestEdit: MergeValuesEdit): void {
    const languageId = getLanguageId(document);
    if (!languageId) {
        return;
    }

    const intoNode = mapNodeOf(manifestEdit.into);
    if (!intoNode) {
        return;
    }

    const documentText = document.getText();
    const parses = (languageId === 'yaml') ? kp.parseYAML(documentText) : kp.parseJSON(documentText);

    const replaceRangeInDoc = nodeRange(intoNode, document);
    const newMap = _.merge({}, objectOf(intoNode.entries), manifestEdit.values);
    const ancestors = getAncestors(parses, intoNode);
    const goingIntoEmptyMap = isEmptyMap(ancestors, intoNode);

    if (languageId === 'yaml') {
        const indentAmount = goingIntoEmptyMap ? yamlIndentAmountGoingIntoEmptyMap(document, ancestors![0]) : yamlIndentAmount(replaceRangeInDoc);
        const indent = ' '.repeat(indentAmount);
        // TODO: this can result in style changes to elements that were not modified e.g. image: foo:bar -> image: 'foo:bar'
        // This is irritating but may be hard to avoid in more complex situations such as when multiple values are being merged
        const basicYAML = yaml.safeDump(newMap);
        const indentedYAML = basicYAML.split('\n').map((l) => indent + l).join('\n');
        const prefix = goingIntoEmptyMap ? '\n' : '';
        const newText = prefix + indentedYAML.trim();
        wsedit.replace(document.uri, replaceRangeInDoc, newText);
    } else if (languageId === 'json') {
        throw new Error("You haven't done this bit yet Towlson!");
    }
}

type LanguageID = 'json' | 'yaml' | undefined;

function nodeRange(node: kp.MapValue, document: vscode.TextDocument) {
    const fullRange = node.range;
    const fullRangeInDoc = new vscode.Range(document.positionAt(fullRange.start), document.positionAt(fullRange.end)); // The range also picks up any leading spaces leading into the next array entry
    const fullRangeText = document.getText(fullRangeInDoc);
    const trailingSpaceCount = fullRangeText.length - fullRangeText.trimRight().length;
    const replaceRange = { start: fullRange.start, end: fullRange.end - trailingSpaceCount };
    const replaceRangeInDoc = new vscode.Range(document.positionAt(replaceRange.start), document.positionAt(replaceRange.end));
    return replaceRangeInDoc;
}

function isEmptyMap(ancestors: readonly kp.Ancestor[] | undefined, node: kp.MapValue) {
    const containmentKind = (ancestors && ancestors.length > 0) ? ancestors[0].kind : 'top-level';
    const existing = Object.entries(node.entries);
    const isNodeEmpty = existing.length === 0;
    return isNodeEmpty && containmentKind === 'map';
}

function getLanguageId(document: vscode.TextDocument): LanguageID {
    switch (document.languageId) {
        case 'json':
        case 'yaml':
            return document.languageId;
        default:
            return undefined;
    }
}

function getAncestors(parsedDocument: kp.ResourceParse[], node: kp.MapValue): ReadonlyArray<kp.Ancestor> | undefined {
    const ancestors = kp.evaluate(parsedDocument, {
        onMap: function* (value: kp.MapValue, ancestors: ReadonlyArray<kp.Ancestor>) {
            if (value.range.start === node.range.start && value.range.end === node.range.end) {
                yield ancestors;
            }
        }
    });

    return ancestors[0];
}

function yamlIndentAmount(range: vscode.Range): number {
    return range.start.character;
}

function yamlIndentAmountGoingIntoEmptyMap(document: vscode.TextDocument, parent: kp.Ancestor): number {
    const parentMap = parent.value as kp.MapValue;  // safe because containmentKind === 'map'
    const ourEntry = parentMap.entries[parent.at];
    return document.positionAt(ourEntry.keyRange.start).character + 2;
}
