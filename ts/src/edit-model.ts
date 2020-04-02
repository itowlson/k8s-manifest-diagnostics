import * as kp from 'k8s-manifest-parser';

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

export type ManifestEdit = InsertTextEdit | MergeValuesEdit;
