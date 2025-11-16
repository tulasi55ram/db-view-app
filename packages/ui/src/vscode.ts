interface VsCodeApi {
  postMessage(message: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

let vscodeApi: VsCodeApi | undefined;

export function getVsCodeApi(): VsCodeApi | undefined {
  if (typeof acquireVsCodeApi === "function") {
    vscodeApi = vscodeApi ?? acquireVsCodeApi();
  }
  return vscodeApi;
}
