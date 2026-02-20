import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { execFile } from 'child_process';

function openItermAtPath(dirPath: string): void {
    execFile('/usr/bin/open', ['-a', 'iTerm', dirPath], (error: Error | null) => {
        if (error) {
            vscode.window.showErrorMessage(`Failed to open iTerm: ${error.message}`);
        }
    });
}

function getWorkspaceRootPath(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
        return folders[0].uri.fsPath;
    }
    return undefined;
}

function getDirectoryFromUri(uri?: vscode.Uri): string | undefined {
    if (!uri) {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            uri = activeEditor.document.uri;
        }
    }
    if (!uri) {
        return undefined;
    }

    const fsPath = uri.fsPath;
    try {
        const stat = fs.statSync(fsPath);
        return stat.isDirectory() ? fsPath : path.dirname(fsPath);
    } catch {
        return path.dirname(fsPath);
    }
}

export function activate(context: vscode.ExtensionContext): void {
    const openRootDisposable = vscode.commands.registerCommand(
        'iterm-integration.openRoot',
        () => {
            const rootPath = getWorkspaceRootPath();
            if (rootPath) {
                openItermAtPath(rootPath);
            } else {
                vscode.window.showWarningMessage('No workspace folder is open.');
            }
        }
    );

    const openHereDisposable = vscode.commands.registerCommand(
        'iterm-integration.openHere',
        (uri?: vscode.Uri) => {
            const dirPath = getDirectoryFromUri(uri);
            if (dirPath) {
                openItermAtPath(dirPath);
            } else {
                vscode.window.showWarningMessage('No file or folder selected.');
            }
        }
    );

    context.subscriptions.push(openRootDisposable, openHereDisposable);
}

export function deactivate(): void {}
