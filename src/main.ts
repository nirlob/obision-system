import Gio from '@girs/gio-2.0';
import Gtk from '@girs/gtk-4.0';
import Gdk from '@girs/gdk-4.0';
import Adw from '@girs/adw-1';
import { SettingsService } from './services/settings-service';
import { ResumeComponent } from './components/resume';
import { CpuComponent } from './components/cpu';
import { GpuComponent } from './components/gpu';
import { MemoryComponent } from './components/memory';
import { DiskComponent } from './components/disk';
import { NetworkComponent } from './components/network';
import { SystemInfoComponent } from './components/system-info';
import { ProcessesComponent } from './components/processes';
import { ServicesComponent } from './components/services';
import { DriversComponent } from './components/drivers';
import { LogsComponent } from './components/logs';

class ObisionStatusApplication {
  private application: Adw.Application;

  constructor() {
    // Create the application
    this.application = new Adw.Application({
      application_id: 'com.obision.ObisionSystem',
      flags: Gio.ApplicationFlags.DEFAULT_FLAGS,
    });

    // Connect signals
    this.application.connect('activate', this.onActivate.bind(this));
    this.application.connect('startup', this.onStartup.bind(this));
  }

  private onStartup(): void {
    console.log('Application starting up...');

    // Add application actions for menu
    const aboutAction = new Gio.SimpleAction({ name: 'about' });
    aboutAction.connect('activate', () => {
      const windows = this.application.get_windows();
      if (windows.length > 0) {
        this.showAboutDialog(windows[0]);
      }
    });
    this.application.add_action(aboutAction);

    const preferencesAction = new Gio.SimpleAction({ name: 'preferences' });
    preferencesAction.connect('activate', () => {
      const windows = this.application.get_windows();
      if (windows.length > 0) {
        this.showPreferencesDialog(windows[0]);
      }
    });
    this.application.add_action(preferencesAction);

    const quitAction = new Gio.SimpleAction({ name: 'quit' });
    quitAction.connect('activate', () => {
      this.application.quit();
    });
    this.application.add_action(quitAction);

    // Set keyboard shortcuts
    this.application.set_accels_for_action('app.quit', ['<Ctrl>Q']);

    // Set resource path
    // this.application.set_resource_base_path('/data');
  }

  private onActivate(): void {
    console.log('Application activated');

    // Load CSS
    const cssProvider = new Gtk.CssProvider();
    try {
      cssProvider.load_from_path('/usr/share/com.obision.ObisionSystem/style.css');
    } catch (e) {
      cssProvider.load_from_path('data/style.css');
    }

    const display = Gdk.Display.get_default();
    if (display) {
      Gtk.StyleContext.add_provider_for_display(display, cssProvider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
    }

    // Create and show the main window
    const window = this.createMainWindow();
    console.log('Window created, presenting...');
    window.present();
  }

  private createMainWindow(): Adw.ApplicationWindow {
    // Load UI from resource
    const builder = Gtk.Builder.new();

    // Fallback: load from file
    try {
      // Try installed path first
      try {
        builder.add_from_file('/usr/share/com.obision.ObisionSystem/ui/main.ui');
      } catch (e) {
        builder.add_from_file('data/ui/main.ui');
      }
      console.log('Loaded UI from file');
    } catch (e2) {
      console.error('Could not load UI file:', e2);
      console.log('Using fallback UI');

      this.application.quit();
    }

    const window = builder.get_object('application_window') as Adw.ApplicationWindow;
    window.set_application(this.application);

    // Load window state from settings
    const settings = SettingsService.instance;
    const width = settings.getWindowWidth();
    const height = settings.getWindowHeight();
    const x = settings.getWindowX();
    const y = settings.getWindowY();
    const maximized = settings.getWindowMaximized();

    window.set_default_size(width, height);
    
    if (maximized) {
      window.maximize();
    }

    // Save window state on close
    window.connect('close-request', () => {
      const [currentWidth, currentHeight] = window.get_default_size();
      settings.setWindowWidth(currentWidth);
      settings.setWindowHeight(currentHeight);
      settings.setWindowMaximized(window.is_maximized());
      return false;
    });

    console.log('Setting up UI with loaded content');

    // Get UI elements
    const mainContent = builder.get_object('main_content') as Gtk.Box;
    const contentTitle = builder.get_object('content_title') as Gtk.Label;
    
    // Get navigation buttons
    const menuButton0 = builder.get_object('menu_option_0') as Gtk.ToggleButton;
    const menuButton1 = builder.get_object('menu_option_1') as Gtk.ToggleButton;
    const menuButton2 = builder.get_object('menu_option_2') as Gtk.ToggleButton;
    const menuButton3 = builder.get_object('menu_option_3') as Gtk.ToggleButton;
    const menuButton4 = builder.get_object('menu_option_4') as Gtk.ToggleButton;
    const menuButton5 = builder.get_object('menu_option_5') as Gtk.ToggleButton;
        const menuButton6 = builder.get_object('menu_option_6') as Gtk.ToggleButton;
        const menuButton8 = builder.get_object('menu_option_8') as Gtk.ToggleButton;
        const menuButton9 = builder.get_object('menu_option_9') as Gtk.ToggleButton;
        const menuButton10 = builder.get_object('menu_option_10') as Gtk.ToggleButton;
        const menuButton11 = builder.get_object('menu_option_11') as Gtk.ToggleButton;
    
    // Store all menu buttons for selection management
    const allMenuButtons = [menuButton0, menuButton1, menuButton2, menuButton3, menuButton4, menuButton5, menuButton6, menuButton8, menuButton9, menuButton10, menuButton11];
    
    // Setup navigation
    menuButton0.connect('clicked', () => {
      this.onNavigationItemSelected(0, mainContent, menuButton0, allMenuButtons, contentTitle);
    });
    menuButton1.connect('clicked', () => {
      this.onNavigationItemSelected(1, mainContent, menuButton1, allMenuButtons, contentTitle);
    });
    menuButton2.connect('clicked', () => {
      this.onNavigationItemSelected(2, mainContent, menuButton2, allMenuButtons, contentTitle);
    });
    menuButton3.connect('clicked', () => {
      this.onNavigationItemSelected(3, mainContent, menuButton3, allMenuButtons, contentTitle);
    });
    menuButton4.connect('clicked', () => {
      this.onNavigationItemSelected(4, mainContent, menuButton4, allMenuButtons, contentTitle);
    });
    menuButton5.connect('clicked', () => {
      this.onNavigationItemSelected(5, mainContent, menuButton5, allMenuButtons, contentTitle);
    });
    menuButton6.connect('clicked', () => {
      this.onNavigationItemSelected(6, mainContent, menuButton6, allMenuButtons, contentTitle);
    });
    menuButton8.connect('clicked', () => {
      this.onNavigationItemSelected(7, mainContent, menuButton8, allMenuButtons, contentTitle);
    });
    menuButton9.connect('clicked', () => {
      this.onNavigationItemSelected(8, mainContent, menuButton9, allMenuButtons, contentTitle);
    });
    menuButton10.connect('clicked', () => {
      this.onNavigationItemSelected(9, mainContent, menuButton10, allMenuButtons, contentTitle);
    });
    menuButton11.connect('clicked', () => {
      this.onNavigationItemSelected(10, mainContent, menuButton11, allMenuButtons, contentTitle);
    });

    // Show first view by default
    this.onNavigationItemSelected(0, mainContent, menuButton0, allMenuButtons, contentTitle);

    return window;
  }

  private onNavigationItemSelected(index: number, contentBox: Gtk.Box, selectedButton: Gtk.ToggleButton, allButtons: Gtk.ToggleButton[], titleLabel: Gtk.Label): void {
    // Update button toggle state
    allButtons.forEach(button => {
      button.set_active(false);
    });
    selectedButton.set_active(true);
    
    // Get the label text from the button and set it as title
    const buttonChild = selectedButton.get_child() as Gtk.Box;
    if (buttonChild) {
      let labelWidget = buttonChild.get_first_child();
      while (labelWidget) {
        if (labelWidget instanceof Gtk.Label) {
          titleLabel.set_label(labelWidget.get_label() || '');
          break;
        }
        labelWidget = labelWidget.get_next_sibling();
      }
    }
    
    // Clear current content
    let child = contentBox.get_first_child();
    while (child) {
      const next = child.get_next_sibling();
      contentBox.remove(child);
      child = next;
    }

    // Add content based on selection
    switch (index) {
      case 0: // Resume
        this.showResume(contentBox);
        break;
      case 1: // CPU
        this.showCpu(contentBox);
        break;
      case 2: // GPU
        this.showGpu(contentBox);
        break;
      case 3: // Memory
        this.showMemory(contentBox);
        break;
      case 4: // Disk
        this.showDisk(contentBox);
        break;
      case 5: // Network
        this.showNetwork(contentBox);
        break;
      case 6: // System Info
        this.showSystemInfo(contentBox);
        break;
      case 7: // Processes
        this.showProcesses(contentBox);
        break;
      case 8: // Services
        this.showServices(contentBox);
        break;
      case 9: // Drivers
        this.showDrivers(contentBox);
        break;
      case 10: // Logs
        this.showLogs(contentBox);
        break;
    }
  }

  private showResume(contentBox: Gtk.Box): void {
    const component = new ResumeComponent();
    contentBox.append(component.getWidget());
  }

  private showCpu(contentBox: Gtk.Box): void {
    const component = new CpuComponent();
    contentBox.append(component.getWidget());
  }

  private showGpu(contentBox: Gtk.Box): void {
    const component = new GpuComponent();
    contentBox.append(component.getWidget());
  }

  private showMemory(contentBox: Gtk.Box): void {
    const memoryComponent = new MemoryComponent();
    contentBox.append(memoryComponent.getWidget());
  }

  private showDisk(contentBox: Gtk.Box): void {
    const diskComponent = new DiskComponent();
    contentBox.append(diskComponent.getWidget());
  }

  private showNetwork(contentBox: Gtk.Box): void {
    const component = new NetworkComponent();
    contentBox.append(component.getWidget());
  }

  private showSystemInfo(contentBox: Gtk.Box): void {
    const component = new SystemInfoComponent();
    contentBox.append(component.getWidget());
  }

  private showProcesses(contentBox: Gtk.Box): void {
    const component = new ProcessesComponent();
    contentBox.append(component.getWidget());
  }

  private showServices(contentBox: Gtk.Box): void {
    const component = new ServicesComponent();
    contentBox.append(component.getWidget());
  }

  private showDrivers(contentBox: Gtk.Box): void {
    const component = new DriversComponent();
    contentBox.append(component.getWidget());
  }

  private showLogs(contentBox: Gtk.Box): void {
    const component = new LogsComponent();
    contentBox.append(component.getWidget());
  }

  private showAboutDialog(parent: Gtk.Window): void {
    const aboutDialog = new Adw.AboutWindow({
      transient_for: parent,
      modal: true,
      application_name: 'Obision System',
      application_icon: 'com.obision.ObisionSystem',
      developer_name: 'Jose Francisco Gonzalez',
      version: '1.0.0',
      developers: ['Jose Francisco Gonzalez <jfgs1609@gmail.com>'],
      copyright: `© ${new Date().getFullYear()} Jose Francisco Gonzalez`,
      license_type: Gtk.License.GPL_3_0,
      website: 'https://obision.com',
      issue_url: 'https://github.com/nirlob/obision-system/issues',
    });

    aboutDialog.present();
  }

  private showPreferencesDialog(parent: Gtk.Window): void {
    const builder = Gtk.Builder.new();
    
    try {
      try {
        builder.add_from_file('/usr/share/com.obision.ObisionSystem/ui/preferences.ui');
      } catch (e) {
        builder.add_from_file('data/ui/preferences.ui');
      }
    } catch (e) {
      console.error('Could not load preferences.ui:', e);
      return;
    }

    const prefsWindow = builder.get_object('preferences_window') as Adw.PreferencesWindow;
    const refreshIntervalSpin = builder.get_object('refresh_interval_spin') as Gtk.SpinButton;

    prefsWindow.set_transient_for(parent);

    // Load current settings
    const settings = SettingsService.instance;
    refreshIntervalSpin.set_value(settings.getRefreshInterval());

    // Save settings when changed
    refreshIntervalSpin.connect('value-changed', () => {
      const value = refreshIntervalSpin.get_value();
      settings.setRefreshInterval(value);
      console.log(`Refresh interval changed to ${value} seconds`);
    });

    prefsWindow.present();
  }

  public run(argv: string[]): number {
    return this.application.run(argv);
  }
}

// Main function
function main(argv: string[]): number {
  const app = new ObisionStatusApplication();
  return app.run(argv);
}

// Run the application
if (typeof ARGV !== 'undefined') {
  main(ARGV);
} else {
  main([]);
}
