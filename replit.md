# SSOAP Toolbox

## Overview

SSOAP Toolbox is a professional-grade sanitary sewer overflow analysis and planning application. It provides tools for SWMM5 (Storm Water Management Model) simulation, RDII (Rainfall-Derived Infiltration and Inflow) analysis, hydrograph visualization, condition assessment, and SSO (Sanitary Sewer Overflow) event tracking. The application is designed for sanitary engineering workflows requiring clarity, efficiency, and enterprise-grade interfaces.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, using Vite as the build tool
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state management and caching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming (light/dark mode support)
- **Design System**: Carbon Design System-inspired, focusing on enterprise data clarity
- **Typography**: IBM Plex Sans (primary) and IBM Plex Mono (data/code display)

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful JSON API endpoints under `/api/*`
- **File Uploads**: Multer for handling SWMM input files (.inp, .rpt)
- **Build System**: esbuild for server bundling, Vite for client

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` contains all database table definitions
- **Migrations**: Drizzle Kit for database migrations (`drizzle-kit push`)
- **Current Storage**: In-memory storage implementation exists as fallback in `server/storage.ts`

### Key Data Models
- **Projects**: Container for sewer analysis projects with sewershed metadata
- **Simulations**: SWMM5 simulation runs with input files and output results
- **RDII Parameters**: RTK parameters for rainfall-derived infiltration analysis
- **Hydrographs**: Flow data for sewershed analysis
- **Condition Assessments**: Pipe condition evaluations
- **SSO Events**: Sanitary sewer overflow incident tracking

### Application Pages
- Dashboard: Overview statistics and recent activity
- Projects: Project management CRUD operations
- Simulation: SWMM5 file upload and simulation execution
- RDII Analysis: Rainfall-derived infiltration parameter management
- Hydrograph: Flow visualization with Recharts
- Condition Assessment: Pipe condition tracking
- SSO Events: Overflow event logging and analysis
- Settings: Theme configuration and system info

## External Dependencies

### Database
- **PostgreSQL**: Primary database, configured via `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe database queries and schema management

### UI Libraries
- **Radix UI**: Accessible, unstyled component primitives (dialogs, dropdowns, tabs, etc.)
- **Recharts**: Charting library for hydrograph and analysis visualizations
- **Lucide React**: Icon library

### Form Handling
- **React Hook Form**: Form state management
- **Zod**: Schema validation (integrated with Drizzle via drizzle-zod)

### Development Tools
- **Vite**: Development server with HMR
- **Replit Plugins**: Runtime error overlay, cartographer, dev banner (development only)

### File Processing
- **Multer**: Server-side file upload handling for SWMM input files