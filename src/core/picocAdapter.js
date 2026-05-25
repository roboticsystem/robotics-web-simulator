export class PicoCAdapter {
  // 初始化 PicoC WASM 适配器的基础状态。
  constructor({ onStdout, onStderr }) {
    this.onStdout = onStdout;
    this.onStderr = onStderr;
    this.module = null;
    this.ready = false;
    this.loadPromise = null;
    this.loadStage = "idle";
    this.cacheToken = `${Date.now()}`;
    this.stdoutBuffer = "";
    this.stderrBuffer = "";
  }

  // 按需加载 PicoC WASM 模块并复用结果。
  async load() {
    if (this.ready && this.module) {
      return this.module;
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = this.loadInternal();

    try {
      return await this.loadPromise;
    } catch (error) {
      const detail = this.formatErrorDetail(error);
      throw new Error(`PicoC WASM is not ready at ${this.loadStage}: ${detail}`);
    } finally {
      this.loadPromise = null;
    }
  }

  // 负责真正导入并实例化 PicoC WASM 资源。
  async loadInternal() {
    const moduleUrl = new URL("/wasm/picoc.js", window.location.origin);
    moduleUrl.searchParams.set("t", this.cacheToken);

    this.loadStage = "import";
    const imported = await import(/* @vite-ignore */ moduleUrl.href);
    const factory =
      imported.default ??
      imported.createPicoCModule ??
      window.createPicoCModule ??
      null;

    if (typeof factory !== "function") {
      throw new Error("PicoC Emscripten factory was not found.");
    }

    this.loadStage = "instantiate";
    this.module = await factory({
      noFSInit: true,
      locateFile: (path) => {
        const assetUrl = new URL(`/wasm/${path}`, window.location.origin);
        assetUrl.searchParams.set("t", this.cacheToken);
        return assetUrl.href;
      },
      preRun: [
        (module) => {
          this.installStdioBridge(module);
        }
      ],
      print: (text) => this.onStdout?.(String(text)),
      printErr: (text) => this.onStderr?.(String(text))
    });

    this.loadStage = "ready";
    this.ready = true;
    return this.module;
  }

  // 把不同类型的异常整理成可读文本。
  formatErrorDetail(error) {
    if (error instanceof Error) {
      return error.stack || error.message;
    }

    if (typeof error === "string") {
      return error;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  // 把标准输入输出桥接到前端回调。
  installStdioBridge(module) {
    if (!module?.FS?.init) {
      throw new Error("Emscripten FS.init is unavailable.");
    }

    module.FS.init(
      null,
      (charCode) => this.handleStdoutChar(charCode),
      (charCode) => this.handleStderrChar(charCode)
    );
  }

  // 处理 PicoC 标准输出的单字符流。
  handleStdoutChar(charCode) {
    this.stdoutBuffer = this.consumeChar(this.stdoutBuffer, charCode, this.onStdout);
  }

  // 处理 PicoC 标准错误的单字符流。
  handleStderrChar(charCode) {
    this.stderrBuffer = this.consumeChar(this.stderrBuffer, charCode, this.onStderr);
  }

  // 把字符流累积成按行输出的文本。
  consumeChar(buffer, charCode, emitter) {
    if (charCode === null || charCode === undefined) {
      if (buffer) {
        emitter?.(buffer);
      }
      return "";
    }

    if (charCode === 10) {
      emitter?.(buffer);
      return "";
    }

    if (charCode !== 0) {
      return buffer + String.fromCharCode(charCode);
    }

    return buffer;
  }

  // 在执行结束时冲刷尚未输出的缓冲文本。
  flushPendingOutput() {
    if (this.stdoutBuffer) {
      this.onStdout?.(this.stdoutBuffer);
      this.stdoutBuffer = "";
    }

    if (this.stderrBuffer) {
      this.onStderr?.(this.stderrBuffer);
      this.stderrBuffer = "";
    }
  }

  // 在模块异常后重置缓存状态。
  invalidateModule() {
    this.module = null;
    this.ready = false;
    this.loadStage = "idle";
    this.cacheToken = `${Date.now()}`;
  }

  // 执行当前 C 源码并返回 PicoC 退出码。
  async run(source, options = {}) {
    const module = await this.load();
    if (!module?.ccall) {
      throw new Error("PicoC module is missing ccall.");
    }
    this.stdoutBuffer = "";
    this.stderrBuffer = "";
    const debug = Boolean(options.debug);
    const functionName = debug ? "run_source_debug" : "run_source";

    try {
      return await module.ccall(functionName, "number", ["string"], [source], {
        async: true
      });
    } catch (error) {
      this.invalidateModule();
      throw error;
    } finally {
      this.flushPendingOutput();
    }
  }
}
