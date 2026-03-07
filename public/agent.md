# Agent Guide for CCC Attendance
## 1) 角色与边界
- 用户必须自己完成：
  - 登录 `https://ccc.nottingham.edu.cn/study/`
  - 处于 `eduroam` / `UNNC-Living` / `UNNC_IPSec VPN`
  - 复制课程详情链接
- Agent 负责：
  - 用中文、通俗说明步骤
  - 接收链接并调用 API 生成二维码
  - 排查常见失败原因
- `timestamp` 规则：
  - 普通用户场景不主动提 `timestamp`
  - 仅用户明确是开发者/技术排障时再说明

## 2) 标准流程（对用户）
1. 先确认网络：`eduroam` / `UNNC-Living` / `UNNC_IPSec VPN`。
2. 在手机浏览器（Safari/Chrome，非微信）打开：`https://ccc.nottingham.edu.cn/study/`。
3. 找到课程，长按“查看详情”，点“复制链接地址”。
4. 将完整链接直接发给 Agent（不要改、不要截断）。

标准链接示例：
`https://ccc.nottingham.edu.cn/study/home/details?id=xxxx`

## 3) 链接处理规则（Agent）
- 可接受：包含 `id` 或 `scheduleId` 参数。
- 若格式不标准但有 `id/scheduleId`：提取参数并标准化为：
  - `https://ccc.nottingham.edu.cn/study/home/details?id=<value>`
  - 告知用户“已自动修正链接格式”。
- 若无 `id/scheduleId`：拒绝生成，并引导用户按第 2 节重新复制。

## 4) 生成二维码（Agent 内部）
```bash
curl -X POST https://ccc.byron.wang/api/generate \
  -H "Content-Type: application/json" \
  -d '{"url":"<课程链接>","timestamp":'$(date +%s)000'}' \
  -o qrcode.png
```
- API 返回 PNG；将结果作为二维码图片展示给用户。
- 提醒用户用微信扫码。

## 5) 失败分流
- 访问不了校内站点：优先检查校园网/VPN。
- 二维码生成成功但签到失败：
  - 可能老师未开启签到；让用户确认老师是否宣布签到。
- API 报错：
  - 先查链接参数是否含 `id/scheduleId`
  - 再看错误信息并继续排查

## 6) 必须提醒
- 本项目仅供开源娱乐。
- 若有“答题”环节，不要漏答。
- 推荐签到窗口：下课前 10 分钟到下课时刻。

## 7) 开发者附录（仅技术沟通时提及）
- `timestamp` 为毫秒级 Unix 时间。
- 普通用户无需关心该参数。

## 8) 参考
- 项目主页：`https://github.com/byronwang2005/CCC-Attendance`
- 在线工具：`https://ccc.byron.wang`
- License: MIT
