# Database Setup – MariaDB (local) & Vercel

This project uses **MySQL/MariaDB** with Prisma. You can use local MariaDB and a cloud MySQL database when deploying to Vercel.

---

## 1. Local: MariaDB (arthings)

Your MariaDB data directory: `C:\Program Files\MariaDB 12.1\data\arthings` → database name: **arthings**.

### 1.1 Ensure the database exists

In MariaDB (e.g. HeidiSQL or command line):

```sql
CREATE DATABASE IF NOT EXISTS arthings
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

### 1.2 Connection string in `.env`

Copy `.env.example` to `.env` and set:

```env
# Replace YOUR_PASSWORD with your MariaDB user password
# Default user is often 'root'
DATABASE_URL="mysql://root:YOUR_PASSWORD@localhost:3306/arthings"
```

If you use another user:

```env
DATABASE_URL="mysql://arthings_user:YOUR_PASSWORD@localhost:3306/arthings"
```

### 1.3 Apply schema and seed

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

---

## 2. Vercel: database when deployed

Vercel does not host MySQL; it offers Postgres (e.g. Vercel Postgres / Neon). This app uses **MySQL/MariaDB**, so you need an external MySQL-compatible host and set `DATABASE_URL` on Vercel.

### 2.1 Create a cloud MySQL database

Use one of:

- **PlanetScale** (free tier): https://planetscale.com  
- **Railway** (MySQL): https://railway.app  
- **Any MySQL/MariaDB host** (e.g. Aiven, ScaleGrid, your VPS)

Get the **MySQL connection string** (e.g. `mysql://user:pass@host:3306/dbname`).

### 2.2 Set `DATABASE_URL` on Vercel

1. Open your project on [Vercel Dashboard](https://vercel.com/dashboard).
2. **Settings** → **Environment Variables**.
3. Add:
   - **Name:** `DATABASE_URL`
   - **Value:** your cloud MySQL URL (same format as local).
4. Redeploy so the new variable is used.

### 2.3 First deploy: run migrations on the cloud DB

After the first deploy, run migrations against the **cloud** database (with `DATABASE_URL` pointing to it). Either:

- Temporarily set `DATABASE_URL` in your local `.env` to the cloud URL and run:
  - `npm run db:push`
  - `npm run db:seed`
- Or use your provider’s SQL console / CLI to run the same schema and seed logic.

---

## 3. Quick reference

| Environment | DATABASE_URL example |
|-------------|-----------------------|
| Local (MariaDB) | `mysql://root:PASSWORD@localhost:3306/arthings` |
| Vercel (cloud MySQL) | `mysql://user:PASSWORD@host:3306/dbname` (from PlanetScale, Railway, etc.) |

---

## 4. Useful commands

```bash
npm run db:generate   # Regenerate Prisma client
npm run db:push       # Push schema to DB (no data loss)
npm run db:seed       # Seed categories, cities, etc.
npm run db:studio     # Open Prisma Studio
```
