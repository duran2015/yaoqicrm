# 数据库恢复说明

`customer_profile_v2` 迁移(对齐正大天晴客融CRM 档案体系)为 additive 迁移,采用
`migrate diff` + `migrate deploy` 应用,未做 reset,未丢失任何现有数据。

迁移前请先备份:`prisma/dev.db.bak`。

## 回滚步骤

```bash
# 1. 停掉 dev server
# 2. 恢复备份
cp prisma/dev.db.bak prisma/dev.db
# 3. 恢复旧 schema(如需要)
git checkout -- prisma/schema.prisma
npx prisma generate
# 4. 删除迁移记录目录(如需彻底回到迁移前状态)
rm -rf prisma/migrations/*_customer_profile_v2
```

注意:`enrich:v2` 写入的扩展数据(教育经历/银行账户/科室/进院产品/国考成绩/
分级历史/客户分配/建档申请)在回滚到旧库后会随之消失,这是预期行为。
