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
- `/blocked` - Shown when branch is blacklisted (blocked login)

## API Endpoints
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user + branch info + impersonation state
- `GET /api/branches` - List all branches (SUPER_ADMIN), ?include_deleted=true for soft-deleted
- `POST /api/branches` - Create branch with optional admin (SUPER_ADMIN)
- `PATCH /api/branches/:id/status` - Update branch status (SUPER_ADMIN)
- `DELETE /api/superadmin/branches/:id` - Soft delete branch (SUPER_ADMIN)
- `GET /api/superadmin/branches/:id/admin` - Get branch admin info (SUPER_ADMIN)
- `PATCH /api/superadmin/branches/:id/admin` - Update admin name/email or reassign (SUPER_ADMIN)
- `POST /api/superadmin/branches/:id/admin` - Create new admin for branch (SUPER_ADMIN)
- `POST /api/superadmin/branches/:id/reset-admin-password` - Reset admin password (SUPER_ADMIN)
- `GET /api/superadmin/branches/metrics` - Branch membership metrics (SUPER_ADMIN)
- `GET /api/superadmin/branches/:id/welcome-package` - Get welcome package info (SUPER_ADMIN)
- `GET /api/superadmin/branches/:id/stats` - Per-branch stats (SUPER_ADMIN)
- `GET /api/branch/stats` - Dashboard branch stats (BRANCH_ADMIN, authenticated)
- `GET /api/branch/clients` - List branch clients with membership + attendance info (BRANCH_ADMIN), ?include_left=true for soft-deleted
- `POST /api/branch/clients` - Create client (user + membership + optional extra fields) (BRANCH_ADMIN)
- `PATCH /api/branch/clients/:id` - Update client fields (name, lastName, phone, birthDate, gender, emergency, medical) (BRANCH_ADMIN)
- `DELETE /api/branch/clients/:id` - Soft delete client (membership status → "left") (BRANCH_ADMIN)
- `GET /api/branch/clients/:id` - Client profile with notes + attendances + emergency/medical info (BRANCH_ADMIN)
- `POST /api/branch/clients/:id/notes` - Add internal note (BRANCH_ADMIN)
- `POST /api/branch/clients/:id/attendance` - Register attendance (BRANCH_ADMIN)
- `POST /api/branch/clients/:id/avatar` - Upload client avatar photo (BRANCH_ADMIN, multer)
- `DELETE /api/branch/clients/:id/avatar` - Remove client avatar photo (BRANCH_ADMIN)
- `GET /api/branch/invite-link` - Get branch invite URL (BRANCH_ADMIN)
- `GET /api/branch/plans` - List branch membership plans (BRANCH_ADMIN)
- `POST /api/branch/plans` - Create membership plan (BRANCH_ADMIN)
- `PATCH /api/branch/plans/:id` - Update plan (BRANCH_ADMIN)
- `DELETE /api/branch/plans/:id` - Deactivate plan (BRANCH_ADMIN)
- `POST /api/branch/memberships/:id/assign-plan` - Assign plan to membership (BRANCH_ADMIN)
- `DELETE /api/branch/memberships/:id/plan` - Remove plan from membership (BRANCH_ADMIN)
- `GET /api/branch/reservations/stats` - Today's booking count + next booking (BRANCH_ADMIN)
- `GET /api/branch/classes` - List class schedules (BRANCH_ADMIN)
- `POST /api/branch/classes` - Create class schedule (BRANCH_ADMIN)
- `PATCH /api/branch/classes/:id` - Update class (BRANCH_ADMIN)
- `DELETE /api/branch/classes/:id` - Deactivate class (BRANCH_ADMIN)
- `GET /api/branch/bookings?date=` - Get bookings for date (BRANCH_ADMIN)
- `GET /api/branch/bookings/class/:classId?date=` - Get bookings for specific class+date (BRANCH_ADMIN)
- `POST /api/branch/bookings` - Create booking {classScheduleId, userId, bookingDate} (BRANCH_ADMIN)
- `PATCH /api/branch/bookings/:id/status` - Update booking status (BRANCH_ADMIN)
- `POST /api/superadmin/impersonate` - Start impersonation {branchId} (SUPER_ADMIN)
- `POST /api/superadmin/impersonate/end` - End impersonation (authenticated)
- `GET /api/superadmin/audit` - Audit logs (SUPER_ADMIN)
- `GET /api/branch/tv-data?date=` - TV mode data: today's classes with bookings + routines (BRANCH_ADMIN)
- `PATCH /api/branch/classes/:id/routine` - Update class routine {routineDescription, routineImageUrl} (BRANCH_ADMIN)
- `GET /api/branch/clients/export` - Export clients to CSV (BRANCH_ADMIN)
- `GET /api/branch/alerts` - Expiring memberships + inactive clients alerts (BRANCH_ADMIN)
- `GET /api/branch/announcements` - List branch announcements (BRANCH_ADMIN)
- `POST /api/branch/announcements` - Create announcement {message} (BRANCH_ADMIN)
- `DELETE /api/branch/announcements/:id` - Delete announcement (BRANCH_ADMIN)
- `GET /api/public/branch/:slug/announcements` - Active announcements (public)
- `POST /api/branch/classes/copy-week` - Copy schedules between days {fromDay, toDay} (BRANCH_ADMIN)
- `POST /api/branch/upload` - Upload file (image/video), returns {url} (BRANCH_ADMIN)
- `GET /api/branch/photos` - List branch photos (BRANCH_ADMIN)
- `POST /api/branch/photos` - Add photo {type, url} (BRANCH_ADMIN)
- `DELETE /api/branch/photos/:id` - Delete photo (BRANCH_ADMIN)
- `POST /api/branch/photos/reorder` - Reorder photos {ids[]} (BRANCH_ADMIN)
- `GET /api/branch/posts` - List branch posts (BRANCH_ADMIN)
- `POST /api/branch/posts` - Create post {title, content, mediaUrl?, mediaType?} (BRANCH_ADMIN)
- `PATCH /api/branch/posts/:id` - Update post (BRANCH_ADMIN)
- `DELETE /api/branch/posts/:id` - Delete post (BRANCH_ADMIN)
- `POST /api/branch/posts/reorder` - Reorder posts {ids[]} (BRANCH_ADMIN)
- `GET /api/branch/products` - List branch products (BRANCH_ADMIN)
- `POST /api/branch/products` - Create product {name, price, description?, imageUrl?} (BRANCH_ADMIN)
- `PATCH /api/branch/products/:id` - Update product (BRANCH_ADMIN)
- `DELETE /api/branch/products/:id` - Delete product (BRANCH_ADMIN)
- `POST /api/branch/products/reorder` - Reorder products {ids[]} (BRANCH_ADMIN)
- `GET /api/branch/videos` - List branch videos (BRANCH_ADMIN)
- `POST /api/branch/videos` - Add video {url, title?} (BRANCH_ADMIN)
- `DELETE /api/branch/videos/:id` - Delete video (BRANCH_ADMIN)
- `POST /api/branch/videos/reorder` - Reorder videos {ids[]} (BRANCH_ADMIN)
- `GET /api/public/branch/:slug/content` - Get all public content (photos, posts, products, videos)
- `GET /api/public/branch/:slug` - Get public branch info
- `GET /api/branches/nearby?q=&category=&lat=&lng=&radius_km=` - Search/filter branches (public)
- `GET /api/memberships` - Get user memberships with branch info (authenticated)
- `POST /api/memberships/join` - Join a branch {branchSlug or branchId} (authenticated)
- `POST /api/memberships/favorite` - Toggle favorite {branchId, isFavorite} (authenticated)

## Database Schema
- **users**: id, email, passwordHash, role (SUPER_ADMIN/BRANCH_ADMIN/CUSTOMER), branchId, name, phone, lastName, birthDate, gender, emergencyContactName, emergencyContactPhone, medicalNotes
- **branches**: id, name, slug, status, category, subcategory, latitude, longitude, city, address, coverImageUrl, description, deletedAt
- **memberships**: id, userId, branchId, status (active/banned/left), isFavorite, joinedAt, lastSeenAt, source (invite/self_join/admin_created), planId, classesRemaining, expiresAt
- **membership_plans**: id, branchId, name, description, price (integer cents), durationDays, classLimit, isActive, createdAt
- **class_schedules**: id, branchId, name, description, dayOfWeek, startTime, endTime, capacity, instructorName, isActive, createdAt
- **class_bookings**: id, classScheduleId, branchId, userId, bookingDate, status (confirmed/cancelled/attended), createdAt
- **audit_logs**: id, actorUserId, action, branchId, metadata (jsonb), createdAt
- **client_notes**: id, branchId, userId, content, createdBy, createdAt
- **attendances**: id, branchId, userId, checkedInAt, registeredBy
- **branch_photos**: id, branchId, type (profile/facility), url, displayOrder, createdAt
- **branch_posts**: id, branchId, title, content, mediaUrl, mediaType (image/video), displayOrder, createdAt
- **branch_products**: id, branchId, name, description, price (integer cents), imageUrl, displayOrder, isActive, createdAt
- **branch_videos**: id, branchId, title, url, thumbnailUrl, displayOrder, createdAt
- **branch_announcements**: id, branchId, message, isActive, createdAt

## Branch Status Rules
- **Activa (active)**: Todo funciona normalmente
- **Suspendida (suspended)**: Admin puede entrar al dashboard pero ve banner "Pago pendiente". Clientes ven pantalla de bloqueo.
- **Bloqueada (blacklisted)**: No permite login, muestra pantalla de bloqueo para todos.

## Super Admin Features
- Dashboard with branch metrics (total, active, customers, memberships)
- Branch management: create with optional admin, status updates, soft delete
- Admin management: view, edit name/email, create, reset password, reassign
- Admin email shown on each branch card for quick visibility
- Impersonation: temporarily act as branch admin (15-min sessions, amber banner)
- Audit logging: all admin actions tracked with actor, action, metadata
- Welcome package: credentials modal with URLs, copy/download options
- Resend welcome package: regenerate modal with URLs + admin email (no password change)
- Search and filter branches, show/hide deleted

## Branch Admin Dashboard (Fases 1-7 completadas)
- Tab navigation with 6 sections: Resumen, Clientes, Membresías, Reservas, Contenido, TV Mode
- Resumen tab: real counts (active clients, active memberships, today's reservations, next booking), branch status with description, public URL link
- Clientes tab (Fase 2): client list with search/filter, create client dialog with credentials, invite link dialog, client profile modal with notes, attendance registration, membership info
- Component file: client/src/components/clientes-tab.tsx
- Membresías tab (Fase 3): plan CRUD (create/edit/deactivate/reactivate), plan cards with price/duration/classLimit, assign plan to clients from profile dialog, auto-decrement classes on attendance, remove plan
- Reservas tab (Fase 4): weekly calendar view with class schedule, day detail with bookings, class CRUD (create/edit/deactivate/reactivate), book clients into classes, booking status management (confirmed/attended/cancelled), capacity tracking
- Contenido tab (Fase 5): manage public profile content — profile photo (1), facility photos (max 5), fixed posts (max 3, text + image/video), products catalog (unlimited), training videos. File upload via multer. Reorder with ↑↓ buttons. All content shown on public page /app/:slug.
- TV Mode tab (Fase 6): full-screen TV/monitor view for reception — today's classes by hour, student list with attendance status (attended/pending/cancelled), routine per class (text + optional image), date navigation, auto-refresh every 30s, fullscreen browser API button
- Fase 7 Extras: announcements (create/delete, max 1 active, banner on public page), export clients CSV, alerts (expiring memberships + inactive 30d clients in Resumen), copy weekly schedules between days
- StatusBadge component reused in header and summary with unique testIds
- Preserves: suspended banner, impersonation banner, theme toggle, logout
- Component file: client/src/components/clientes-tab.tsx
- Component file: client/src/components/membresias-tab.tsx
- Component file: client/src/components/reservas-tab.tsx
- Component file: client/src/components/contenido-tab.tsx

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
