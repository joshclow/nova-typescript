import * as searchResultsModule from "../searchResults";
import { registerFindReferences } from "./findReferences";

jest.mock("../searchResults");

describe("findReferences command", () => {
  beforeEach(() => {
    (global as any).nova = Object.assign(nova, {
      commands: {
        register: jest.fn(),
      },
      workspace: {
        showErrorMessage(err: Error) {
          throw err;
        },
        showInformativeMessage: jest.fn(),
      },
    });
  });

  const mockEditor = {
    selectedRange: {
      start: 0,
      end: 0,
    },
    document: {
      getTextInRange() {
        return "";
      },
      eol: "\n",
    },
  };

  function getCommand(
    languageClient: LanguageClient,
    // eslint-disable-next-line no-unused-vars
    register: (client: LanguageClient) => NovaDisposable
    // eslint-disable-next-line no-unused-vars
  ): (...args: Array<any>) => Promise<void> {
    register(languageClient);
    expect(nova.commands.register).toHaveBeenCalledWith(
      "apexskier.typescript.findReferences",
      expect.any(Function)
    );
    const command = (nova.commands.register as jest.Mock).mock.calls[0][1];
    (nova.commands.register as jest.Mock).mockClear();
    return command;
  }

  it("warns if no references are available", async () => {
    const mockLanguageClient = {
      sendRequest: jest.fn().mockReturnValueOnce(Promise.resolve(null)),
    };
    const command = getCommand(
      mockLanguageClient as any as LanguageClient,
      registerFindReferences
    );
    await command(mockEditor);

    expect(nova.workspace.showInformativeMessage).toHaveBeenCalledTimes(1);
    expect(nova.workspace.showInformativeMessage).toHaveBeenCalledWith(
      "Couldn't find references."
    );
  });

  it("finds references", async () => {
    (global as any).console.info = jest.fn();
    const mockLanguageClient = {
      sendRequest: jest.fn().mockReturnValueOnce(Promise.resolve([])),
    };
    const command = getCommand(
      mockLanguageClient as any as LanguageClient,
      registerFindReferences
    );
    await command(mockEditor);

    expect(mockLanguageClient.sendRequest).toHaveBeenNthCalledWith(
      1,
      "textDocument/references",
      expect.anything()
    );

    expect(
      searchResultsModule.createLocationSearchResultsTree
    ).toHaveBeenCalledTimes(1);
  });
});
