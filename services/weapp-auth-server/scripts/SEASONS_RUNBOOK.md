# 活动期迁移与换届操作手册

这些命令只应在后端服务已停止、Nginx 已禁止活动写请求的维护窗口执行。生产数据目录、对象镜像和备份目录不得加入 Git。

## 首次迁移 2026 数据

1. 记录当前部署的 Git 提交，并确认 `users.json`、`submissions.json`、`future_cards.json`、`feedback.json` 与 `location-settings.json` 的实际路径。
2. 先预览迁移，不写入数据：

   ```bash
   npm run seasons:migrate
   ```

3. 核对报告中的账号、打卡、投稿、投票、积分和待办数量，再执行：

   ```bash
   npm run seasons:migrate -- --apply
   ```

迁移会创建 `data/seasons/`，原始 JSON 保持不变。重复执行只返回已有迁移报告；如果原始数据摘要发生变化，脚本会拒绝覆盖。

## 备份与恢复演练

1. 使用生产 COS 凭据导出完整对象镜像。目标目录必须不存在：

   ```bash
   npm run seasons:mirror -- --out /secure/backup/cos-mirror
   ```

2. 创建数据与对象联合备份：

   ```bash
   npm run seasons:backup -- backup --out /secure/backup/welcome-backup --media-dir /secure/backup/cos-mirror
   ```

3. 恢复到全新的隔离目录并记录演练凭证：

   ```bash
   npm run seasons:backup -- restore --from /secure/backup/welcome-backup --out /secure/restore-drill --record-proof
   ```

`--record-proof` 只在当前生产数据摘要与备份一致、全部文件及图片对象通过 SHA-256 校验时写入凭证。归档或切换当前活动期前，后端会再次检查该凭证。

## 结算、归档与开启下一届

1. 超管在“我的活动记录”页面创建下一届草稿，设置截止和公布时间，并核对地点、路线、积分、奖项及保留策略。
2. 通过 issue #59 的当届花名册和审批流程给账号写入不可由用户修改的 `participantSeasonId`，同时写入逐账号能力：`checkin`、`submit`、`vote`。普通账号只返回并访问这一届的数据；修改请求头或 URL 访问其他届会返回 `SEASON_NOT_VISIBLE`。账号不得重复绑定另一届，资格为空时开启活动会被拒绝。
   - 匹配活动范围内花名册的当级新生获得打卡、投稿和投票能力。
   - 名单外申请者经超管批准后只获得打卡能力。
   - 现有全部账号在首次迁移时统一认定为 2026 级参与者，绑定 `2026-welcome` 并保留三项能力。
   - 超管可在管理页向草稿活动导入 `.xlsx` 或 UTF-8 `.csv` 花名册。首行必须包含姓名、学号、入学年份、学院；后端完整校验成功后原子替换上一版，开放后的活动拒绝替换。
3. 将当前届切换到结算状态。此后禁止新打卡、投稿、投票和申诉，管理员仍可处理已有事项。
4. 清空全部待审核打卡、投稿和申诉。未处理数量不为零时，归档接口会拒绝操作。
5. 重新执行备份与隔离恢复演练，再由超管冻结结果并归档。
6. 超管逐一复核管理员账号。下一届只有在上一届已归档、恢复凭证有效、已导入参与资格且管理员名单全部确认后才能设为当前活动期。

每个状态变更都会进入活动期审计记录。服务使用 `writer.lock` 保证单实例写入；若进程异常退出，应先确认不存在其他后端进程，再人工移除旧锁文件。不要在多实例部署中共享此 JSON 数据目录。

## 保留策略预览

先更新完整对象镜像，再运行：

```bash
npm run seasons:retention -- --media-dir /secure/backup/cos-mirror
```

该命令只输出候选清单，不删除对象。仍被活动记录、反馈或未来寄语引用的对象始终受保护；保留期限为空时不会产生清理候选。实际删除必须另行审核并记录。

## 回滚

回滚必须同时使用备份清单中的代码版本、JSON 数据和 COS 对象。不要让不识别活动期的新旧代码交叉写入同一数据目录。恢复程序只接受一个不存在的新目录，因此生产切换应通过原子更换目录或挂载点完成，保留旧目录用于回退。
