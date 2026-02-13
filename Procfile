web: node dist/src/main
release: npm run prisma:generate && npx prisma migrate resolve --rolled-back 20260213094600_add_username_to_user 2>/dev/null; npx prisma migrate deploy && npx prisma db seed
