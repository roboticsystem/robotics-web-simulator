// 提供一个简单的异步延时工具。
function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export class RobotBridge {
  // 初始化脚本执行层与仿真层之间的桥接对象。
  constructor({ getController, onLog }) {
    this.getController = getController;
    this.onLog = onLog;
    this.activeExecutionToken = 0;
    this.lastCancelReason = "";
  }

  // 获取当前可用的仿真控制器实例。
  get controller() {
    return this.getController?.() ?? null;
  }

  // 为一次新的执行流程分配活动令牌。
  beginExecution() {
    this.activeExecutionToken = Date.now() + Math.random();
    this.lastCancelReason = "";
    return this.activeExecutionToken;
  }

  // 在执行结束后清理当前活动令牌。
  completeExecution(token) {
    if (token && this.activeExecutionToken === token) {
      this.activeExecutionToken = 0;
      this.lastCancelReason = "";
    }
  }

  // 取消当前执行并通知仿真层停止动作。
  async cancelExecution(reason = "仿真已重置，当前运行已停止。") {
    this.lastCancelReason = reason;
    this.activeExecutionToken = 0;

    if (this.controller?.stopMotion) {
      await this.controller.stopMotion(reason);
    }
  }

  // 校验当前动作是否仍属于有效执行会话。
  ensureExecutionActive(token) {
    if (!token || token !== this.activeExecutionToken) {
      throw new Error(this.lastCancelReason || "当前运行已停止。");
    }
  }

  // 转发前进或后退动作到仿真控制器。
  async move(direction, distance, speed) {
    const token = this.activeExecutionToken;
    this.ensureExecutionActive(token);

    if (!this.controller?.animateMove) {
      await delay(100);
      this.ensureExecutionActive(token);
      return;
    }

    await this.controller.animateMove(direction, distance, speed);
    this.ensureExecutionActive(token);
  }

  // 转发转向动作到仿真控制器。
  async turn(direction, angle, speed) {
    const token = this.activeExecutionToken;
    this.ensureExecutionActive(token);

    if (!this.controller?.animateTurn) {
      await delay(100);
      this.ensureExecutionActive(token);
      return;
    }

    await this.controller.animateTurn(direction, angle, speed);
    this.ensureExecutionActive(token);
  }

  // 在桥接层统一处理等待动作。
  async wait(seconds) {
    const token = this.activeExecutionToken;
    this.ensureExecutionActive(token);

    if (!this.controller?.wait) {
      await delay(seconds * 1000);
      this.ensureExecutionActive(token);
      return;
    }

    await this.controller.wait(seconds);
    this.ensureExecutionActive(token);
  }

  // 请求仿真层立即停止当前运动。
  async stop() {
    const token = this.activeExecutionToken;
    this.ensureExecutionActive(token);

    if (this.controller?.stopMotion) {
      await this.controller.stopMotion();
    }

    this.ensureExecutionActive(token);
  }

  // 请求仿真层把机器人恢复到初始状态。
  async reset() {
    const token = this.activeExecutionToken;
    this.ensureExecutionActive(token);

    if (this.controller?.resetRobot) {
      await this.controller.resetRobot();
    }

    this.ensureExecutionActive(token);
  }

  // 读取当前仿真环境中的传感器值。
  readSensor(sensor) {
    const token = this.activeExecutionToken;
    this.ensureExecutionActive(token);

    if (!this.controller?.readSensor) {
      return 0;
    }

    return this.controller.readSensor(sensor);
  }

  // 把脚本输出消息转发到前端日志区。
  say(message) {
    this.ensureExecutionActive(this.activeExecutionToken);
    this.onLog?.(message);
  }

  // 挂载供 PicoC 调用的全局宿主桥接接口。
  attachHostBridge(globalScope = window) {
    globalScope.robotHostBridge = {
      moveForward: async (distance, speed) => this.move("FORWARD", distance, speed),
      moveBackward: async (distance, speed) => this.move("BACKWARD", distance, speed),
      turnLeft: async (angle, speed) => this.turn("LEFT", angle, speed),
      turnRight: async (angle, speed) => this.turn("RIGHT", angle, speed),
      waitSeconds: async (seconds) => this.wait(seconds),
      stop: async () => this.stop(),
      readSensor: (sensor) => this.readSensor(sensor),
      say: (message) => this.say(message),
      reset: async () => this.reset()
    };
  }
}
