# VPS Value

一个纯前端、隐私友好的 VPS 剩余价值计算器。

## 功能

- 按续费金额、付款周期、交易日和到期日计算剩余价值
- 支持 USD、EUR、GBP、JPY、HKD、TWD、SGD、AUD、CAD、CNY
- 使用 [Frankfurter](https://www.frankfurter.app/) 自动获取汇率，也可手动输入
- 自动计算日均/月均成本、使用价值、溢价与售出价格
- 深色/浅色模式、响应式移动端布局
- 本地保存、复制 Markdown 结果、导出 PNG 卡片（同时复制 Markdown 链接）
- 纯静态页面，无服务器、无跟踪、无数据上传

## Docker 部署

```bash
docker run -d --name vps-calculator --restart unless-stopped \
  -p 20100:80 wangsc1/vps-calculator:latest
```

或使用 Docker Compose：

```bash
docker compose up -d
```

默认端口为 `20100`，可通过环境变量 `VPS_CALC_PORT` 修改。镜像支持 `linux/amd64` 和 `linux/arm64`。

本地构建：

```bash
docker build -t vps-calculator .
```

## 许可

本项目采用 Apache License 2.0 授权，详见 [LICENSE](./LICENSE) 与 [NOTICE](./NOTICE)。
