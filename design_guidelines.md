# SSOAP Toolbox Design Guidelines

## Design Approach: Carbon Design System
**Rationale**: Enterprise-grade data analysis tool requiring clarity, efficiency, and professional aesthetics for sanitary engineering workflows.

## Core Design Principles
1. **Clarity First**: Technical data must be immediately scannable
2. **Workflow Efficiency**: Minimize clicks for complex analysis tasks
3. **Professional Credibility**: Clean, enterprise-grade interface

## Typography
- **Primary Font**: IBM Plex Sans (system fallback: -apple-system, sans-serif)
- **Monospace**: IBM Plex Mono for data/code display
- **Hierarchy**:
  - Page titles: text-2xl font-semibold
  - Section headers: text-lg font-medium
  - Body: text-base
  - Data labels: text-sm font-medium
  - Captions: text-xs

## Layout System
**Spacing Units**: Tailwind 2, 4, 6, 8, 12, 16 for consistent rhythm

**Application Structure**:
- **Left Sidebar** (w-64): Primary navigation, project selector, tool categories
- **Main Content** (flex-1): Analysis workspace with max-w-7xl container
- **Right Panel** (w-80, collapsible): Properties, settings, live parameters

**Grid Patterns**:
- Dashboard cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6
- Data tables: Full-width with horizontal scroll for dense information
- Form layouts: Single column max-w-2xl for input clarity

## Component Library

### Navigation
- **Top Bar**: Logo, project breadcrumbs, user menu, notifications
- **Sidebar**: Expandable/collapsible sections (SWMM Engine, Analysis Tools, Reports, Settings)
- **Tab Navigation**: For multi-step workflows and analysis views

### Data Display
- **Analysis Dashboard**: Card-based metrics (overflow volume, frequency, costs)
- **Data Tables**: Sortable, filterable with row actions, pagination
- **Charts**: Integration-ready for plotting SWMM results (line, bar, scatter)
- **Map View**: Interactive map canvas for sewer network visualization

### Forms & Inputs
- **Input Groups**: Label-input-helper text pattern with clear validation states
- **File Upload**: Drag-drop zone for SWMM input files (.inp, .rpt)
- **Parameter Controls**: Sliders, number inputs, dropdowns for SWMM parameters
- **Date Pickers**: For rainfall data and simulation periods

### Analysis Workflow
- **Wizard Pattern**: Multi-step process (Setup → Configure → Run → Results)
- **Progress Indicators**: Clear status for SWMM engine execution
- **Action Panels**: Primary/secondary buttons with loading states
- **Results Viewer**: Tabbed interface (Summary, Detailed Logs, Visualizations, Export)

### Feedback Elements
- **Status Badges**: Success, Warning, Error, Processing states
- **Toast Notifications**: Non-intrusive alerts (top-right)
- **Modal Dialogs**: For confirmations, detailed settings
- **Empty States**: Guidance when no projects/data loaded

## Specialized Components

### SWMM Engine Interface
- **Command Panel**: Input file loader, simulation controls (Run, Stop, Reset)
- **Real-time Log**: Monospace terminal-style output viewer
- **Parameter Editor**: Form-based SWMM configuration with tooltips
- **Results Processor**: Auto-parse .rpt files into structured views

### SSO Analysis Tools
- **Overflow Event List**: Table with location, timestamp, volume, duration
- **Cost Calculator**: Input-driven forms with live calculation displays
- **Scenario Comparison**: Side-by-side result panels
- **Report Generator**: Template selector with preview

## Images & Visual Assets
**No hero images** - This is a professional utility application.

**Icons**: Material Icons via CDN for consistency
- Navigation icons: 24px outlined style
- Action buttons: 20px filled style
- Status indicators: 16px for inline context

**Diagrams/Graphics**: Placeholder comments for:
- Sewer network topology diagrams
- Flow direction indicators
- Infrastructure status overlays

## Responsive Behavior
- **Desktop (lg+)**: Three-panel layout fully visible
- **Tablet (md)**: Collapsible right panel, persistent sidebar
- **Mobile**: Bottom tab navigation, stacked single-column views

## Animation Guidelines
**Minimal & Purposeful**:
- Sidebar collapse/expand: 200ms ease-in-out
- Tab transitions: Instant switch, no fade
- Loading states: Simple spinner, no elaborate animations
- Data updates: Subtle highlight flash on value changes

## Accessibility
- ARIA labels for all interactive elements
- Keyboard navigation throughout workflows
- Focus indicators on all form inputs
- Screen reader announcements for SWMM status changes

This design creates a professional, efficient environment for sanitary engineers to perform complex SSO analysis with confidence and clarity.