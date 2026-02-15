# Database Setup – PostgreSQL (Vercel + local)

This project uses **PostgreSQL** with Prisma. Sessions are stored in Postgres (persistent across serverless invocations).

---

## 1. Add database in Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard) → your project
2. Open the **Storage** tab
3. Click **Create Database**
4. Choose **Neon** or **Prisma Postgres** (Postgres providers)
5. Select region and plan → Create
6. Click **Connect to Project** and select your Arthings project

This adds `DATABASE_URL` to your project. Redeploy after connecting.

---

## 2. Apply schema and seed

The build runs `prisma db push` automatically. After the first deploy:

1. Get your `DATABASE_URL` from Vercel: **Settings** → **Environment Variables**
2. Copy it into your local `.env`
3. Run:
   ```bash
   npm run db:seed
   ```
   (This seeds categories and cities. Run once.)

---

## 3. Local development

Use the same Postgres `DATABASE_URL` (Neon / Prisma Postgres) in `.env` for local dev, or create a separate Neon project for local.

```bash
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

---

## 4. Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Postgres connection string (set by Vercel when you connect the DB) |
| `SESSION_SECRET` | Yes | Random string for sessions (set in Vercel env) |
| `ADMIN_EMAIL` | No | Email for admin account |

---

## 5. Useful commands

```bash
npm run db:generate   # Regenerate Prisma client
npm run db:push       # Push schema to DB (runs in vercel-build)
npm run db:seed       # Seed categories, cities (run once after first deploy)
npm run db:studio     # Open Prisma Studio
```
