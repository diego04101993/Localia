# Box Manager - Gym/Fitness Studio Management Platform

## Overview
Multi-tenant gym management platform with role-based access (SUPER_ADMIN, BRANCH_ADMIN, CUSTOMER). Built with Express + Drizzle + React/wouter. Includes a marketplace directory for discovering nearby businesses.

## Architecture
- **Frontend**: React + wouter + TanStack Query + shadcn/ui + Tailwind
- **Backend**: Express + passport-local + bcrypt + express-session
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Session-based with passport-local strategy

## Key Routes
- `/` - Login page (unauthenticated users)
- `/superadmin` - Super admin dashboard (SUPER_ADMIN only)
- `/dashboard` - Branch admin panel (BRANCH_ADMIN only)
- `/app/:slug` - Public branch page (anyone) with join/favorite for authenticated users
- `/explore` - Marketplace directory with search, category filters, nearby sort (public)
- `/favorites` - User favorites and memberships (CUSTOMER, authenticated)
- `/blocked` - Shown when branch is suspended/blacklisted

## API Endpoints
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user + branch info
- `GET /api/branches` - List all branches (SUPER_ADMIN)
- `POST /api/branches` - Create branch (SUPER_ADMIN)
- `PATCH /api/branches/:id/status` - Update branch status (SUPER_ADMIN)
- `GET /api/public/branch/:slug` - Get public branch info
- `GET /api/branches/nearby?q=&category=&lat=&lng=&radius_km=` - Search/filter branches (public)
- `GET /api/memberships` - Get user memberships with branch info (authenticated)
- `POST /api/memberships/join` - Join a branch {branchSlug or branchId} (authenticated)
- `POST /api/memberships/favorite` - Toggle favorite {branchId, isFavorite} (authenticated)

## Database Schema
- **users**: id, email, passwordHash, role (SUPER_ADMIN/BRANCH_ADMIN/CUSTOMER), branchId, name
- **branches**: id, name, slug, status, category, subcategory, latitude, longitude, city, address, coverImageUrl, description
- **memberships**: id, userId, branchId, status (active/banned/left), isFavorite, joinedAt, lastSeenAt, source (invite/self_join/admin_created)

## Branch Categories
box, gym, yoga, estetica, doctor, abogado, freelancer, otro

## Seed Data
- Super Admin: admin@boxmanager.com / admin123
- Branch Admin (Box Central): central@boxmanager.com / branch123
- Branch Admin (Box Norte): norte@boxmanager.com / branch123
- Customer: cliente@test.com / cliente123
- 8 branches across categories: Box Central, Box Norte, Box Sur (suspended), Estética Luz, Dr. Pérez, Bufete García, Yoga Zen Studio, Coworking Hub

## Language
- UI is in Spanish (es-MX)
