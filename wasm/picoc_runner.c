#include <stdio.h>
#include <string.h>
#include <emscripten/emscripten.h>

#include "picoc.h"
#include "platform.h"

#ifndef PICOC_STACK_SIZE
#define PICOC_STACK_SIZE (128 * 1024)
#endif

// 初始化 PicoC 并执行当前源码。
static int run_source_internal(const char *source, int debugEnabled) {
    Picoc pc;
    int exitValue = 0;
    char *mainName;

    setbuf(stdout, NULL);
    setbuf(stderr, NULL);

    PicocInitialize(&pc, PICOC_STACK_SIZE);
    PicocIncludeAllSystemHeaders(&pc);
    WebDebugSetEnabled(debugEnabled);

    if (PicocPlatformSetExitPoint(&pc)) {
        exitValue = pc.PicocExitValue;
        WebDebugSetEnabled(0);
        PicocCleanup(&pc);
        return exitValue;
    }

    PicocParse(&pc, "web_input.c", source, (int)strlen(source), true, true, false, false);
    mainName = TableStrRegister(&pc, "main");
    if (VariableDefined(&pc, mainName)) {
        PicocCallMain(&pc, 0, NULL);
    }
    fflush(stdout);
    fflush(stderr);
    exitValue = pc.PicocExitValue;
    WebDebugSetEnabled(0);
    PicocCleanup(&pc);
    return exitValue;
}

EMSCRIPTEN_KEEPALIVE
// 以普通运行模式执行源码。
int run_source(const char *source) {
    return run_source_internal(source, 0);
}

EMSCRIPTEN_KEEPALIVE
// 以调试运行模式执行源码。
int run_source_debug(const char *source) {
    return run_source_internal(source, 1);
}
