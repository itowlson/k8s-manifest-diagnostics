import * as path from 'path';

import { downloadAndUnzipVSCode, runTests } from 'vscode-test';

async function main() {
    try {
        // The folder containing the Extension Manifest package.json
        // Passed to `--extensionDevelopmentPath`
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');

        // The path to the extension test script
        // Passed to --extensionTestsPath
        const extensionTestsPath = path.resolve(__dirname, '../test/index');

        const vscodeExecutablePath = await downloadAndUnzipVSCode('1.43.2');
        // const cliPath = resolveCliPathFromVSCodeExecutablePath(vscodeExecutablePath);

        // Download VS Code, unzip it and run the integration test
        const exitCode = await runTests({ vscodeExecutablePath, extensionDevelopmentPath, extensionTestsPath });
        console.log(`Test runner exited with code ${exitCode}`);
    } catch (err) {
        console.error('Failed to run tests');
        process.exit(1);
    }
}

main();
