jest.mock("./informationView");
jest.mock("./tsLibPath", () => ({
  getTsLibPath: () => "/tsLibPath",
}));
jest.mock("./tsUserPreferences", () => ({
  setupUserPreferences: jest.fn(),
  getUserPreferences: () => "user preferences",
}));
jest.mock("./isEnabledForJavascript", () => ({
  isEnabledForJavascript: () => true,
}));
jest.mock("./skipDestructiveOrganizeImports", () => ({
  skipDestructiveOrganizeImports: () => false,
}));
jest.mock("nova-extension-utils");

jest.useFakeTimers();

(global as any).nova = Object.assign(nova, {
  commands: {
    register: jest.fn(),
    invoke: jest.fn(),
  },
  config: {
    ["get"]: jest.fn(),
  },
  workspace: {
    path: "/workspace",
    onDidAddTextEditor: jest.fn(),
  },
  extension: {
    path: "/extension",
  },
  fs: {
    access: jest.fn(),
  },
  path: {
    join(...args: string[]) {
      return args.join("/");
    },
  },
});

const originalLog = global.console.log;
global.console.log = jest.fn((...args) => {
  if (
    args[0] === "activating..." ||
    args[0] === "activated" ||
    args[0] === "reloading..." ||
    args[0] === "deactivate"
  ) {
    return;
  }
  originalLog(...args);
});
global.console.info = jest.fn();

const CompositeDisposableMock: jest.Mock<Partial<CompositeDisposable>> =
  jest.fn();
(global as any).CompositeDisposable = CompositeDisposableMock;
const ProcessMock: jest.Mock<Partial<Process>> = jest.fn();
(global as any).Process = ProcessMock;
const LanguageClientMock: jest.Mock<Partial<LanguageClient>> = jest.fn();
(global as any).LanguageClient = LanguageClientMock;

describe("test suite", () => {
  beforeEach(() => {
    jest.resetModules();

    const {
      dependencyManagement: { installWrappedDependencies },
    } = require("nova-extension-utils");
    installWrappedDependencies
      .mockReset()
      .mockImplementation(() => Promise.resolve());
    nova.fs.access = jest.fn().mockReturnValue(true);
    (nova.commands.register as jest.Mock).mockReset();
    (nova.commands.invoke as jest.Mock).mockReset();
    (nova.config.get as jest.Mock).mockReset();
    LanguageClientMock.mockReset().mockImplementation(() => ({
      onRequest: jest.fn(),
      onNotification: jest.fn(),
      onDidStop: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    }));
    ProcessMock.mockReset().mockImplementation(() => ({
      onStdout: jest.fn(),
      onStderr: jest.fn(),
      onDidExit: jest.fn((cb) => {
        cb(0);
        return { dispose: jest.fn() };
      }),
      start: jest.fn(),
    }));
    const { InformationView } = require("./informationView");
    (InformationView as jest.Mock).mockReset();
    (nova.workspace.onDidAddTextEditor as jest.Mock).mockReset();
    CompositeDisposableMock.mockReset().mockImplementation(() => ({
      add: jest.fn(),
      dispose: jest.fn(),
    }));
  });

  test("global behavior", () => {
    require("./main");

    expect(nova.commands.register).toHaveBeenCalledTimes(2);
    expect(nova.commands.register).toHaveBeenCalledWith(
      "apexskier.typescript.openWorkspaceConfig",
      expect.any(Function)
    );
    expect(nova.commands.register).toHaveBeenCalledWith(
      "apexskier.typescript.reload",
      expect.any(Function)
    );

    expect(CompositeDisposable).toHaveBeenCalledTimes(1);

    const { registerDependencyUnlockCommand } =
      require("nova-extension-utils").dependencyManagement;
    expect(registerDependencyUnlockCommand).toHaveBeenCalledTimes(1);
    expect(registerDependencyUnlockCommand).toHaveBeenCalledWith(
      "apexskier.typescript.forceClearLock"
    );
  });

  function assertActivationBehavior() {
    expect(nova.commands.register).toHaveBeenCalledTimes(7);
    expect(nova.commands.register).toHaveBeenNthCalledWith(
      1,
      "apexskier.typescript.openWorkspaceConfig",
      expect.any(Function)
    );
    expect(nova.commands.register).toHaveBeenNthCalledWith(
      2,
      "apexskier.typescript.reload",
      expect.any(Function)
    );
    expect(nova.commands.register).toHaveBeenNthCalledWith(
      3,
      "apexskier.typescript.findReferences",
      expect.any(Function)
    );
    expect(nova.commands.register).toHaveBeenNthCalledWith(
      4,
      "apexskier.typescript.findSymbol",
      expect.any(Function)
    );
    expect(nova.commands.register).toHaveBeenNthCalledWith(
      5,
      "apexskier.typescript.rename",
      expect.any(Function)
    );
    expect(nova.commands.register).toHaveBeenNthCalledWith(
      6,
      "apexskier.typescript.commands.organizeImports",
      expect.any(Function)
    );
    expect(nova.commands.register).toHaveBeenNthCalledWith(
      7,
      "apexskier.typescript.commands.formatDocument",
      expect.any(Function)
    );

    const tsUserPreferencesModule = require("./tsUserPreferences");
    expect(tsUserPreferencesModule.setupUserPreferences).toHaveBeenCalled();

    // installs dependencies

    const {
      dependencyManagement: { installWrappedDependencies },
    } = require("nova-extension-utils");
    expect(installWrappedDependencies).toHaveBeenCalledTimes(1);

    expect(Process).toHaveBeenCalledTimes(2);
    // makes the run script executable
    expect(Process).toHaveBeenNthCalledWith(1, "/usr/bin/env", {
      args: ["chmod", "u+x", "/extension/run.sh"],
    });
    // gets the typescript version
    expect(Process).toHaveBeenNthCalledWith(2, "/usr/bin/env", {
      args: ["node", "/tsLibPath/tsc.js", "--version"],
      stdio: ["ignore", "pipe", "ignore"],
    });

    expect(LanguageClientMock).toHaveBeenCalledTimes(1);
    expect(LanguageClientMock).toHaveBeenCalledWith(
      "apexskier.typescript",
      "TypeScript Language Server",
      {
        env: {
          DEBUG: "FALSE",
          DEBUG_BREAK: "FALSE",
          DEBUG_PORT: "undefined",
          INSTALL_DIR: undefined,
          WORKSPACE_DIR: "/workspace",
        },
        path: "/extension/run.sh",
        type: "stdio",
      },
      {
        initializationOptions: {
          preferences: "user preferences",
          tsserver: {
            path: "/tsLibPath/tsserver.js",
          },
        },
        syntaxes: ["typescript", "tsx", "cts", "mts", "javascript", "jsx"],
      }
    );
    const languageClient: LanguageClient =
      LanguageClientMock.mock.results[0].value;
    expect(languageClient.start).toHaveBeenCalledTimes(1);

    expect(languageClient.onRequest).not.toHaveBeenCalled();

    const { InformationView } = require("./informationView");
    expect(InformationView).toHaveBeenCalledTimes(1);
    const informationView = (
      InformationView as jest.Mock<typeof InformationView>
    ).mock.instances[0];
    expect(informationView.status).toBe("Running");
    expect(informationView.reload).toHaveBeenCalledTimes(1);
  }

  describe("activate and deactivate", () => {
    it("installs dependencies, runs the server, gets the ts version", async () => {
      // dynamically require so global mocks are setup before top level code execution
      const { activate, deactivate } = require("./main");

      (ProcessMock as jest.Mock<Partial<Process>>)
        .mockImplementationOnce(() => ({
          onStdout: jest.fn(),
          onStderr: jest.fn(),
          onDidExit: jest.fn((cb) => {
            cb(0);
            return { dispose: jest.fn() };
          }),
          start: jest.fn(),
        }))
        .mockImplementationOnce(() => ({
          onStdout: jest.fn((cb) => {
            cb("ts v1.2.3\n");
            return { dispose: jest.fn() };
          }),
          onStderr: jest.fn(),
          onDidExit: jest.fn(),
          start: jest.fn(),
        }));

      await activate();

      assertActivationBehavior();

      // typescript version is reported in the information view
      const { InformationView } = require("./informationView");
      const informationView = (
        InformationView as jest.Mock<typeof InformationView>
      ).mock.instances[0];
      expect(informationView.tsVersion).toBeUndefined();
      const tsVersionProcess: Process = ProcessMock.mock.results[1].value;
      const exitCB = (tsVersionProcess.onDidExit as jest.Mock).mock.calls[0][0];
      exitCB(0);
      // allow promise to execute
      await new Promise(setImmediate);
      expect(informationView.tsVersion).toBe("ts v1.2.3");

      deactivate();

      const languageClient: LanguageClient =
        LanguageClientMock.mock.results[0].value;
      expect(languageClient.stop).toHaveBeenCalledTimes(1);
      const compositeDisposable: CompositeDisposable =
        CompositeDisposableMock.mock.results[0].value;
      expect(compositeDisposable.dispose).toHaveBeenCalledTimes(1);
    });

    it("shows an error if activation fails", async () => {
      // dynamically require so global mocks are setup before top level code execution
      const { activate } = require("./main");

      global.console.error = jest.fn();
      global.console.warn = jest.fn();
      nova.workspace.showErrorMessage = jest.fn();

      const {
        dependencyManagement: { installWrappedDependencies },
      } = require("nova-extension-utils");
      installWrappedDependencies.mockImplementation(() =>
        Promise.reject(new Error("Failed to install:\n\nsome output on stderr"))
      );

      await activate();

      expect(nova.workspace.showErrorMessage).toHaveBeenCalledWith(
        new Error("Failed to install:\n\nsome output on stderr")
      );
    });

    it("handles unexpected crashes", async () => {
      // dynamically require so global mocks are setup before top level code execution
      const { activate } = require("./main");

      nova.workspace.showActionPanel = jest.fn();

      await activate();

      const languageClient: LanguageClient =
        LanguageClientMock.mock.results[0].value;
      const stopCallback = (languageClient.onDidStop as jest.Mock).mock
        .calls[0][0];

      stopCallback(new Error("Mock language server crash"));

      expect(nova.workspace.showActionPanel).toHaveBeenCalledTimes(1);
      const actionPanelCall = (nova.workspace.showActionPanel as jest.Mock).mock
        .calls[0];
      expect(actionPanelCall[0]).toMatchInlineSnapshot(`
        "TypeScript Language Server stopped unexpectedly:

        Error: Mock language server crash

        Please report this, along with any output in the Extension Console."
      `);
      expect(actionPanelCall[1].buttons).toHaveLength(2);

      const { InformationView } = require("./informationView");
      const informationView = (
        InformationView as jest.Mock<typeof InformationView>
      ).mock.instances[0];
      expect(informationView.status).toBe("Stopped");

      const actionCallback = actionPanelCall[2];

      // reload
      expect(nova.commands.invoke).not.toHaveBeenCalled();
      actionCallback(0);
      expect(nova.commands.invoke).toHaveBeenCalledTimes(1);
      expect(nova.commands.invoke).toHaveBeenCalledWith(
        "apexskier.typescript.reload"
      );

      // ignore
      actionCallback(1);
    });

    test("reload", async () => {
      // dynamically require so global mocks are setup before top level code execution
      require("./main");

      const reload = (nova.commands.register as jest.Mock).mock.calls.find(
        ([command]) => command == "apexskier.typescript.reload"
      )[1];

      expect(CompositeDisposableMock).toHaveBeenCalledTimes(1);

      await reload();

      expect(CompositeDisposableMock).toHaveBeenCalledTimes(2);

      const compositeDisposable1: CompositeDisposable =
        CompositeDisposableMock.mock.results[0].value;
      expect(compositeDisposable1.dispose).toHaveBeenCalledTimes(1);
      const compositeDisposable2: CompositeDisposable =
        CompositeDisposableMock.mock.results[1].value;
      expect(compositeDisposable2.dispose).not.toHaveBeenCalled();

      assertActivationBehavior();
    });

    test("watches files to apply post-save actions", async () => {
      // dynamically require so global mocks are setup before top level code execution
      const { activate } = require("./main");

      await activate();

      (nova as any).config = { onDidChange: jest.fn() };
      (nova as any).workspace.config = { onDidChange: jest.fn() };

      expect(nova.workspace.onDidAddTextEditor).toHaveBeenCalledTimes(1);
      const setupWatcher = (nova.workspace.onDidAddTextEditor as jest.Mock).mock
        .calls[0][0];
      const mockEditor = {
        onWillSave: jest.fn(),
        onDidDestroy: jest.fn(),
        document: {
          syntax: "typescript",
          onDidChangeSyntax: jest.fn(),
        },
      };
      setupWatcher(mockEditor);

      expect(mockEditor.onWillSave).toHaveBeenCalledTimes(0);
      const refreshListener = (nova.config.onDidChange as jest.Mock).mock
        .calls[0][1];

      const getBoolMock: jest.Mock = require("nova-extension-utils").preferences
        .getOverridableBoolean;

      getBoolMock.mockReturnValue(false);
      refreshListener();

      // eslint-disable-next-line no-unused-vars
      let saveHandler: (editor: unknown) => Promise<unknown>;

      getBoolMock.mockReset().mockReturnValue(true);
      refreshListener();
      saveHandler = mockEditor.onWillSave.mock.calls[0][0];
      await saveHandler(mockEditor);
      expect(nova.commands.invoke).toHaveBeenCalledTimes(2);
      expect(nova.commands.invoke).toHaveBeenNthCalledWith(
        1,
        "apexskier.typescript.commands.organizeImports",
        mockEditor
      );
      expect(nova.commands.invoke).toHaveBeenNthCalledWith(
        2,
        "apexskier.typescript.commands.formatDocument",
        mockEditor
      );

      mockEditor.onWillSave.mockReset();
      (nova.commands.invoke as jest.Mock).mockReset();
      getBoolMock
        .mockReset()
        .mockImplementation(
          (test: string) =>
            test == "apexskier.typescript.config.organizeImportsOnSave"
        );
      refreshListener();
      saveHandler = mockEditor.onWillSave.mock.calls[0][0];
      await saveHandler(mockEditor);
      expect(nova.commands.invoke).toHaveBeenCalledTimes(1);
      expect(nova.commands.invoke).toHaveBeenNthCalledWith(
        1,
        "apexskier.typescript.commands.organizeImports",
        mockEditor
      );

      mockEditor.onWillSave.mockReset();
      (nova.commands.invoke as jest.Mock).mockReset();
      getBoolMock
        .mockReset()
        .mockImplementation(
          (test: string) =>
            test == "apexskier.typescript.config.formatDocumentOnSave"
        );
      refreshListener();
      saveHandler = mockEditor.onWillSave.mock.calls[0][0];
      await saveHandler(mockEditor);
      expect(nova.commands.invoke).toHaveBeenCalledTimes(1);
      expect(nova.commands.invoke).toHaveBeenNthCalledWith(
        1,
        "apexskier.typescript.commands.formatDocument",
        mockEditor
      );
    });
  });
});
