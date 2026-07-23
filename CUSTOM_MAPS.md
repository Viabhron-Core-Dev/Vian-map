# Custom Maps: Architecture & Rollout Plan

## Current State in Repository
- **UI Framework Established**: The `CustomMapTool.tsx` has been overhauled to include a multi-step setup wizard framework.
- **Wizard States scaffolded**:
  - `select_source`: User chooses between "Blank Grid" (from scratch) or "Live Map Cutout" (satellite/hybrid base).
  - `cutout`: Tap-to-tap bounds selection implemented to trap a specific geographic boundary (max 5km² limit logically scoped).
  - `blank_setup`: UI in place to configure 1, 2, or 3-point calibration.
  - `paint`: Top-toolbar style PC-paint tools (Point, Route, Area) are scaffolded in the UI.

---

## Universal Tracking Structure
- **The GPS/Location/None Protocol**: Custom maps will fully integrate the standard operational hardware toggle. 
- **Auto-Fallback Engine**: Actions requiring physical validation will default directly back to `GPS` if attempting to activate them from a `None` state, keeping operations fluid.
- **Integration**: This tracking backbone handles movement-based map plotting, avoiding manual drawing on the glass where sensor precision could be used instead.

---

## Action Plan & Phases

### Phase 1: Setup Wizard & Core UI (Near Complete)
- [x] Wizard state machine architecture.
- [x] "Cutout" selection mechanic (Opposite corner bounding box definition).
- [x] Blank Grid calibration point selection UI.
- [ ] Dynamic base layer locking (locking panning/zooming strictly to the defined canvas).

### Phase 2: Visual Cropping & Paint Mechanics
- **The Blackout Mask**: Implementing Leaflet visual map "cropping" mechanics. Once a Cutout boundary is locked, everything outside of that boundary is visually masked/blacked out locking focus purely on the custom canvas.
- **Paint Engine**: Transition the map click handlers exclusively to the chosen Paint Tool logic:
  - **Area/Encircle Tool**: Tap-to-tap to draw polygons.
  - **Route Tool**: Tap-to-tap path tracing.
  - **Point Tool**: Marker drops with tactical intel popups.

### Phase 3: Calibration & Waypoint Integration
- **Blank Map Calibration**: Coding the translation matrix for the 1-point, 2-point, or 3-point calibration logic to anchor blank grid drawings to physical earthly bounds.
- **Waypoint Hooking**: Connecting custom drawn points to global waypoints.

### Phase 4: Kinematic Map Painting (Physical Surveying)
*(Note: Preserved as requested. This perfectly aligns as the capstone of the Custom Maps suite.)*
- **Hardware-Driven Drawing**: Leveraging the `GPS -> Location -> None` cyclical tracker directly inside the Paint tools.
- **Physical Mapping Execution**: 
  - *Routes*: User selects Route tool, begins tracking. Walking the path natively traces the trail onto the blank/cutout base map using unified tracker nodes.
  - *Area Encirclement*: Walking the outer perimeter of an AO; when closed, the path connects forming the polygon natively.
  - *Points*: Dropping points automatically at the tracked physical footprint.
- **Origin Anchoring**: Marking initial location directly as Calibration Point 1 for rapid Blank Grid starts.
