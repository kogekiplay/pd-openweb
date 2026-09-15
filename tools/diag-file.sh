#!/usr/bin/env bash
# 逐文件消化 strict 诊断时用的取数小工具。
#
# 用法:
#   NODE_OPTIONS=--max_old_space_size=8192 npx tsc -p tsconfig.strictprobe.json --noEmit \
#     2>&1 | grep 'error TS' > /tmp/strict.txt      # 先出一份全量
#   tools/diag-file.sh <文件路径> [错误码前缀]        # 再按文件看
#
# 把诊断按行号排好、每条右边贴上对应源码行 —— 决定「这个形参到底是什么」时
# 光看错误信息不够，必须同时看到那一行长什么样。
F="$1"; CODE="${2:-TS}"
grep -F "$F" /tmp/strict.txt | grep -E "error ${CODE}" | \
  sed -E 's#^([^(]+)\(([0-9]+),([0-9]+)\): error (TS[0-9]+): (.*)$#\2\t\4\t\5#' | \
  sort -n -k1 | awk -F'\t' -v f="$1" '
    {n=$1; code=$2; msg=$3;
     if (n != prev) { cmd="sed -n \"" n "p\" " f; cmd | getline src; close(cmd); prev=n }
     printf "%5s %-8s %-58.58s | %s\n", n, code, msg, substr(src,1,90) }'
