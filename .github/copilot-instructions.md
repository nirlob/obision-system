# Obision System - AI Agent Instructions

## Project Overview
A modern GNOME system monitoring application built with TypeScript, GTK4, and Libadwaita. Displays comprehensive system information (CPU, GPU, memory, disk, network, temperatures, processes, services, drivers, logs) using an adaptive `AdwNavigationSplitView` layout. Uses a **hybrid build system**: TypeScript → GJS-compatible JavaScript via custom Node.js build script (`scripts/build.js`) that concatenates all modules into a single executable file.

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
// 1. interfaces/*.js (TypeScript interfaces, stripped during transpilation)
// 2. Services (in order):
//    - settings-service.js, utils-service.js, resume-service.js
//    - network-service.js, processes-service.js, logs-service.js
// 3. Components (in order):
//    - resume.js, cpu.js, gpu.js, memory.js, disk.js, network.js
//    - system-info.js, resources.js, processes.js, services.js, drivers.js, logs.js
// 4. main.js (application entry point)
```
**Critical**: Order prevents undefined references in single-file output. When adding new modules:
1. Place services before components that use them
2. Place components before main.js
3. Update `scripts/build.js` to include new file in correct sequence
4. Ensure `cleanJSContent()` processes new file properly

## Run Commands
- **Development**: `npm start` → Builds + runs with `GSETTINGS_SCHEMA_DIR=builddir/data ./builddir/main.js`
- **Build only**: `npm run build` → Compiles TS → GJS + compiles GSettings schema via `glib-compile-schemas`
- **Watch mode**: `npm run dev` → TypeScript watch mode (requires manual `npm run build` to regenerate main.js)
- **Direct run**: `GSETTINGS_SCHEMA_DIR=builddir/data ./builddir/main.js` (requires prior build)
- **Production install**: `npm run meson-install` → Full build pipeline (npm build → meson setup → meson compile → sudo install)
- **Uninstall**: `npm run meson-uninstall` → Removes system installation, cleans build dirs
- **Debian package**: `npm run deb-build` → Creates .deb in `builddir/obision-system.deb`
- **Debian install**: `npm run deb-install` → Installs .deb with dependency resolution
- **Clean**: `npm run clean` → Removes `builddir/`, `mesonbuilddir/`, debian artifacts
- **Deep clean**: `npm run meson-clean` → Additional GSettings compiled schema cleanup

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
`src/main.ts` implements navigation switching via `onNavigationItemSelected()`:
```typescript
private onNavigationItemSelected(row: Gtk.ListBoxRow, contentBox: Gtk.Box): void {
  // Clear current content
  let child = contentBox.get_first_child();
  while (child) {
    const next = child.get_next_sibling();
    contentBox.remove(child);
    child = next;
  }
  
  // Switch based on row index (maps to navigation_list rows in main.ui)
  const index = row.get_index();
  switch (index) {
    case 0: this.showResume(contentBox); break;        // Dashboard/Resume
    case 1: this.showSystemInfo(contentBox); break;    // System Information
    case 2: this.showProcesses(contentBox); break;     // Process Monitor
    case 3: this.showServices(contentBox); break;      // Services Manager
    case 4: this.showDrivers(contentBox); break;       // Hardware Drivers
    case 5: this.showLogs(contentBox); break;          // System Logs
    // Add new views here
  }
}
```
**Pattern**: Each `showX()` method instantiates component class, calls `getWidget()`, adds to contentBox.

To add new views:
1. Add `<object class="GtkListBoxRow">` in `data/ui/main.ui` → `navigation_list` (order matters!)
2. Create component: `src/components/my-view.ts` with `constructor()`, `getWidget()`, `destroy()`
3. Create UI file: `data/ui/my-view.ui` with root object having unique ID
4. Add case in `onNavigationItemSelected()` switch
5. Update `scripts/build.js` concatenation order (add before `main.js`)
6. Import component in `src/main.ts`: `import { MyViewComponent } from './components/my-view';`
7. Rebuild: `npm run build && ./builddir/main.js`

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
Modern GNOME 45+ UI components used throughout (`data/ui/main.ui`):
- **`AdwNavigationSplitView`**: Two-pane responsive layout
  - Sidebar: `GtkListBox` with navigation items (`navigation_list`)
  - Content: Scrollable area (`main_content`) dynamically populated
- **`AdwBreakpoint`**: Automatically collapse sidebar when `max-width: 400sp`
- **`AdwToolbarView`**: Container combining header bar + scrollable content
- **`AdwHeaderBar`**: Modern title bar with menu button
- **`AdwAboutWindow`**: Standard GNOME about dialog (created in `showAboutDialog()`)
- **`AdwPreferencesWindow`**: Settings dialog (created in `showPreferencesDialog()` with GSettings binding)

**Widget naming convention**: Use descriptive IDs in UI files (e.g., `cpu_value`, `memory_chart`, `processes_list`)

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
1. **Edit `data/ui/main.ui`**: Add `<object class="GtkListBoxRow">` to `navigation_list` (order determines index)
   ```xml
   <child>
     <object class="GtkListBoxRow">
       <property name="child">
         <object class="GtkBox">
           <property name="spacing">12</property>
           <child>
             <object class="GtkImage">
               <property name="icon-name">my-icon-symbolic</property>
             </object>
           </child>
           <child>
             <object class="GtkLabel">
               <property name="label" translatable="yes">My View</property>
             </object>
           </child>
         </object>
       </property>
     </object>
   </child>
   ```
2. **Create component**: `src/components/my-view.ts` with `constructor()`, `getWidget()`, `destroy()`
3. **Create UI file**: `data/ui/my-view.ui` with root container having unique ID
4. **Import in main**: Add `import { MyViewComponent } from './components/my-view';` to `src/main.ts`
5. **Add switch case**: In `onNavigationItemSelected()`, add `case N: this.showMyView(contentBox); break;`
6. **Create show method**: Implement `private showMyView(contentBox: Gtk.Box): void` in `src/main.ts`
7. **Update build script**: Add component to `scripts/build.js` concatenation (before `main.js` section)
8. **Rebuild**: `npm run build && ./builddir/main.js`

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
Use builder IDs from UI files (e.g., `data/ui/main.ui`):
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
