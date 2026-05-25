const BUILTIN_FUNCTIONS = new Set([
  "printf",
  "robot_move_backward",
  "robot_move_forward",
  "robot_read_battery",
  "robot_read_distance",
  "robot_read_light",
  "robot_read_sensor",
  "robot_read_temperature",
  "robot_reset",
  "robot_say",
  "robot_stop",
  "robot_turn_left",
  "robot_turn_right",
  "robot_wait"
]);

const BUILTIN_FUNCTION_SIGNATURES = new Map([
  ["printf", { minArgs: 1, maxArgs: Number.POSITIVE_INFINITY }],
  ["robot_move_backward", { minArgs: 2, maxArgs: 2 }],
  ["robot_move_forward", { minArgs: 2, maxArgs: 2 }],
  ["robot_read_battery", { minArgs: 0, maxArgs: 0 }],
  ["robot_read_distance", { minArgs: 0, maxArgs: 0 }],
  ["robot_read_light", { minArgs: 0, maxArgs: 0 }],
  ["robot_read_sensor", { minArgs: 1, maxArgs: 1 }],
  ["robot_read_temperature", { minArgs: 0, maxArgs: 0 }],
  ["robot_reset", { minArgs: 0, maxArgs: 0 }],
  ["robot_say", { minArgs: 1, maxArgs: 1 }],
  ["robot_stop", { minArgs: 0, maxArgs: 0 }],
  ["robot_turn_left", { minArgs: 2, maxArgs: 2 }],
  ["robot_turn_right", { minArgs: 2, maxArgs: 2 }],
  ["robot_wait", { minArgs: 1, maxArgs: 1 }]
]);

const ROBOT_SENSOR_NAMES = new Set([
  "DISTANCE",
  "TEMPERATURE",
  "LIGHT",
  "BATTERY",
  "ULTRASONIC",
  "ULTRASONIC_DISTANCE",
  "INFRARED",
  "INFRARED_ANALOG",
  "INFRARED_DIGITAL",
  "IMU_GYRO_Z",
  "IMU_ACCEL_X",
  "IMU_ACCEL_Y",
  "IMU_ROLL",
  "IMU_PITCH",
  "ULTRASONIC_01",
  "INFRARED_01",
  "IMU_01"
]);

const FUNCTION_LIKE_KEYWORDS = new Set([
  "for",
  "if",
  "return",
  "sizeof",
  "switch",
  "while"
]);

const TYPE_NAMES = new Set([
  "FILE",
  "bool",
  "char",
  "double",
  "float",
  "int",
  "long",
  "short",
  "size_t",
  "void"
]);

const OPENERS = new Map([
  ["(", ")"],
  ["[", "]"],
  ["{", "}"]
]);

const CLOSERS = new Map([
  [")", "("],
  ["]", "["],
  ["}", "{"]
]);

const TYPE_PREFIX_PATTERN =
  /^(?:(?:static|const|unsigned|signed|long|short|volatile|register|extern|auto|inline|typedef)\s+)*(?:void|char|short|int|long|float|double|bool|size_t|FILE|struct\s+[A-Za-z_]\w*|enum\s+[A-Za-z_]\w*|union\s+[A-Za-z_]\w*|[A-Z][A-Za-z0-9_]*|[A-Za-z_]\w*_t)\b/;

const FUNCTION_SIGNATURE_PATTERN =
  /(^|\n)\s*((?:(?:static|inline|extern|const|unsigned|signed|long|short|volatile|register|auto)\s+)*(?:void|char|short|int|long|float|double|bool|size_t|FILE|struct\s+[A-Za-z_]\w*|enum\s+[A-Za-z_]\w*|[A-Z][A-Za-z0-9_]*|[A-Za-z_]\w*_t))\s+([A-Za-z_]\w*)\s*\(([\s\S]*?)\)\s*([;{])/g;

// 创建统一格式的诊断信息对象。
function createDiagnostic({
  line,
  column,
  endLine = line,
  endColumn = column + 1,
  message,
  suggestion,
  severity = "error",
  type = "syntax",
  source = "static"
}) {
  return {
    line,
    column,
    endLine,
    endColumn: Math.max(endColumn, column + 1),
    message,
    suggestion,
    severity,
    type,
    source
  };
}

// 统一源码换行格式。
function normalizeSource(source = "") {
  return String(source).replace(/\r\n?/g, "\n");
}

// 计算每一行在源码中的起始偏移量。
function getLineOffsets(source) {
  const offsets = [0];

  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") {
      offsets.push(index + 1);
    }
  }

  return offsets;
}

// 根据偏移量换算出行列位置。
function getPositionFromOffset(lineOffsets, offset) {
  let low = 0;
  let high = lineOffsets.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lineOffsets[mid] <= offset) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const lineIndex = Math.max(high, 0);

  return {
    line: lineIndex + 1,
    column: offset - lineOffsets[lineIndex] + 1
  };
}

// 按顶层分隔符拆分参数或表达式。
function splitTopLevel(text, delimiter = ",") {
  const parts = [];
  let buffer = "";
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;

  for (let index = 0; index < text.length; index += 1) {
    const current = text[index];

    if (current === "(") {
      parenDepth += 1;
    } else if (current === ")") {
      parenDepth = Math.max(parenDepth - 1, 0);
    } else if (current === "[") {
      bracketDepth += 1;
    } else if (current === "]") {
      bracketDepth = Math.max(bracketDepth - 1, 0);
    } else if (current === "{") {
      braceDepth += 1;
    } else if (current === "}") {
      braceDepth = Math.max(braceDepth - 1, 0);
    }

    if (
      current === delimiter &&
      parenDepth === 0 &&
      bracketDepth === 0 &&
      braceDepth === 0
    ) {
      if (buffer.trim()) {
        parts.push(buffer.trim());
      }
      buffer = "";
      continue;
    }

    buffer += current;
  }

  if (buffer.trim()) {
    parts.push(buffer.trim());
  }

  return parts;
}

// 计算函数声明中期望的参数数量范围。
function getExpectedArgumentCount(parameterText = "") {
  const normalized = String(parameterText).trim();
  if (!normalized || normalized === "void") {
    return {
      minArgs: 0,
      maxArgs: 0
    };
  }

  const parts = splitTopLevel(normalized, ",");
  const fixedArgs = parts.filter((part) => part && part !== "void" && !part.includes("...")).length;
  const isVariadic = parts.some((part) => part.includes("..."));

  return {
    minArgs: fixedArgs,
    maxArgs: isVariadic ? Number.POSITIVE_INFINITY : fixedArgs
  };
}

// 统计一次函数调用传入的实参数量。
function countCallArguments(argumentText = "") {
  const normalized = String(argumentText).trim();
  if (!normalized) {
    return 0;
  }

  let count = 1;
  let hasContent = false;
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;
  let mode = "code";

  for (let index = 0; index < argumentText.length; index += 1) {
    const current = argumentText[index];

    if (mode === "string") {
      hasContent = true;
      if (current === "\\") {
        index += 1;
        continue;
      }
      if (current === '"') {
        mode = "code";
      }
      continue;
    }

    if (mode === "char") {
      hasContent = true;
      if (current === "\\") {
        index += 1;
        continue;
      }
      if (current === "'") {
        mode = "code";
      }
      continue;
    }

    if (current === '"') {
      hasContent = true;
      mode = "string";
      continue;
    }

    if (current === "'") {
      hasContent = true;
      mode = "char";
      continue;
    }

    if (!/\s/.test(current)) {
      hasContent = true;
    }

    if (current === "(") {
      parenDepth += 1;
      continue;
    }

    if (current === ")") {
      parenDepth = Math.max(parenDepth - 1, 0);
      continue;
    }

    if (current === "[") {
      bracketDepth += 1;
      continue;
    }

    if (current === "]") {
      bracketDepth = Math.max(bracketDepth - 1, 0);
      continue;
    }

    if (current === "{") {
      braceDepth += 1;
      continue;
    }

    if (current === "}") {
      braceDepth = Math.max(braceDepth - 1, 0);
      continue;
    }

    if (
      current === "," &&
      parenDepth === 0 &&
      bracketDepth === 0 &&
      braceDepth === 0
    ) {
      count += 1;
    }
  }

  return hasContent ? count : 0;
}

// 查找成对分隔符的结束位置。
function findMatchingDelimiter(source, openIndex, openChar, closeChar) {
  let depth = 1;

  for (let index = openIndex + 1; index < source.length; index += 1) {
    const current = source[index];

    if (current === openChar) {
      depth += 1;
    } else if (current === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

// 屏蔽注释但保留字符串结构。
function maskCommentsPreserveStrings(source) {
  const chars = [];
  let mode = "code";

  for (let index = 0; index < source.length; index += 1) {
    const current = source[index];
    const next = source[index + 1];

    if (mode === "line-comment") {
      chars.push(current === "\n" ? "\n" : " ");
      if (current === "\n") {
        mode = "code";
      }
      continue;
    }

    if (mode === "block-comment") {
      if (current === "*" && next === "/") {
        chars.push(" ");
        chars.push(" ");
        index += 1;
        mode = "code";
      } else {
        chars.push(current === "\n" ? "\n" : " ");
      }
      continue;
    }

    if (mode === "string") {
      chars.push(current);
      if (current === "\\") {
        index += 1;
        if (index < source.length) {
          chars.push(source[index]);
        }
        continue;
      }
      if (current === '"') {
        mode = "code";
      }
      continue;
    }

    if (mode === "char") {
      chars.push(current);
      if (current === "\\") {
        index += 1;
        if (index < source.length) {
          chars.push(source[index]);
        }
        continue;
      }
      if (current === "'") {
        mode = "code";
      }
      continue;
    }

    if (current === "/" && next === "/") {
      chars.push(" ");
      chars.push(" ");
      index += 1;
      mode = "line-comment";
      continue;
    }

    if (current === "/" && next === "*") {
      chars.push(" ");
      chars.push(" ");
      index += 1;
      mode = "block-comment";
      continue;
    }

    if (current === '"') {
      chars.push(current);
      mode = "string";
      continue;
    }

    if (current === "'") {
      chars.push(current);
      mode = "char";
      continue;
    }

    chars.push(current);
  }

  return chars.join("");
}

// 扫描源码结构并检查括号与注释闭合情况。
function scanStructure(source) {
  const errors = [];
  const sanitizedChars = [];
  const delimiterStack = [];

  let line = 1;
  let column = 1;
  let mode = "code";
  let stringStart = null;
  let blockCommentStart = null;

  for (let index = 0; index < source.length; index += 1) {
    const current = source[index];
    const next = source[index + 1];

    if (mode === "line-comment") {
      sanitizedChars.push(current === "\n" ? "\n" : " ");
      if (current === "\n") {
        mode = "code";
      }
    } else if (mode === "block-comment") {
      if (current === "*" && next === "/") {
        sanitizedChars.push(" ");
        sanitizedChars.push(" ");
        index += 1;
        column += 1;
        mode = "code";
      } else {
        sanitizedChars.push(current === "\n" ? "\n" : " ");
      }
    } else if (mode === "string") {
      if (current === "\\") {
        sanitizedChars.push(" ");
        if (next !== undefined) {
          sanitizedChars.push(next === "\n" ? "\n" : " ");
          index += 1;
          if (next === "\n") {
            line += 1;
            column = 0;
          } else {
            column += 1;
          }
        }
      } else if (current === "\n") {
        errors.push(
          createDiagnostic({
            line: stringStart.line,
            column: stringStart.column,
            message: "字符串没有正确闭合。",
            suggestion: '请在行尾前补上结束引号 `"`。'
          })
        );
        sanitizedChars.push("\n");
        mode = "code";
      } else {
        sanitizedChars.push(" ");
        if (current === '"') {
          mode = "code";
        }
      }
    } else if (mode === "char") {
      if (current === "\\") {
        sanitizedChars.push(" ");
        if (next !== undefined) {
          sanitizedChars.push(next === "\n" ? "\n" : " ");
          index += 1;
          if (next === "\n") {
            line += 1;
            column = 0;
          } else {
            column += 1;
          }
        }
      } else if (current === "\n") {
        errors.push(
          createDiagnostic({
            line: stringStart.line,
            column: stringStart.column,
            message: "字符字面量没有正确闭合。",
            suggestion: "请在行尾前补上字符字面量的结束单引号。"
          })
        );
        sanitizedChars.push("\n");
        mode = "code";
      } else {
        sanitizedChars.push(" ");
        if (current === "'") {
          mode = "code";
        }
      }
    } else if (current === "/" && next === "/") {
      sanitizedChars.push(" ");
      sanitizedChars.push(" ");
      index += 1;
      column += 1;
      mode = "line-comment";
    } else if (current === "/" && next === "*") {
      sanitizedChars.push(" ");
      sanitizedChars.push(" ");
      blockCommentStart = { line, column };
      index += 1;
      column += 1;
      mode = "block-comment";
    } else if (current === '"') {
      sanitizedChars.push(" ");
      stringStart = { line, column };
      mode = "string";
    } else if (current === "'") {
      sanitizedChars.push(" ");
      stringStart = { line, column };
      mode = "char";
    } else {
      sanitizedChars.push(current);

      if (OPENERS.has(current)) {
        delimiterStack.push({ char: current, line, column });
      } else if (CLOSERS.has(current)) {
        const expectedOpen = CLOSERS.get(current);
        const top = delimiterStack.at(-1);

        if (!top || top.char !== expectedOpen) {
          errors.push(
            createDiagnostic({
              line,
              column,
              message: `这里出现了多余的 \`${current}\`。`,
              suggestion: "请检查这一处附近的括号或分隔符是否成对出现。"
            })
          );
        } else {
          delimiterStack.pop();
        }
      }
    }

    if (current === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  if (mode === "block-comment" && blockCommentStart) {
    errors.push(
      createDiagnostic({
        line: blockCommentStart.line,
        column: blockCommentStart.column,
        message: "块注释没有正确闭合。",
        suggestion: "请补上结束标记 `*/`。"
      })
    );
  }

  if (mode === "string" && stringStart) {
    errors.push(
      createDiagnostic({
        line: stringStart.line,
        column: stringStart.column,
        message: "字符串没有正确闭合。",
        suggestion: '请补上结束引号 `"`。'
      })
    );
  }

  if (mode === "char" && stringStart) {
    errors.push(
      createDiagnostic({
        line: stringStart.line,
        column: stringStart.column,
        message: "字符字面量没有正确闭合。",
        suggestion: "请补上结束单引号 `'`。"
      })
    );
  }

  delimiterStack.forEach((entry) => {
    errors.push(
      createDiagnostic({
        line: entry.line,
        column: entry.column,
        message: `\`${entry.char}\` 缺少对应的结束符 \`${OPENERS.get(entry.char)}\`。`,
        suggestion: "请检查这一段代码中的括号是否成对闭合。"
      })
    );
  });

  return {
    errors,
    sanitized: sanitizedChars.join("")
  };
}

// 查找下一行非空的有效代码。
function findNextMeaningfulLine(lines, startIndex) {
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return "";
}

// 判断当前行是否属于续行语句。
function looksLikeLineContinuation(trimmedLine) {
  return /(?:=|==|!=|<=|>=|\+|-|\*|\/|%|&&|\|\||,|\\)$/.test(trimmedLine);
}

// 判断当前行是否像一条应以分号结束的语句。
function looksLikeSemicolonStatement(trimmedLine) {
  if (/^(return|break|continue|goto)\b/.test(trimmedLine)) {
    return true;
  }

  if (TYPE_PREFIX_PATTERN.test(trimmedLine)) {
    return true;
  }

  if (/^[A-Za-z_]\w*\s*\(.*\)$/.test(trimmedLine)) {
    return true;
  }

  if (
    /^[A-Za-z_]\w*(?:\[[^\]]*\])?\s*(?:\+\+|--|=|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|<<=|>>=).*$/.test(
      trimmedLine
    )
  ) {
    return true;
  }

  return false;
}

// 检查头文件包含语句的写法。
function validateIncludeLines(sourceLines, sanitizedLines) {
  const errors = [];

  sanitizedLines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("#include")) {
      return;
    }

    if (/^#include\s+[<"][^>"]+[>"]$/.test(trimmed)) {
      return;
    }

    const sourceLine = sourceLines[index] ?? "";
    errors.push(
      createDiagnostic({
        line: index + 1,
        column: Math.max(sourceLine.indexOf("#include") + 1, 1),
        endColumn: Math.max(sourceLine.length + 1, 2),
        message: "#include 语法不正确。",
        suggestion: '请使用 `#include <stdio.h>` 或 `#include "header.h"` 这种写法。'
      })
    );
  });

  return errors;
}

// 检查语句末尾缺失分号的问题。
function validateMissingSemicolons(sourceLines, sanitizedLines) {
  const errors = [];

  sanitizedLines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    if (
      trimmed.startsWith("#") ||
      trimmed === "{" ||
      trimmed === "}" ||
      trimmed.endsWith("{") ||
      trimmed.endsWith("}") ||
      trimmed.endsWith(";") ||
      trimmed.endsWith(":") ||
      trimmed.endsWith(",") ||
      trimmed === "else" ||
      trimmed === "do"
    ) {
      return;
    }

    if (/^(if|for|while|switch)\b/.test(trimmed)) {
      return;
    }

    if (looksLikeLineContinuation(trimmed)) {
      return;
    }

    const nextMeaningfulLine = findNextMeaningfulLine(sanitizedLines, index);
    if (trimmed.endsWith(")") && nextMeaningfulLine.startsWith("{") && TYPE_PREFIX_PATTERN.test(trimmed)) {
      return;
    }

    if (!looksLikeSemicolonStatement(trimmed)) {
      return;
    }

    const sourceLine = sourceLines[index] ?? "";
    errors.push(
      createDiagnostic({
        line: index + 1,
        column: Math.max(sourceLine.trimEnd().length, 1),
        endColumn: Math.max(sourceLine.length + 1, 2),
        message: "语句末尾缺少分号。",
        suggestion: "请在这条语句末尾补上 `;`。"
      })
    );
  });

  return errors;
}

// 收集源码中的函数声明和定义符号。
function collectFunctionSymbols(sanitizedSource, lineOffsets) {
  const definitions = [];
  const prototypes = [];
  const declarationOffsets = new Set();

  let match;
  while ((match = FUNCTION_SIGNATURE_PATTERN.exec(sanitizedSource))) {
    const terminator = match[5];
    const name = match[3];
    const fullText = match[0];
    const nameOffset = match.index + fullText.lastIndexOf(name);
    const position = getPositionFromOffset(lineOffsets, nameOffset);
    const argInfo = getExpectedArgumentCount(match[4]);
    const entry = {
      name,
      line: position.line,
      column: position.column,
      offset: nameOffset,
      minArgs: argInfo.minArgs,
      maxArgs: argInfo.maxArgs
    };

    declarationOffsets.add(nameOffset);

    if (terminator === "{") {
      definitions.push(entry);
    } else {
      prototypes.push(entry);
    }
  }

  return {
    definitions,
    prototypes,
    declarationOffsets
  };
}

// 收集源码中的宏定义符号。
function collectMacros(sanitizedSource, lineOffsets) {
  const macros = [];
  const macroPattern = /^\s*#define\s+([A-Za-z_]\w*)/gm;

  let match;
  while ((match = macroPattern.exec(sanitizedSource))) {
    const name = match[1];
    const nameOffset = match.index + match[0].lastIndexOf(name);
    const position = getPositionFromOffset(lineOffsets, nameOffset);
    macros.push({
      name,
      line: position.line,
      column: position.column
    });
  }

  return macros;
}

// 收集 typedef 和结构体等类型别名。
function collectTypeAliases(sanitizedSource) {
  const types = new Set(TYPE_NAMES);
  const typedefPattern = /^\s*typedef\s+.+?\s+([A-Za-z_]\w*)\s*;/gm;
  const structPattern = /^\s*(?:struct|enum|union)\s+([A-Za-z_]\w*)\s*\{/gm;

  let match;
  while ((match = typedefPattern.exec(sanitizedSource))) {
    types.add(match[1]);
  }

  while ((match = structPattern.exec(sanitizedSource))) {
    types.add(match[1]);
  }

  return types;
}

// 检查重复的函数定义。
function validateDuplicateDefinitions(definitions) {
  const errors = [];
  const seen = new Map();

  definitions.forEach((entry) => {
    const first = seen.get(entry.name);
    if (!first) {
      seen.set(entry.name, entry);
      return;
    }

    errors.push(
      createDiagnostic({
        line: entry.line,
        column: entry.column,
        endColumn: entry.column + entry.name.length,
        message: `函数 \`${entry.name}\` 被重复定义了。`,
        suggestion: "请只保留一个定义，或将其中一个函数改名。"
      })
    );
  });

  return errors;
}

// 检查重复的宏定义。
function validateDuplicateMacros(macros) {
  const errors = [];
  const seen = new Map();

  macros.forEach((entry) => {
    const first = seen.get(entry.name);
    if (!first) {
      seen.set(entry.name, entry);
      return;
    }

    errors.push(
      createDiagnostic({
        line: entry.line,
        column: entry.column,
        endColumn: entry.column + entry.name.length,
        message: `宏 \`${entry.name}\` 被重复定义了。`,
        suggestion: "请删除重复的宏，或将其中一个改名。",
        severity: "warning"
      })
    );
  });

  return errors;
}

// 检查函数调用的参数个数是否匹配。
function validateFunctionArgumentCounts({
  sanitizedSource,
  sourceWithStrings,
  lineOffsets,
  definitions,
  prototypes,
  declarationOffsets,
  macros,
  knownTypes
}) {
  const knownMacros = new Set(macros.map((item) => item.name));
  const knownFunctions = new Map(BUILTIN_FUNCTION_SIGNATURES);
  const errors = [];
  const callPattern = /\b([A-Za-z_]\w*)\s*\(/g;

  [...definitions, ...prototypes].forEach((item) => {
    if (!knownFunctions.has(item.name)) {
      knownFunctions.set(item.name, {
        minArgs: item.minArgs,
        maxArgs: item.maxArgs
      });
    }
  });

  let match;
  while ((match = callPattern.exec(sanitizedSource))) {
    const name = match[1];
    const callOffset = match.index;
    const previousChar = sanitizedSource[callOffset - 1] ?? "";
    const signature = knownFunctions.get(name);

    if (
      !signature ||
      FUNCTION_LIKE_KEYWORDS.has(name) ||
      knownMacros.has(name) ||
      knownTypes.has(name) ||
      declarationOffsets.has(callOffset) ||
      previousChar === "#" ||
      previousChar === "."
    ) {
      continue;
    }

    const openParenIndex = callOffset + match[0].lastIndexOf("(");
    const closeParenIndex = findMatchingDelimiter(sanitizedSource, openParenIndex, "(", ")");
    if (closeParenIndex < 0) {
      continue;
    }

    const argCount = countCallArguments(
      sourceWithStrings.slice(openParenIndex + 1, closeParenIndex)
    );
    const { minArgs, maxArgs } = signature;
    const hasTooFewArgs = argCount < minArgs;
    const hasTooManyArgs = Number.isFinite(maxArgs) && argCount > maxArgs;

    if (!hasTooFewArgs && !hasTooManyArgs) {
      continue;
    }

    const position = getPositionFromOffset(lineOffsets, callOffset);
    const expectedText =
      maxArgs === Number.POSITIVE_INFINITY
        ? `至少 ${minArgs} 个`
        : minArgs === maxArgs
          ? `${minArgs} 个`
          : `${minArgs} 到 ${maxArgs} 个`;

    errors.push(
      createDiagnostic({
        line: position.line,
        column: position.column,
        endColumn: position.column + name.length,
        message: `函数 \`${name}\` 需要 ${expectedText}参数，当前传入了 ${argCount} 个。`,
        suggestion: "请根据函数声明补齐或删除参数。",
        type: "semantic"
      })
    );
  }

  return errors;
}

// 检查机器人传感器名称是否有效。
function validateRobotSensorNames(source, lineOffsets) {
  const maskedSource = maskCommentsPreserveStrings(source);
  const errors = [];
  const pattern = /\brobot_read_sensor\s*\(\s*"([^"]*)"\s*\)/g;

  let match;
  while ((match = pattern.exec(maskedSource))) {
    const sensorName = match[1];
    if (ROBOT_SENSOR_NAMES.has(sensorName)) {
      continue;
    }

    const literalOffset = match.index + match[0].indexOf(`"${sensorName}"`) + 1;
    const position = getPositionFromOffset(lineOffsets, literalOffset);
    errors.push(
      createDiagnostic({
        line: position.line,
        column: position.column,
        endColumn: position.column + sensorName.length,
        message: `不支持的传感器名称 \`${sensorName}\`。`,
        suggestion: '请改为 `"DISTANCE"`、`"TEMPERATURE"`、`"LIGHT"`、`"BATTERY"`、`"ULTRASONIC"`、`"INFRARED"`、`"IMU_GYRO_Z"`、`"IMU_ACCEL_X"`、`"IMU_ACCEL_Y"`、`"IMU_ROLL"` 或 `"IMU_PITCH"`。',
        severity: "warning",
        type: "semantic"
      })
    );
  }

  return errors;
}

// 检查未声明的函数调用。
function validateUnknownFunctionCalls({
  sanitizedSource,
  lineOffsets,
  definitions,
  prototypes,
  declarationOffsets,
  macros,
  knownTypes
}) {
  const knownFunctions = new Set(BUILTIN_FUNCTIONS);
  const knownMacros = new Set(macros.map((item) => item.name));
  const errors = [];
  const callPattern = /\b([A-Za-z_]\w*)\s*\(/g;

  definitions.forEach((item) => knownFunctions.add(item.name));
  prototypes.forEach((item) => knownFunctions.add(item.name));

  let match;
  while ((match = callPattern.exec(sanitizedSource))) {
    const name = match[1];
    const callOffset = match.index;
    const nameOffset = callOffset;

    if (
      FUNCTION_LIKE_KEYWORDS.has(name) ||
      knownFunctions.has(name) ||
      knownMacros.has(name) ||
      knownTypes.has(name) ||
      declarationOffsets.has(nameOffset)
    ) {
      continue;
    }

    const previousChar = sanitizedSource[callOffset - 1] ?? "";
    if (previousChar === "#" || previousChar === ".") {
      continue;
    }

    const position = getPositionFromOffset(lineOffsets, callOffset);
    errors.push(
      createDiagnostic({
        line: position.line,
        column: position.column,
        endColumn: position.column + name.length,
        message: `函数 \`${name}\` 没有声明。`,
        suggestion: "请检查函数名是否写对，或先补上函数声明。",
        severity: "warning",
        type: "semantic"
      })
    );
  }

  return errors;
}

// 对重复的诊断结果进行去重。
function dedupeDiagnostics(errors) {
  const result = new Map();

  errors.forEach((error) => {
    const key = [
      error.line,
      error.column,
      error.endLine,
      error.endColumn,
      error.message,
      error.source,
      error.type
    ].join(":");

    if (!result.has(key)) {
      result.set(key, error);
    }
  });

  return [...result.values()];
}

// 对整段 C 源码执行静态诊断。
export function validateCSource(source = "") {
  const normalizedSource = normalizeSource(source);
  if (!normalizedSource.trim()) {
    return [];
  }

  const lineOffsets = getLineOffsets(normalizedSource);
  const sourceLines = normalizedSource.split("\n");
  const structural = scanStructure(normalizedSource);
  const sourceWithStrings = maskCommentsPreserveStrings(normalizedSource);
  const sanitizedLines = structural.sanitized.split("\n");
  const functionSymbols = collectFunctionSymbols(structural.sanitized, lineOffsets);
  const macros = collectMacros(structural.sanitized, lineOffsets);
  const knownTypes = collectTypeAliases(structural.sanitized);

  return dedupeDiagnostics([
    ...structural.errors,
    ...validateIncludeLines(sourceLines, sanitizedLines),
    ...validateMissingSemicolons(sourceLines, sanitizedLines),
    ...validateDuplicateDefinitions(functionSymbols.definitions),
    ...validateDuplicateMacros(macros),
    ...validateFunctionArgumentCounts({
      sanitizedSource: structural.sanitized,
      sourceWithStrings,
      lineOffsets,
      definitions: functionSymbols.definitions,
      prototypes: functionSymbols.prototypes,
      declarationOffsets: functionSymbols.declarationOffsets,
      macros,
      knownTypes
    }),
    ...validateRobotSensorNames(normalizedSource, lineOffsets),
    ...validateUnknownFunctionCalls({
      sanitizedSource: structural.sanitized,
      lineOffsets,
      definitions: functionSymbols.definitions,
      prototypes: functionSymbols.prototypes,
      declarationOffsets: functionSymbols.declarationOffsets,
      macros,
      knownTypes
    })
  ])
    .sort((left, right) => {
      if (left.line !== right.line) {
        return left.line - right.line;
      }

      if (left.column !== right.column) {
        return left.column - right.column;
      }

      if (left.severity !== right.severity) {
        return left.severity === "error" ? -1 : 1;
      }

      return left.message.localeCompare(right.message);
    })
    .slice(0, 80);
}
