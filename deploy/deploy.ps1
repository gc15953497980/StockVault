# StockVault 部署脚本 (本地执行)
# 用法: .\deploy\deploy.ps1 -Server "root@你的服务器IP" -Domain "你的域名"

param(
    [Parameter(Mandatory=$true)]
    [string]$Server,          # 阿里云服务器地址，如 root@123.123.123.123

    [Parameter(Mandatory=$true)]
    [string]$Domain,          # 你的域名

    [string]$RemotePath = "/var/www/stockvault"   # 服务器部署路径
)

$ErrorActionPreference = "Stop"

Write-Host "=== 1. 构建项目 ===" -ForegroundColor Cyan
npm run build
if (-not $?) { Write-Host "构建失败!" -ForegroundColor Red; exit 1 }

Write-Host "`n=== 2. 更新 nginx 配置中的域名 ===" -ForegroundColor Cyan
$nginxConf = Get-Content ".\deploy\stockvault.nginx.conf" -Raw
$nginxConf = $nginxConf -replace 'your-domain.com', $Domain
$nginxConf | Set-Content ".\deploy\stockvault.nginx.conf.tmp" -Encoding UTF8
Move-Item -Force ".\deploy\stockvault.nginx.conf.tmp" ".\deploy\stockvault.nginx.conf"

Write-Host "`n=== 3. 上传文件到服务器 ===" -ForegroundColor Cyan
Write-Host "上传静态文件..."
scp -r dist/* "${Server}:${RemotePath}/"

Write-Host "上传 nginx 配置..."
scp deploy/stockvault.nginx.conf "${Server}:/etc/nginx/sites-available/stockvault"

Write-Host "`n=== 4. 服务器端配置 ===" -ForegroundColor Cyan
$remoteCmd = @"
echo '>>> 创建站点目录...'
mkdir -p $RemotePath

echo '>>> 检查 nginx...'
if ! command -v nginx &> /dev/null; then
    echo '安装 nginx...'
    apt update && apt install -y nginx
fi

echo '>>> 启用站点配置...'
ln -sf /etc/nginx/sites-available/stockvault /etc/nginx/sites-enabled/

echo '>>> 移除默认站点...'
rm -f /etc/nginx/sites-enabled/default

echo '>>> 测试 nginx 配置...'
nginx -t

echo '>>> 重载 nginx...'
systemctl reload nginx

echo '>>> 安装 HTTPS 证书 (Certbot)...'
if ! command -v certbot &> /dev/null; then
    apt install -y certbot python3-certbot-nginx
fi
certbot --nginx -d $Domain --non-interactive --agree-tos --email admin@$Domain

echo '>>> 检查/开启防火墙...'
ufw allow 80/tcp 2>/dev/null
ufw allow 443/tcp 2>/dev/null

echo '>>> 部署完成! 访问 https://$Domain'
"@

ssh $Server "bash -s" <<< $remoteCmd

Write-Host "`n=== 部署完成! ===" -ForegroundColor Green
Write-Host "访问地址: https://$Domain" -ForegroundColor Yellow
