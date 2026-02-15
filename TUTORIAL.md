# Arthings — Deployment & Admin Tutorial

Complete guide to running Arthings locally, promoting an admin, and making it accessible from the internet.

---

## 1. Prerequisites

| Tool | Version | Link |
|---|---|---|
| **Node.js** | 18 + | [nodejs.org](https://nodejs.org) |
| **MariaDB** | 10.6 + | [mariadb.org](https://mariadb.org/download/) |
| **ngrok** (optional) | latest | [ngrok.com](https://ngrok.com) |

---

## 2. Install & Start

```bash
# 1. Install dependencies
npm install

# 2. Copy .env.example → .env and fill in your MariaDB credentials
#    (already done if you've been running locally)

# 3. Push schema to database (safe — never drops existing data)
npx prisma db push

# 4. Generate Prisma client
npx prisma generate

# 5. Start the server
npm start
```

The server starts on **http://localhost:3000** and binds to `0.0.0.0`, so it's already accessible on your LAN.

---

## 3. Promote an Admin

1. Open `.env` and set `ADMIN_EMAIL` to the email of an **already-registered** user:

   ```env
   ADMIN_EMAIL=your-email@example.com
   ```

2. Run the promote script:

   ```bash
   node prisma/promote-admin.js
   ```

3. Log out and log back in. You'll see an **⚙ Admin Panel** link in the user dropdown.

---

## 4. Admin Panel

Navigate to `/pages/admin.html` (or click **⚙ Admin Panel** in the navbar). The panel has four tabs:

| Tab | What it does |
|---|---|
| **Dashboard** | Stats overview — users, listings, active rentals, revenue |
| **Users** | Search, promote/demote admins, delete users |
| **Listings** | Search and delete any listing |
| **Rentals** | Filter by status, change rental status |

---

## 5. Temporary Public Domain (ngrok)

No domain purchase needed — ngrok gives you a free HTTPS URL.

### One-time setup

1. Sign up at [ngrok.com](https://ngrok.com) (free).
2. Download and install ngrok.
3. Add your auth token:

   ```bash
   ngrok config add-authtoken YOUR_TOKEN
   ```

### Expose your server

```bash
# In a separate terminal (keep the server running)
ngrok http 3000
```

ngrok outputs a URL like:
```
https://a1b2-123-45-67-89.ngrok-free.app
```

Share this URL — anyone can access your site from their phone or PC.

> **Note:** On the free tier the URL changes every restart. This is normal for dev/staging.

---

## 6. Access from Phone (LAN)

If you're on the same Wi-Fi, you don't need ngrok:

1. Find your PC's local IP:

   ```bash
   # Windows
   ipconfig
   # Look for "IPv4 Address", e.g. 192.168.1.100
   ```

2. Open `http://192.168.1.100:3000` on your phone's browser.

---

## 7. Keep the Server Running (PM2)

For always-on operation (even after closing the terminal):

```bash
# Install PM2 globally
npm install -g pm2

# Start Arthings with PM2
pm2 start server.js --name arthings

# Auto-start on boot
pm2 startup
pm2 save

# Useful commands
pm2 status          # Check if running
pm2 logs arthings   # View logs
pm2 restart arthings
pm2 stop arthings
```

---

## 8. Quick-Start Batch Script (Windows)

Create a file called `start-arthings.bat` in the project root:

```bat
@echo off
echo Starting Arthings...
cd /d "%~dp0"
start "Arthings Server" cmd /c "npm start"
timeout /t 3 >nul
start http://localhost:3000
echo Server is running. Close the other terminal to stop it.
```

Double-click the `.bat` file to start the server and open the browser.

---

## 9. Keeping Your Database Safe

- `npx prisma db push` **never drops data** — it only adds new columns/tables.
- Your existing users, listings, and rentals are always preserved.
- To back up your database:

  ```bash
  mysqldump -u root -p arthings > backup.sql
  ```

- To restore:

  ```bash
  mysql -u root -p arthings < backup.sql
  ```
