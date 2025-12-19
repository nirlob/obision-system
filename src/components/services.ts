import Gtk from '@girs/gtk-4.0';
import Adw from '@girs/adw-1';
import GLib from '@girs/glib-2.0';
import { UtilsService } from '../services/utils-service';

export class ServicesComponent {
  private container: Gtk.Box;
  private listBox!: Gtk.ListBox;
  private utils: UtilsService;
  private searchEntry!: Gtk.SearchEntry;
  private serviceRows: Map<string, Adw.ActionRow> = new Map();
  private totalServicesLabel!: Gtk.Label;
  private activeServicesLabel!: Gtk.Label;
  private inactiveServicesLabel!: Gtk.Label;
  private failedServicesLabel!: Gtk.Label;
  private stats = { total: 0, active: 0, inactive: 0, failed: 0 };

  constructor() {
    this.utils = UtilsService.instance;
    const builder = Gtk.Builder.new();
    
    // Load UI file with fallback
    try {
      try {
        builder.add_from_file('/usr/share/com.obision.app.system/ui/services.ui');
      } catch (e) {
        builder.add_from_file('data/ui/services.ui');
      }
    } catch (e) {
      console.error('Could not load services.ui:', e);
      this.container = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 12,
      });
      return;
    }
    
    this.container = builder.get_object('services_container') as Gtk.Box;
    this.listBox = builder.get_object('services_list') as Gtk.ListBox;
    this.searchEntry = builder.get_object('services_search') as Gtk.SearchEntry;
    this.totalServicesLabel = builder.get_object('total_services_label') as Gtk.Label;
    this.activeServicesLabel = builder.get_object('active_services_label') as Gtk.Label;
    this.inactiveServicesLabel = builder.get_object('inactive_services_label') as Gtk.Label;
    this.failedServicesLabel = builder.get_object('failed_services_label') as Gtk.Label;
    
    // Setup search
    this.searchEntry.connect('search-changed', () => {
      this.filterServices();
    });
    
    // Load services
    this.loadServices();
  }

  private loadServices(): void {
    // Reset statistics
    this.stats = { total: 0, active: 0, inactive: 0, failed: 0 };
    
    try {
      // Get list of systemd services
      const [stdout] = this.utils.executeCommand('systemctl', [
        'list-units',
        '--type=service',
        '--all',
        '--no-pager',
        '--no-legend'
      ]);
      
      const lines = stdout.trim().split('\n');
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        // Parse systemctl output
        const parts = line.trim().split(/\s+/);
        if (parts.length < 4) continue;
        
        const serviceName = parts[0];
        const loadState = parts[1];
        const activeState = parts[2];
        const subState = parts[3];
        const description = parts.slice(4).join(' ');
        
        if (activeState === 'not-found') {
          continue;
        }
        
        this.addServiceRow(serviceName, activeState, subState, description);
        
        // Update statistics
        this.stats.total++;
        if (activeState === 'active') {
          this.stats.active++;
        } else if (activeState === 'failed') {
          this.stats.failed++;
        } else {
          this.stats.inactive++;
        }
      }
      
      // Update footer labels
      this.updateFooter();
    } catch (e) {
      console.error('Error loading services:', e);
      this.addErrorRow('Could not load system services');
    }
  }

  private addServiceRow(name: string, activeState: string, subState: string, description: string): void {
    const row = new Adw.ActionRow({
      title: name,
      subtitle: description || subState,
    });
    
    // Set icon based on state
    let iconName = 'media-playback-stop-symbolic';
    if (activeState === 'active') {
      iconName = 'emblem-ok-symbolic';
    } else if (activeState === 'failed') {
      iconName = 'dialog-error-symbolic';
    }
    
    const icon = new Gtk.Image({
      icon_name: iconName,
      pixel_size: 16,
    });
    row.add_prefix(icon);
    
    // Add status badge
    const statusLabel = new Gtk.Label({
      label: activeState.charAt(0).toUpperCase() + activeState.slice(1),
      valign: Gtk.Align.CENTER,
    });
    statusLabel.add_css_class('heading');
    
    if (activeState === 'active') {
      statusLabel.add_css_class('success');
    } else if (activeState === 'failed') {
      statusLabel.add_css_class('error');
    } else {
      statusLabel.add_css_class('dim-label');
    }
    
    row.add_suffix(statusLabel);
    
    // Add action buttons
    const actionBox = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 6,
      valign: Gtk.Align.CENTER,
    });
    
    if (activeState === 'active') {
      const stopButton = new Gtk.Button({
        icon_name: 'media-playback-stop-symbolic',
        tooltip_text: 'Stop service',
      });
      stopButton.add_css_class('flat');
      stopButton.connect('clicked', () => {
        this.controlService(name, 'stop');
      });
      actionBox.append(stopButton);
      
      const restartButton = new Gtk.Button({
        icon_name: 'view-refresh-symbolic',
        tooltip_text: 'Restart service',
      });
      restartButton.add_css_class('flat');
      restartButton.connect('clicked', () => {
        this.controlService(name, 'restart');
      });
      actionBox.append(restartButton);
    } else {
      const startButton = new Gtk.Button({
        icon_name: 'media-playback-start-symbolic',
        tooltip_text: 'Start service',
      });
      startButton.add_css_class('flat');
      startButton.connect('clicked', () => {
        this.controlService(name, 'start');
      });
      actionBox.append(startButton);
    }
    
    row.add_suffix(actionBox);
    
    this.serviceRows.set(name.toLowerCase(), row);
    this.listBox.append(row);
  }

  private addErrorRow(message: string): void {
    const row = new Adw.ActionRow({
      title: 'Error',
      subtitle: message,
    });
    
    const icon = new Gtk.Image({
      icon_name: 'dialog-error-symbolic',
      pixel_size: 16,
    });
    row.add_prefix(icon);
    
    this.listBox.append(row);
  }

  private controlService(serviceName: string, action: string): void {
    try {
      // Use pkexec to run systemctl with elevated privileges
      const [stdout, stderr] = this.utils.executeCommand('pkexec', [
        'systemctl',
        action,
        serviceName
      ]);
      
      // Check if authentication was cancelled
      if (stderr && (stderr.includes('dismissed') || stderr.includes('Error executing command'))) {
        console.log('Service control cancelled: authentication required');
        return;
      }
      
      console.log(`Service ${serviceName} ${action}ed successfully`);
      
      // Reload services after a short delay
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
        this.reloadServices();
        return GLib.SOURCE_REMOVE;
      });
    } catch (e) {
      console.error(`Error ${action}ing service ${serviceName}:`, e);
    }
  }

  private reloadServices(): void {
    // Clear existing rows
    let child = this.listBox.get_first_child();
    while (child) {
      const next = child.get_next_sibling();
      this.listBox.remove(child);
      child = next;
    }
    
    this.serviceRows.clear();
    this.loadServices();
  }

  private filterServices(): void {
    const searchText = this.searchEntry.get_text().toLowerCase();
    
    if (!searchText) {
      // Show all
      for (const row of this.serviceRows.values()) {
        row.set_visible(true);
      }
      return;
    }
    
    // Filter based on search text
    for (const [name, row] of this.serviceRows.entries()) {
      const title = (row.get_title() || '').toLowerCase();
      const subtitle = (row.get_subtitle() || '').toLowerCase();
      const matches = title.includes(searchText) || subtitle.includes(searchText);
      row.set_visible(matches);
    }
  }

  private updateFooter(): void {
    this.totalServicesLabel.set_label(this.stats.total.toString());
    this.activeServicesLabel.set_label(this.stats.active.toString());
    this.inactiveServicesLabel.set_label(this.stats.inactive.toString());
    this.failedServicesLabel.set_label(this.stats.failed.toString());
  }

  public getWidget(): Gtk.Box {
    return this.container;
  }
}
