# Changelog

## [1.0.1] - 2025-12-07

### Fixed
- **Naming Correction**: Fixed spelling from "Obysion" to "Obision" throughout the project
  - Updated application ID: `com.obysion.ObysionSystem` → `com.obision.ObisionSystem`
  - Updated package name: `obysion-system` → `obision-system`
  - Updated executable: `obysion-system` → `obision-system`
  - Renamed all configuration files and icons to use correct spelling
  - Updated all source code references

- **Battery Information**: Fixed "N/A" display in system-info component
  - Now correctly parses battery data from fastfetch (array format)
  - Displays battery capacity, status, and model name
  - Added proper handling for systems without battery sensors

- **Temperature Display**: Fixed "NaN" in resume component temperature gauges
  - Returns -1 when temperature sensors are not available
  - Displays "N/A" instead of invalid numbers
  - Temperature charts only draw when valid data is available
  - Added fallback search for thermal zones (thermal_zone0 through thermal_zone5)

### Added
- **Icon System**: Complete icon set with multiple resolutions
  - Modern GNOME-style design with blue gradient
  - Added 128x128 and 256x256 sizes for HiDPI support
  - Generated PNG icons: 48x48, 64x64, 128x128, 256x256
  - Maintained SVG scalable version
  - Updated meson.build to install all icon sizes

- **Build System**: 
  - Added `sudo` to meson-install and meson-uninstall scripts
  - Updated meson-clean to remove gschemas.compiled files
  - Fixed GResource configuration (removed xml-stripblanks requirement)
  - Added all UI files and CSS to gresource bundle

### Changed
- Application name: "Obysion System Monitor" → "Obision System"
- Desktop file updated with correct executable name

## [1.0.0] - 2025-11-26

### Initial Release
- Complete system monitoring application for GNOME
- Dashboard with circular charts and system overview
- Multiple monitoring components (CPU, GPU, Memory, Disk, Network, etc.)
- Settings persistence with GSettings
- Modern GTK4/Libadwaita UI

### New Features
- **Dashboard Component (Resume)**:
  - Circular charts with 70° bottom gap for CPU, GPU, Memory, Disk, and Network
  - CPU temperature monitoring with color-coded display
  - GPU temperature monitoring (supports nvidia-smi and sensors)
  - System load visualization with progress bars (1/5/15 min averages)
  - Top processes list
  - System information summary

- **Settings Persistence**:
  - Window state (width, height, position, maximized) saved across sessions
  - Configurable refresh interval (1-60 seconds)
  - Preferences dialog for easy configuration
  - Dynamic refresh interval updates without restart

- **Settings Service**:
  - GSettings integration for persistent configuration
  - Singleton pattern for easy access
  - Signal connections for reactive updates

### Components
- Resume: Dashboard with circular charts and system overview
- CPU: Detailed CPU information
- GPU: GPU monitoring and information
- Memory: Memory usage and statistics
- Disk: Disk usage and information
- Network: Network interfaces and statistics
- System Info: System information details
- Resources: Resource monitoring
- Processes: Process list and management
- Services: System services management
- Drivers: Driver information
- Logs: System logs viewer

### Technical Improvements
- TypeScript → GJS build system with automatic conversion
- Hybrid build system (npm + Meson)
- GSettings schema compilation in build process
- Proper service module handling in build script
- Dual-path fallback for UI and resource loading (development vs. installed)

### Architecture
- Singleton pattern for services (UtilsService, SettingsService)
- Component-based UI architecture
- GTK4 and Libadwaita integration
- Adaptive layout with responsive sidebar
- Custom CSS styling support

### Documentation
- Updated README.md with new branding and features
- Added comprehensive project structure documentation
- Included troubleshooting guide
- Added development workflow instructions
