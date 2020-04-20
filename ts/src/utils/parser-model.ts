import * as kp from 'k8s-manifest-parser';
import { cantHappen } from './never';

export function objectOf(ast: { [key: string]: kp.ResourceMapEntry }): object {
    const o: any = {};
    for (const [k, v] of Object.entries(ast)) {
        o[k] = jsValueOfResourceMapEntry(v);
    }
    return o;
}

function jsValueOfResourceMapEntry(rme: kp.ResourceMapEntry): any {
    return jsValueOfASTValue(rme.value);
}

function jsValueOfASTValue(v: kp.Value): any {
    switch (v.valueType) {
        case 'string': return v.value;
        case 'number': return v.value;
        case 'boolean': return v.value;
        case 'array': return v.items.map((item) => jsValueOfASTValue(item));
        case 'map': return objectOf(v.entries);
        case 'missing': return undefined;
        default: return cantHappen(v);
    }
}

export function mapNodeOf(node: kp.MapTraversalEntry | kp.MapValue | kp.ResourceParse): kp.MapValue | undefined {
    if (isMapValue(node)) {
        return node;
    }
    if (isMapTraversalEntry(node)) {
        return node.parseNode() as (kp.MapValue | undefined);
    }
    return { valueType: 'map', ...node };
}

function isMapValue(node: kp.MapTraversalEntry | kp.MapValue | kp.ResourceParse): node is kp.MapValue {
    return (node as any).valueType === 'map';
}

function isMapTraversalEntry(node: kp.MapTraversalEntry | kp.MapValue | kp.ResourceParse): node is kp.MapTraversalEntry {
    return !!((node as any).parseNode);
}
