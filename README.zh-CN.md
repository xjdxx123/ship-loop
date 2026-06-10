# ship-loop（中文简介）

**一条命令，从模糊想法（或一份 PRD）到可商业化的成品。**

一个 Claude Code 插件，实现真正的 loop engineering：人工密集的设计阶段把意图冻结成文档，
然后自治循环负责实现、**自己发现 bug**、修复、对抗式验收、直至交付 - 提供了 API keys
就真实部署上线。完整文档见 [README.md](README.md)（英文）。

## 安装

```bash
/plugin marketplace add xjdxx123/ship-loop
/plugin install ship-loop
```

## 使用

| 命令 | 作用 |
|---|---|
| `/ship "<想法>"` | 从 0 到 1：分阶段设计问答 → 冻结四文档 → 自治构建 |
| `/ship path/to/PRD.md` | 已有 PRD：只针对文档缺口提问 |
| 在已有项目目录 `/ship` | MVP 精修：先审计现状，再问调整方向 |
| `/ship:status` | 进度、parked 项、预算 |
| `/ship:pause` / `/ship:resume` | 干净暂停 / 断点续跑 |
| `/ship:operate` | 交付后的运营环（第一周只报告不动手） |

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

## 商业化边界（重要）

默认激进：`.env` 里有 keys 就真实部署、真建数据库、真跑测试支付、真配置 Stripe live。
唯一常设人工门：**执行真金白银的扣款**。成本预期请看英文 README 的 Cost honesty 一节
（同类 harness 实测约 $200 / 6 小时构建一个完整产品；小工具个位数美元）。

MIT 协议。致谢名单见英文 README。
