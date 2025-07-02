import { showLocation } from "./showLocation";

class MockRange {
  // eslint-disable-next-line no-unused-vars
  constructor(readonly start: number, readonly end: number) {}
}
(global as any).Range = MockRange;

beforeEach(() => {
  (global as any).nova = Object.assign(nova, {
    workspace: {
      openFile: jest.fn(),
    },
  });
});

const table = [
  // Location
  {
    uri: "fileURI",
    range: {
      start: { line: 1, character: 2 },
      end: { line: 3, character: 4 },
    },
  },
  // LocationLink
  {
    targetUri: "fileURI",
    targetRange: {
      start: { line: 1, character: 2 },
      end: { line: 3, character: 4 },
    },
    targetSelectionRange: {
      start: { line: 1, character: 2 },
      end: { line: 3, character: 4 },
    },
  },
];
describe.each(table)("showLocation", (location) => {
  it("opens file, selects text, scrolls to selection", async () => {
    const mockEditor = {
      document: {
        getTextInRange() {
          return `This is some
fun text
in the editor.
cool beans
coooooool beeeaaans`;
        },
        eol: "\n",
      },
      addSelectionForRange: jest.fn(),
      scrollToPosition: jest.fn(),
    };
    nova.workspace.openFile = jest
      .fn()
      .mockReturnValueOnce(Promise.resolve(mockEditor));

    await showLocation(location);

    expect(nova.workspace.openFile).toHaveBeenCalledTimes(1);
    expect(nova.workspace.openFile).toHaveBeenCalledWith("fileURI");
    expect(mockEditor.addSelectionForRange).toHaveBeenCalledTimes(1);
    expect(mockEditor.addSelectionForRange).toHaveBeenCalledWith(new Range(15, 41));
    expect(mockEditor.scrollToPosition).toHaveBeenCalledTimes(1);
  });

  it("handles failures to open editor", async () => {
    global.console.warn = jest.fn();
    nova.workspace.showWarningMessage = jest.fn();
    await showLocation(location);

    expect(nova.workspace.openFile).toHaveBeenCalledWith("fileURI");
    expect(nova.workspace.showWarningMessage).toHaveBeenCalledTimes(1);
    expect(nova.workspace.showWarningMessage).toHaveBeenCalledWith(
      "Failed to open fileURI"
    );
  });
});
