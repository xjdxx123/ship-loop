# ship-loop（中文简介）

**一条命令，从模糊想法（或一份 PRD）到可商业化的成品。**

一个 Claude Code 插件，实现真正的 loop engineering：人工密集的设计阶段把意图冻结成文档，
然后自治循环负责实现、**自己发现 bug**、修复、对抗式验收、直至交付 - 提供了 API keys
就真实部署上线。完整文档见 [README.md](README.md)（英文）。

## 现状：它用自己造了自己（v0.3.0）

本插件的参考运行就是这个仓库：v0.3.0 由 ship-loop 在 ship-loop 上构建——冻结文档、
冻结门、8 个自治回合，**16/16 features 通过，其中 7 个是 evaluator 实测中自主发现的**
（活清单膨胀 78%）。合同谈判在写码前抓出真 bug；evaluator 抓出会让预算闸对最贵会话
失明的 fail-open。凭证而非口号：[运行实录](stories/2026-06-10-v0.3.0-dogfood.md)
（含诚实部分：该次运行超出自己的 charter 预算 2 倍——预算闸正是这次运行造的，
来不及为它自己上膛）、全部 16 份[合同](docs/ship-loop/contracts/)与逐轮日志。
如实声明未实战路径：K=3 熔断与 3 票 panel 仅有 fixture 覆盖（16/16 全是一次通过），
首个外部产品运行应重点观察。

## 安装

```bash
/plugin marketplace add xjdxx123/ship-loop
/plugin install ship-loop@ship-loop
```

## 使用

| 命令 | 作用 |
|---|---|
| `/ship "<想法>"` | 从 0 到 1：分阶段设计问答 → 冻结四文档 → 自治构建 |
| `/ship path/to/PRD.md` | 已有 PRD：只针对文档缺口提问 |
| 在已有项目目录 `/ship` | MVP 精修：先审计现状，再问调整方向 |
| `/ship:status` | 进度、parked 项、预算 |
| `/ship:iterate [反馈清单]` | 对已交付产品发动新一轮：吐槽逐条复现成 bug 任务、只问增量、重新冻结、自治构建 |
| `/ship:pause` / `/ship:resume` | 干净暂停 / 断点续跑 |
| `/ship:operate` | 交付后的运营环（第一周只报告不动手） |
| `/ship:rollback <F-id> "<原因>"` | 回滚已交付 feature（pr 模式关 PR），重开为 `pending`，记录 learning |

## 首跑七步

1. 进一个空目录（或已有 repo，会先审计）跑 `/ship "<想法>"`；装完插件先重启会话让 Stop hook 上膛。
2. 分阶段答题，每份文档单独批：产品 → PRD；技术 → TECH_SPEC；品味 → DESIGN_SPEC
   （这份文件直接校准 evaluator 的审美，写得有态度）；运行参数 → BUILD_CHARTER。
3. 冻结门：看派生的任务清单 + 成本预估 + 权限自检（确认 auto-approval 已开），回复 **go**。
4. 走开。只有需要你时才有桌面通知（parked 项 / 预算暂停 / 空转 / 交付）；随时 `/ship:status`。
5. 整个 run 是文件不是聊天记录：冻结四文档、`feature_list.json`（活清单）、`contracts/`
   （逐 feature 的"done 定义"审计链）、`learnings.json`、`loop-run-log.md`、`NEEDS_HUMAN.md`。
6. 预算暂停时：`cost --transcript` 审账 → 改 charter 的 `token_budget_day`（charter 归你，
   loop 不许自己加预算）→ `rm docs/ship-loop/PAUSED` → `/ship:resume`。
7. 交付后：`/ship:operate` 周期巡检（首周只报告）、`/ship:iterate` 带反馈清单开下一轮、
   `/ship:rollback` 回滚单个 feature。

**预算校准要点**：闸门单位是**含缓存读的 transcript 总量**，比"输出 tokens"直觉大一个
数量级（构建 v0.3.0 的 12 小时会话实测 187.8M）。先正常跑一次、用 `cost --transcript`
实测、预算设健康会话的 2-3 倍；模板默认值是占位符不是推荐值。

## 核心机制

1. **活的 feature 清单**：evaluator 真实操作应用（真浏览器、真命令），发现的每个 bug
   都变成新任务 - 循环自己生成自己的 backlog。
2. **合同谈判**：写代码之前，实现者和验收者先在磁盘文件上谈判"done 的定义"，验收按
   谈出来的合同打分，不按任何一方的私下理解。
3. **对抗式验收 + 证据规则**：没有亲自执行命令（`commandsRun` + 输出摘录）的判决在
   结构上无效；写代码的永远不给自己打分；验收者默认立场是拒绝。
4. **确定性闸门**：脚本型 Stop hook 数 JSON 状态，没做完不许收工 - 裁判是脚本不是
   "感觉"。连续 3 次状态无变化则升级给人，防止空转。
5. **冻结文档**：PRD / TECH_SPEC / DESIGN_SPEC / BUILD_CHARTER 归人所有，循环只读；
   设计层冲突会回到你手里。**人拥有设计，机器拥有构建。**

## 自主进化（v0.2）

三层记忆、三种风险姿态：**L1 项目层**（跟 repo 走，本代码库的坑，自动）；**L2 全局档案**
（跟人走，`~/.claude/ship-loop/profile/`，栈/品味/工作习惯偏好——**提案制**：建议在下次
intake 时一句话确认，所有生效变更进 append-only 的 evolution.log）；**L3 社区层**（协议
只走人审 PR、永不自改；**playbooks/** 是 SKILL.md 格式的部署/支付等真实世界执行知识，
同一 provider 成功交付 ≥2 次后蒸馏成草稿，人审后发布）。回顾代理在每次交付后运行，读
的全是已有痕迹。局部永远压倒全局；loop 自身的协议也是设计，而设计归人。playbook 管线是
复利资产：每次验证过的交付都让下一次更便宜。

## 开发者信任包（v0.3）

把无人值守的循环交给你的 repo 和 token 预算之前，五个可以直接读源码核对的机制
（全部是已落地行为，不是愿景）：

1. **真实成本计量**：`scripts/ship-state.mjs` 的 `cost` 子命令逐条累加会话 transcript（JSONL）
   里的 token 用量（输入/输出/缓存读/缓存写/总计；分块读取，超过 V8 字符串上限的超长
   transcript 也能算）；Stop-hook 闸门用同一套累加对照 charter 的 `token_budget_day` 硬停——
   超预算即写 NEEDS_HUMAN.md、落 PAUSED 标记、通知一次、放行停止；预算行缺失或 transcript
   不可读则不执法，永不弄崩会话。
2. **通知**：`scripts/notify.sh`——桌面横幅（macOS osascript / Linux notify-send / stderr 兜底）
   加可选的 `SHIP_LOOP_WEBHOOK` JSON POST；每条新 NEEDS_HUMAN.md 行、预算暂停、空转、交付
   各通知一次；纯传输层，所有路径 exit 0，通知失败不拖垮调用方。
3. **PR 模式**：charter 写 `merge_strategy: pr` 后，通过验收的 feature 推成 `ship/<id>` 分支
   并开 PR，正文是 evaluator 判决（证据 + commandsRun 摘录，绝不是一句 LGTM）；合并权留给人
   （或 CI）；依赖项要等依赖的 PR `MERGED` 才放行。机制：skills/conductor/SKILL.md。
4. **回滚**：`/ship:rollback <F-id> "<原因>"` 回滚交付合并（`git revert -m 1`；pr 模式直接关
   PR），feature 重开为 `pending` 且 `--passes false`（依赖项不再视它为已满足），并记录
   learning；脏工作区拒绝执行、绝不猜 hash、绝不自动解决冲突。机制：commands/ship-rollback.md。
5. **权限预检**：无人值守最常见的死法是一个没人会点的权限弹窗（闸门保住会话，弹窗卡死工具
   调用）。三重缓解：冻结门要求确认 auto-approval 已开启才放 go；conductor 入场用一次无害的
   Bash 空操作探测会话是否会弹窗；headless/relay 腿自带 `--dangerously-skip-permissions`。
   机制：skills/design-intake/SKILL.md + skills/conductor/SKILL.md。

## 商业化边界（重要）

默认激进：`.env` 里有 keys 就真实部署、真建数据库、真跑测试支付、真配置 Stripe live。
唯一常设人工门：**执行真金白银的扣款**。成本预期请看英文 README 的 Cost honesty 一节
（同类 harness 实测约 $200 / 6 小时构建一个完整产品；小工具个位数美元）。
v0.3 起预算为实测而非估算：`ship-state.mjs cost` 从会话 transcript 累加真实 token 用量，
超过 charter 的 `token_budget_day` 即由 Stop-hook 闸门硬停。

MIT 协议。致谢名单见英文 README。
