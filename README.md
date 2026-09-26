# VPS Value

一个纯前端、隐私友好的 VPS 剩余价值计算器。灵感来自 [verkyer/vps-jsq](https://github.com/verkyer/vps-jsq)，界面与代码为重新设计和实现。

## 功能

- 按续费金额、付款周期、交易日和到期日计算剩余价值
- 支持 USD、EUR、GBP、JPY、HKD、TWD、SGD、AUD、CAD、CNY
- 使用 [Frankfurter](https://www.frankfurter.app/) 自动获取汇率，也可手动输入
- 自动计算日均/月均成本、使用价值、溢价与建议售价
- 深色/浅色模式、响应式移动端布局
- 本地保存、分享链接、复制 Markdown、导出 PNG 卡片
- 纯静态页面，无服务器、无跟踪、无数据上传

## 本地运行

直接打开 `index.html`，或使用任意静态服务器：

```bash
python3 -m http.server 8080
```

## 部署

仓库已配置 GitHub Pages，可从 `main` 分支根目录直接发布。

## 致谢与许可

本项目参考了 [verkyer/vps-jsq](https://github.com/verkyer/vps-jsq) 的产品思路。原项目与本项目均按 Apache License 2.0 授权，详见 [LICENSE](./LICENSE) 与 [NOTICE](./NOTICE)。
