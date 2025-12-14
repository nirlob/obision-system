# Obision System - AI Agent Instructions

## Project Overview
A GNOME system monitoring application built with TypeScript, GTK4, and Libadwaita. Displays comprehensive system information (CPU, GPU, memory, disk, network, temperatures, processes, services, drivers, logs) using a responsive navigation split-view layout. Uses a **hybrid build system**: TypeScript → GJS-compatible JavaScript via custom Node.js build script (`scripts/build.js`).

## Critical Build System
**NEVER use `tsc` directly.** Always use `npm run build` which:
1. Compiles TypeScript to CommonJS in `builddir/`
2. Strips CommonJS/TypeScript artifacts (`exports`, `require`, `__importDefault`, `void 0`)
3. **Combines all modules into a single `builddir/main.js`** with GJS-compatible imports
4. Converts `@girs` imports to GJS `imports.gi` syntax (e.g., `import Gtk from "@girs/gtk-4.0"` → `const { Gtk } = imports.gi;`)
5. Copies resources (`data/ui/*.ui`, `data/style.css`, `data/icons/`, GSettings schema) to `builddir/data/`

**Build concatenation order is critical** (`scripts/build.js`):
```javascript
// Order: interfaces → services → components → main
// 1. interfaces/*.js (stripped during transpilation)
// 2. services/settings-service.js, utils-service.js, resume-service.js,
//    network-service.js, processes-service.js, logs-service.js
// 3. components/resume.js, cpu.js, gpu.js, memory.js, disk.js, network.js,
//    system-info.js, resources.js, processes.js, services.js, drivers.js, logs.js
// 4. main.js
```
Order prevents undefined references in the single-file output. Adding new modules requires updating `scripts/build.js` in correct sequence.

## Run Commands
- **Development**: `npm start` (builds + runs with `GSETTINGS_SCHEMA_DIR=builddir/data`)
- **Build only**: `npm run build` (compile TypeScript → GJS + compile GSettings schema)
- **Watch mode**: `npm run dev` (TypeScript watch, manual rebuild needed)
- **Direct run**: `GSETTINGS_SCHEMA_DIR=builddir/data ./builddir/main.js` (after building)
- **Production install**: `npm run meson-install` (builds, meson setup, compile, sudo install)
- **Debian package**: `npm run deb-build` (creates .deb in builddir/)
- **Clean**: `npm run clean` (removes builddir/, mesonbuilddir/, debian artifacts)

## Architecture

### Application Lifecycle
Single-class application in `src/main.ts`:
```typescript
class ObisionStatusApplication {
  private application: Adw.Application;
  
  constructor() {
    this.application = new Adw.Application({
      application_id: 'com.obision.ObisionSystem',  // Note: ObisionSystem, not ObisionStatus
      flags: Gio.ApplicationFlags.DEFAULT_FLAGS,
    });
    this.application.connect('activate', this.onActivate.bind(this));
    this.application.connect('startup', this.onStartup.bind(this));
  }
  
  private onStartup(): void {
    // Register app actions (about, preferences, quit)
    // Set keyboard shortcuts with set_accels_for_action
  }
  
  private onActivate(): void {
    // Load CSS, create main window, present UI
  }
}
```

### Service Pattern (Singleton)
Services in `src/services/` use static instance pattern:
```typescript
export class UtilsService {
  static _instance: UtilsService;
  
  public static get instance(): UtilsService {
    if (!UtilsService._instance) {
      UtilsService._instance = new UtilsService();
    }
    return UtilsService._instance;
  }
  
  public executeCommand(command: string, args: string[] = []): [string, string] {
    const process = new Gio.Subprocess({
      argv: [command, ...args],
      flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
    });
    process.init(null);
    const [ok, stdout, stderr] = process.communicate_utf8(null, null);
    return [stdout, stderr];
  }
}
```
Access: `const utils = UtilsService.instance;`

### Component Pattern
Components in `src/components/` encapsulate UI logic with lifecycle management:
```typescript
export class ResumeComponent {
  private container: Gtk.Box;
  private utils: UtilsService;
  private updateTimeoutId: number | null = null;
  
  constructor() {
    this.utils = UtilsService.instance;
    const builder = Gtk.Builder.new();
    // Load UI file with fallback
    try {
      builder.add_from_file('/usr/share/com.obision.ObisionStatus/ui/resume.ui');
    } catch (e) {
      builder.add_from_file('data/ui/resume.ui');
    }
    this.container = builder.get_object('resume_container') as Gtk.Box;
    
    // Setup periodic updates with GLib.timeout_add
    this.updateTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10000, () => {
      this.updateData();
      return GLib.SOURCE_CONTINUE;
    });
  }
  
  public getWidget(): Gtk.Box { return this.container; }
  
  public destroy(): void {
    if (this.updateTimeoutId !== null) {
      GLib.source_remove(this.updateTimeoutId);
    }
  }
}
```
Pattern: Load UI from Builder XML, reference widgets by ID, implement `getWidget()` and `destroy()` for lifecycle.

### Navigation System
`src/main.ts` implements navigation switching (lines 70-107):
```typescript
private onNavigationItemSelected(row: Gtk.ListBoxRow, contentBox: Gtk.Box): void {
  // Clear current content
  let child = contentBox.get_first_child();
  while (child) {
    const next = child.get_next_sibling();
    contentBox.remove(child);
    child = next;
  }
  
  // Switch based on row index
  const index = row.get_index();
  switch (index) {
    case 0: this.showResume(contentBox); break;
    case 1: this.showSystemInfo(contentBox); break;
    case 2: this.showResources(contentBox); break;
    case 3: this.showProcesses(contentBox); break;
  }
}
```
To add new views: 1) Add `GtkListBoxRow` in `data/ui/main.ui`, 2) Add case in switch, 3) Create component in `src/components/`, 4) Update `scripts/build.js` concatenation order.

### UI Loading Pattern (Dual-Path Fallback)
All UI loading uses try/catch for installed vs. development paths:
```typescript
const builder = Gtk.Builder.new();
try {
  builder.add_from_file('/usr/share/com.obision.ObisionSystem/ui/main.ui'); // Installed
} catch (e) {
  builder.add_from_file('data/ui/main.ui'); // Development
}
const window = builder.get_object('application_window') as Adw.ApplicationWindow;
```
**Always cast `builder.get_object()` return values** to specific types (`as Gtk.Label`, `as Adw.ApplicationWindow`).

## File Structure
```
src/
├── main.ts                          # Entry point, app lifecycle, navigation
├── services/
│   ├── utils-service.ts            # System command execution via Gio.Subprocess
│   ├── settings-service.ts         # GSettings integration for persistent configuration
│   ├── resume-service.ts           # Resume/dashboard data aggregation
│   ├── network-service.ts          # Network statistics and monitoring
│   ├── processes-service.ts        # Process information and management
│   └── logs-service.ts             # System logs parsing
├── components/
│   ├── resume.ts                   # Dashboard with CPU/memory charts (Gtk.DrawingArea)
│   ├── cpu.ts, gpu.ts, memory.ts, disk.ts, network.ts  # Resource-specific views
│   ├── system-info.ts              # System details view
│   ├── resources.ts                # Combined resource monitoring
│   ├── processes.ts                # Process list with filtering
│   ├── services.ts                 # System services management
│   ├── drivers.ts                  # Hardware drivers information
│   └── logs.ts                     # System logs viewer
└── interfaces/
    ├── resume.ts, network.ts, processes.ts, logs.ts  # TypeScript type definitions

data/
├── ui/*.ui                         # GTK Builder XML files (one per component)
├── style.css                       # GTK4/Adwaita CSS customizations
├── com.obision.ObisionSystem.gschema.xml  # GSettings schema
└── icons/                          # Icon assets

scripts/build.js                    # Custom TypeScript → GJS compiler
builddir/                           # Generated output (git-ignored)
├── main.js                         # Concatenated GJS-compatible script
└── data/                           # Copied resources
```

## GJS/GTK4 Integration

### Import Conversion
TypeScript uses `@girs` NPM packages for type definitions, build script converts to GJS runtime imports:
- **TypeScript source**: `import Gtk from "@girs/gtk-4.0"`
- **Built output**: `const { Gtk } = imports.gi;`

Build script header (`scripts/build.js` lines 67-79):
```javascript
const gjsHeader = `#!/usr/bin/env gjs

imports.gi.versions.Gtk = '4.0';
imports.gi.versions.Adw = '1';

const { Gio } = imports.gi;
const { Gtk } = imports.gi;
const { Gdk } = imports.gi;
const { Adw } = imports.gi;
const { GLib } = imports.gi;
const { Pango } = imports.gi;
`;
```

### Adwaita UI Patterns
Modern GNOME 45+ UI components (`data/ui/main.ui`):
- **`AdwNavigationSplitView`**: Two-pane layout with responsive sidebar (lines 21-174)
  - Sidebar: Navigation list with icons
  - Content: Scrollable main area
- **`AdwBreakpoint`**: Collapse sidebar when `max-width: 400sp` (lines 12-15)
- **`AdwToolbarView`**: Header bar + content container (lines 26-68, 101-158)
- **`AdwHeaderBar`**: Title bar with menu button (lines 28-36, 103-115)
- **`AdwAboutWindow`**: Standard GNOME about dialog (`src/main.ts` lines 134-148)

### CSS Loading
Load styles early in `onActivate()` (`src/main.ts` lines 70-81):
```typescript
const cssProvider = new Gtk.CssProvider();
try {
  cssProvider.load_from_path('/usr/share/com.obision.ObisionSystem/style.css');
} catch (e) {
  cssProvider.load_from_path('data/style.css'); // Development fallback
}
const display = Gdk.Display.get_default();
if (display) {
  Gtk.StyleContext.add_provider_for_display(display, cssProvider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
}
```

### Drawing Custom Graphics
Use `Gtk.DrawingArea` with `set_draw_func` for custom rendering (`src/components/resume.ts` lines 50-58):
```typescript
this.cpuChart = builder.get_object('cpu_chart') as Gtk.DrawingArea;
this.cpuChart.set_draw_func((area, cr, width, height) => {
  // cr is Cairo context
  cr.setSourceRGBA(0.3, 0.3, 0.3, 0.2);
  cr.arc(centerX, centerY, radius, startAngle, endAngle);
  cr.stroke();
});
this.cpuChart.queue_draw(); // Trigger redraw
```

## TypeScript/GJS Gotchas
- **Window content property**: Adw.ApplicationWindow requires type cast: `(window as any).content = widget`
- **CommonJS required**: `tsconfig.json` uses `"module": "CommonJS"` (ES modules unsupported by build script)
- **Type definitions**: `@girs/*` packages provide IntelliSense, but GJS runtime uses `imports.gi.*`
- **Main entry point**: Check global `ARGV`: `if (typeof ARGV !== 'undefined') main(ARGV);` (`src/main.ts` lines 155-159)
- **Builder object retrieval**: Always cast: `builder.get_object('id') as Gtk.Label`
- **Signal connections**: Use `.connect('signal-name', handler)` not `.on()`
- **String cleaning**: Build script regex strips `exports.*`, `require()`, `__importDefault`, `_1.default.` references

## Development Workflow
1. Edit TypeScript in `src/` or UI XML in `data/ui/`
2. Run `npm run build` to compile (automatic on `npm start`)
3. Test with `./builddir/main.js` or `npm start`
4. Debug: `GJS_DEBUG_OUTPUT=stderr ./builddir/main.js` or `gjs --debugger builddir/main.js`
5. System install: `npm run meson-install` (requires sudo)
6. Post-install: `sudo update-desktop-database /usr/share/applications` + `sudo glib-compile-schemas /usr/share/glib-2.0/schemas/`

## Meson Build System
`meson.build` handles production installation (dual build system with npm):
- Installs **compiled JS from `builddir/main.js`** (not TypeScript sources)
- Creates launcher script in `/usr/bin/` from `bin/obision-system.in` template
- Compiles GResources bundle from `data/com.obision.ObisionSystem.gresource.xml`
- Installs desktop file (`data/com.obision.ObisionSystem.desktop.in`), icons, GSettings schema
- Uses app ID `com.obision.ObisionSystem` throughout

**Install paths**:
- Binary: `/usr/bin/obision-system` → `/usr/share/com.obision.ObisionSystem/main.js`
- UI files: `/usr/share/com.obision.ObisionSystem/ui/*.ui`
- CSS: `/usr/share/com.obision.ObisionSystem/style.css`
- Icons: `/usr/share/icons/hicolor/{scalable,48x48,64x64}/apps/com.obision.ObisionSystem.*`
- Schema: `/usr/share/glib-2.0/schemas/com.obision.ObisionSystem.gschema.xml`

## Common Tasks

### Adding New Navigation View
1. **Edit `data/ui/main.ui`**: Add `GtkListBoxRow` to `navigation_list` (follow pattern lines 73-130)
2. **Create component**: `src/components/my-view.ts` with `constructor()`, `getWidget()`, `destroy()`
3. **Create UI file**: `data/ui/my-view.ui` with root object having unique ID
4. **Update `src/main.ts`**: Add case in `onNavigationItemSelected()` switch
5. **Update `scripts/build.js`**: Add component in concatenation order (before `main.js`)
6. **Rebuild**: `npm run build && ./builddir/main.js`

### Adding App Actions
Register in `onStartup()` method (`src/main.ts` lines 31-52):
```typescript
const myAction = new Gio.SimpleAction({ name: 'my-action' });
myAction.connect('activate', () => {
  console.log('Action triggered');
});
this.application.add_action(myAction);
this.application.set_accels_for_action('app.my-action', ['<Ctrl>M']);
```
Add to menu in `data/ui/main.ui` (lines 3-19):
```xml
<item>
  <attribute name="label" translatable="yes">_My Action</attribute>
  <attribute name="action">app.my-action</attribute>
</item>
```

### Accessing UI Elements
Use builder IDs from `data/ui/main.ui`:
```typescript
const mainContent = builder.get_object('main_content') as Gtk.Box;
const splitView = builder.get_object('split_view') as Adw.NavigationSplitView;
const navigationList = builder.get_object('navigation_list') as Gtk.ListBox;
```

### Executing System Commands
Use `UtilsService` singleton (`src/services/utils-service.ts`):
```typescript
const utils = UtilsService.instance;
try {
  const [stdout, stderr] = utils.executeCommand('df', ['-h']);
  console.log(`Disk usage: ${stdout}`);
} catch (error) {
  console.error('Command failed:', error);
}
```
Commands use `Gio.Subprocess` with `STDOUT_PIPE | STDERR_PIPE` flags, blocking until completion.

### Periodic Updates
Use `GLib.timeout_add` for polling (`src/components/resume.ts` lines 62-66):
```typescript
this.updateTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10000, () => {
  this.updateData();
  return GLib.SOURCE_CONTINUE; // Keep running
});

// Cleanup in destroy()
if (this.updateTimeoutId !== null) {
  GLib.source_remove(this.updateTimeoutId);
}
```

### Troubleshooting Build Issues
- **"Module not found"**: Run `npm install` to get `@girs` packages
- **GJS runtime errors**: Check `builddir/main.js` for unconverted imports (look for `require`, `exports`)
- **"Cannot find object ID"**: Verify UI file loaded correctly with try/catch, check Builder XML for `id` attribute
- **Concatenation order errors**: Ensure `scripts/build.js` adds dependencies before dependents
- **Meson install fails**: Run `npm run build` first to generate `builddir/main.js`
