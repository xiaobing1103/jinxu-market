# 金序 · 水贝行情

独立静态贵金属行情网站，由 GitHub Pages 托管，GitHub Actions 采集数据；不依赖原服务器。

在线访问：https://xiaobing1103.github.io/jinxu-market/

2026年11月27日迁移：导入8个日期文件，并合并切换前的最后快照。旧归档中的不完整JSON行已排除，原始归档备份保存在旧服务器及本机，未生成替代价格。旧行情服务已停用，原网址跳转到本网站。

## 数据更新

- Actions约每5分钟尝试抓取一次，调度、部署及缓存可能造成延迟，不保证实时性。
- 最新报价：`data/latest.json`。
- 真实历史：`data/archive/YYYY-MM-DD.jsonl`，包含从旧服务导入的存量记录。
- 工作树保留最近90天归档，网页提供最近1小时、24小时、7天走势。
- 每次成功采集均提交到Git。数据是公开的，不使用旧版会话或403保护。
- 源地址使用仓库的 `SOURCE_URL` Actions Secret，源码、页面及日志不包含源地址。
- 上游失败时保留并发布上次成功快照，网页显示实际采集时间和源报价时间。
- 网页每60秒检查静态文件更新，不代表每60秒获得新报价。

## 本地构建

Python 3.12，无额外依赖。已有数据时直接构建：

```sh
python scripts/build.py
python -m http.server 8080 --directory _site
```

需要抓取时，在环境变量中提供 `SOURCE_URL` 后执行 `python scripts/collect.py`。不要提交 `.env` 或任何密码。

## GitHub Pages

仓库Settings → Pages → Source选择GitHub Actions。仓库Settings → Secrets and variables → Actions配置`SOURCE_URL`，然后运行`Collect market data and deploy Pages`工作流。

所有归档时间戳为UTC毫秒，网页按北京时间显示。旧版每分钟实采数据保留原始时间；迁移后的样本采用新的采集间隔，不补造中间报价。

报价仅供参考，不构成投资建议。
