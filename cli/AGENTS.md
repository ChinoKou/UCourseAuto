# AGENTS.md

本文件中的每一条规则都是强制性的。违反任何一条规则都会遭受毁灭性打击：临时的、一次性的、命令行上的违反同样是违反；没被当场发现也算违反；出于好意、为了进度、为了帮忙的违反也是违反。

消息中每次提到 AGENTS.md，必须重新完整阅读一遍本文件，不允许以之前已经读过为理由省略。

本文件收录 cli 子项目的工程规范，与仓库根目录 AGENTS.md 的全局规则（语言规则、代码与文档约定、Git 约定、行为规则）同时有效。本文件中的相对路径均以本文件所在目录为准。

## 1. 项目概况与目录

UCourseAuto 是自动完成 优学院 平台课件的命令行工具，Python 3.12+（基线版本见 `.python-version`）。

- `main.py` — 启动器；入口逻辑在 `src/main.py`（`Main` 类，主菜单与管理器装配），也可用 `python -m src.main` 启动
- `src/logic/config.py` — 配置读写与迁移（`Config` 继承 `schema.ConfigModel`；`ucourse_data/ucourse_config.json` 明文保存，密码为明文；`config_version` 版本号与 `MIGRATIONS` 迁移升级钩子负责旧版根目录 yaml 配置的自动迁移）
- `src/utils/` — 工具包：interaction（用户交互辅助 answer）、crypto（sync 接口 DES/Base64 加解密 `sync_text_encrypt`/`sync_text_decrypt`）
- `src/apis/` — 优学院 平台 API 封装（login、course）
- `src/logic/` — 业务管理器：http_client、logger_manager、user_manager、version_manager、config_manager、data_manager、courseware_manager
- `src/schema/` — Pydantic 数据模型（api_request、api_response、config、course、courseware、common）
- `tests/` — pytest 回归测试
- 导入规范：所有 import 从子项目根开始（`from src.xxx import yyy`），同级模块之间同样如此
- 不入库：`ucourse_data/`

## 2. 分层与架构边界

1. `schema/` 只放 Pydantic 模型，被所有层引用，自身不导入 apis/logic。
2. `apis/` 只做 HTTP 调用与响应解析；`logic/` 编排业务流程并调用 `apis/`；`main.py` 装配入口。
3. `schema/` 模型的字段顺序即配置的遍历顺序（课程→教材→章节→节→页面），刷课按插入顺序执行。
4. 上报协议加密只由 `src/utils/crypto.py` 提供。改动解析、上报逻辑前必须依据真实 API 响应结构；禁止臆造字段取值、枚举匹配与防御分支，禁止随意变更 `schema/` 的字段类型与默认值。

## 3. 工具链（uv）

- 统一经 uv 管理环境与依赖，本节命令在本目录内执行：`uv sync` 同步环境，`uv run <命令>` 在项目环境中执行，不直接调用宿主 Python。
- 依赖增删一律 `uv add` / `uv remove`；`pyproject.toml` 与 `uv.lock` 由 uv CLI 维护，未经用户明确指示禁止手工编辑。
- `pyproject.toml` 的 `[tool.uv]` 索引配置为 aliyun 镜像优先、pypi 兜底（`index-strategy = "unsafe-best-match"`，ty 等新版本包仅存在于 pypi），不要删除或改动。
- `requirements.txt` 为手工维护的最小依赖清单（仅顶层运行依赖，版本下界与 `[project].dependencies` 一致），供传统 pip 用户；依赖变更时手动同步，不用 uv export 生成。
- 质量门，四项全部通过才算完成：

  ```bash
  uv run ruff check .
  uv run ruff format --check .
  uv run ty check
  uv run pytest
  ```

  ty 不带路径参数，检查范围由 `pyproject.toml` 的 `[tool.ty.src]` 定义。格式问题用 `uv run ruff format .` 修复。禁止删除测试、注释断言或放宽配置来让检查通过。`tests/` 没有用例时 pytest 报告 "no tests ran" 并以非零码退出，属于正常状态，不代表质量门失败。

## 4. 类型安全与逃逸口

类型检查器（ty）是发现设计问题的仪器，不是要绕过的关卡。质量门四项变绿不能单独作为完工证据。

1. ty 报错时只有两种合法反应：**修改设计**，或在**有真实类型证据的最小边界**使用逃逸口并登记理由。
2. 以下"表面工夫"一律属于缺陷，与逻辑错误同等对待：
   - 为过质量门把同一份事实复制到多个定义点，或抄第二份声明、第二份实现；
   - 用 `cast()`、`type: ignore[错误码]`、更宽的注解（`Any`、`object`、未参数化容器、可选化、宽 `Exception`）换取检查通过；
   - 把"根因在别处"的问题按调用点逐个枚举修正，而不是在上游收窄类型；
   - 用可空默认值把本可精确报错的失败面改写成"功能静默不工作"。
3. 禁止传播性 `Any`：新增与修改的代码中，公开函数、Pydantic 字段、dataclass 字段不得使用 `Any`、未参数化容器（裸 `list`、`dict`）、宽 `Callable`。存量代码不要求回溯整理，禁止为凑"零错误"做无边界的类型整理。
4. 逃逸口只能以行内 `# type: ignore[具体错误码]` 形式出现，并附一行中文理由；禁止文件级或全局关闭诊断。
5. ty 没有 basic/standard/strict 档位（那是 pyright 的概念）：默认规则等级即标准档，调整只能经 `pyproject.toml` 的 `[tool.ty.rules]` 按规则设置，禁止为通过检查调低等级。

## 5. 代码规范

1. 注释使用中文，术语与 identifier 保留英文；不要过度注释；不允许在文件最前面添加 docstring 或 shebang。
2. 禁止使用 try-except 进行 import。一个库如果需要，必须直接 import。
3. 日志使用 loguru，沿用既有 `[MANAGER][XXX]`、`[课程][xxx]` 风格的中文前缀。
