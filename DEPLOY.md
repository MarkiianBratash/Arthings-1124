# Deploy Arthings to GitHub & Vercel

## Push to a new GitHub repository

1. **Create a new repository on GitHub**
   - Go to [github.com/new](https://github.com/new)
   - Name it (e.g. `arthings` or `DBAlpha`)
   - Do **not** add a README, .gitignore, or license (project already has them)
   - Create the repository

2. **Push this project to it** (run in a terminal where Git is installed):

   ```bash
   cd c:\Users\User\Desktop\DBAlpha

   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git add .
   git commit -m "Add MariaDB + Vercel support, database docs"
   git branch -M main
   git push -u origin main
   ```

   Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your GitHub username and repo name.

   If this repo already had a remote (e.g. `origin`), either:
   - Replace it: `git remote set-url origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git`
   - Or add a second remote: `git remote add github https://github.com/...` then `git push -u github main`

---

## Deploy to Vercel with a database

1. **Connect the GitHub repo to Vercel**
   - Go to [vercel.com](https://vercel.com) and sign in
   - **Add New** → **Project** → **Import** your GitHub repository
   - Leave build settings as default (Vercel will use `vercel.json`)

2. **Add environment variables**
   - In the Vercel project: **Settings** → **Environment Variables**
   - Add:
     - `DATABASE_URL` = your **cloud MySQL** connection string (PlanetScale, Railway, or any MySQL/MariaDB host)
     - `SESSION_SECRET` = a long random string for sessions
     - `ADMIN_EMAIL` = (optional) email for admin account

3. **Deploy**
   - **Deploy** (or push to `main` after the repo is connected to trigger a deploy)

4. **Apply schema to the production database**
   - Set `DATABASE_URL` in your local `.env` to the **same** cloud MySQL URL used on Vercel
   - Run:
     ```bash
     npm run db:push
     npm run db:seed
     ```
   - Then switch `.env` back to your local MariaDB URL if needed.

For full database setup (local MariaDB + cloud MySQL), see [DATABASE.md](DATABASE.md).
