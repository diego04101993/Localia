# Box Manager - Gym/Fitness Studio Management Platform

## Overview
Box Manager is a multi-tenant gym and fitness studio management platform designed to streamline operations for various fitness businesses. It supports role-based access for SUPER_ADMIN, BRANCH_ADMIN, and CUSTOMER roles. The platform also includes a public marketplace directory to help users discover nearby businesses. The business vision is to provide a comprehensive, easy-to-use solution for fitness professionals to manage their establishments efficiently and expand their reach through a community marketplace.

## User Preferences
I prefer simple language. I want iterative development. Ask before making major changes. I prefer detailed explanations. Do not make changes to the `client/src/components` folder.

## System Architecture
The platform is built with a modern web stack:
- **Frontend**: React, wouter for routing, TanStack Query for data fetching, shadcn/ui and Tailwind CSS for a consistent and customizable UI/UX. The UI is localized in Spanish (es-MX).
- **Backend**: Express.js handles API requests, with `passport-local` and `bcrypt` for secure session-based authentication. `express-session` manages user sessions.
- **Database**: PostgreSQL is used as the primary data store, with Drizzle ORM for type-safe database interactions.
- **Authentication**: Session-based authentication using `passport-local` strategy, supporting different roles (SUPER_ADMIN, BRANCH_ADMIN, CUSTOMER).
- **Core Features**:
    - **Role-Based Access Control**: Differentiates functionalities and access levels for Super Admins, Branch Admins, and Customers.
    - **Multi-tenancy**: Each branch operates as an independent tenant within the system.
    - **Branch Management (Super Admin)**: Tools for creating, managing status (active, suspended, blacklisted), and soft-deleting branches. Includes admin user management (create, edit, reset passwords), impersonation capabilities for support, and audit logging.
    - **Branch Admin Dashboard**: Comprehensive dashboard with tabs for:
        - **Summary**: Key branch metrics, status, and public URL.
        - **Clients**: Client list management, creation with credentials, attendance tracking, and client profile viewing with notes.
        - **Memberships**: Multi-month billing cycle model with plan CRUD (create, edit, deactivate) and plan assignment. Plans support 1/3/6/12/custom month cycles (cycleMonths field). 1 month = 30 days.
        - **Bookings**: Weekly calendar view for class schedules, class CRUD, client booking, and booking status management. Capacity tracking is included.
        - **Content Management**: Public profile content management including photos (profile, facility), fixed posts (text, image/video), product catalogs, and training videos. Content is displayed on the public branch page.
        - **Perfil Público**: Dedicated tab for managing public-facing branch profile: basic info (description, category), gallery (up to 5 images), location (address, Google Maps URL), operating hours (Mon-Sun weekly schedule), services/products (with type: service|product, durationMinutes), and reviews summary (read-only).
        - **TV Mode**: A full-screen display for reception areas showing today's classes, attendance, and routines with auto-refresh.
    - **Public Marketplace**: An `/explore` route allows all users to search, filter by category, and find nearby branches.
    - **User Features**: Customers can join branches, mark favorites, and manage their memberships.
    - **Multi-Month Billing Cycles**: Plans support configurable cycle lengths via `cycleMonths` field (0, 1, 3, 6, 12, or custom). Duration = cycleMonths * 30 days. Classes and price are for the entire cycle, not per month. `paidAt`, `expiresAt`, `classesRemaining` dynamically managed. `planStatus` is computed at read time. Renewal resets the cycle. `cycleMonths=0` = "Pago por clase" drop-in (1 class, 1-day validity).
    - **Class Consumption Rules**: Classes deducted automatically based on booking outcome. Attended → -1 class. No-show (auto-reconciled after class ends) → -1 class. Late cancellation (< 3hrs before class) → -1 class. Early cancellation (>= 3hrs) → no deduction. Unlimited plans never deducted. Expired plans block "attended" marking. Cutoff constant: `DEFAULT_CANCEL_CUTOFF_MINUTES = 180` in routes.ts, overridable per branch via `cancelCutoffMinutes`.
    - **Status Management**: Branches can be `active`, `suspended` (admin sees banner, clients blocked), or `blacklisted` (all blocked).
    - **Alerts and Notifications**: Dashboard alerts for expiring memberships, inactive clients, zero-class clients, and upcoming birthdays (7-day window). Each alert card includes a WhatsApp button (wa.me) when client has a phone number, using customizable per-branch message templates.
    - **WhatsApp Templates**: Branch-level customizable WhatsApp message templates stored as JSONB (`whatsapp_templates` column on `branches`). Template types: `expired_membership`, `expiring_membership`, `no_classes`, `birthday_greeting`. Variables: `{firstName}`, `{fullName}`, `{branchName}`, `{expiresAt}`, `{classesRemaining}`, `{classesTotal}`. Editable in dashboard Resumen tab with live preview. Endpoints: `GET /api/branch/whatsapp-templates`, `PATCH /api/branch/whatsapp-templates`. Phone normalization: MX format (+52 prefix for 10-digit numbers).
    - **Plan Deactivation Impact**: When a plan is deactivated/deleted, all assigned clients are detached (`planId=null`) but history is preserved (`paidAt`, `expiresAt`, `classesRemaining` kept). A `planNameSnapshot` string stores the deleted plan's name. `planStatus="deleted"` is computed at read time. UI shows orange "Plan eliminado" badge and "Asignar nuevo plan" button. Assigning a new plan clears `planNameSnapshot`.
    - **Customer Self-Booking (PWA)**: Logged-in customers see an "Agenda" section on `/app/:slug` with a 7-day strip, class cards showing spots left (X/Y), Reservar/Cancelar buttons, and a "Mis reservas" section with upcoming confirmed bookings. Booking validates plan expiry, classes remaining, and capacity. Cancellation respects cutoff. Endpoints: `GET /api/public/branch/:slug/schedule?date=`, `GET /api/public/branch/:slug/my-bookings?date=`, `GET /api/public/branch/:slug/my-upcoming-bookings`, `POST /api/public/branch/:slug/book`, `POST /api/public/branch/:slug/cancel-booking`.
    - **Public Branch Page**: `/app/:slug` displays announcements, membership actions, customer schedule, branch info (description, address, Google Maps link, operating hours, reviews summary), photo gallery, posts, services/products (separated by type), and videos.
    - **Reviews**: `branch_reviews` table stores user ratings and comments. Public endpoint: `GET /api/public/branch/:slug/reviews`. Admin endpoint: `GET /api/branch/reviews`. Read-only in admin dashboard.
    - **Data Export**: Ability to export client data to CSV.

## External Dependencies
- **PostgreSQL**: Relational database for all application data.
- **Multer**: Used for handling file uploads (e.g., client avatars, branch photos, media for posts) on the backend.
