const ROBOT_FUNCTIONS = [
  {
    label: "robot_reset",
    signature: "void robot_reset(void);",
    insertText: "robot_reset();",
    detail: "重置机器人的位置和运动状态。",
    documentation: [
      "重置机器人的坐标、朝向和当前运动状态。"
    ].join("\n"),
    parameters: []
  },
  {
    label: "robot_move_forward",
    signature: "void robot_move_forward(int distance, int speed);",
    insertText: "robot_move_forward(${1:distance}, ${2:speed});",
    detail: "按指定距离和速度让机器人前进。",
    documentation: [
      "让机器人向前移动。",
      "",
      "- `distance`：移动距离",
      "- `speed`：移动速度"
    ].join("\n"),
    parameters: [
      { label: "distance", documentation: "移动距离" },
      { label: "speed", documentation: "移动速度。" }
    ]
  },
  {
    label: "robot_move_backward",
    signature: "void robot_move_backward(int distance, int speed);",
    insertText: "robot_move_backward(${1:distance}, ${2:speed});",
    detail: "按指定距离和速度让机器人后退。",
    documentation: [
      "让机器人向后移动。",
      "",
      "- `distance`：移动距离，单位 cm",
      "- `speed`：移动速度"
    ].join("\n"),
    parameters: [
      { label: "distance", documentation: "移动距离，单位 cm。" },
      { label: "speed", documentation: "移动速度。" }
    ]
  },
  {
    label: "robot_turn_left",
    signature: "void robot_turn_left(int angle, int speed);",
    insertText: "robot_turn_left(${1:angle}, ${2:speed});",
    detail: "按指定角度和速度让机器人左转。",
    documentation: [
      "让机器人向左转动。",
      "",
      "- `angle`：转动角度，单位度",
      "- `speed`：转动速度"
    ].join("\n"),
    parameters: [
      { label: "angle", documentation: "转动角度，单位度。" },
      { label: "speed", documentation: "转动速度。" }
    ]
  },
  {
    label: "robot_turn_right",
    signature: "void robot_turn_right(int angle, int speed);",
    insertText: "robot_turn_right(${1:angle}, ${2:speed});",
    detail: "按指定角度和速度让机器人右转。",
    documentation: [
      "让机器人向右转动。",
      "",
      "- `angle`：转动角度，单位度",
      "- `speed`：转动速度"
    ].join("\n"),
    parameters: [
      { label: "angle", documentation: "转动角度，单位度。" },
      { label: "speed", documentation: "转动速度。" }
    ]
  },
  {
    label: "robot_wait",
    signature: "void robot_wait(double seconds);",
    insertText: "robot_wait(${1:0.5});",
    detail: "让机器人脚本暂停指定秒数。",
    documentation: [
      "暂停脚本执行一段时间。",
      "",
      "- `seconds`：等待时长，单位秒"
    ].join("\n"),
    parameters: [{ label: "seconds", documentation: "等待时长，单位秒。" }]
  },
  {
    label: "robot_stop",
    signature: "void robot_stop(void);",
    insertText: "robot_stop();",
    detail: "停止机器人当前动作。",
    documentation: "立即停止机器人当前动作。",
    parameters: []
  },
  {
    label: "robot_read_distance",
    signature: "int robot_read_distance(void);",
    insertText: "robot_read_distance()",
    detail: "读取距离传感器的值。",
    documentation:
      "读取机器人前方最近障碍物的距离。当前方无遮挡时返回 -1。",
    parameters: []
  },
  {
    label: "robot_read_temperature",
    signature: "double robot_read_temperature(void);",
    insertText: "robot_read_temperature()",
    detail: "读取温度传感器的值。",
    documentation: "读取当前温度传感器的数值。",
    parameters: []
  },
  {
    label: "robot_read_light",
    signature: "int robot_read_light(void);",
    insertText: "robot_read_light()",
    detail: "读取光照传感器的值。",
    documentation: "读取当前光照传感器的数值。",
    parameters: []
  },
  {
    label: "robot_read_battery",
    signature: "int robot_read_battery(void);",
    insertText: "robot_read_battery()",
    detail: "读取电量百分比。",
    documentation: "读取当前电池电量百分比。",
    parameters: []
  },
  {
    label: "robot_read_sensor",
    signature: "double robot_read_sensor(char *name);",
    insertText: 'robot_read_sensor("${1:DISTANCE}")',
    detail: "按名称读取传感器。",
    documentation: [
      "按名称读取传感器值。",
      "",
      "支持的名称：",
      '- `"DISTANCE"`：距离',
      '- `"TEMPERATURE"`：温度',
      '- `"LIGHT"`：光照',
      '- `"BATTERY"`：电量',
      "",
      '当名称为 `"DISTANCE"` 时，如果未检测到障碍物会返回 `-1`。'
    ].join("\n"),
    parameters: [{ label: "name", documentation: '传感器名称，例如 `"DISTANCE"`。' }]
  },
  {
    label: "robot_say",
    signature: "void robot_say(char *message);",
    insertText: 'robot_say("${1:hello}");',
    detail: "向调试输出面板写入一条消息。",
    documentation: "向调试输出面板输出一条文本消息。",
    parameters: [{ label: "message", documentation: "要输出的消息文本。" }]
  },
  {
    label: "printf",
    signature: "int printf(char *format, ...);",
    insertText: 'printf("${1:value=%d\\\\n}", ${2:value});',
    detail: "向输出面板打印格式化文本。",
    documentation: "格式化输出文本，内容会显示在 PicoC 调试日志面板中。",
    parameters: [
      { label: "format", documentation: "格式化字符串。" },
      { label: "...", documentation: "额外的格式化参数。" }
    ]
  }
];

const C_SNIPPETS = [
  {
    label: "main",
    kind: "snippet",
    detail: "插入 `main` 函数模板。",
    documentation: "插入一个基础的 `main` 函数模板。",
    insertText: [
      "int main() {",
      "\t${1:// code}",
      "\treturn 0;",
      "}"
    ].join("\n")
  },
  {
    label: "for",
    kind: "snippet",
    detail: "插入 `for` 循环模板。",
    documentation: "插入一个常用的 `for` 循环模板。",
    insertText: [
      "for (int ${1:i} = 0; ${1:i} < ${2:count}; ${1:i}++) {",
      "\t${3:// code}",
      "}"
    ].join("\n")
  },
  {
    label: "if",
    kind: "snippet",
    detail: "插入 `if` 条件块模板。",
    documentation: "插入一个基础的 `if` 条件块模板。",
    insertText: [
      "if (${1:condition}) {",
      "\t${2:// code}",
      "}"
    ].join("\n")
  },
  {
    label: "while",
    kind: "snippet",
    detail: "插入 `while` 循环模板。",
    documentation: "插入一个基础的 `while` 循环模板。",
    insertText: [
      "while (${1:condition}) {",
      "\t${2:// code}",
      "}"
    ].join("\n")
  },
  {
    label: "include_stdio",
    kind: "snippet",
    detail: "插入 `stdio` 头文件。",
    documentation: "插入 `#include <stdio.h>`。",
    insertText: "#include <stdio.h>"
  }
];

const C_KEYWORDS = [
  {
    label: "int",
    kind: "keyword",
    detail: "C 关键字",
    documentation: "声明整型变量，或作为函数返回类型使用。",
    insertText: "int "
  },
  {
    label: "double",
    kind: "keyword",
    detail: "C 关键字",
    documentation: "声明双精度浮点数变量。",
    insertText: "double "
  },
  {
    label: "char",
    kind: "keyword",
    detail: "C 关键字",
    documentation: "声明字符变量。",
    insertText: "char "
  },
  {
    label: "return",
    kind: "keyword",
    detail: "C 关键字",
    documentation: "从当前函数返回。",
    insertText: "return "
  },
  {
    label: "if",
    kind: "keyword",
    detail: "C 关键字",
    documentation: "条件分支语句。",
    insertText: "if "
  },
  {
    label: "else",
    kind: "keyword",
    detail: "C 关键字",
    documentation: "`if` 语句的备选分支。",
    insertText: "else "
  },
  {
    label: "for",
    kind: "keyword",
    detail: "C 关键字",
    documentation: "包含初始化、条件和迭代部分的循环语句。",
    insertText: "for "
  },
  {
    label: "while",
    kind: "keyword",
    detail: "C 关键字",
    documentation: "当条件成立时持续执行的循环语句。",
    insertText: "while "
  },
  {
    label: "#include",
    kind: "keyword",
    detail: "预处理指令",
    documentation: "包含一个头文件。",
    insertText: "#include "
  }
];

const HEADER_SUGGESTIONS = [
  {
    label: "stdio.h",
    detail: "标准输入输出头文件",
    documentation: "包含标准输入输出相关声明。"
  },
  {
    label: "stdlib.h",
    detail: "标准工具头文件",
    documentation: "包含标准工具函数相关声明。"
  },
  {
    label: "string.h",
    detail: "字符串处理头文件",
    documentation: "包含字符串处理相关声明。"
  },
  {
    label: "math.h",
    detail: "数学运算头文件",
    documentation: "包含数学运算相关声明。"
  },
  {
    label: "stdbool.h",
    detail: "布尔类型支持头文件",
    documentation: "包含 `bool` 等布尔类型支持声明。"
  }
];

const SENSOR_NAME_SUGGESTIONS = [
  '"DISTANCE"',
  '"TEMPERATURE"',
  '"LIGHT"',
  '"BATTERY"',
  '"ULTRASONIC"',
  '"ULTRASONIC_DISTANCE"',
  '"INFRARED"',
  '"INFRARED_ANALOG"',
  '"INFRARED_DIGITAL"',
  '"IMU_GYRO_Z"',
  '"IMU_ACCEL_X"',
  '"IMU_ACCEL_Y"',
  '"IMU_ROLL"',
  '"IMU_PITCH"',
  '"ULTRASONIC_01"',
  '"INFRARED_01"',
  '"IMU_01"'
];

const CONTROL_FLOW_KEYWORDS = new Set([
  "if",
  "for",
  "while",
  "switch",
  "case",
  "return",
  "break",
  "continue",
  "else",
  "do",
  "goto",
  "sizeof"
]);

const ANALYSIS_EMPTY = {
  functions: [],
  globals: [],
  macros: [],
  types: []
};

let languageFeaturesRegistered = false;
let analysisCache = {
  source: null,
  value: ANALYSIS_EMPTY
};

// 规范化字符串中的多余空白。
function normalizeWhitespace(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

// 把建议项类型转换为中文标签。
function kindLabelFromKind(kind) {
  switch (kind) {
    case "function":
      return "函数";
    case "snippet":
      return "片段";
    case "keyword":
      return "关键字";
    case "constant":
      return "常量";
    case "variable":
      return "变量";
    case "parameter":
      return "参数";
    case "macro":
      return "宏";
    case "header":
      return "头文件";
    case "type":
      return "类型";
    default:
      return "符号";
  }
}

// 根据建议类型生成来源说明。
function originFromKind(kind) {
  switch (kind) {
    case "function":
      return "机器人 API";
    case "snippet":
      return "代码模板";
    case "keyword":
      return "C 语言";
    case "constant":
      return "运行时常量";
    case "variable":
    case "parameter":
      return "当前文件";
    case "macro":
      return "预处理器";
    case "header":
      return "头文件包含";
    case "type":
      return "当前文件";
    default:
      return "当前文件";
  }
}

// 为不同建议类型分配排序分组。
function sortGroupFromKind(kind) {
  switch (kind) {
    case "header":
    case "constant":
      return 0;
    case "parameter":
      return 10;
    case "variable":
      return 12;
    case "function":
      return 20;
    case "type":
      return 24;
    case "macro":
      return 28;
    case "snippet":
      return 70;
    case "keyword":
      return 80;
    default:
      return 50;
  }
}

// 把片段语法转换为可插入文本与光标计划。
function snippetToInsertPlan(snippet) {
  let text = "";
  let cursorOffset = null;

  for (let index = 0; index < snippet.length; index += 1) {
    const current = snippet[index];

    if (current === "$" && snippet[index + 1] === "{") {
      const endIndex = snippet.indexOf("}", index + 2);
      if (endIndex < 0) {
        text += current;
        continue;
      }

      const placeholder = snippet.slice(index + 2, endIndex);
      const colonIndex = placeholder.indexOf(":");
      const replacement = colonIndex >= 0 ? placeholder.slice(colonIndex + 1) : "";

      if (cursorOffset === null) {
        cursorOffset = text.length;
      }

      text += replacement;
      index = endIndex;
      continue;
    }

    if (current === "$" && /\d/.test(snippet[index + 1] ?? "")) {
      if (cursorOffset === null) {
        cursorOffset = text.length;
      }

      while (/\d/.test(snippet[index + 1] ?? "")) {
        index += 1;
      }
      continue;
    }

    text += current;
  }

  return {
    text,
    cursorOffset: cursorOffset ?? text.length
  };
}

// 把目录项转换为统一的建议对象。
function createCatalogSuggestion(item, fallbackKind) {
  const kind = item.kind ?? fallbackKind;
  const insertPlan = snippetToInsertPlan(item.insertText ?? item.label);

  return {
    id: `${kind}-${item.label}`,
    label: item.label,
    kind,
    kindLabel: kindLabelFromKind(kind),
    detail: item.detail ?? item.signature ?? "",
    signature: item.signature ?? "",
    documentation: item.documentation ?? "",
    origin: item.origin ?? originFromKind(kind),
    insertTextValue: insertPlan.text,
    cursorOffset: insertPlan.cursorOffset,
    sortGroup: item.sortGroup ?? sortGroupFromKind(kind),
    lineNumber: item.lineNumber ?? null,
    filterText: item.filterText ?? item.label
  };
}

// 计算模糊子序列匹配分数。
function fuzzySubsequenceScore(label, prefix) {
  if (!prefix) {
    return 0;
  }

  const normalizedLabel = label.toLowerCase();
  const normalizedPrefix = prefix.toLowerCase();
  let cursor = 0;
  let score = 0;

  for (const char of normalizedPrefix) {
    const matchIndex = normalizedLabel.indexOf(char, cursor);
    if (matchIndex < 0) {
      return Number.POSITIVE_INFINITY;
    }

    score += matchIndex - cursor;
    cursor = matchIndex + 1;
  }

  return 90 + score + Math.max(normalizedLabel.length - normalizedPrefix.length, 0);
}

// 计算补全项与输入前缀的匹配分数。
function scoreSuggestion(label, prefix) {
  if (!prefix) {
    return 0;
  }

  const normalizedLabel = label.toLowerCase();
  const normalizedPrefix = prefix.toLowerCase();

  if (normalizedLabel === normalizedPrefix) {
    return 0;
  }

  if (normalizedLabel.startsWith(normalizedPrefix)) {
    return 10 + Math.max(normalizedLabel.length - normalizedPrefix.length, 0);
  }

  const tokenIndex = normalizedLabel
    .split(/[_\s]+/)
    .findIndex((token) => token.startsWith(normalizedPrefix));
  if (tokenIndex >= 0) {
    return 20 + tokenIndex;
  }

  const boundaryIndex = normalizedLabel.indexOf(`_${normalizedPrefix}`);
  if (boundaryIndex >= 0) {
    return 30 + boundaryIndex;
  }

  const substringIndex = normalizedLabel.indexOf(normalizedPrefix);
  if (substringIndex >= 0) {
    return 50 + substringIndex;
  }

  return fuzzySubsequenceScore(normalizedLabel, normalizedPrefix);
}

// 读取传感器名称补全的当前前缀。
function getSensorPrefix(linePrefix) {
  const match = linePrefix.match(/robot_read_sensor\s*\(\s*"([^"]*)$/);
  return match ? match[1] : null;
}

// 读取头文件补全的当前前缀。
function getIncludePrefix(linePrefix) {
  const match = linePrefix.match(/#include\s*([<"])([^>"]*)$/);
  if (!match) {
    return null;
  }

  return {
    opener: match[1],
    prefix: match[2]
  };
}

// 构建传感器名称补全列表。
function buildSensorSuggestions(linePrefix, lineSuffix) {
  const sensorPrefix = getSensorPrefix(linePrefix);
  if (sensorPrefix === null) {
    return [];
  }

  const needsClosingQuote = !lineSuffix.startsWith('"');

  return SENSOR_NAME_SUGGESTIONS.filter((item) =>
    item.toLowerCase().includes(sensorPrefix.toLowerCase())
  ).map((item) => {
    const sensorName = item.slice(1, -1);
    const insertTextValue = needsClosingQuote ? `${sensorName}"` : sensorName;

    return {
      id: `sensor-${sensorName}`,
      label: item,
      kind: "constant",
      kindLabel: "传感器",
      detail: "传感器名称",
      signature: "",
      documentation: `将 ${item} 作为传感器名称使用。`,
      origin: "机器人传感器",
      insertTextValue,
      cursorOffset: insertTextValue.length,
      sortGroup: 0,
      lineNumber: null,
      filterText: sensorName
    };
  });
}

// 构建头文件名称补全列表。
function buildHeaderSuggestions(linePrefix, lineSuffix) {
  const includePrefix = getIncludePrefix(linePrefix);
  if (!includePrefix) {
    return [];
  }

  const needsCloser = !lineSuffix.startsWith(includePrefix.opener === "<" ? ">" : '"');
  const closer = includePrefix.opener === "<" ? ">" : '"';

  return HEADER_SUGGESTIONS.filter((item) =>
    item.label.toLowerCase().includes(includePrefix.prefix.toLowerCase())
  ).map((item) => {
    const insertTextValue = needsCloser ? `${item.label}${closer}` : item.label;

    return {
      id: `header-${item.label}`,
      label: item.label,
      kind: "header",
      kindLabel: "头文件",
      detail: item.detail,
      signature: "",
      documentation: item.documentation,
      origin: "C 标准库",
      insertTextValue,
      cursorOffset: insertTextValue.length,
      sortGroup: 0,
      lineNumber: null,
      filterText: item.label
    };
  });
}

// 屏蔽源码中的注释和字符串内容。
function sanitizeSource(source = "") {
  let result = "";
  let index = 0;
  let inBlockComment = false;
  let inString = false;
  let inChar = false;

  while (index < source.length) {
    const current = source[index];
    const next = source[index + 1];

    if (inBlockComment) {
      if (current === "*" && next === "/") {
        result += "  ";
        index += 2;
        inBlockComment = false;
        continue;
      }

      result += current === "\n" ? "\n" : " ";
      index += 1;
      continue;
    }

    if (inString) {
      if (current === "\\") {
        result += " ";
        index += 1;
        if (index < source.length) {
          result += source[index] === "\n" ? "\n" : " ";
          index += 1;
        }
        continue;
      }

      result += current === "\n" ? "\n" : " ";
      if (current === '"') {
        inString = false;
      }
      index += 1;
      continue;
    }

    if (inChar) {
      if (current === "\\") {
        result += " ";
        index += 1;
        if (index < source.length) {
          result += source[index] === "\n" ? "\n" : " ";
          index += 1;
        }
        continue;
      }

      result += current === "\n" ? "\n" : " ";
      if (current === "'") {
        inChar = false;
      }
      index += 1;
      continue;
    }

    if (current === "/" && next === "/") {
      result += "  ";
      index += 2;
      while (index < source.length && source[index] !== "\n") {
        result += " ";
        index += 1;
      }
      continue;
    }

    if (current === "/" && next === "*") {
      result += "  ";
      index += 2;
      inBlockComment = true;
      continue;
    }

    if (current === '"') {
      inString = true;
      result += " ";
      index += 1;
      continue;
    }

    if (current === "'") {
      inChar = true;
      result += " ";
      index += 1;
      continue;
    }

    result += current;
    index += 1;
  }

  return result;
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

// 根据偏移量换算出行号。
function getLineNumberFromOffset(lineOffsets, offset) {
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

  return high + 1;
}

// 查找与左花括号匹配的右花括号。
function findMatchingBrace(source, openIndex) {
  let depth = 1;

  for (let index = openIndex + 1; index < source.length; index += 1) {
    const current = source[index];

    if (current === "{") {
      depth += 1;
    } else if (current === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

// 按顶层分隔符拆分文本。
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

// 组合基础类型与指针标记。
function buildTypeLabel(baseType, pointerMarks = "") {
  const cleanedBase = normalizeWhitespace(baseType);
  const cleanedPointer = pointerMarks.replace(/\s+/g, "");
  return normalizeWhitespace(`${cleanedBase}${cleanedPointer ? ` ${cleanedPointer}` : ""}`);
}

// 解析一组声明符并提取变量信息。
function parseDeclaratorList({
  declaratorsText,
  typeLabel,
  lineNumber,
  scope,
  ownerName,
  insertAs = "variable"
}) {
  const items = [];

  splitTopLevel(declaratorsText, ",").forEach((chunk) => {
    let declarator = normalizeWhitespace(chunk);
    if (!declarator || declarator.includes("(")) {
      return;
    }

    declarator = declarator.replace(/\s*=\s*[\s\S]*$/, "").trim();
    declarator = declarator.replace(/\[[^\]]*\]/g, "").trim();

    const nameMatch = declarator.match(/([A-Za-z_]\w*)\s*$/);
    if (!nameMatch) {
      return;
    }

    const name = nameMatch[1];
    const pointerMarks = declarator.slice(0, nameMatch.index).replace(/[^*]/g, "");
    const resolvedType = buildTypeLabel(typeLabel, pointerMarks);

    items.push({
      id: `${scope}-${ownerName ?? "file"}-${name}-${lineNumber}`,
      name,
      label: name,
      kind: insertAs,
      kindLabel: kindLabelFromKind(insertAs),
      detail: resolvedType || "值",
      signature: `${resolvedType || "值"} ${name}`.trim(),
      documentation:
        scope === "parameter"
          ? `${ownerName}() 中的参数。`
          : scope === "local"
            ? `${ownerName}() 中的局部变量。`
            : "当前文件中声明的全局符号。",
      origin: "当前文件",
      insertTextValue: name,
      cursorOffset: name.length,
      sortGroup: sortGroupFromKind(insertAs),
      lineNumber,
      scope,
      ownerName,
      filterText: name
    });
  });

  return items;
}

// 解析单条声明语句中的变量信息。
function parseDeclarationText({
  text,
  lineNumber,
  scope,
  ownerName,
  insertAs = "variable"
}) {
  const statement = normalizeWhitespace(text);
  if (!statement) {
    return [];
  }

  if (/^(if|for|while|switch|return|break|continue|else|do|goto|case)\b/.test(statement)) {
    return [];
  }

  const declarationMatch = statement.match(
    /^((?:(?:static|const|unsigned|signed|long|short|volatile|register|extern|auto)\s+)*(?:void|char|short|int|long|float|double|bool|size_t|FILE|struct\s+[A-Za-z_]\w*|enum\s+[A-Za-z_]\w*|[A-Z][A-Za-z0-9_]*|[A-Za-z_]\w*_t))\s+(.+)$/
  );

  if (!declarationMatch) {
    return [];
  }

  const baseType = normalizeWhitespace(declarationMatch[1]);
  const declaratorsText = declarationMatch[2].trim();

  return parseDeclaratorList({
    declaratorsText,
    typeLabel: baseType,
    lineNumber,
    scope,
    ownerName,
    insertAs
  });
}

// 从源码片段中提取变量声明。
function extractVariablesFromText(text, startLineNumber, scope, ownerName, insertAs) {
  const items = [];
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    const lineNumber = startLineNumber + index;
    const fragments = line.split(/[{}]/);

    fragments.forEach((fragment) => {
      const clauses = splitTopLevel(fragment, ";");
      clauses.forEach((clause) => {
        items.push(
          ...parseDeclarationText({
            text: clause.endsWith(";") ? clause.slice(0, -1) : clause,
            lineNumber,
            scope,
            ownerName,
            insertAs
          })
        );
      });

      const forMatch = fragment.match(/^.*?\bfor\s*\(([^)]*)\)/);
      if (forMatch) {
        const initializer = forMatch[1].split(";")[0] ?? "";
        items.push(
          ...parseDeclarationText({
            text: initializer,
            lineNumber,
            scope,
            ownerName,
            insertAs
          })
        );
      }
    });
  });

  return items;
}

// 解析函数参数列表。
function parseParameterList(parameterText, ownerName) {
  const normalized = normalizeWhitespace(parameterText);
  if (!normalized || normalized === "void") {
    return [];
  }

  return splitTopLevel(parameterText, ",")
    .map((item, index) => {
      const raw = normalizeWhitespace(item);
      if (!raw || raw === "void") {
        return null;
      }

      const withoutArraySuffix = raw.replace(/\[[^\]]*\]/g, "").trim();
      const nameMatch = withoutArraySuffix.match(/([A-Za-z_]\w*)\s*$/);

      if (!nameMatch) {
        return {
          label: raw,
          name: raw,
          documentation: `${ownerName}() 的第 ${index + 1} 个参数。`
        };
      }

      const name = nameMatch[1];
      const typePart = normalizeWhitespace(withoutArraySuffix.slice(0, nameMatch.index)) || "值";
      const pointerMarks = typePart.replace(/[^*]/g, "");
      const baseType = normalizeWhitespace(typePart.replace(/\*+/g, " "));
      const resolvedType = buildTypeLabel(baseType, pointerMarks);

      return {
        label: resolvedType ? `${resolvedType} ${name}` : name,
        name,
        type: resolvedType || "值",
        documentation: `${ownerName}() 的第 ${index + 1} 个参数。`
      };
    })
    .filter(Boolean);
}

// 根据匹配结果创建函数记录。
function createFunctionRecord(match, sanitizedSource, lineOffsets) {
  const returnType = normalizeWhitespace(match[2]);
  const name = match[3];

  if (CONTROL_FLOW_KEYWORDS.has(name)) {
    return null;
  }

  const openIndex = match.index + match[0].length - 1;
  const closeIndex = findMatchingBrace(sanitizedSource, openIndex);
  if (closeIndex < 0) {
    return null;
  }

  const startLine = getLineNumberFromOffset(lineOffsets, match.index + match[1].length);
  const endLine = getLineNumberFromOffset(lineOffsets, closeIndex);
  const bodyStartLine = getLineNumberFromOffset(lineOffsets, openIndex);
  const bodyText = sanitizedSource.slice(openIndex + 1, closeIndex);
  const normalizedParams = normalizeWhitespace(match[4]);
  const parameters = parseParameterList(match[4], name);
  const signature = `${returnType} ${name}(${normalizedParams})`.trim().replace(/\(\)$/, "()");
  const locals = extractVariablesFromText(bodyText, bodyStartLine, "local", name, "variable");

  return {
    id: `function-${name}-${startLine}`,
    name,
    label: name,
    kind: "function",
    kindLabel: "函数",
    detail: signature,
    signature: `${signature};`,
    documentation: `定义于当前文件第 ${startLine} 行。`,
    origin: "当前文件",
    insertTextValue: `${name}()`,
    cursorOffset: name.length + 1,
    sortGroup: sortGroupFromKind("function"),
    lineNumber: startLine,
    startLine,
    endLine,
    openIndex,
    closeIndex,
    returnType,
    parameters,
    locals,
    filterText: name
  };
}

// 从源码中提取全部函数记录。
function extractFunctionRecords(sanitizedSource, lineOffsets) {
  const records = [];
  const pattern =
    /(^|\n)\s*((?:(?:static|inline|extern|const|unsigned|signed|long|short|volatile|register|auto)\s+)*(?:void|char|short|int|long|float|double|bool|size_t|FILE|struct\s+[A-Za-z_]\w*|enum\s+[A-Za-z_]\w*|[A-Z][A-Za-z0-9_]*|[A-Za-z_]\w*_t))\s+([A-Za-z_]\w*)\s*\(([\s\S]*?)\)\s*\{/g;

  let match;
  while ((match = pattern.exec(sanitizedSource))) {
    const record = createFunctionRecord(match, sanitizedSource, lineOffsets);
    if (record) {
      records.push(record);
    }
  }

  return records;
}

// 屏蔽指定范围内的源码内容。
function maskSourceRanges(source, ranges) {
  const chars = source.split("");

  ranges.forEach((range) => {
    for (let index = Math.max(range.start, 0); index <= Math.min(range.end, chars.length - 1); index += 1) {
      if (chars[index] !== "\n") {
        chars[index] = " ";
      }
    }
  });

  return chars.join("");
}

// 提取源码中的宏定义信息。
function extractMacros(source, lineOffsets) {
  const items = [];
  const pattern = /^\s*#define\s+([A-Za-z_]\w*)(?:\s+(.*))?$/gm;

  let match;
  while ((match = pattern.exec(source))) {
    const name = match[1];
    const value = normalizeWhitespace(match[2] ?? "");
    const lineNumber = getLineNumberFromOffset(lineOffsets, match.index);

    items.push({
      id: `macro-${name}-${lineNumber}`,
      name,
      label: name,
      kind: "macro",
      kindLabel: "宏",
      detail: value || "#define",
      signature: value ? `#define ${name} ${value}` : `#define ${name}`,
      documentation: `定义于当前文件第 ${lineNumber} 行的宏。`,
      origin: "预处理器",
      insertTextValue: name,
      cursorOffset: name.length,
      sortGroup: sortGroupFromKind("macro"),
      lineNumber,
      filterText: name
    });
  }

  return items;
}

// 提取源码中的类型定义信息。
function extractTypes(source, lineOffsets) {
  const items = [];
  const seen = new Set();

  const structPattern = /^\s*struct\s+([A-Za-z_]\w*)\s*\{/gm;
  let match;
  while ((match = structPattern.exec(source))) {
    const name = match[1];
    const lineNumber = getLineNumberFromOffset(lineOffsets, match.index);
    const key = `struct:${name}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    items.push({
      id: `struct-${name}-${lineNumber}`,
      name,
      label: name,
      kind: "type",
      kindLabel: "类型",
      detail: `struct ${name}`,
      signature: `struct ${name}`,
      documentation: `定义于当前文件第 ${lineNumber} 行的结构体。`,
      origin: "当前文件",
      insertTextValue: name,
      cursorOffset: name.length,
      sortGroup: sortGroupFromKind("type"),
      lineNumber,
      filterText: name
    });
  }

  const typedefPattern = /^\s*typedef\s+(.+?)\s+([A-Za-z_]\w*)\s*;/gm;
  while ((match = typedefPattern.exec(source))) {
    const alias = match[2];
    const body = normalizeWhitespace(match[1]);
    if (body.includes("(")) {
      continue;
    }

    const lineNumber = getLineNumberFromOffset(lineOffsets, match.index);
    const key = `typedef:${alias}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    items.push({
      id: `typedef-${alias}-${lineNumber}`,
      name: alias,
      label: alias,
      kind: "type",
      kindLabel: "类型",
      detail: body,
      signature: `typedef ${body} ${alias}`,
      documentation: `定义于当前文件第 ${lineNumber} 行的类型别名。`,
      origin: "当前文件",
      insertTextValue: alias,
      cursorOffset: alias.length,
      sortGroup: sortGroupFromKind("type"),
      lineNumber,
      filterText: alias
    });
  }

  return items;
}

// 分析整段 C 源码中的符号和作用域。
function analyzeCSource(source = "") {
  if (analysisCache.source === source && analysisCache.value) {
    return analysisCache.value;
  }

  if (!source) {
    analysisCache = {
      source,
      value: ANALYSIS_EMPTY
    };
    return ANALYSIS_EMPTY;
  }

  const sanitized = sanitizeSource(source);
  const lineOffsets = getLineOffsets(sanitized);
  const functionRecords = extractFunctionRecords(sanitized, lineOffsets);
  const maskedSource = maskSourceRanges(
    sanitized,
    functionRecords.map((item) => ({
      start: item.openIndex,
      end: item.closeIndex
    }))
  );
  const maskedLineOffsets = getLineOffsets(maskedSource);

  const globals = extractVariablesFromText(
    maskedSource,
    1,
    "global",
    "file",
    "variable"
  );
  const macros = extractMacros(sanitized, lineOffsets);
  const types = extractTypes(maskedSource, maskedLineOffsets);

  const normalizedGlobals = globals.filter((item) => !CONTROL_FLOW_KEYWORDS.has(item.name));
  const normalizedMacros = macros.filter((item) => item.name);
  const normalizedTypes = types.filter((item) => item.name);

  const value = {
    functions: functionRecords,
    globals: normalizedGlobals,
    macros: normalizedMacros,
    types: normalizedTypes
  };

  analysisCache = {
    source,
    value
  };

  return value;
}

// 对建议项列表按标识去重。
function dedupeSuggestions(items) {
  const deduped = new Map();

  items.forEach((item) => {
    const key = `${item.kind ?? "symbol"}:${item.label}`;
    const existing = deduped.get(key);

    if (!existing) {
      deduped.set(key, item);
      return;
    }

    if ((item.sortGroup ?? 999) < (existing.sortGroup ?? 999)) {
      deduped.set(key, item);
      return;
    }

    if (
      (item.sortGroup ?? 999) === (existing.sortGroup ?? 999) &&
      (item.lineNumber ?? Number.POSITIVE_INFINITY) > (existing.lineNumber ?? -1)
    ) {
      deduped.set(key, item);
    }
  });

  return [...deduped.values()];
}

// 按输入前缀和类型对建议项排序。
function rankSuggestions(items, prefix, includeAll) {
  return dedupeSuggestions(items)
    .map((item) => ({
      ...item,
      matchScore: prefix ? scoreSuggestion(item.filterText ?? item.label, prefix) : 0
    }))
    .filter((item) => {
      if (!prefix) {
        return includeAll;
      }
      return Number.isFinite(item.matchScore);
    })
    .sort((left, right) => {
      if ((left.sortGroup ?? 999) !== (right.sortGroup ?? 999)) {
        return (left.sortGroup ?? 999) - (right.sortGroup ?? 999);
      }

      if (left.matchScore !== right.matchScore) {
        return left.matchScore - right.matchScore;
      }

      if ((left.lineNumber ?? 0) !== (right.lineNumber ?? 0)) {
        return (right.lineNumber ?? 0) - (left.lineNumber ?? 0);
      }

      return left.label.localeCompare(right.label);
    })
    .map(({ matchScore, ...item }) => item);
}

// 构建当前文档内的局部建议列表。
function buildDocumentSuggestions(analysis, cursorLineNumber) {
  const items = [];
  const currentFunction = analysis.functions.find(
    (item) => cursorLineNumber >= item.startLine && cursorLineNumber <= item.endLine
  );

  if (currentFunction) {
    currentFunction.parameters.forEach((parameter, index) => {
      items.push({
        id: `param-${currentFunction.name}-${parameter.name}-${index}`,
        label: parameter.name,
        kind: "parameter",
        kindLabel: "参数",
        detail: parameter.type ?? parameter.label,
        signature: parameter.label,
        documentation: parameter.documentation,
        origin: `当前文件 / ${currentFunction.name}()`,
        insertTextValue: parameter.name,
        cursorOffset: parameter.name.length,
        sortGroup: sortGroupFromKind("parameter"),
        lineNumber: currentFunction.startLine,
        filterText: parameter.name
      });
    });

    currentFunction.locals
      .filter((item) => item.lineNumber <= cursorLineNumber)
      .forEach((item) => {
        items.push({
          id: `local-${currentFunction.name}-${item.name}-${item.lineNumber}`,
          label: item.name,
          kind: "variable",
          kindLabel: "变量",
          detail: item.detail,
          signature: item.signature,
          documentation: item.documentation,
          origin: `当前文件 / ${currentFunction.name}()`,
          insertTextValue: item.name,
          cursorOffset: item.name.length,
          sortGroup: sortGroupFromKind("variable"),
          lineNumber: item.lineNumber,
          filterText: item.name
        });
      });
  }

  analysis.functions.forEach((item) => {
    items.push({
      id: item.id,
      label: item.label,
      kind: "function",
      kindLabel: "函数",
      detail: item.detail,
      signature: item.signature,
      documentation: item.documentation,
      origin: item.origin,
      insertTextValue: item.insertTextValue,
      cursorOffset: item.cursorOffset,
      sortGroup: item.sortGroup,
      lineNumber: item.lineNumber,
      filterText: item.filterText
    });
  });

  analysis.types.forEach((item) => {
    items.push({
      id: item.id,
      label: item.label,
      kind: "type",
      kindLabel: "类型",
      detail: item.detail,
      signature: item.signature,
      documentation: item.documentation,
      origin: item.origin,
      insertTextValue: item.insertTextValue,
      cursorOffset: item.cursorOffset,
      sortGroup: item.sortGroup,
      lineNumber: item.lineNumber,
      filterText: item.filterText
    });
  });

  analysis.globals.forEach((item) => {
    items.push({
      id: item.id,
      label: item.label,
      kind: "variable",
      kindLabel: "变量",
      detail: item.detail,
      signature: item.signature,
      documentation: item.documentation,
      origin: item.origin,
      insertTextValue: item.insertTextValue,
      cursorOffset: item.cursorOffset,
      sortGroup: item.sortGroup,
      lineNumber: item.lineNumber,
      filterText: item.filterText
    });
  });

  analysis.macros.forEach((item) => {
    items.push({
      id: item.id,
      label: item.label,
      kind: "macro",
      kindLabel: "宏",
      detail: item.detail,
      signature: item.signature,
      documentation: item.documentation,
      origin: item.origin,
      insertTextValue: item.insertTextValue,
      cursorOffset: item.cursorOffset,
      sortGroup: item.sortGroup,
      lineNumber: item.lineNumber,
      filterText: item.filterText
    });
  });

  return items;
}

const IDEA_SUGGESTION_CATALOG = [
  ...ROBOT_FUNCTIONS.map((item) => createCatalogSuggestion(item, "function")),
  ...C_SNIPPETS.map((item) => createCatalogSuggestion(item, "snippet")),
  ...C_KEYWORDS.map((item) => createCatalogSuggestion(item, "keyword"))
];

// 查询当前光标上下文下的补全建议。
export function queryCSuggestions({
  prefix = "",
  linePrefix = "",
  lineSuffix = "",
  includeAll = false,
  source = "",
  cursorLineNumber = 1
} = {}) {
  const headerSuggestions = buildHeaderSuggestions(linePrefix, lineSuffix);
  if (headerSuggestions.length > 0) {
    return rankSuggestions(headerSuggestions, getIncludePrefix(linePrefix)?.prefix ?? "", true);
  }

  const sensorSuggestions = buildSensorSuggestions(linePrefix, lineSuffix);
  if (sensorSuggestions.length > 0) {
    return rankSuggestions(sensorSuggestions, getSensorPrefix(linePrefix) ?? "", true);
  }

  const analysis = analyzeCSource(source);
  const documentSuggestions = buildDocumentSuggestions(analysis, cursorLineNumber);
  const allItems = [...documentSuggestions, ...IDEA_SUGGESTION_CATALOG];

  if (!includeAll && !prefix) {
    return [];
  }

  return rankSuggestions(allItems, prefix, includeAll);
}

// 生成 Monaco 可直接使用的补全项。
function createCompletionItems(monaco, model, position) {
  const range = buildRange(monaco, model, position);
  const linePrefix = model.getValueInRange(
    new monaco.Range(position.lineNumber, 1, position.lineNumber, position.column)
  );
  const lineSuffix = model.getValueInRange(
    new monaco.Range(
      position.lineNumber,
      position.column,
      position.lineNumber,
      model.getLineMaxColumn(position.lineNumber)
    )
  );
  const prefix = model.getWordUntilPosition(position).word;
  const source = model.getValue();

  return queryCSuggestions({
    prefix,
    linePrefix,
    lineSuffix,
    includeAll: true,
    source,
    cursorLineNumber: position.lineNumber
  }).map((item, index) => ({
    label: item.label,
    kind: completionKindFromItem(monaco, item),
    detail: item.detail,
    documentation: item.documentation,
    insertText: item.insertTextValue,
    insertTextRules:
      item.kind === "snippet"
        ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
        : undefined,
    sortText: `${String(item.sortGroup ?? 99).padStart(2, "0")}${String(index).padStart(3, "0")}`,
    range
  }));
}

// 生成当前单词的替换范围。
function buildRange(monaco, model, position) {
  const word = model.getWordUntilPosition(position);
  return new monaco.Range(
    position.lineNumber,
    word.startColumn,
    position.lineNumber,
    word.endColumn
  );
}

// 把内部建议类型映射到 Monaco 类型。
function completionKindFromItem(monaco, item) {
  switch (item.kind) {
    case "snippet":
      return monaco.languages.CompletionItemKind.Snippet;
    case "keyword":
      return monaco.languages.CompletionItemKind.Keyword;
    case "constant":
      return monaco.languages.CompletionItemKind.Constant;
    case "variable":
      return monaco.languages.CompletionItemKind.Variable;
    case "parameter":
      return monaco.languages.CompletionItemKind.Variable;
    case "macro":
      return monaco.languages.CompletionItemKind.Constant;
    case "header":
      return monaco.languages.CompletionItemKind.File;
    case "type":
      return monaco.languages.CompletionItemKind.Struct;
    default:
      return monaco.languages.CompletionItemKind.Function;
  }
}

// 注册自定义补全提供器。
function registerCompletionProvider(monaco, languageId) {
  return monaco.languages.registerCompletionItemProvider(languageId, {
    triggerCharacters: ["(", '"', "_", "#", "<", ","],
    provideCompletionItems(model, position) {
      return {
        suggestions: createCompletionItems(monaco, model, position)
      };
    }
  });
}

// 在文档分析结果中查找当前符号。
function findDocumentSymbol(analysis, word, lineNumber) {
  const currentFunction = analysis.functions.find(
    (item) => lineNumber >= item.startLine && lineNumber <= item.endLine
  );

  if (currentFunction) {
    const localSymbol = [
      ...currentFunction.parameters.map((item) => ({
        name: item.name,
        kind: "parameter",
        signature: item.label,
        documentation: item.documentation,
        lineNumber: currentFunction.startLine
      })),
      ...currentFunction.locals
    ].find((item) => item.name === word);

    if (localSymbol) {
      return localSymbol;
    }
  }

  return (
    analysis.functions.find((item) => item.name === word) ||
    analysis.macros.find((item) => item.name === word) ||
    analysis.types.find((item) => item.name === word) ||
    analysis.globals.find((item) => item.name === word) ||
    null
  );
}

// 构建签名提示所需的函数列表。
function buildSignatureItems(analysis) {
  return [
    ...ROBOT_FUNCTIONS.map((item) => ({
      label: item.label,
      signature: item.signature,
      documentation: item.documentation,
      parameters: item.parameters
    })),
    ...analysis.functions.map((item) => ({
      label: item.name,
      signature: item.signature,
      documentation: item.documentation,
      parameters: item.parameters
    }))
  ];
}

// 按当前单词生成范围对象。
function buildWordRange(monaco, position, word) {
  return new monaco.Range(
    position.lineNumber,
    word.startColumn,
    position.lineNumber,
    word.endColumn
  );
}

// 根据偏移量生成 Monaco 范围对象。
function createRangeFromOffsets(monaco, model, startOffset, endOffset) {
  const safeStart = Math.max(0, startOffset);
  const safeEnd = Math.max(safeStart + 1, endOffset);
  const start = model.getPositionAt(safeStart);
  const end = model.getPositionAt(safeEnd);

  return new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column);
}

// 根据行列位置换算源码偏移量。
function getOffsetFromPosition(lineOffsets, lineNumber, column) {
  const safeLine = Math.max(1, lineNumber);
  const lineStart = lineOffsets[safeLine - 1] ?? 0;
  const nextLineStart = lineOffsets[safeLine] ?? Number.POSITIVE_INFINITY;
  const maxColumn = Number.isFinite(nextLineStart)
    ? nextLineStart - lineStart + 1
    : Number.POSITIVE_INFINITY;
  const safeColumn = Math.max(1, Math.min(column, maxColumn));
  return lineStart + safeColumn - 1;
}

// 根据偏移量生成普通范围对象。
function buildRangeFromOffsets(lineOffsets, startOffset, endOffset) {
  const safeStart = Math.max(0, startOffset);
  const safeEnd = Math.max(safeStart + 1, endOffset);
  const startLineNumber = getLineNumberFromOffset(lineOffsets, safeStart);
  const endLineNumber = getLineNumberFromOffset(lineOffsets, safeEnd);
  const startColumn = safeStart - (lineOffsets[startLineNumber - 1] ?? 0) + 1;
  const endColumn = safeEnd - (lineOffsets[endLineNumber - 1] ?? 0) + 1;

  return {
    startLineNumber,
    startColumn,
    endLineNumber,
    endColumn
  };
}

// 读取指定偏移量附近的单词信息。
function getWordInfoAtOffset(source, offset) {
  const isWordChar = (char) => /[A-Za-z0-9_]/.test(char ?? "");

  let cursor = offset;
  if (!isWordChar(source[cursor]) && isWordChar(source[cursor - 1])) {
    cursor -= 1;
  }

  if (!isWordChar(source[cursor])) {
    return null;
  }

  let startOffset = cursor;
  let endOffset = cursor + 1;

  while (startOffset > 0 && isWordChar(source[startOffset - 1])) {
    startOffset -= 1;
  }

  while (endOffset < source.length && isWordChar(source[endOffset])) {
    endOffset += 1;
  }

  return {
    word: source.slice(startOffset, endOffset),
    startOffset,
    endOffset
  };
}

// 拆分顶层参数并保留其偏移范围。
function splitTopLevelRanges(text, baseOffset = 0, delimiter = ",") {
  const ranges = [];
  let segmentStart = 0;
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;

  for (let index = 0; index < text.length; index += 1) {
    const current = text[index];

    if (current === "(") {
      parenDepth += 1;
      continue;
    }

    if (current === ")" && parenDepth > 0) {
      parenDepth -= 1;
      continue;
    }

    if (current === "[") {
      bracketDepth += 1;
      continue;
    }

    if (current === "]" && bracketDepth > 0) {
      bracketDepth -= 1;
      continue;
    }

    if (current === "{") {
      braceDepth += 1;
      continue;
    }

    if (current === "}" && braceDepth > 0) {
      braceDepth -= 1;
      continue;
    }

    if (
      current === delimiter &&
      parenDepth === 0 &&
      bracketDepth === 0 &&
      braceDepth === 0
    ) {
      ranges.push({
        startOffset: baseOffset + segmentStart,
        endOffset: baseOffset + index
      });
      segmentStart = index + 1;
    }
  }

  ranges.push({
    startOffset: baseOffset + segmentStart,
    endOffset: baseOffset + text.length
  });

  return ranges;
}

// 去除源码范围两端的空白字符。
function trimSourceRange(source, startOffset, endOffset) {
  let start = startOffset;
  let end = endOffset;

  while (start < end && /\s/.test(source[start] ?? "")) {
    start += 1;
  }

  while (end > start && /\s/.test(source[end - 1] ?? "")) {
    end -= 1;
  }

  return {
    startOffset: start,
    endOffset: end
  };
}

// 查找与左圆括号匹配的右圆括号。
function findMatchingParenthesis(source, openIndex) {
  let depth = 0;

  for (let index = openIndex; index < source.length; index += 1) {
    const current = source[index];

    if (current === "(") {
      depth += 1;
      continue;
    }

    if (current === ")") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

// 向前查找最近一层未闭合的左圆括号。
function findEnclosingOpenParenthesis(source, offset) {
  let depth = 0;

  for (let index = Math.max(offset - 1, 0); index >= 0; index -= 1) {
    const current = source[index];

    if (current === ")") {
      depth += 1;
      continue;
    }

    if (current === "(") {
      if (depth === 0) {
        return index;
      }

      depth -= 1;
    }
  }

  return -1;
}

// 读取指定偏移量之前的标识符。
function readIdentifierBeforeOffset(source, offset) {
  let end = offset + 1;

  while (end >= 0 && /\s/.test(source[end] ?? "")) {
    end -= 1;
  }

  if (end < 0) {
    return null;
  }

  let start = end;
  while (start >= 0 && /[A-Za-z0-9_]/.test(source[start] ?? "")) {
    start -= 1;
  }

  const name = source.slice(start + 1, end + 1);
  if (!name) {
    return null;
  }

  return {
    name,
    startOffset: start + 1,
    endOffset: end + 1
  };
}

// 在 Monaco 模型中定位当前参数提示上下文。
function findCallArgumentContext(monaco, model, position, signatureItems, word) {
  const source = model.getValue();
  const sanitized = sanitizeSource(source);
  const offset = model.getOffsetAt(position);
  const openIndex = findEnclosingOpenParenthesis(sanitized, offset);

  if (openIndex < 0 || offset <= openIndex) {
    return null;
  }

  const closeIndex = findMatchingParenthesis(sanitized, openIndex);
  if (closeIndex < 0 || offset > closeIndex) {
    return null;
  }

  const functionToken = readIdentifierBeforeOffset(sanitized, openIndex - 1);
  if (!functionToken || CONTROL_FLOW_KEYWORDS.has(functionToken.name)) {
    return null;
  }

  const item = signatureItems.find((entry) => entry.label === functionToken.name);
  if (!item || !item.parameters?.length) {
    return null;
  }

  const argumentRanges = splitTopLevelRanges(
    sanitized.slice(openIndex + 1, closeIndex),
    openIndex + 1
  );
  const argumentIndex = argumentRanges.findIndex((range) => {
    if (range.startOffset === range.endOffset) {
      return offset === range.startOffset;
    }

    return offset >= range.startOffset && offset < range.endOffset;
  });

  if (argumentIndex < 0) {
    return null;
  }

  const parameter = item.parameters[argumentIndex];
  if (!parameter) {
    return null;
  }

  const trimmedRange = trimSourceRange(
    sanitized,
    argumentRanges[argumentIndex].startOffset,
    argumentRanges[argumentIndex].endOffset
  );

  let range = createRangeFromOffsets(
    monaco,
    model,
    trimmedRange.startOffset,
    trimmedRange.endOffset
  );

  if (word) {
    const wordStartOffset = model.getOffsetAt({
      lineNumber: position.lineNumber,
      column: word.startColumn
    });
    const wordEndOffset = model.getOffsetAt({
      lineNumber: position.lineNumber,
      column: word.endColumn
    });

    if (
      wordStartOffset >= trimmedRange.startOffset &&
      wordEndOffset <= Math.max(trimmedRange.endOffset, trimmedRange.startOffset + 1)
    ) {
      range = buildWordRange(monaco, position, word);
    }
  }

  return {
    item,
    parameter,
    argumentIndex,
    range
  };
}

// 直接从源码文本中定位参数提示上下文。
function findCallArgumentContextFromSource({
  source,
  lineOffsets,
  lineNumber,
  column,
  signatureItems,
  word
}) {
  const sanitized = sanitizeSource(source);
  const offset = getOffsetFromPosition(lineOffsets, lineNumber, column);
  const openIndex = findEnclosingOpenParenthesis(sanitized, offset);

  if (openIndex < 0 || offset <= openIndex) {
    return null;
  }

  const closeIndex = findMatchingParenthesis(sanitized, openIndex);
  if (closeIndex < 0 || offset > closeIndex) {
    return null;
  }

  const functionToken = readIdentifierBeforeOffset(sanitized, openIndex - 1);
  if (!functionToken || CONTROL_FLOW_KEYWORDS.has(functionToken.name)) {
    return null;
  }

  const item = signatureItems.find((entry) => entry.label === functionToken.name);
  if (!item || !item.parameters?.length) {
    return null;
  }

  const argumentRanges = splitTopLevelRanges(
    sanitized.slice(openIndex + 1, closeIndex),
    openIndex + 1
  );
  const argumentIndex = argumentRanges.findIndex((range) => {
    if (range.startOffset === range.endOffset) {
      return offset === range.startOffset;
    }

    return offset >= range.startOffset && offset < range.endOffset;
  });

  if (argumentIndex < 0) {
    return null;
  }

  const parameter = item.parameters[argumentIndex];
  if (!parameter) {
    return null;
  }

  const trimmedRange = trimSourceRange(
    sanitized,
    argumentRanges[argumentIndex].startOffset,
    argumentRanges[argumentIndex].endOffset
  );

  let range = buildRangeFromOffsets(
    lineOffsets,
    trimmedRange.startOffset,
    trimmedRange.endOffset
  );

  if (
    word &&
    word.startOffset >= trimmedRange.startOffset &&
    word.endOffset <= Math.max(trimmedRange.endOffset, trimmedRange.startOffset + 1)
  ) {
    range = buildRangeFromOffsets(lineOffsets, word.startOffset, word.endOffset);
  }

  return {
    item,
    parameter,
    argumentIndex,
    range
  };
}

// 解析当前光标位置的悬停说明内容。
export function resolveCHoverInfo({ source = "", lineNumber = 1, column = 1 } = {}) {
  if (!source) {
    return null;
  }

  const analysis = analyzeCSource(source);
  const lineOffsets = getLineOffsets(source);
  const offset = getOffsetFromPosition(lineOffsets, lineNumber, column);
  const word = getWordInfoAtOffset(source, offset);
  const signatureItems = buildSignatureItems(analysis);
  const sections = [];
  let range = null;

  if (word) {
    const builtin = ROBOT_FUNCTIONS.find((item) => item.label === word.word);
    if (builtin) {
      range = buildRangeFromOffsets(lineOffsets, word.startOffset, word.endOffset);
      sections.push({
        kind: "symbol",
        signature: builtin.signature,
        documentation: builtin.documentation
      });
    } else {
      const symbol = findDocumentSymbol(analysis, word.word, lineNumber);
      if (symbol) {
        range = buildRangeFromOffsets(lineOffsets, word.startOffset, word.endOffset);
        sections.push({
          kind: "symbol",
          signature: symbol.signature ?? symbol.detail ?? symbol.name,
          documentation:
            symbol.documentation ?? `声明于当前文件第 ${symbol.lineNumber ?? lineNumber} 行。`
        });
      }
    }
  }

  const argumentContext = findCallArgumentContextFromSource({
    source,
    lineOffsets,
    lineNumber,
    column,
    signatureItems,
    word
  });
  if (argumentContext) {
    if (!range) {
      range = argumentContext.range;
    }

    sections.push({
      kind: "parameter",
      title: `${argumentContext.item.label}() 的第 ${argumentContext.argumentIndex + 1} 个参数`,
      signature: argumentContext.parameter.label ?? argumentContext.parameter.name ?? "",
      documentation:
        argumentContext.parameter.documentation ??
        `${argumentContext.item.label}() 的第 ${argumentContext.argumentIndex + 1} 个参数。`
    });
  }

  if (!sections.length || !range) {
    return null;
  }

  return {
    range,
    sections
  };
}

// 注册自定义悬停说明提供器。
function registerHoverProvider(monaco, languageId) {
  const builtinDocs = new Map(ROBOT_FUNCTIONS.map((item) => [item.label, item]));

  return monaco.languages.registerHoverProvider(languageId, {
    provideHover(model, position) {
      const word = model.getWordAtPosition(position);
      const source = model.getValue();
      const analysis = analyzeCSource(source);
      const signatureItems = buildSignatureItems(analysis);
      const contents = [];
      let range = null;

      if (word) {
        const builtin = builtinDocs.get(word.word);
        if (builtin) {
          range = buildWordRange(monaco, position, word);
          contents.push(
            { value: `\`\`\`c\n${builtin.signature}\n\`\`\`` },
            { value: builtin.documentation }
          );
        } else {
          const symbol = findDocumentSymbol(analysis, word.word, position.lineNumber);
          if (symbol) {
            const signature = symbol.signature ?? symbol.detail ?? symbol.name;
            const documentation =
              symbol.documentation ?? `声明于当前文件第 ${symbol.lineNumber ?? position.lineNumber} 行。`;

            range = buildWordRange(monaco, position, word);
            contents.push(
              { value: `\`\`\`c\n${signature}\n\`\`\`` },
              { value: documentation }
            );
          }
        }
      }

      const argumentContext = findCallArgumentContext(
        monaco,
        model,
        position,
        signatureItems,
        word
      );
      if (argumentContext) {
        if (contents.length) {
          contents.push({ value: "---" });
        }

        if (!range) {
          range = argumentContext.range;
        }

        contents.push(
          {
            value: `**参数位置**：\`${argumentContext.item.label}()\` 的第 ${argumentContext.argumentIndex + 1} 个参数`
          },
          {
            value: `\`\`\`c\n${argumentContext.parameter.label ?? argumentContext.parameter.name}\n\`\`\``
          },
          {
            value:
              argumentContext.parameter.documentation ??
              `${argumentContext.item.label}() 的第 ${argumentContext.argumentIndex + 1} 个参数。`
          }
        );
      }

      if (!contents.length || !range) {
        return null;
      }

      return {
        range,
        contents
      };
    }
  });
}

// 计算当前签名提示所处的调用上下文。
function getSignatureContext(model, position) {
  const analysis = analyzeCSource(model.getValue());
  const linePrefix = model.getValueInRange({
    startLineNumber: position.lineNumber,
    startColumn: 1,
    endLineNumber: position.lineNumber,
    endColumn: position.column
  });

  const signatureItems = buildSignatureItems(analysis);

  let matchedFunction = null;
  let matchedIndex = -1;

  signatureItems.forEach((item) => {
    const index = linePrefix.lastIndexOf(`${item.label}(`);
    if (index > matchedIndex) {
      matchedFunction = item;
      matchedIndex = index;
    }
  });

  if (!matchedFunction || matchedIndex < 0) {
    return null;
  }

  const callFragment = linePrefix.slice(matchedIndex + matchedFunction.label.length + 1);
  const activeParameter = callFragment.split(",").length - 1;

  return {
    item: matchedFunction,
    activeParameter: Math.max(0, activeParameter)
  };
}

// 注册自定义签名提示提供器。
function registerSignatureProvider(monaco, languageId) {
  return monaco.languages.registerSignatureHelpProvider(languageId, {
    signatureHelpTriggerCharacters: ["(", ","],
    signatureHelpRetriggerCharacters: [","],
    provideSignatureHelp(model, position) {
      const context = getSignatureContext(model, position);

      if (!context) {
        return null;
      }

      return {
        value: {
          activeSignature: 0,
          activeParameter: Math.min(
            context.activeParameter,
            Math.max(context.item.parameters.length - 1, 0)
          ),
          signatures: [
            {
              label: context.item.signature,
              documentation: context.item.documentation,
              parameters: context.item.parameters
            }
          ]
        },
        dispose: () => {}
      };
    }
  });
}

// 注册 C 编辑器的全部智能能力。
export function registerCEditorIntelligence(monaco) {
  if (languageFeaturesRegistered) {
    return;
  }

  ["c", "cpp"].forEach((languageId) => {
    registerCompletionProvider(monaco, languageId);
    registerHoverProvider(monaco, languageId);
    registerSignatureProvider(monaco, languageId);
  });

  languageFeaturesRegistered = true;
}
