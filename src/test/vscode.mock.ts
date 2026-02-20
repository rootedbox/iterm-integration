export const window = {
  showErrorMessage: jest.fn(),
  showWarningMessage: jest.fn(),
  activeTextEditor: undefined as any,
};

export const workspace = {
  workspaceFolders: undefined as any,
};

export const commands = {
  registerCommand: jest.fn(),
};

export const Uri = {
  file: (path: string) => ({ fsPath: path }),
};
