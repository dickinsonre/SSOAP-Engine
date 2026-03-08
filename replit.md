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
- **DWF Patterns**: Dry Weather Flow patterns with hourly multipliers (weekday/weekend) and GWI
- **Hydrographs**: Flow data for sewershed analysis
- **Condition Assessments**: Pipe condition evaluations
- **SSO Events**: Sanitary sewer overflow incident tracking

### Application Pages
- Dashboard: Overview statistics and recent activity
- Projects: Project management CRUD operations
- Simulation: SWMM5 file upload and simulation execution
- RDII Analysis: Rainfall-derived infiltration parameter management with GA calibration
- DWF Analysis: Dry Weather Flow patterns, mean flow statistics, weekday/weekend patterns, and groundwater infiltration (GWI) metrics
- Hydrograph: Flow visualization with Recharts
- Condition Assessment: Pipe condition tracking
- SSO Events: Overflow event logging and analysis
- RDII Studio: Complete 10-tab RDII calibration workflow (Data Import, QA/QC, DWF & GWI, RDII Series, Events, Calibrate, Compare, Time Series, Export, Docs)
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

## Recent Changes

### API Query Format (January 2026)
- All frontend API calls use query parameters for filtering: `/api/simulations?projectId=X`
- TanStack Query keys encode the full URL with query parameters: `["/api/simulations?projectId=${projectId}"]`
- This format works with the default query function that joins array elements with "/"

### Demo Data
The application includes seeded demo data for immediate testing:
- 2 projects: "Downtown Sewer Analysis" (proj-1), "Northside Rehabilitation" (proj-2)
- 2 simulations for proj-1: "Baseline Simulation" (completed), "Storm Event Analysis" (running)
- 3 RDII parameter sets: Downtown Core, Commercial District, Residential North
- 3 DWF patterns with weekday/weekend multipliers and GWI for Downtown Core, Commercial District, Residential North
- 2 condition assessments with pre/post rehabilitation data
- 3 SSO events with varying severity levels

### RDII Studio (February 2026)
- New page at `/rdii-studio` with 10-tab calibration workflow
- CalibrationDataContext in `client/src/contexts/CalibrationDataContext.tsx` manages shared state (flow/rainfall data, events, optimization results)
- File format parsers in `client/src/lib/fileFormatParsers.ts` support CSV and SWMM5 formats
- Sample data in `client/public/sample-data/` (3-day hourly flow + rainfall CSV, served by Vite from client root)
- Tab components in `client/src/components/rdii-studio/`
- Client-side NSGA-II multi-objective optimization for RTK parameter calibration
- All processing is client-side (except Tournament GA which uses `/api/calibration/run-direct`)

### RDII Studio Improvements (March 2026)
- **Workflow Progress Tracker**: Visual progress bar + step indicators above tabs showing completion status (complete/pending/locked)
- **Ecosystem Connections**: 4 external link buttons in Export tab (INP MAKER, Rain Canvas, SWMM5 Engine, BatchSWMM)
- **Calibration Tournament**: Side-by-side GA vs NSGA-II comparison with metrics table, hydrograph overlay, and auto-verdict
- **Convolution Visualizer**: Animated RTK convolution in Time Series tab with play/pause/speed controls, showing fast/medium/slow RDII building up
- New server endpoint: `POST /api/calibration/run-direct` accepts raw rainfall/observed arrays for tournament GA

## Development Notes

### Query Client Configuration
The query client (`client/src/lib/queryClient.ts`) uses a default query function that:
- Joins queryKey array elements with "/" to form the URL
- For query parameters, include them directly in the first element of the queryKey array

### Theme Support
The application supports light/dark/system modes via:
- ThemeProvider component in `client/src/components/theme-provider.tsx`
- Theme selection stored in localStorage
- CSS variables defined in `client/src/index.css`
- **Color Schemes**: 7 palettes applied via `data-color-scheme` attribute on `<html>`:
  - Blue variants: `steel` (default), `ocean`, `sky`, `navy`
  - Brand themes: `epa` (EPA blue #0071BC with green accents), `uf` (UF Gators orange #FA4616 + blue), `osu` (OSU Beavers orange #D73F09 + black)
- Color scheme type defined in both `theme-provider.tsx` and `settings.tsx` — must stay in sync
- Each scheme has full light + dark CSS variable sets in `index.css`