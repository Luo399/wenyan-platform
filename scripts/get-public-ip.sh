#!/bin/bash
# 获取服务器公网 IP 脚本
# 使用方法：在宝塔终端执行 bash get-public-ip.sh

echo "=== 正在获取服务器公网 IP ==="
echo ""

# 方法 1: 通过阿里云元数据服务（如果是阿里云 ECS）
if command -v curl &> /dev/null; then
    IP1=$(curl -s --connect-timeout 3 http://100.100.100.200/latest/meta-data/eipv4 2>/dev/null)
    if [ -n "$IP1" ] && [[ "$IP1" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo "阿里云 ECS 公网 IP: $IP1"
    fi
fi

# 方法 2: 通过公共 IP 查询服务
if command -v curl &> /dev/null; then
    IP2=$(curl -s --connect-timeout 3 ifconfig.me 2>/dev/null)
    if [ -n "$IP2" ] && [[ "$IP2" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo "公网 IP (ifconfig.me): $IP2"
    fi
fi

# 方法 3: 备用查询
if command -v curl &> /dev/null; then
    IP3=$(curl -s --connect-timeout 3 ip.sb 2>/dev/null)
    if [ -n "$IP3" ] && [[ "$IP3" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo "公网 IP (ip.sb): $IP3"
    fi
fi

# 方法 4: wget 备用
if command -v wget &> /dev/null; then
    IP4=$(wget -qO- --timeout=3 ipinfo.io/ip 2>/dev/null)
    if [ -n "$IP4" ] && [[ "$IP4" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo "公网 IP (ipinfo.io): $IP4"
    fi
fi

echo ""
echo "=== 请使用上面任意一个 IP 地址 ==="