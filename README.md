# 🏥 NHF&RI Doctor's Duty Roster App

A production-ready Progressive Web App (PWA) for generating and managing doctor duty rosters at the National Heart Foundation Hospital and Research Institute.

## Features

- **Role-Based Authentication**: Master password (Dr. Alif) + rotating maker passwords for 3-month roster cycles
- **Smart Scheduling Algorithm**: Fair rotation, ward restrictions, Cath lab eligibility, OPD quotas, Friday-night caps, duty bank carry-over
- **Mobile-First Design**: Works beautifully on phones, tablets, and desktops
- **Offline Support**: PWA with service worker caching
- **Manual Editing**: Interactive grid to reassign any duty slot after generation
- **Bangladesh Holidays**: One-click loader for official BD public holidays
- **Export**: PDF, Excel (.xlsx), Word (.docx), and CSV
- **Backup & Restore**: Download a JSON backup and restore it later
- **Supabase Backend**: Cloud sync for maker passwords and roster history

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite 6 + TypeScript |
| Styling | Tailwind CSS v4 |
| State | Zustand (local) + TanStack Query (server) |
| Backend | Supabase (PostgreSQL + Auth) |
| Deploy | Vercel |

## Quick Start

```bash
# 1. Clone
git clone https://github.com/munim430-ai/Nhf-Rooster-App.git
cd Nhf-Rooster-App

# 2. Install
npm install

# 3. Create .env from example
cp .env.example .env
# Fill in your Supabase credentials

# 4. Run locally
npm run dev

# 5. Build for production
npm run build
```

## Supabase Setup

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Run the migration: `supabase/migrations/001_initial_schema.sql`
3. Copy your project URL and anon key to `.env`

## Deployment

```bash
# Push to GitHub (auto-deploys to Vercel)
git add .
git commit -m "Initial build"
git push origin main
```

## Master Password

`MediCat15@` — grants full access including maker password management.

## License

Private — NHF&RI Internal Use
