# Box Manager - Gym/Fitness Studio Management Platform

## Overview
Multi-tenant gym management platform with role-based access (SUPER_ADMIN, BRANCH_ADMIN, CUSTOMER). Built with Express + Drizzle + React/wouter.

## Architecture
- **Frontend**: React + wouter + TanStack Query + shadcn/ui + Tailwind
- **Backend**: Express + passport-local + bcrypt + express-session
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Session-based with passport-local strategy

## Key Routes
- `/` - Login page (unauthenticated users)
- `/superadmin` - Super admin dashboard (SUPER_ADMIN only)
- `/dashboard` - Branch admin panel (BRANCH_ADMIN only)
- `/app/:slug` - Public branch page (anyone)
- `/blocked` - Shown when branch is suspended/blacklisted

## API Endpoints
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user + branch info
- `GET /api/branches` - List all branches (SUPER_ADMIN)
- `POST /api/branches` - Create branch (SUPER_ADMIN)
- `PATCH /api/branches/:id/status` - Update branch status (SUPER_ADMIN)
- `GET /api/public/branch/:slug` - Get public branch info

## Seed Data
- Super Admin: admin@boxmanager.com / admin123
- Branch Admin (Box Central): central@boxmanager.com / branch123
- Branch Admin (Box Norte): norte@boxmanager.com / branch123
- 3 branches: Box Central (active), Box Norte (active), Box Sur (suspended)

## Language
- UI is in Spanish (es-MX)
