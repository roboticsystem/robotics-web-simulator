import { validateCSource } from "./cSyntaxDiagnostics.js";

const ROBOT_API_SPECS = [
  "void robot_reset(void);",
  "void robot_move_forward(int distance, int speed);",
  "void robot_move_backward(int distance, int speed);",
  "void robot_turn_left(int angle, int speed);",
  "void robot_turn_right(int angle, int speed);",
  "void robot_wait(double seconds);",
  "void robot_stop(void);",
  "int robot_read_distance(void);",
  "double robot_read_temperature(void);",
  "int robot_read_light(void);",
  "int robot_read_battery(void);",
  'double robot_read_sensor(char *name); // supported: DISTANCE, TEMPERATURE, LIGHT, BATTERY, ULTRASONIC, ULTRASONIC_DISTANCE, INFRARED, INFRARED_ANALOG, INFRARED_DIGITAL, IMU_GYRO_Z, IMU_ACCEL_X, IMU_ACCEL_Y, IMU_ROLL, IMU_PITCH, ULTRASONIC_01, INFRARED_01, IMU_01',
  'void robot_say(char *message);',
  "int printf(char *format, ...);"
];

const ALLOWED_ROBOT_APIS = new Set([
  "robot_reset",
  "robot_move_forward",
  "robot_move_backward",
  "robot_turn_left",
  "robot_turn_right",
  "robot_wait",
  "robot_stop",
  "robot_read_distance",
  "robot_read_temperature",
  "robot_read_light",
  "robot_read_battery",
  "robot_read_sensor",
  "robot_say"
]);

const DEFAULT_OLLAMA_OPTIONS = {
  temperature: 0,
  top_p: 0.85,
  repeat_penalty: 1.08,
  num_predict: 960,
  num_ctx: 4096
};

const DEFAULT_OPENAI_OPTIONS = {
  temperature: 0,
  top_p: 0.85,
  max_tokens: 2048
};

const REVIEW_ISSUE_LIMIT = 6;
const ROBOT_SAFETY_RADIUS = 18;

function summarizeErrors(errors = []) {
  if (!errors.length) {
    return "None.";
  }

  return errors
    .slice(0, 8)
    .map((error) => {
      const line = error?.line ?? 1;
      const column = error?.column ?? 1;
      const message = error?.message ?? "Unknown error";
      return `- line ${line}, column ${column}: ${message}`;
    })
    .join("\n");
}

function formatSceneNumber(value, digits = 1) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) {
    return "-";
  }

  return normalized.toFixed(digits);
}

function formatScenePoint(point, digits = 1) {
  if (!point || typeof point !== "object") {
    return "(x=-, y=-)";
  }

  return `(x=${formatSceneNumber(point.x, digits)}, y=${formatSceneNumber(point.y, digits)})`;
}

function formatInstalledSensorLatest(latest) {
  if (latest == null) {
    return "null";
  }

  if (typeof latest === "object") {
    try {
      return JSON.stringify(latest);
    } catch {
      return "[unserializable]";
    }
  }

  return String(latest);
}

function formatSceneContext(sceneContext) {
  if (!sceneContext) {
    return "未提供场景上下文。";
  }

  const coordinateSystem = sceneContext.coordinateSystem ?? {};
  const world = sceneContext.world ?? {};
  const robot = sceneContext.robot ?? {};
  const robotSensorData = robot.sensorData ?? {};
  const map = sceneContext.map ?? {};
  const readableSensors = sceneContext.readableSensors ?? {};
  const installedSensors = Array.isArray(sceneContext.installedSensors)
    ? sceneContext.installedSensors
    : [];
  const obstacles = Array.isArray(map.obstacles)
    ? [...map.obstacles].sort((left, right) => Number(left.id ?? 0) - Number(right.id ?? 0))
    : [];

  const obstacleSummary = obstacles.length
    ? obstacles
        .map((entry, index) => {
          const size = entry.size ?? {};
          const aabb = entry.aabb ?? null;
          const vertices = Array.isArray(entry.vertices) ? entry.vertices : [];

          return [
            `- obstacle ${entry.id ?? index + 1}`,
            `type=${entry.type ?? "unknown"}`,
            entry.label ? `label=${entry.label}` : null,
            `center=${formatScenePoint(entry.center)}`,
            entry.radius != null ? `radius=${formatSceneNumber(entry.radius)}` : null,
            size.width != null || size.height != null
              ? `size=(w=${formatSceneNumber(size.width)}, h=${formatSceneNumber(size.height)})`
              : null,
            aabb
              ? `aabb=[minX=${formatSceneNumber(aabb.minX)}, maxX=${formatSceneNumber(aabb.maxX)}, minY=${formatSceneNumber(aabb.minY)}, maxY=${formatSceneNumber(aabb.maxY)}]`
              : null,
            vertices.length
              ? `vertices=${vertices.map((vertex) => formatScenePoint(vertex)).join(" -> ")}`
              : null
          ]
            .filter(Boolean)
            .join("; ");
        })
        .join("\n")
    : "- none";

  const installedSensorSummary = installedSensors.length
    ? installedSensors
        .map((sensor, index) => {
          return [
            `- sensor ${sensor?.sensorId ?? sensor?.id ?? index + 1}`,
            `type=${sensor?.sensorType ?? "unknown"}`,
            `name=${sensor?.name ?? "-"}`,
            `enabled=${sensor?.enabled !== false}`,
            sensor?.mountX != null || sensor?.mountY != null
              ? `mount=${formatScenePoint({ x: sensor?.mountX, y: sensor?.mountY })}`
              : null,
            sensor?.mountAngle != null ? `mountAngle=${formatSceneNumber(sensor?.mountAngle, 3)}` : null,
            sensor?.outputMode ? `outputMode=${sensor.outputMode}` : null,
            `latest=${formatInstalledSensorLatest(sensor?.latest)}`
          ]
            .filter(Boolean)
            .join("; ");
        })
        .join("\n")
    : "- none";
  const enabledSensors = installedSensors.filter((sensor) => sensor?.enabled !== false);
  const enabledSensorTypes = [...new Set(enabledSensors.map((sensor) => sensor?.sensorType).filter(Boolean))];
  const enabledSensorSummary = enabledSensors.length
    ? `Enabled sensors: count=${enabledSensors.length}, types=${enabledSensorTypes.join(", ")}`
    : "Enabled sensors: none";

  const lineTrackSummary = map.lineTrack
    ? `Line track: width=${formatSceneNumber(map.lineTrack.trackWidth)}, closed=${Boolean(map.lineTrack.closed)}, controlPoints=${Number(map.lineTrack.controlPointCount ?? 0)}, segments=${Number(map.lineTrack.segmentCount ?? 0)}`
    : "Line track: none";
  const gridSummary = map.grid
    ? `Grid: type=${map.grid.type ?? "gridMap"}, cols=${Number(map.grid.cols ?? 0)}, rows=${Number(map.grid.rows ?? 0)}, cellW=${formatSceneNumber(map.grid.cellW)}, cellH=${formatSceneNumber(map.grid.cellH)}, start=${formatScenePoint(map.grid.start)}, startCell=${map.grid.startCell ? JSON.stringify(map.grid.startCell) : "null"}, seed=${map.grid.seed ?? "null"}, occupancyRows=${Array.isArray(map.grid.occupancy) ? map.grid.occupancy.length : 0}`
    : "Grid: none";
  const mazeExitSummary = map.mazeExit
    ? `Maze exit: position=${formatScenePoint(map.mazeExit.position)}, cell=${map.mazeExit.cell ? JSON.stringify(map.mazeExit.cell) : "null"}, cellW=${formatSceneNumber(map.mazeExit.cellW)}, cellH=${formatSceneNumber(map.mazeExit.cellH)}`
    : "Maze exit: none";

  return [
    `Layout: ${sceneContext.layoutName ?? "Unnamed layout"}`,
    `World: width=${formatSceneNumber(world.width)}, height=${formatSceneNumber(world.height)}, background=${world.background ?? "-"}, gridColor=${world.gridColor ?? "-"}`,
    [
      "Coordinate system:",
      `type=${coordinateSystem.type ?? "-"}`,
      `origin=${coordinateSystem.origin ?? "-"}`,
      `positiveX=${coordinateSystem.positiveX ?? "-"}`,
      `positiveY=${coordinateSystem.positiveY ?? "-"}`,
      `rotationUnit=${coordinateSystem.rotationUnit ?? "-"}`,
      `rotationZero=${coordinateSystem.rotationZeroDirection ?? "-"}`,
      `movementFormula=${coordinateSystem.movementFormula ?? "-"}`
    ].join(" "),
    [
      "Robot:",
      `id=${robot.id ?? "-"}`,
      `position=${formatScenePoint(robot.position)}`,
      `rotationRad=${formatSceneNumber(robot.rotationRad, 3)}`,
      `rotationDeg=${formatSceneNumber(robot.rotationDeg, 1)}`,
      `headingVector=${formatScenePoint(robot.headingVector, 3)}`,
      `radius=${formatSceneNumber(robot.radius)}`,
      `visible=${Boolean(robot.visible)}`,
      `velocity=${formatScenePoint(robot.velocity, 3)}`,
      `targetVelocity=${formatScenePoint(robot.targetVelocity, 3)}`,
      `angularVelocity=${formatSceneNumber(robot.angularVelocity, 3)}`,
      `targetAngularVelocity=${formatSceneNumber(robot.targetAngularVelocity, 3)}`
    ].join(" "),
    robot.aabb
      ? `Robot AABB: minX=${formatSceneNumber(robot.aabb.minX)}, maxX=${formatSceneNumber(robot.aabb.maxX)}, minY=${formatSceneNumber(robot.aabb.minY)}, maxY=${formatSceneNumber(robot.aabb.maxY)}`
      : "Robot AABB: none",
    [
      "Robot sensorData:",
      `light=${formatSceneNumber(robotSensorData.light)}`,
      `sound=${formatSceneNumber(robotSensorData.sound)}`,
      `lineDetected=${Boolean(robotSensorData.lineDetected)}`,
      `linePosition=${robotSensorData.linePosition ? formatScenePoint(robotSensorData.linePosition) : "(x=-, y=-)"}`,
      `collision=${JSON.stringify(robotSensorData.collision ?? {})}`,
      `proximity=${JSON.stringify(robotSensorData.proximity ?? {})}`
    ].join(" "),
    [
      "Readable sensors:",
      `DISTANCE=${formatSceneNumber(readableSensors.DISTANCE)}`,
      `TEMPERATURE=${formatSceneNumber(readableSensors.TEMPERATURE)}`,
      `LIGHT=${formatSceneNumber(readableSensors.LIGHT, 0)}`,
      `BATTERY=${formatSceneNumber(readableSensors.BATTERY, 0)}`
    ].join(" "),
    enabledSensorSummary,
    `Obstacle count: ${Number(map.obstacleCount ?? obstacles.length)}`,
    lineTrackSummary,
    gridSummary,
    mazeExitSummary,
    "Obstacles (sorted by id):",
    obstacleSummary,
    "Installed sensors:",
    installedSensorSummary
  ].join("\n");
}

function stripReasoningArtifacts(text) {
  return String(text ?? "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
}

function extractCodeBlock(text) {
  const normalized = stripReasoningArtifacts(text);
  if (!normalized) {
    return "";
  }

  const fencedMatch = normalized.match(/```(?:c|cpp)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const mainIndex = normalized.search(/#include|int\s+main\s*\(/);
  if (mainIndex > 0) {
    return normalized.slice(mainIndex).trim();
  }

  return normalized;
}

function normalizeGeneratedCode(code) {
  let normalized = String(code ?? "")
    .replace(/\r\n/g, "\n")
    .trim();

  if (!normalized) {
    return "";
  }

  if (/printf\s*\(/.test(normalized) && !/#include\s*<stdio\.h>/.test(normalized)) {
    normalized = `#include <stdio.h>\n\n${normalized}`;
  }

  return normalized;
}

function findHallucinatedRobotApis(code) {
  const matches = [...String(code ?? "").matchAll(/\b(robot_[A-Za-z_]\w*)\s*\(/g)];
  const names = [...new Set(matches.map((match) => match[1]))];
  return names.filter((name) => !ALLOWED_ROBOT_APIS.has(name));
}

function formatDiagnostics(errors = []) {
  return errors.slice(0, REVIEW_ISSUE_LIMIT).map((error) => {
    const line = error?.line ?? 1;
    const column = error?.column ?? 1;
    return `- line ${line}, column ${column}: ${error?.message ?? "Unknown diagnostic"}`;
  });
}

function inspectGeneratedCode(code) {
  const issues = [];

  if (!/\bint\s+main\s*\(/.test(code)) {
    issues.push("Missing int main() entry point.");
  }

  const hallucinatedApis = findHallucinatedRobotApis(code);
  if (hallucinatedApis.length) {
    issues.push(`Uses unsupported robot API(s): ${hallucinatedApis.join(", ")}`);
  }

  const diagnostics = validateCSource(code);
  const blockingDiagnostics = diagnostics.filter((error) => {
    if (error?.severity === "error") {
      return true;
    }

    return /undeclared|unsupported|invalid/i.test(String(error?.message ?? ""));
  });

  issues.push(...formatDiagnostics(blockingDiagnostics));

  return {
    issues,
    hallucinatedApis,
    diagnostics: blockingDiagnostics
  };
}

function buildMessages({ requirement, currentCode, errors, sceneContext }) {
  const codeContext = currentCode?.trim() ? currentCode.trim() : "// editor is empty";
  const errorContext = summarizeErrors(errors);
  const mapContext = [
    formatSceneContext(sceneContext),
    "地图说明：本项目只使用二维地图。不存在三维场景，不存在 z 轴，不存在高度或深度。",
    "障碍物说明：障碍物占据的是二维区域。规划运动时要使用 AABB 边界、障碍物尺寸、半径和多边形顶点，不能只看障碍物中心点。",
    "地图类型说明：如果 map.kind 是 gridMap，就按二维栅格单元和墙来推理；如果 map.kind 是 lineTrack，就按二维巡线地图来推理；否则就按普通二维障碍物布局来推理。",
    "传感器说明：场景上下文中的 Installed sensors 和 Enabled sensors 就是当前实际已配置的传感器。生成代码时可以结合当前已启用的真实传感器，尤其是超声、红外和 IMU 读数，辅助避障、纠偏和运动决策。",
    `安全说明：除非用户明确要求进行碰撞测试，否则机器人与障碍物边界至少保持机器人半径 ${ROBOT_SAFETY_RADIUS} + 2 的安全间距。`
  ].join("\n");
  const collisionGuidance = [
    "二维位姿规则：机器人位姿只有 (x, y, rotationRad)，只存在 x、y 和朝向。",
    "二维朝向规则：rotationRad = 0 表示朝向 +X 方向，也就是向右。",
    "转向规则：robot_turn_left(angle, speed) 会减小朝向角；robot_turn_right(angle, speed) 会增大朝向角。",
    "前进模型：x += cos(theta) * distance，y += sin(theta) * distance。",
    "后退模型：x -= cos(theta) * distance，y -= sin(theta) * distance。",
    "栅格地图规则：当 map.grid 存在时，应将 startCell、mazeExit.cell、occupancy 墙信息和障碍物单元视为权威的栅格导航上下文。",
    "巡线地图规则：当 map.lineTrack 存在时，应遵循提供的二维巡线语义，不要自行虚构地图数据之外的路径点。",
    "传感器辅助规则：可以使用 robot_read_sensor(\"ULTRASONIC\")、robot_read_sensor(\"INFRARED_ANALOG\")、robot_read_sensor(\"INFRARED_DIGITAL\")、robot_read_sensor(\"IMU_GYRO_Z\")、robot_read_sensor(\"IMU_ACCEL_X\")、robot_read_sensor(\"IMU_ACCEL_Y\") 等当前已配置传感器，辅助避障、纠偏和运动决策。",
    "传感器选择规则：如果场景上下文中某类传感器未启用或未配置，就不要把它当作主逻辑依赖；优先使用当前已启用且有最新读数的传感器。",
    "避障规则：除非用户明确要求碰撞或接触测试，否则生成的运动代码必须避开所有被障碍物占据的区域。",
    `安全间距规则：机器人本体与障碍物边界之间至少保留 ${ROBOT_SAFETY_RADIUS + 2} 的距离。`
  ].join("\n");

  return [
    {
      role: "system",
      content: [
        "你是一个面向机器人仿真平台的 C 代码助手。",
        "请返回一份可以在 PicoC 环境中运行的完整 C 源文件。",
        "代码必须包含 int main()。",
        "只能使用已提供的 robot_* API 和 printf，不要虚构新的 API。",
        "如果提供了场景上下文，就必须将其视为地图数据、机器人状态和传感器数值的唯一事实来源。",
        "这个仿真器是严格的二维仿真。不要虚构三维坐标、z 值、高度、海拔、深度、基于俯仰的移动方式或三维传感器。",
        "地图是二维地图。障碍物占据的是二维区域，而不是点。规划运动时必须尊重障碍物 AABB、多边形范围、圆形半径和栅格墙信息。",
        "当 map.kind 为 gridMap 时，优先基于 map.grid.startCell、map.grid.occupancy 和 mazeExit 的单元格信息进行栅格化推理。",
        "当 map.kind 为 lineTrack 时，优先基于提供的二维巡线信息生成跟线或与线相关的逻辑。",
        "如果当前场景已配置可用传感器，可以结合传感器读数降低碰撞概率，而不是只依赖静态地图。",
        "除非用户明确要求进行碰撞测试，否则生成的运动代码必须带安全余量地避开所有障碍物。",
        "只返回代码，不要添加解释，不要使用 Markdown 代码围栏。"
      ].join("\n")
    },
    {
      role: "user",
      content: [
        `碰撞与运动约束：\n${collisionGuidance}`,
        `需求：\n${String(requirement ?? "").trim()}`,
        `可用 API：\n${ROBOT_API_SPECS.join("\n")}`,
        `场景上下文：\n${mapContext}`,
        `当前代码：\n${codeContext}`,
        `当前错误：\n${errorContext}`,
        [
          "输出要求：",
          "1. 返回完整的 C 源文件，不要只返回片段。",
          "2. 如果当前代码已经接近正确，优先在当前代码基础上修改；否则重写完整文件。",
          "3. 如果使用了 printf，就保留 #include <stdio.h>。",
          "4. 读取传感器后，尽量通过 printf 或 robot_say 输出结果，方便用户观察。",
          "5. 代码保持简单、稳定、可运行。",
          "6. 严格按照场景上下文中描述的机器人结构和地图结构来写，不要虚构额外字段。",
          "7. 只为二维地图生成逻辑，不要虚构三维坐标、z 轴、高度、深度或不存在的地图字段。",
          "8. 如果 map.grid 存在，优先使用提供的栅格语义和起点，而不是假设地图是自由连续的空白平面。",
          "9. 如果当前场景已启用传感器，可以将传感器读数作为辅助信息来降低碰撞概率。"
        ].join("\n")
      ].join("\n\n")
    }
  ];
}

async function requestOllamaChat({ endpoint, model, messages, timeoutMs = 180000 }) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: DEFAULT_OLLAMA_OPTIONS
      }),
      signal: controller.signal
    });

    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const message =
        typeof payload === "string"
          ? payload
          : payload?.error ?? payload?.message ?? `Request failed: ${response.status}`;
      throw new Error(`Ollama request failed: ${message}`);
    }

    const content =
      (typeof payload === "object" && payload?.message?.content) ||
      (typeof payload === "object" && payload?.response) ||
      "";

    if (!String(content).trim()) {
      throw new Error("Ollama returned empty content.");
    }

    return {
      content: String(content),
      payload: typeof payload === "object" ? payload : null
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Ollama request timed out.");
    }

    if (error instanceof TypeError) {
      throw new Error("Unable to connect to Ollama.");
    }

    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

async function requestOpenAICompatibleChat({
  endpoint,
  model,
  apiKey,
  messages,
  timeoutMs = 180000
}) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const headers = {
      "Content-Type": "application/json"
    };

    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        ...DEFAULT_OPENAI_OPTIONS
      }),
      signal: controller.signal
    });

    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const message =
        typeof payload === "string"
          ? payload
          : payload?.error?.message ??
            payload?.error ??
            payload?.message ??
            `Request failed: ${response.status}`;
      throw new Error(`GPT request failed: ${message}`);
    }

    const content =
      (typeof payload === "object" && payload?.choices?.[0]?.message?.content) ||
      (typeof payload === "object" && payload?.choices?.[0]?.text) ||
      "";

    if (!String(content).trim()) {
      throw new Error("GPT endpoint returned empty content.");
    }

    return {
      content: String(content),
      payload: typeof payload === "object" ? payload : null
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("GPT request timed out.");
    }

    if (error instanceof TypeError) {
      throw new Error("Unable to connect to GPT endpoint.");
    }

    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

async function requestAiChat({
  provider = "ollama",
  endpoint,
  model,
  apiKey,
  messages,
  timeoutMs = 180000
}) {
  const normalizedEndpoint = String(endpoint ?? "").trim();
  const normalizedModel = String(model ?? "").trim();

  if (!normalizedEndpoint) {
    throw new Error(provider === "ollama" ? "Please configure the Ollama endpoint." : "Please configure the GPT endpoint.");
  }

  if (!normalizedModel) {
    throw new Error(provider === "ollama" ? "Please configure the Ollama model name." : "Please configure the GPT model name.");
  }

  if (provider === "openai" && !String(apiKey ?? "").trim()) {
    throw new Error("API key is required for GPT mode.");
  }

  if (provider === "openai") {
    return requestOpenAICompatibleChat({
      endpoint: normalizedEndpoint,
      model: normalizedModel,
      apiKey: String(apiKey ?? "").trim(),
      messages,
      timeoutMs
    });
  }

  return requestOllamaChat({
    endpoint: normalizedEndpoint,
    model: normalizedModel,
    messages,
    timeoutMs
  });
}

export async function generateRobotCode({
  provider = "ollama",
  endpoint,
  model,
  apiKey = "",
  requirement,
  currentCode,
  errors,
  sceneContext = null
}) {
  const firstPass = await requestAiChat({
    provider,
    endpoint,
    model,
    apiKey,
    messages: buildMessages({
      requirement,
      currentCode,
      errors,
      sceneContext
    })
  });

  const candidate = {
    raw: firstPass.content,
    code: normalizeGeneratedCode(extractCodeBlock(firstPass.content)),
    report: null
  };
  candidate.report = inspectGeneratedCode(candidate.code);

  if (!candidate.code) {
    throw new Error("AI returned empty code.");
  }

  return {
    raw: candidate.raw,
    code: candidate.code,
    issues: candidate.report.issues.slice(0, REVIEW_ISSUE_LIMIT),
    truncated:
      firstPass.payload?.done_reason === "length" ||
      firstPass.payload?.choices?.[0]?.finish_reason === "length"
  };
}
