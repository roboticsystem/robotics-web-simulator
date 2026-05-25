import { registerCEditorIntelligence } from "./cEditorIntelligence.js";

let monacoBootstrapped = false;

// 按需加载并初始化 Monaco 编辑器环境。
export async function loadMonaco() {
  const monaco = await import("monaco-editor/esm/vs/editor/editor.api");

  if (!monacoBootstrapped) {
    await import("monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution");
    const editorWorker = await import(
      "monaco-editor/esm/vs/editor/editor.worker?worker"
    );

    self.MonacoEnvironment = {
      getWorker() {
        return new editorWorker.default();
      }
    };
    registerCEditorIntelligence(monaco);
    monacoBootstrapped = true;
  }

  return monaco;
}
