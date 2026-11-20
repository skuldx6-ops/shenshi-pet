# 申时桌宠

蓝色闹钟桌宠，面向 macOS 与 Windows。与原 macOS 菜单栏版「申时」是两个独立项目。

## 当前功能

- 透明、置顶、可拖动的桌宠窗口（角色显示约 148 × 160 像素）；位置记忆；托盘可恢复隐藏的桌宠。
- 提醒气泡出现在桌宠旁边，拖动桌宠时跟随并自动避开屏幕边缘。
- 护眼（默认 40 分钟）、饮水（默认 60 分钟）、午饭（每天本地时间 11:30）和打卡（每天 09:00、18:00）。
- 自定义提醒：单次、每天、每周、每月；支持提前提醒、暂停、编辑和删除（最多 10 条）。
- 专注模式暂停定时提醒，退出后重新开始间隔计时。午饭提醒只有固定时间和提示文案，没有随机选餐功能。
- 设置页可选择“登录后自动启动”，默认关闭。
- 保留原版五个 WebP 提醒动图。三视图设定和桌宠正面素材见 `design/character` 与 `src/assets`。

应用须处于运行状态，定时提醒才会出现。睡眠后恢复时会按有限时间窗口补发近期提醒，不会集中弹出一整天的旧提醒。数据保存在本机应用 WebView 存储中。

## 项目结构

```text
design/character/       三视图与角色设计参考
src/assets/             桌宠和五个原版提醒动图
src/pet/                桌宠交互、拖动、位置记忆
src/reminders/          定时规则与跟随气泡
src/settings/           提醒及专注设置
src/shared/             多窗口定位
src-tauri/              Mac/Windows 原生窗口、托盘和打包
tests/                  定时规则测试
.github/workflows/      双平台构建
```

## 开发与构建

需要 Node.js 22、Rust 稳定版，以及 [Tauri 的平台依赖](https://v2.tauri.app/start/prerequisites/)。

```bash
npm ci
npm test
npm run tauri dev
npm run tauri build
```

GitHub Actions 在 Mac 与 Windows 分别构建安装包。未签名的 Mac 安装包可能受到 Gatekeeper 提示；正式分发前需配置 Apple 签名与公证。Windows 透明窗口和虚拟桌面行为仍需 Windows 实机验收。

## 素材说明

原版 WebP 动图来自现有「申时」项目。三视图和透明待机稿由内置图像生成工具依据原版角色与用户参考图制作。待机稿边缘仍有少量生成碎点，正式发布前需清理并补齐动作帧。
