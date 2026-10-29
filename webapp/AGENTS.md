# AGENTS.md

本文件收录 webapp 子项目的工程规范，与仓库根目录 AGENTS.md 的全局规则（语言规则、代码与文档约定、Git 约定、行为规则）同时有效。本文件中的相对路径均以本文件所在目录为准。

## 1. 项目概况与目录

webapp 是 UCourseAuto 的网页版子项目：纯静态网页（React 19 + TypeScript），部署于 Cloudflare Pages，功能与 cli 子项目对等。所有对 优学院 平台的请求由用户浏览器直连发出，无任何服务端参与。

界面由顶栏与核心内容区组成：顶栏左侧为品牌标识、GitHub 入口与一级菜单导航（工作台与课件库），右侧依次是运行状态、外观按钮与账号入口；首页只有刷课卡与课件库卡两张自适应卡片，占满顶栏以下的可用空间。刷课卡直接启动并承载运行动画，模式、冷却、逐类时长与检测开关全部在同一张卡上调整，设置不设独立页面；课件库卡展示五层课件树与实时进度；完整树编辑器支持任意层级勾选、半选与行级删除。错误与警告在右上角即时提示，需要排查的失败提供可复制的错误详情与 Issue 入口。支持浅色、深色与跟随系统三种外观；启动时先完成字体与登录态结算，再进入内容。

- `index.html` — 入口页面、内联启动画面与首屏主题脚本
- `src/main.tsx` — 挂载入口（字体、样式、静态启动画面淡出、装配根端口注入）
- `src/App.tsx` — 端口注入、主题、提示与全局动效降级的装配
- `src/styles/` — 样式按目录分组，`index.css` 只做导入：`tokens.css`（设计令牌）；`base/`（`reset` 重置、`utilities` 工具类、`brand` 品牌与头像、`feedback` 空状态与骨架）；`controls/`（`button`、`form`、`switch`、`badge`、`progress`、`tree`）；`shell/`（`topbar` 顶栏、`frame` 页面骨架、`card` 卡片、`boot` 启动画面）；`overlays/`（`dialog` 弹窗与抽屉、`toast` 提示条、`error-panel` 错误详情）；`features/` 下按界面分组：`auth/`、`account/`、`server/`、`dashboard/`（`home`、`run-console`、`run-console-live`、`run-settings`、`library-card`）、`library/`（`library`、`toolbar`、`wizard`）
- `src/schema/protocol/` — 按接口划分的 zod 协议模型（登录、课程列表、教材列表、教材目录、章内容、学习记录、题目答案、当前用户、上报体）
- `src/schema/domain/` — 域模型（课件树、课程与教材、配置、进度与检测阶段、站点）
- `src/schema/parse.ts` — 响应校验入口
- `src/net/` — fetch 封装（Authorization 注入、超时、重试）
- `src/crypto/` — sync 上报 DES 加解密，加密的唯一来源
- `src/apis/` — 优学院 平台接口封装（auth、course）与统一结果类型，只做请求与响应解析
- `src/logic/` — 纯函数规则：`courseware/`（树查找与删除、组装、统计）、`studyRecord/`（上报体构造、学习记录写回）
- `src/usecases/` — 业务动作：`ports.ts`（端口与观察者）、`signIn.ts`、`configureCourseware.ts`、`pruneCourseware.ts`、`runCourseware.ts`、`runLock.ts`
- `src/composition/` — 装配根，把平台接口与状态层绑定为端口
- `src/storage/` — localStorage 读写与迁移（键名与序列化集中于此）
- `src/state/` — zustand stores（configStore、runStore）
- `src/error/` — 错误与警告通道（结构化错误详情、右上角提示事件、复制与 Issue 文本）
- `src/ui/` — 组件与视图：`app/`（启动、外壳、hash 路由、端口上下文）、`auth/`、`account/`、`dashboard/`（刷课控制台、课件库卡片）、`library/`（树编辑器、配置向导）、`run/`（首页启动流程、卡内运行动画与设置、检测开关）、`common/`（基础控件、共用课件树、弹层与错误面板）、`theme/`（主题与右上角外观按钮）、`motion/`
- `tests/` — vitest 单元测试，业务动作的测试位于 `tests/usecases/`；`tests/fixtures/` 为真实响应样本与 cli 侧加密样本（个人字段已抹除）
- 导入规范：所有 import 经 `@/` 别名从子项目根开始（`import { xxx } from "@/apis/auth"`），同级模块之间同样如此
- 不入库：`node_modules/`、`dist/`

## 2. 分层与架构边界

依赖方向自上而下，`tests/architecture.test.ts` 扫描源码校验，违反时失败并给出行号。

| 来源 | 允许引用 |
| --- | --- |
| `ui/` | `usecases/`、`state/`、`logic/`、`schema/`、`error/`、`ui/` |
| `usecases/` | `apis/`、`logic/`、`schema/`、`error/`、`usecases/` |
| `composition/` | 全部内部模块 |
| `state/` | `logic/`、`storage/`、`schema/`、`error/`、`state/` |
| `apis/` | `net/`、`crypto/`、`schema/`、`apis/` |
| `logic/` | `schema/`、`logic/` |
| `storage/` | `schema/`、`error/`、`storage/` |
| `net/` | 无内部依赖 |
| `crypto/` | 无内部依赖 |
| `schema/` | 只允许 `schema/` |

1. `schema/` 只放 zod 模型与站点解析函数，被所有层引用，自身不导入 apis/logic/ui。
2. `apis/` 只做 HTTP 调用与响应解析，站点地址由调用方传入 `Site` 对象；重试与超时策略统一在 `net/`；失败以 `PlatformResult` 返回，不调用提示通道。
3. `logic/` 只放纯函数：课件树的查找与删除、目录与章内容组装、学习记录写回、上报体构造与统计。
4. `usecases/` 是配置、刷课、清理、登录四个业务阶段的编排点；平台调用、sleep、随机数、进度上报、停止检查、反刷课分段全部经端口注入，不引用状态层。
5. `composition/browser.ts` 是唯一同时引用状态层与访问层的模块，其余模块不得引用装配根。
6. `ui/` 不直接调用 `apis/`，一律经 `state/` 或 `usecases/` 触发；课件树的遍历顺序即刷课顺序，容器一律用数组。
7. 协议加密只由 `crypto/` 提供；禁止臆造字段取值与防御分支。
8. 站点模型集中在 `schema/domain/site.ts`：内置站点为固定引用值，自定义站点为 `custom:${id}`；账号的 `site` 字段保存引用值，展示或调用前经 `findSite` / `resolveSite` 解析。
9. `custom_sites` 只经 configStore 的新增、修改、删除动作写入；被账号引用的站点禁止删除。配置版本为 1；缺失版本号或版本号异常按损坏配置处理。
10. 课件树的所有权：`logic/` 与 `usecases/` 就地改写入参，入参必须是调用方自己的副本（`structuredClone(store.courses)`）；写入状态层统一走 `replaceCourseware`，由它在赋值前复制。immer 会冻结写入状态的对象，直接把工作树交出去会让后续写回与清理向只读对象赋值。

## 3. 工具链（bun + 脚手架）

- 项目初始化经脚手架完成（仓库根执行 `bun create vite webapp --template react-ts`）；脚手架生成的配置文件（tsconfig 三件套、oxlint 配置、`.gitignore`、vite 配置）保留原样，仅追加必要项（`@/` 路径别名、`strict: true`、`test` / `typecheck` 脚本）。
- 全部依赖的安装、增删、升级一律经 `bun add` / `bun remove` / `bun update`，`package.json` 与 `bun.lock` 由 Bun 维护，禁止手工编辑依赖项、禁止绕开包管理器放置依赖。本节命令在本目录内执行。
- 界面依赖：`@base-ui/react`（对话框、下拉、开关等无障碍原语）、`motion`（过渡与入场）、`virtua`（长列表）、`@tabler/icons-react`、`@fontsource-variable/manrope`、`@fontsource/ibm-plex-mono`。禁止再引入第二套组件库。
- 质量门，四项全部通过才算完成：

  ```bash
  bun run lint        # oxlint（脚手架自带）
  bun run typecheck   # tsc -b
  bun run test        # vitest run
  bun run build       # tsc -b && vite build（脚手架脚本原样）
  ```

  禁止删除测试、断言或放宽 oxlint / tsconfig 配置换取通过。`tests/` 没有用例时 vitest 报告 "no test files found" 并以非零码退出，属于正常状态，不代表质量门失败。

## 4. 类型安全与逃逸口

1. TypeScript 为核心语言：全部源码为 `.ts` / `.tsx`，禁止新增 `.js` 源文件；`strict: true`。
2. 新增代码禁止 `any`、非空断言（`!`）与未参数化容器类型（裸 `Array`、裸对象字面量类型）；公开函数与 zod 模型的类型经 TypeScript 类型与 `z.infer` 推导表达，不手写第二份。
3. 类型问题修改设计解决，逃逸口仅允许 `// oxlint-disable-next-line <规则>: 中文理由` 形式的最小行内登记，禁止文件级关闭规则。

## 5. 界面与动效

1. 设计令牌全部定义在 `src/styles/tokens.css`；组件与页面样式引用 CSS 变量，禁止在 TSX 中硬编码颜色、字体与阴影。样式按上表的分组落位，新页面在 `src/styles/features/` 下建目录并在 `src/styles/index.css` 登记导入；禁止把样式重新堆回单个文件，删除组件时同步删除其样式。
2. 主题由 `ThemeProvider` 维护，`data-theme` 写在文档根元素；首屏主题由 `index.html` 的内联脚本在样式加载前设置，避免闪烁。主题偏好键为 `ucourse_theme`，与配置存储分离。
3. 启动加载由 `AppRoot` 的 `BootScreen` 与 `index.html` 的静态启动画面共同承担：等待 `document.fonts.ready`、配置读取与登录态结算后再进入内容；禁止绕过这两个等待点直接显示页面。
4. 复杂交互原语统一使用 `@base-ui/react` 的 Dialog、Popover、Select、Switch；按钮、输入、复选框使用原生语义。触达目标不小于 44px。
5. 动效只改变 `transform` 与 `opacity`；弹簧与变体集中在 `src/ui/motion/presets.ts`。`MotionConfig reducedMotion="user"` 挂在应用入口，CSS 动画同时受 `prefers-reduced-motion` 降级。
6. 长列表（课件树）一律经 `virtua` 虚拟化；页面滚动容器保持固定高度，不手写窗口化。课件库、配置向导与首页课件库卡片的树共用 `src/ui/common/Tree.tsx` 的行结构，新增树界面必须复用这一组件。
7. 刷课没有独立运行页：开始、停止、实时进度与反刷课分段都在首页的刷课控制台内完成；执行流程由 `usecases/runCourseware.ts` 负责，界面不承载协议调用。
8. 课件树的编辑粒度覆盖课程、教材、章、节、页面五层：每层都有复选框，父级按后代页面数量呈现全选与半选；行尾删除按钮可以直接移除子树。禁止退回按节批量编辑的单一入口。
9. 进度、阶段变化与成功状态用动画和局部状态表达；错误与警告经 `src/error/report.ts` 上报，在右上角以提示条出现。
10. 需要复制的失败（接口异常、配置中断、刷课中断）使用 `ErrorOverlay`：必须展示接口、状态、时间与原始响应，提供复制错误与创建 Issue 两个动作。原始响应可能包含账号信息，提交前必须提示用户检查。
11. 站点选择固定由「下拉选择 + 管理按钮 + 站点弹层」组成；新增与编辑自定义站点必须填写名称、课程 API 地址、用户 API 地址，并给出地址预览与 http 地址提示。
12. 品牌图形只有一个来源 `public/favicon.svg`：站点图标、顶栏、登录页与启动画面都引用这个文件，网页内不得再内嵌另一份品牌 SVG。
13. 页面不设全局最大宽度，也不设页脚：顶栏与内容区按可用宽度铺满，首页两张卡片占满顶栏以下的全部空间。

## 6. 代码规范

1. 注释中文，术语与 identifier 保留英文；不要过度注释。
2. 禁止 try-catch 包裹 import；一个库如果需要，必须直接 import。
3. 界面状态一律订阅 store，禁止组件之间用事件文本或字符串匹配传递状态；业务阶段（如反刷课分段）经回调上报。
