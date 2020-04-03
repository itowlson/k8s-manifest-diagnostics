import * as kp from 'k8s-manifest-parser';
import * as vscode from 'vscode';
import { cantHappen } from './utils/never';

export interface InsertTextEdit {
    readonly kind: 'insert';
    readonly at: number;
    readonly text: string;
}

export interface MergeValuesEdit {
    readonly kind: 'merge-values';
    readonly into: kp.MapTraversalEntry | kp.MapValue;
    readonly values: object;
}

type SingleManifestEdit = InsertTextEdit | MergeValuesEdit;

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
        case 'merge-values':
            combineOneMergeValues(wsedit, document, manifestEdit);
            return;
        default:
            cantHappen(manifestEdit);
            return;
    }
}

function combineOneInsert(wsedit: vscode.WorkspaceEdit, document: vscode.TextDocument, manifestEdit: InsertTextEdit): void {
    wsedit.insert(document.uri, document.positionAt(manifestEdit.at), manifestEdit.text);
}

function combineOneMergeValues(_wsedit: vscode.WorkspaceEdit, _document: vscode.TextDocument, _manifestEdit: MergeValuesEdit): void {
}
