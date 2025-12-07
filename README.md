# Obysion System - System Monitor for GNOME

A modern GNOME system monitoring application built with TypeScript, GTK4, and Libadwaita. Provides a clean, responsive interface for viewing comprehensive system information including CPU, GPU, memory, disk, network, temperatures, and system load using an adaptive navigation split-view layout.

## Features

- 🚀 **TypeScript Support**: Written in TypeScript for better development experience and type safety
- 📱 **Modern UI**: Built with GTK4 and Libadwaita for native GNOME integration
- 📊 **Adaptive Layout**: Responsive navigation split-view that adapts to window size
- 🎨 **Custom Styling**: CSS-based theming support with Adwaita integration
- 🏗️ **Meson Build System**: Professional build system setup with system-wide installation
- 🖥️ **Desktop Integration**: Proper desktop file, GSettings schema, and system integration
- ⚡ **Lightweight**: Minimal resource footprint with efficient GJS runtime

## Project Structure

```
obysion-system/
├── src/                          # Source code
│   ├── main.ts                   # Main application file
│   ├── components/               # UI components (Resume, CPU, GPU, Memory, Disk, Network, etc.)
│   ├── services/                 # Business logic
│   │   ├── utils-service.ts      # Utilities (system commands, etc.)
│   │   └── settings-service.ts   # GSettings integration for persistent configuration
│   └── interfaces/               # TypeScript interfaces
├── scripts/                      # Build scripts
│   └── build.js                  # Custom TypeScript to GJS converter
├── data/                         # Application data
│   ├── ui/                       # UI definition files
│   │   └── main.ui               # Main window with NavigationSplitView
│   ├── style.css                 # Custom CSS styling
│   ├── icons/                    # Application icons
│   ├── *.desktop.in              # Desktop file template
│   ├── *.gschema.xml             # GSettings schema
│   └── *.gresource.xml           # Resource bundle definition
├── bin/                          # Executable scripts
│   └── obysion-system.in         # Launcher script template
├── builddir/                     # Generated files (created by build)
│   ├── main.js                   # Compiled JavaScript (ready for GJS)
│   ├── services/                 # Compiled services
│   └── data/                     # Copied resources
├── meson.build                   # Meson build configuration
├── package.json                  # NPM configuration
└── tsconfig.json                 # TypeScript configuration
```

## Dependencies

### System Dependencies
- **GJS**: JavaScript runtime for GNOME (>= 1.66.0)
- **GTK4**: GUI toolkit (>= 4.0)
- **Libadwaita**: Modern GNOME widgets (>= 1.0)
- **Meson**: Build system (>= 0.59.0)
- **Node.js**: For TypeScript compilation (>= 16.0.0)
- **pkg-config**: For dependency detection
- **glib-compile-resources**: For resource bundling

### Install system dependencies on Debian/Ubuntu:
```bash
sudo apt-get update
sudo apt-get install -y \
  pkg-config \
  libglib2.0-dev \
  libgtk-4-dev \
  libadwaita-1-dev \
  gjs \
  meson \
  nodejs \
  npm
```

### Install system dependencies on Fedora:
```bash
sudo dnf install -y \
  pkgconf \
  glib2-devel \
  gtk4-devel \
  libadwaita-devel \
  gjs \
  meson \
  gcc \
  nodejs \
  npm
```

## Building and Running

### Quick Start (Development)
```bash
# Clone the repository
git clone https://github.com/nirlob/obision-status.git
cd obysion-system

# Install Node.js dependencies
npm install

# Build and run the application
npm start
```

### Development Mode
```bash
# Install npm dependencies (includes @girs type definitions)
npm install

# Build and run the application
npm start

# Or build and run separately
npm run build
./builddir/main.js

# TypeScript watch mode (auto-rebuild on changes)
npm run dev
```

### System-Wide Installation

#### Install to system
```bash
# Build the application
npm run build

# Setup Meson with system prefix
npm run meson-setup

# Compile with Meson
npm run meson-compile

# Install system-wide (requires sudo)
sudo npm run meson-install

# Update desktop database and compile GSettings schemas
sudo update-desktop-database /usr/share/applications
sudo glib-compile-schemas /usr/share/glib-2.0/schemas/
sudo gtk-update-icon-cache /usr/share/icons/hicolor/
```

Or use the all-in-one command:
```bash
# Build and install in one step
sudo npm run meson-install

# Then update system caches
sudo update-desktop-database /usr/share/applications
sudo glib-compile-schemas /usr/share/glib-2.0/schemas/
sudo gtk-update-icon-cache /usr/share/icons/hicolor/
```

#### Uninstall from system
```bash
sudo npm run meson-uninstall
```

## NPM Scripts

- `npm start`: Build and run the application in development mode (recommended for testing)
- `npm run build`: Build from TypeScript source with automatic GJS conversion
- `npm run dev`: Watch TypeScript files for changes (auto-rebuild)
- `npm run clean`: Clean build and meson directories
- `npm run meson-setup`: Setup Meson build directory with /usr prefix
- `npm run meson-compile`: Compile with Meson build system
- `npm run meson-install`: Complete build and system-wide installation (requires sudo)
- `npm run meson-uninstall`: Uninstall application from system (requires sudo)
- `npm run meson-clean`: Clean Meson build directory

## Running the Application

### After Development Build
```bash
./builddir/main.js
```

### After System Installation
```bash
obysion-system
```
Or launch from GNOME Applications menu: Look for "Obysion System"

## TypeScript Development

The project includes TypeScript type definitions for GJS and GTK in the `types/` directory. While not complete, they provide basic type checking and IntelliSense support.

### Key Features of the TypeScript Setup:
- **@girs Type Definitions**: Official TypeScript definitions for GTK4, Libadwaita, GLib, and GIO
- **Automatic Import Conversion**: Build system converts TypeScript imports to GJS-compatible format
- **Type Safety**: Full IntelliSense support and compile-time type checking
- **Dual Development**: Support for both TypeScript and JavaScript development workflows

## UI Development

The application uses declarative UI files (`data/ui/main.ui`) which are loaded at runtime. This allows for:

- Easy UI modifications without recompilation
- Professional UI design workflow
- Separation of concerns (logic vs. presentation)
- Integration with UI design tools

### UI File Structure:
- Modern Libadwaita components (AdwNavigationSplitView, AdwBreakpoint, etc.)
- Adaptive layout that responds to window width
- Responsive sidebar that collapses on narrow screens
- CSS classes for custom styling integration
- Accessible widget properties

## Application Features

### Main Features:
1. **Comprehensive System Monitoring**: 
   - Dashboard with circular charts (CPU, GPU, memory, disk, network)
   - CPU and GPU temperature monitoring with color-coded displays
   - System load visualization with progress bars (1/5/15 min averages)
   - Top processes and system information
2. **Persistent Settings**: 
   - Window state (size, position, maximized) saved across sessions
   - Configurable refresh interval (1-60 seconds)
   - Preferences dialog for easy configuration
3. **Adaptive Layout**: Navigation split-view that adapts to window size
4. **Sidebar Navigation**: Collapsible sidebar for easy navigation on narrow screens
5. **Custom Styling**: CSS-based theming with Adwaita integration
6. **System Commands**: Execute system commands via UtilsService for retrieving system data

### Extensibility:
The application architecture is designed to be easily extended:
- Add new components in `src/components/`
- Create new services in `src/services/`
- Define interfaces in `src/interfaces/`
- Extend UI in `data/ui/main.ui`
- Apply custom styles in `data/style.css`

## Architecture

### Build System
The project uses a **hybrid build system**:

1. **TypeScript → JavaScript**: Node.js build script (`scripts/build.js`)
   - Compiles TypeScript to CommonJS
   - Strips TypeScript/CommonJS artifacts
   - Converts `@girs` imports to GJS `imports.gi` syntax
   - Combines all modules into single `builddir/main.js`
   - Maintains execution order (services → components → main)

2. **Meson Build**: For system installation
   - Compiles GResources
   - Configures desktop files
   - Installs to system directories
   - Creates launcher script

**Important**: Always use `npm run build` instead of `tsc` directly.

### Application Pattern
The application follows a single-class pattern with modular extension points:
```typescript
class ObysionSystemApplication {
  private application: Adw.Application;
  constructor() {
    this.application = new Adw.Application({
      application_id: 'com.obysion.ObysionSystem',
      flags: Gio.ApplicationFlags.DEFAULT_FLAGS,
    });
  }
}
```

### Settings Service Pattern
Settings use GSettings for persistence:
```typescript
class SettingsService {
  private settings: Gio.Settings;
  static _instance: SettingsService;
  
  private constructor() {
    this.settings = new Gio.Settings({ schema_id: 'com.obysion.obysion-system' });
  }
  
  public getRefreshInterval(): number {
    return this.settings.get_int('refresh-interval');
  }
  
  public connectRefreshIntervalChanged(callback: (interval: number) => void): number {
    return this.settings.connect('changed::refresh-interval', () => {
      callback(this.getRefreshInterval());
    });
  }
}
```

### Service Pattern
Services use static singleton pattern:
```typescript
class MyService {
  static _instance: MyService;
  static get instance(): MyService {
    if (!MyService._instance) {
      MyService._instance = new MyService();
    }
    return MyService._instance;
  }
}
```

## Troubleshooting

### Common Issues:

1. **Meson setup fails with "pkg-config not found"**:
   ```bash
   sudo apt-get install pkg-config libglib2.0-dev libgtk-4-dev libadwaita-1-dev
   ```

2. **Application doesn't appear in GNOME menu after installation**:
   ```bash
   sudo update-desktop-database /usr/share/applications
   sudo gtk-update-icon-cache /usr/share/icons/hicolor/
   ```

3. **GSettings schema errors**:
   ```bash
   sudo glib-compile-schemas /usr/share/glib-2.0/schemas/
   ```

4. **Permission denied when cleaning mesonbuilddir**:
   ```bash
   sudo rm -rf mesonbuilddir
   sudo chown -R $USER:$USER builddir
   ```

5. **TypeScript compilation errors**:
   - Ensure `@girs` packages are installed: `npm install`
   - Check TypeScript version: `npx tsc --version`

### Debug Mode:
```bash
# Run with debug output
GJS_DEBUG_OUTPUT=stderr ./builddir/main.js

# Run with GJS debugger
gjs --debugger builddir/main.js

# Check system logs for installation issues
journalctl -xe | grep obysion-system
```

## Debian Package

### Building the .deb Package
```bash
# Build the debian package
npm run deb-build

# The .deb file will be created in builddir/obision-system.deb
```

### Installing the Package
```bash
# Install the built package
npm run deb-install

# Or manually
sudo dpkg -i builddir/obision-system.deb
sudo apt-get install -f  # Install dependencies if needed
```

### Uninstalling the Package
```bash
npm run deb-uninstall
```

## Release Process

### Automated Release
Use the release script to automatically bump version, update files, and create git tag:

```bash
# This will:
# 1. Increment patch version (e.g., 1.0.0 → 1.0.1)
# 2. Update package.json, meson.build, and debian/changelog
# 3. Commit changes
# 4. Create annotated git tag
# 5. Push changes and tag to origin
npm run release
```

### Manual Release
If you need more control over versioning:

```bash
# 1. Update version in package.json
nano package.json

# 2. Update version in meson.build
nano meson.build

# 3. Update debian/changelog
dch -i  # Or edit manually

# 4. Commit and tag
git add .
git commit -m "Release version X.X.X"
git tag -a vX.X.X -m "Version X.X.X"
git push origin master
git push origin vX.X.X
```

### GitHub Actions Workflow
When you push a tag (e.g., `v1.0.1`), GitHub Actions will automatically:
1. Build the project
2. Create the `.deb` package
3. Create a GitHub Release with the package attached
4. Generate release notes

To trigger a release:
```bash
npm run release  # This creates and pushes the tag
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with both TypeScript and JavaScript
5. Submit a pull request

## License

This project is licensed under the GPL-3.0 License - see the desktop file for details.

## Resources

- [GJS Documentation](https://gjs-docs.gnome.org/)
- [GTK4 Documentation](https://docs.gtk.org/gtk4/)
- [Libadwaita Documentation](https://gnome.pages.gitlab.gnome.org/libadwaita/)
- [GNOME Developer Documentation](https://developer.gnome.org/)
- [Meson Build System](https://mesonbuild.com/)