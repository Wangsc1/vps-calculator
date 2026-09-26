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

## 本地运行

直接打开 `index.html`，或使用任意静态服务器：

```bash
python3 -m http.server 8080
```

## 部署

### GitHub Pages

仓库已配置 GitHub Pages，可从 `main` 分支根目录直接发布。

### Docker

```bash
docker run -d --name vps-calculator --restart unless-stopped \
  -p 8080:80 wangsc1/vps-calculator:latest
```

或使用 Docker Compose：

```bash
docker compose up -d
```

默认端口为 `8080`，可通过环境变量 `VPS_CALC_PORT` 修改。镜像支持 `linux/amd64` 和 `linux/arm64`。

本地构建：

```bash
docker build -t vps-calculator .
```

推送到 `main` 或打 `v*` 标签时，GitHub Actions 会自动构建镜像并推送到 Docker Hub（需在仓库 Secrets 中设置 `DOCKERHUB_USERNAME` 和 `DOCKERHUB_TOKEN`）。

## 许可

本项目采用 Apache License 2.0 授权，详见 [LICENSE](./LICENSE) 与 [NOTICE](./NOTICE)。
