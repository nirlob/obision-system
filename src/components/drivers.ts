import Gtk from '@girs/gtk-4.0';
import Adw from '@girs/adw-1';
import GLib from '@girs/glib-2.0';
import { UtilsService } from '../services/utils-service';

interface DriverInfo {
  name: string;
  description: string;
  version?: string;
  used?: string;
}

export class DriversComponent {
  private container: Gtk.Box;
  private stack!: Gtk.Stack;
  private refreshButton!: Gtk.Button;
  private kernelDriversGroup!: Gtk.ListBox;
  private graphicsDriversGroup!: Gtk.ListBox;
  private networkDriversGroup!: Gtk.ListBox;
  private storageDriversGroup!: Gtk.ListBox;
  private audioDriversGroup!: Gtk.ListBox;
  private usbDriversGroup!: Gtk.ListBox;
  private utils: UtilsService;

  constructor() {
    this.utils = UtilsService.instance;
    const builder = Gtk.Builder.new();
    
    try {
      try {
        builder.add_from_file('/usr/share/com.obision.ObisionSystem/ui/drivers.ui');
      } catch (e) {
        builder.add_from_file('data/ui/drivers.ui');
      }
    } catch (e) {
      console.error('Could not load drivers.ui:', e);
      this.container = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 12,
      });
      return;
    }

    this.container = builder.get_object('drivers_container') as Gtk.Box;
    this.stack = builder.get_object('drivers_stack') as Gtk.Stack;
    this.refreshButton = builder.get_object('drivers_refresh_button') as Gtk.Button;
    this.kernelDriversGroup = builder.get_object('kernel_drivers_group') as Gtk.ListBox;
    this.graphicsDriversGroup = builder.get_object('graphics_drivers_group') as Gtk.ListBox;
    this.networkDriversGroup = builder.get_object('network_drivers_group') as Gtk.ListBox;
    this.storageDriversGroup = builder.get_object('storage_drivers_group') as Gtk.ListBox;
    this.audioDriversGroup = builder.get_object('audio_drivers_group') as Gtk.ListBox;
    this.usbDriversGroup = builder.get_object('usb_drivers_group') as Gtk.ListBox;
    
    // Get refresh button
    this.refreshButton.connect('clicked', () => {
      this.loadDrivers(true);
    });
    
    // Load drivers on initial load
    GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
      this.stack.set_visible_child_name('loading');
      this.refreshButton.set_sensitive(false);
      
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
        this.loadDriversInternal();
        return GLib.SOURCE_REMOVE;
      });
      
      return GLib.SOURCE_REMOVE;
    });
  }

  private loadDrivers(showLoading: boolean = false): void {
    if (showLoading) {
      // Show loading and disable refresh button
      this.stack.set_visible_child_name('loading');
      this.refreshButton.set_sensitive(false);
    }
    
    // Use GLib.timeout_add to ensure loading is visible before heavy work
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
      this.loadDriversInternal();
      return GLib.SOURCE_REMOVE;
    });
  }

  private loadDriversInternal(): void {
    // Clear existing rows
    this.clearGroup(this.graphicsDriversGroup);
    this.clearGroup(this.networkDriversGroup);
    this.clearGroup(this.storageDriversGroup);
    this.clearGroup(this.audioDriversGroup);
    this.clearGroup(this.usbDriversGroup);
    this.clearGroup(this.kernelDriversGroup);
    
    // Load each category with delays
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
      this.loadGraphicsDrivers();
      return GLib.SOURCE_REMOVE;
    });
    
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
      this.loadNetworkDrivers();
      return GLib.SOURCE_REMOVE;
    });
    
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 800, () => {
      this.loadStorageDrivers();
      return GLib.SOURCE_REMOVE;
    });
    
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1100, () => {
      this.loadAudioDrivers();
      return GLib.SOURCE_REMOVE;
    });
    
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1400, () => {
      this.loadUSBDrivers();
      return GLib.SOURCE_REMOVE;
    });
    
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1700, () => {
      this.loadKernelModules();
      return GLib.SOURCE_REMOVE;
    });
    
    // Show content after all loads complete - wait longer
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2500, () => {
      this.stack.set_visible_child_name('content');
      this.refreshButton.set_sensitive(true);
      return GLib.SOURCE_REMOVE;
    });
  }

  private clearGroup(listBox: Gtk.ListBox): void {
    // Remove all rows from the list box
    listBox.remove_all();
  }

  private addDriverRow(listBox: Gtk.ListBox, driver: DriverInfo): void {
    const row = new Adw.ActionRow({
      title: driver.name,
      subtitle: driver.description,
    });
    
    if (driver.version) {
      const versionLabel = new Gtk.Label({
        label: driver.version,
        css_classes: ['dim-label', 'caption'],
        halign: Gtk.Align.END,
        valign: Gtk.Align.CENTER,
      });
      row.add_suffix(versionLabel);
    }
    
    if (driver.used) {
      const usedLabel = new Gtk.Label({
        label: `Used: ${driver.used}`,
        css_classes: ['dim-label', 'caption'],
        halign: Gtk.Align.END,
        valign: Gtk.Align.CENTER,
      });
      row.add_suffix(usedLabel);
    }
    
    listBox.append(row);
  }

  private loadGraphicsDrivers(): void {
    try {
      // Get GPU info from lspci
      const [lspciOut] = this.utils.executeCommand('lspci', ['-k']);
      const lines = lspciOut.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('VGA') || line.includes('3D') || line.includes('Display')) {
          const deviceName = line.split(':').slice(2).join(':').trim();
          let driver = 'Unknown';
          let version = '';
          
          // Look for kernel driver in use
          for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
            if (lines[j].includes('Kernel driver in use:')) {
              driver = lines[j].split(':')[1].trim();
              
              // Try to get version
              try {
                const [modInfoOut] = this.utils.executeCommand('modinfo', [driver]);
                const versionLine = modInfoOut.split('\n').find(l => l.includes('version:'));
                if (versionLine) {
                  version = versionLine.split(':')[1].trim();
                }
              } catch (e) {
                // Ignore if modinfo fails
              }
              break;
            }
          }
          
          this.addDriverRow(this.graphicsDriversGroup, {
            name: driver,
            description: deviceName,
            version: version || undefined,
          });
        }
      }
    } catch (error) {
      console.error('Error loading graphics drivers:', error);
    }
  }

  private loadNetworkDrivers(): void {
    try {
      const [lspciOut] = this.utils.executeCommand('lspci', ['-k']);
      const lines = lspciOut.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('Network') || line.includes('Ethernet') || line.includes('Wireless')) {
          const deviceName = line.split(':').slice(2).join(':').trim();
          let driver = 'Unknown';
          let version = '';
          
          for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
            if (lines[j].includes('Kernel driver in use:')) {
              driver = lines[j].split(':')[1].trim();
              
              try {
                const [modInfoOut] = this.utils.executeCommand('modinfo', [driver]);
                const versionLine = modInfoOut.split('\n').find(l => l.includes('version:'));
                if (versionLine) {
                  version = versionLine.split(':')[1].trim();
                }
              } catch (e) {
                // Ignore
              }
              break;
            }
          }
          
          this.addDriverRow(this.networkDriversGroup, {
            name: driver,
            description: deviceName,
            version: version || undefined,
          });
        }
      }
    } catch (error) {
      console.error('Error loading network drivers:', error);
    }
  }

  private loadStorageDrivers(): void {
    try {
      const [lspciOut] = this.utils.executeCommand('lspci', ['-k']);
      const lines = lspciOut.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('SATA') || line.includes('RAID') || line.includes('NVMe') || 
            line.includes('IDE') || line.includes('SCSI') || line.includes('Mass storage')) {
          const deviceName = line.split(':').slice(2).join(':').trim();
          let driver = 'Unknown';
          let version = '';
          
          for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
            if (lines[j].includes('Kernel driver in use:')) {
              driver = lines[j].split(':')[1].trim();
              
              try {
                const [modInfoOut] = this.utils.executeCommand('modinfo', [driver]);
                const versionLine = modInfoOut.split('\n').find(l => l.includes('version:'));
                if (versionLine) {
                  version = versionLine.split(':')[1].trim();
                }
              } catch (e) {
                // Ignore
              }
              break;
            }
          }
          
          this.addDriverRow(this.storageDriversGroup, {
            name: driver,
            description: deviceName,
            version: version || undefined,
          });
        }
      }
    } catch (error) {
      console.error('Error loading storage drivers:', error);
    }
  }

  private loadAudioDrivers(): void {
    try {
      const [lspciOut] = this.utils.executeCommand('lspci', ['-k']);
      const lines = lspciOut.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('Audio') || line.includes('Sound') || line.includes('Multimedia')) {
          const deviceName = line.split(':').slice(2).join(':').trim();
          let driver = 'Unknown';
          let version = '';
          
          for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
            if (lines[j].includes('Kernel driver in use:')) {
              driver = lines[j].split(':')[1].trim();
              
              try {
                const [modInfoOut] = this.utils.executeCommand('modinfo', [driver]);
                const versionLine = modInfoOut.split('\n').find(l => l.includes('version:'));
                if (versionLine) {
                  version = versionLine.split(':')[1].trim();
                }
              } catch (e) {
                // Ignore
              }
              break;
            }
          }
          
          this.addDriverRow(this.audioDriversGroup, {
            name: driver,
            description: deviceName,
            version: version || undefined,
          });
        }
      }
    } catch (error) {
      console.error('Error loading audio drivers:', error);
    }
  }

  private loadUSBDrivers(): void {
    try {
      const [lspciOut] = this.utils.executeCommand('lspci', ['-k']);
      const lines = lspciOut.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('USB')) {
          const deviceName = line.split(':').slice(2).join(':').trim();
          let driver = 'Unknown';
          let version = '';
          
          for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
            if (lines[j].includes('Kernel driver in use:')) {
              driver = lines[j].split(':')[1].trim();
              
              try {
                const [modInfoOut] = this.utils.executeCommand('modinfo', [driver]);
                const versionLine = modInfoOut.split('\n').find(l => l.includes('version:'));
                if (versionLine) {
                  version = versionLine.split(':')[1].trim();
                }
              } catch (e) {
                // Ignore
              }
              break;
            }
          }
          
          this.addDriverRow(this.usbDriversGroup, {
            name: driver,
            description: deviceName,
            version: version || undefined,
          });
        }
      }
    } catch (error) {
      console.error('Error loading USB drivers:', error);
    }
  }

  private loadKernelModules(): void {
    try {
      // Get top loaded modules by usage
      const [lsmodOut] = this.utils.executeCommand('lsmod', []);
      const lines = lsmodOut.split('\n').slice(1); // Skip header
      
      // Parse and sort by used count
      const modules: { name: string; size: string; used: string; by: string }[] = [];
      
      for (const line of lines) {
        if (!line.trim()) continue;
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3) {
          modules.push({
            name: parts[0],
            size: parts[1],
            used: parts[2],
            by: parts.slice(3).join(' '),
          });
        }
      }
      
      // Sort by usage (convert to number)
      modules.sort((a, b) => parseInt(b.used) - parseInt(a.used));
      
      // Show top 10 most used modules
      for (let i = 0; i < Math.min(10, modules.length); i++) {
        const module = modules[i];
        
        let version = '';
        let description = '';
        let author = '';
        let license = '';
        let filename = '';
        
        try {
          const [modInfoOut] = this.utils.executeCommand('/usr/sbin/modinfo', [module.name]);
          const infoLines = modInfoOut.split('\n');
          
          for (const line of infoLines) {
            if (line.startsWith('version:')) {
              version = line.substring('version:'.length).trim();
            } else if (line.startsWith('description:')) {
              description = line.substring('description:'.length).trim();
            } else if (line.startsWith('author:')) {
              author = line.substring('author:'.length).trim();
            } else if (line.startsWith('license:')) {
              license = line.substring('license:'.length).trim();
            } else if (line.startsWith('filename:')) {
              filename = line.substring('filename:'.length).trim();
            }
          }
        } catch (e) {
          // Ignore
        }
        
        this.addKernelModuleRow(this.kernelDriversGroup, {
          name: module.name,
          size: module.size,
          used: module.used,
          usedBy: module.by,
          version: version,
          description: description,
          author: author,
          license: license,
          filename: filename,
        });
      }
    } catch (error) {
      console.error('Error loading kernel modules:', error);
    }
  }

  private addKernelModuleRow(listBox: Gtk.ListBox, module: {
    name: string;
    size: string;
    used: string;
    usedBy: string;
    version?: string;
    description?: string;
    author?: string;
    license?: string;
    filename?: string;
  }): void {
    const expanderRow = new Adw.ExpanderRow({
      title: module.name,
      subtitle: '',
    });
    // Asignar el subtítulo solo con texto plano
    expanderRow.set_subtitle(module.description || 'Kernel module');
    // Add version suffix if available
    if (module.version) {
      const versionLabel = new Gtk.Label({
        label: module.version,
        css_classes: ['dim-label', 'caption'],
        halign: Gtk.Align.END,
        valign: Gtk.Align.CENTER,
      });
      expanderRow.add_suffix(versionLabel);
    }

    // Add detailed information rows
    const usedRow = new Adw.ActionRow({
      title: 'Used',
      subtitle: '',
    });
    usedRow.set_subtitle(module.used);
    expanderRow.add_row(usedRow);

    if (module.usedBy) {
      const usedByRow = new Adw.ActionRow({
        title: 'Used by',
        subtitle: '',
      });
      usedByRow.set_subtitle(module.usedBy);
      expanderRow.add_row(usedByRow);
    }

    const sizeBytes = parseInt(module.size);
    const formattedSize = this.utils.formatBytes(sizeBytes);
    const sizeRow = new Adw.ActionRow({
      title: 'Size',
      subtitle: '',
    });
    sizeRow.set_subtitle(formattedSize);
    expanderRow.add_row(sizeRow);

    if (module.author) {
      // Mostrar el autor tal cual, permitiendo arroba y evitando markup
      const authorRow = new Adw.ActionRow({
        title: 'Author',
        subtitle: '',
      });
      authorRow.set_subtitle(module.author);
      expanderRow.add_row(authorRow);
    }

    if (module.license) {
      const licenseRow = new Adw.ActionRow({
        title: 'License',
        subtitle: '',
      });
      licenseRow.set_subtitle(module.license);
      expanderRow.add_row(licenseRow);
    }

    if (module.filename) {
      const filenameRow = new Adw.ActionRow({
        title: 'Filename',
        subtitle: '',
      });
      filenameRow.set_subtitle(module.filename);
      expanderRow.add_row(filenameRow);
    }

    listBox.append(expanderRow);
  }

  public getWidget(): Gtk.Box {
    return this.container;
  }
}
