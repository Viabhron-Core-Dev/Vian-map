# Custom Maps: The User's Concept Workflow

## Core Philosophy
- **Performance First**: The full global map must NOT run constantly in the background while in Custom Map mode. It is too heavy for mobile processing. Only the specified "Cutout" bounds or a pure "Blank Map" should be rendered during the creation phase to save memory and battery.
- **Fixed Zoom/Visibility Engine**: In a Custom Map sandbox, zoom logic is locked or visually standardized. No matter the zoom level, all drawn elements, text, and details remain visible and readable, avoiding the "clutter and disappear" issues of global maps.
- **2D Only**: Strict adherence to a lightweight 2D environment.

## The Creation Flow
1. **Initialization**: Open from the Maps window.
2. **Base Selection**: Choose either **Blank** or **Cutout**.

### Branch A: Cutout Mode
1. **Layer Choice**: Select the base map layer (e.g., Satellite, Hybrid, **Depth Maps**).
2. **Find Location**: Navigate to the targeted geographical location or snap directly to the user's "Current Location".
3. **Enclose Bounds**: Tap dots to enclose the specific area (defining the "Cutout", can be freeform polygons or any shape using multiple taps).
4. **Base Filtration**: Ability to filter out or get rid of built-in global POIs, tags, or labels from the cutout to leave a clean slate.
5. **Creation Mode**: The global map is discarded from memory. The user enters the Sandbox.

### Branch B: Blank Mode
1. **Creation Mode**: Directly enters the isolated Blank Sandbox.

---

## Toolbars & The Placement Engine

### 1. Landscape Build Toolbar (Terrain Generation)
A dedicated toolbar separate from tactical placements, used to establish the physical environment (acting similarly to the Area tool).
- **Draw Landscape**: Tap-to-tap to enclose a shape.
- **Fast Input Window**: A tailored popup with a rapid dropdown menu to instantly assign terrain type (Water, Forest, Sand, Concrete, etc.) rather than filling out a long form.

### 2. Tactical Detail Toolbar
For marking the operational intel over the landscape:
- **POI (Point)**: Tap once to drop.
- **Roads / Routes**: Tap-to-tap-to-tap to draw a path.
  - *Detail Driven Styling*: The visual line dynamically changes based on input details (e.g., "mud road" renders as a brown line; "2 lane road" renders thicker).
- **Area**: Tap-to-tap to enclose a custom tactical polygon zone.
- **Expand Map**: A tool sitting alongside the drawing tools to quickly grow the sandbox edge if you run out of space.
  - *Cutout Mode - "Fetch More Tiles"*: Directional arrow taps to organically push the boundary outward (e.g., +100m in that direction) without needing to redraw the whole cutout perfectly.
  - *Blank Mode - "Landscape Expand"*: Simply extends the infinite drawing grid.

*Workflow Rule*: Immediately after **every** individual placement is finished, an input window pops up to enter details for that specific object, baking its visual style into the map immediately.

### 3. Kinematic Drafting (Walking the Sandbox)
A dedicated physical surveying mode triggered via a FAB (Floating Action Button) from within both the Landscape and Tactical Creation modes. Instead of drawing with your fingers on the glass, your physical movement acts as the "desktop cursor."

- **The UI Controls**:
  - **Kinematic Toggle FAB**: Turns "Walk the Sandbox" tracking mode On or Off.
  - **Universal Sensor FAB (`GPS` / `Location` / `None`)**: Controls the active hardware sensor universally. If tracking is currently `None`, initiating a Kinematic action will automatically override and default to `GPS` to ensure the trace is captured. Tool-specific sensor menus are bypassed entirely.
- **The "Body as Cursor" Workflow**: When Kinematic mode is ON, you do not tap the map itself to draw. You physically walk to the location, then tap the UI tool button to trigger a "click" exactly at your geographic coordinate.
  - **POI**: Walk to the physical asset -> Tap the POI tool -> The marker drops at your feet -> Complete the detail form.
  - **Road**: Walk to the path's origin -> Tap the Road tool -> Walk the path as the app traces your breadcrumbs -> Tap to finish the trace -> Complete the detail form.
  - **Area**: Tap the Area tool to begin -> Walk the entire perimeter -> Tap again to connect the boundary and enclose -> Complete the detail form.
- **Boundary Auto-Expand**: If your physical movement reaches the outer edge of your sandbox canvas while Kinematic Drafting is engaged, the app intercepts and prompts to **Expand Map**. You can choose to extend the mathematical blank grid, or gracefully fetch/extract adjacent real-world tiles based on your movement trajectory (if using Cutout mode).

---

## The Finalization Stage
Once all points, roads, terrain, and tactical areas are placed and the map is complete:
1. Tap the **Final Save** button.
2. The **Custom Map Save Form** appears:
   - **Name**: To identify the map.
   - **Note**: Tactical notes or observations.
   - **Description**: Broad overview of the map.
   - **Location Coordinates**: To anchor this custom sandbox to a specific point on the main global map (acting as a doorway/waypoint on the main map).
   - **Scale & Calibration**: (Specific to Blank Maps) Defines the physical scale and real-world rotation of the drawn canvas.
