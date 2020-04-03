import * as fs from 'fs';
import * as path from 'path';
import * as tmp from 'tmp';

export async function withTempFileCopy<T>(sourceFilePath: string, fn: (tempFilePath: string) => Promise<T>): Promise<T> {
    const tempFileObj = tmp.fileSync({ prefix: 'k8smd-test-', postfix: path.extname(sourceFilePath) });
    fs.copyFileSync(sourceFilePath, tempFileObj.name);
    try {
        return await fn(tempFileObj.name);
    } finally {
        tempFileObj.removeCallback();
    }
}
