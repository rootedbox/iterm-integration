jest.mock('vscode', () => require('./vscode.mock'), { virtual: true });
jest.mock('child_process');
jest.mock('fs');

import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as fs from 'fs';
import { activate, deactivate } from '../extension';

const mockExecFile = child_process.execFile as unknown as jest.Mock;
const mockStatSync = fs.statSync as jest.Mock;

function setupCommands() {
  const context = { subscriptions: [] } as unknown as vscode.ExtensionContext;
  activate(context);

  const handlers: Record<string, Function> = {};
  for (const call of (vscode.commands.registerCommand as jest.Mock).mock.calls) {
    handlers[call[0]] = call[1];
  }

  return { context, handlers };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockExecFile.mockImplementation(() => {});
  (vscode.workspace as any).workspaceFolders = undefined;
  (vscode.window as any).activeTextEditor = undefined;
});

describe('activate', () => {
  it('registers both commands', () => {
    const { context } = setupCommands();
    const reg = vscode.commands.registerCommand as jest.Mock;

    expect(reg).toHaveBeenCalledTimes(2);
    expect(reg).toHaveBeenCalledWith('iterm-integration.openRoot', expect.any(Function));
    expect(reg).toHaveBeenCalledWith('iterm-integration.openHere', expect.any(Function));
  });

  it('pushes disposables to subscriptions', () => {
    const { context } = setupCommands();
    expect(context.subscriptions).toHaveLength(2);
  });
});

describe('deactivate', () => {
  it('can be called without error', () => {
    expect(() => deactivate()).not.toThrow();
  });
});

describe('openRoot command', () => {
  it('opens iTerm at workspace root', () => {
    (vscode.workspace as any).workspaceFolders = [
      { uri: { fsPath: '/projects/myapp' } },
    ];
    const { handlers } = setupCommands();

    handlers['iterm-integration.openRoot']();

    expect(mockExecFile).toHaveBeenCalledWith(
      '/usr/bin/open',
      ['-a', 'iTerm', '/projects/myapp'],
      expect.any(Function),
    );
  });

  it('uses first folder in multi-root workspace', () => {
    (vscode.workspace as any).workspaceFolders = [
      { uri: { fsPath: '/first' } },
      { uri: { fsPath: '/second' } },
    ];
    const { handlers } = setupCommands();

    handlers['iterm-integration.openRoot']();

    expect(mockExecFile).toHaveBeenCalledWith(
      '/usr/bin/open',
      ['-a', 'iTerm', '/first'],
      expect.any(Function),
    );
  });

  it('shows warning when no workspace is open', () => {
    (vscode.workspace as any).workspaceFolders = undefined;
    const { handlers } = setupCommands();

    handlers['iterm-integration.openRoot']();

    expect(mockExecFile).not.toHaveBeenCalled();
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      'No workspace folder is open.',
    );
  });

  it('shows warning when workspace folders array is empty', () => {
    (vscode.workspace as any).workspaceFolders = [];
    const { handlers } = setupCommands();

    handlers['iterm-integration.openRoot']();

    expect(mockExecFile).not.toHaveBeenCalled();
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      'No workspace folder is open.',
    );
  });
});

describe('openHere command', () => {
  it('opens iTerm at directory when URI is a directory', () => {
    mockStatSync.mockReturnValue({ isDirectory: () => true });
    const { handlers } = setupCommands();

    handlers['iterm-integration.openHere']({ fsPath: '/projects/myapp/src' });

    expect(mockExecFile).toHaveBeenCalledWith(
      '/usr/bin/open',
      ['-a', 'iTerm', '/projects/myapp/src'],
      expect.any(Function),
    );
  });

  it('opens iTerm at parent directory when URI is a file', () => {
    mockStatSync.mockReturnValue({ isDirectory: () => false });
    const { handlers } = setupCommands();

    handlers['iterm-integration.openHere']({ fsPath: '/projects/myapp/src/index.ts' });

    expect(mockExecFile).toHaveBeenCalledWith(
      '/usr/bin/open',
      ['-a', 'iTerm', '/projects/myapp/src'],
      expect.any(Function),
    );
  });

  it('falls back to active editor when no URI provided', () => {
    mockStatSync.mockReturnValue({ isDirectory: () => false });
    (vscode.window as any).activeTextEditor = {
      document: { uri: { fsPath: '/projects/myapp/README.md' } },
    };
    const { handlers } = setupCommands();

    handlers['iterm-integration.openHere']();

    expect(mockExecFile).toHaveBeenCalledWith(
      '/usr/bin/open',
      ['-a', 'iTerm', '/projects/myapp'],
      expect.any(Function),
    );
  });

  it('shows warning when no URI and no active editor', () => {
    (vscode.window as any).activeTextEditor = undefined;
    const { handlers } = setupCommands();

    handlers['iterm-integration.openHere']();

    expect(mockExecFile).not.toHaveBeenCalled();
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      'No file or folder selected.',
    );
  });

  it('falls back to dirname when statSync throws', () => {
    mockStatSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });
    const { handlers } = setupCommands();

    handlers['iterm-integration.openHere']({ fsPath: '/projects/myapp/missing.ts' });

    expect(mockExecFile).toHaveBeenCalledWith(
      '/usr/bin/open',
      ['-a', 'iTerm', '/projects/myapp'],
      expect.any(Function),
    );
  });
});

describe('execFile error handling', () => {
  it('shows error message when open command fails', () => {
    (vscode.workspace as any).workspaceFolders = [
      { uri: { fsPath: '/projects/myapp' } },
    ];
    mockExecFile.mockImplementation((_cmd: string, _args: string[], cb: Function) => {
      cb(new Error('iTerm2 is not installed'));
    });
    const { handlers } = setupCommands();

    handlers['iterm-integration.openRoot']();

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'Failed to open iTerm: iTerm2 is not installed',
    );
  });

  it('does not show error message when open succeeds', () => {
    (vscode.workspace as any).workspaceFolders = [
      { uri: { fsPath: '/projects/myapp' } },
    ];
    mockExecFile.mockImplementation((_cmd: string, _args: string[], cb: Function) => {
      cb(null);
    });
    const { handlers } = setupCommands();

    handlers['iterm-integration.openRoot']();

    expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
  });
});
