<script setup>
const primaryGroups = [
  {
    title: "运动控制",
    description: "用于驱动仿真机器人移动、转向、停止和等待。",
    commands: [
      { signature: "void robot_reset(void);", summary: "重置机器人位置、朝向和运动状态。" },
      { signature: "void robot_move_forward(int distance, int speed);", summary: "向前移动，`distance` 为距离，`speed` 为速度。" },
      { signature: "void robot_move_backward(int distance, int speed);", summary: "向后移动，参数含义与前进一致。" },
      { signature: "void robot_turn_left(int angle, int speed);", summary: "向左转，`angle` 为角度，`speed` 为转向速度。" },
      { signature: "void robot_turn_right(int angle, int speed);", summary: "向右转，参数含义与左转一致。" },
      { signature: "void robot_wait(double seconds);", summary: "等待指定秒数，适合在动作之间插入停顿。" },
      { signature: "void robot_stop(void);", summary: "停止当前动作。" }
    ]
  },
  {
    title: "传感器读取",
    description: "用于读取仿真环境实时同步的传感器数值。",
    commands: [
      { signature: "int robot_read_distance(void);", summary: "读取机器人当前朝向到前方最近障碍物的距离，无遮挡时返回 `-1`。" },
      { signature: "double robot_read_temperature(void);", summary: "读取温度值。" },
      { signature: "int robot_read_light(void);", summary: "读取光照值。" },
      { signature: "int robot_read_battery(void);", summary: "读取电量百分比。" },
      { signature: "double robot_read_sensor(char *name);", summary: "按名称读取传感器或状态值。支持的名称如下：`DISTANCE` / `ULTRASONIC` / `ULTRASONIC_DISTANCE` 读取超声波前向距离，单位 cm，无遮挡或超量程时返回 `-1`；`LIGHT` / `INFRARED` / `INFRARED_ANALOG` 读取红外模拟量，返回红外强度；`INFRARED_DIGITAL` 读取红外数字量，返回 `0` 或 `1`；`IMU_GYRO_Z` 读取 IMU Z 轴角速度；`IMU_ACCEL_X` 读取 IMU X 轴加速度；`IMU_ACCEL_Y` 读取 IMU Y 轴加速度；`IMU_ROLL` 读取当前横滚/朝向角；`IMU_PITCH` 读取俯仰角；`TEMPERATURE` 读取温度；`BATTERY` 读取电量百分比。" }
    ]
  }
];

const outputGroup = {
  title: "交互输出",
  description: "用于把 C 程序执行过程输出到前端日志区域。",
  commands: [
    { signature: "void robot_say(char *message);", summary: "向页面调试输出区写入一条文本消息。" },
    { signature: "int printf(char *format, ...);", summary: "标准输出函数，输出会显示在 PicoC 调试日志区域。" }
  ]
};
</script>

<template>
  <section class="reference-page">
    <header class="panel reference-hero">
      <div>
        <p class="eyebrow">PicoC Reference</p>
        <h2>C 语言命令说明</h2>
        <p class="muted">
          这里说明编辑器中已经接入的机器人控制命令、传感器读取函数和日志输出方式。
        </p>
      </div>
      <div class="reference-badges">
        
        <span class="badge">运行环境：PicoC + WASM</span>
      </div>
    </header>

    <section class="reference-grid">
      <article
        v-for="group in primaryGroups"
        :key="group.title"
        class="panel reference-card"
      >
        <header class="mini-header">
          <h3>{{ group.title }}</h3>
        </header>
        <p class="muted">{{ group.description }}</p>
        <div class="reference-command-list">
          <div
            v-for="command in group.commands"
            :key="command.signature"
            class="reference-command"
          >
            <code>{{ command.signature }}</code>
            <p>{{ command.summary }}</p>
          </div>
        </div>
      </article>
    </section>

    <section class="reference-notes">
      <article class="panel reference-card">
        <header class="mini-header">
          <h3>{{ outputGroup.title }}</h3>
        </header>
        <p class="muted">{{ outputGroup.description }}</p>
        <div class="reference-command-list">
          <div
            v-for="command in outputGroup.commands"
            :key="command.signature"
            class="reference-command"
          >
            <code>{{ command.signature }}</code>
            <p>{{ command.summary }}</p>
          </div>
        </div>
      </article>

      <article class="panel reference-card">
        <header class="mini-header">
          <h3>使用规则</h3>
        </header>
        <div class="message-list">
          <div class="callout warning">
            <strong>1. `main()` 会自动执行</strong>
            <p>C 编辑器里的普通程序入口写法就是 `int main() { ... }`。</p>
          </div>

          <div class="callout warning">
            <strong>2. 当前支持 C 调试</strong>
            <p>当前 PicoC 模式支持断点、单步、变量监视和行级追踪，建议结合调试面板使用。</p>
          </div>
        </div>
      </article>
    </section>
  </section>
</template>
