# 差一点 V10

微信小游戏版「差一点」，对齐 `差一点_V10_重构稳定版.html`。

## 相对 V7 的主要变化

- 首页改为卡片入口（每日 / 任务 / 排行 / 皮肤），取消底部导航
- 结算与暂停改为居中叠加卡片
- 皮肤影响背景色与圆环主题色
- 今日奖励改为手动领取（不可重复）
- 存档键：`v10_best` / `v10_bestCombo` / `v10_coins` / `v10_skin`

## 目录

```
├── docs
│   └── PRD.md              # 产品需求文档
├── game.js
├── game.json
├── js
│   ├── main.js             # 主逻辑与 UI
│   ├── render.js           # Canvas / 安全区 / 触控
│   ├── storage.js
│   ├── audio.js
│   ├── icons.js
│   └── tasks.js            # 每日 / 成就任务
├── images/icons/           # SVG 图标
└── 差一点_V10_重构稳定版.html
```

用微信开发者工具打开本目录即可预览。产品说明见 [docs/PRD.md](docs/PRD.md)。
