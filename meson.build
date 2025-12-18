project('obision-app-system',
  version: '1.7.0',
  meson_version: '>= 0.59.0',
)

gnome = import('gnome')

# Application ID
app_id = 'com.obision.ObisionAppSystem'

# Configuration
conf = configuration_data()
conf.set('app_id', app_id)
conf.set('version', meson.project_version())

# Dependencies (GJS is available but not as pkg-config)
# dependency('gjs-1.0', version: '>= 1.66.0')

# Install directories
bindir = get_option('bindir')
datadir = get_option('datadir')
pkgdatadir = datadir / app_id

# Install the main script (from builddir, not src)
install_data('builddir/main.js',
  install_dir: pkgdatadir,
)

# Install UI files
install_subdir('data/ui',
  install_dir: pkgdatadir,
)

# Install CSS file
install_data('data/style.css',
  install_dir: pkgdatadir,
)

# Install resources
gnome.compile_resources(
  app_id + '.src',
  'data/' + app_id + '.gresource.xml',
  gresource_bundle: true,
  install: true,
  install_dir: pkgdatadir,
)

# Create and install desktop file
desktop_file = configure_file(
  input: 'data/' + app_id + '.desktop.in',
  output: app_id + '.desktop',
  configuration: conf,
  install: true,
  install_dir: datadir / 'applications',
)

# Install schema (if needed)
install_data('data/' + app_id + '.gschema.xml',
  install_dir: datadir / 'glib-2.0' / 'schemas'
)

# Install icons
install_data('data/icons/hicolor/scalable/apps/' + app_id + '.svg',
  install_dir: datadir / 'icons' / 'hicolor' / 'scalable' / 'apps'
)

install_data('data/icons/hicolor/48x48/apps/' + app_id + '.png',
  install_dir: datadir / 'icons' / 'hicolor' / '48x48' / 'apps'
)

install_data('data/icons/hicolor/64x64/apps/' + app_id + '.png',
  install_dir: datadir / 'icons' / 'hicolor' / '64x64' / 'apps'
)

install_data('data/icons/hicolor/128x128/apps/' + app_id + '.png',
  install_dir: datadir / 'icons' / 'hicolor' / '128x128' / 'apps'
)

install_data('data/icons/hicolor/256x256/apps/' + app_id + '.png',
  install_dir: datadir / 'icons' / 'hicolor' / '256x256' / 'apps'
)

# Create launcher script
configure_file(
  input: 'bin/obision-app-system.in',
  output: 'obision-app-system',
  configuration: conf,
  install: true,
  install_dir: bindir,
  install_mode: 'rwxr-xr-x',
)