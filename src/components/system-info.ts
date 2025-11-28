import Gtk from '@girs/gtk-4.0';
import Adw from '@girs/adw-1';
import { UtilsService } from '../services/utils-service';

export class SystemInfoComponent {
  private container: Gtk.Box;
  private listBox!: Gtk.ListBox;
  private utils: UtilsService;

  constructor() {
    this.utils = UtilsService.instance;
    const builder = Gtk.Builder.new();
    
    // Load UI file with fallback
    try {
      try {
        builder.add_from_file('/usr/share/com.obysion.ObysionSystem/ui/system-info.ui');
      } catch (e) {
        builder.add_from_file('data/ui/system-info.ui');
      }
    } catch (e) {
      console.error('Could not load system-info.ui:', e);
      this.container = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 12,
      });
      return;
    }
    
    this.container = builder.get_object('system_info_container') as Gtk.Box;
    this.listBox = builder.get_object('system_info_list') as Gtk.ListBox;
    
    // Load system info
    this.loadSystemInfo();
  }

  private loadSystemInfo(): void {
    try {
      const [stdout] = this.utils.executeCommand('fastfetch', ['--format', 'json']);
      const data = JSON.parse(stdout);
      
      // Process each entry from fastfetch
      for (const item of data) {
        if (item.error || item.type === 'Separator' || item.type === 'Title') {
          continue;
        }
        
        const result = item.result;
        let title = '';
        let subtitle = '';
        let icon = '';
        
        switch (item.type) {
          case 'OS':
            title = 'OS';
            subtitle = result.prettyName || result.name;
            icon = 'computer-symbolic';
            break;
          case 'Host':
            title = 'Host';
            subtitle = result.name;
            icon = 'computer-symbolic';
            break;
          case 'Kernel':
            title = 'Kernel';
            subtitle = `${result.name} ${result.release}`;
            icon = 'emblem-system-symbolic';
            break;
          case 'Uptime':
            title = 'Uptime';
            subtitle = this.formatUptime(result.uptime);
            icon = 'document-open-recent-symbolic';
            break;
          case 'Packages':
            title = 'Packages';
            const packages = [];
            if (result.dpkg > 0) packages.push(`${result.dpkg} (dpkg)`);
            if (result.flatpakSystem > 0 || result.flatpakUser > 0) {
              packages.push(`${result.flatpakSystem + result.flatpakUser} (flatpak)`);
            }
            if (result.snap > 0) packages.push(`${result.snap} (snap)`);
            subtitle = packages.join(', ');
            icon = 'package-x-generic-symbolic';
            break;
          case 'Shell':
            title = 'Shell';
            subtitle = result.version ? `${result.exeName} ${result.version}` : result.exeName;
            icon = 'utilities-terminal-symbolic';
            break;
          case 'Display':
            title = 'Display';
            result.forEach((display: {name: string, output: any}, index: number) => {
              subtitle += `${display.name} - ${display.output.refreshRate ? `${display.output.width}x${display.output.height}@${display.output.refreshRate} Hz` : `${display.output.width}x${display.output.height}`}`;
              if (index < result.length - 1) {
                subtitle += '\n';
              }
            });
            icon = 'video-display-symbolic';
          break;
          case 'DE':
            title = 'Desktop Environment';
            subtitle = result.version ? `${result.prettyName} ${result.version}` : result.prettyName || result.name;
            icon = 'computer-symbolic';
            break;
          case 'WM':
            title = 'Window Manager';
            subtitle = `${result.prettyName} (${result.protocolName})`;
            icon = 'computer-apple-ipad-symbolic';
            break;
          case 'Theme':
            title = 'Theme';
            subtitle = result.pretty || result.name;
            icon = 'preferences-desktop-theme-symbolic';
            break;
          case 'Icons':
            title = 'Icons';
            subtitle = result.pretty || result.name;
            icon = 'preferences-desktop-icons-symbolic';
            break;
          case 'Font':
            if (result.pretty || result.name) {
              title = 'Font';
              subtitle = result.pretty || result.name;
              icon = 'font-x-generic-symbolic';
            }
            break;
          case 'Cursor':
            if (result.name) {
              title = 'Cursor';
              subtitle = result.size ? `${result.name} (${result.size}px)` : result.name;
              icon = 'input-mouse-symbolic';
            }
            break;
          case 'CPU':
            title = 'CPU';
            subtitle = `${result.cpu} - ${result.cores.physical} physical cores / ${result.cores.logical} logical cores`;
            icon = 'drive-harddisk-solidstate-symbolic';
            break;
          case 'GPU':
            title = 'GPU';
            if (Array.isArray(result)) {
              result.forEach((gpu: {name: string, vendor: string}, index: number) => {
                subtitle += `${gpu.vendor} ${gpu.name}`;
                if (index < result.length - 1) {
                  subtitle += '\n';
                }
              });
            } else if (result.name) {
              subtitle = `${result.vendor || ''} ${result.name}`.trim();
            }
            icon = 'video-display-symbolic';
            break;
          case 'Memory':
            title = 'Memory';
            const memPct = result.total !== undefined ? `(${(result.used * 100 / result.total).toFixed(1)}%)` : '';
            subtitle = `${this.utils.formatBytes(result.used || 0)} / ${this.utils.formatBytes(result.total || 0)} ${memPct}`;
            icon = 'auth-sim-symbolic';
            break;
          case 'Swap':
            title = 'Swap';
            if (result.total > 0) {
              const swapPct = `(${(result.used * 100 / result.total).toFixed(1)}%)`;
              subtitle = `${this.utils.formatBytes(result.used || 0)} / ${this.utils.formatBytes(result.total || 0)} ${swapPct}`;
            } else {
              subtitle = 'No swap space configured';
            }
            icon = 'drive-harddisk-symbolic';
            break;
          case 'Disk':
            title = 'Mount points';
            result.forEach((mount: { mountpoint: any; bytes: any; }, index: number) => {
              subtitle += `${mount.mountpoint} - ${this.utils.formatBytes(mount.bytes.used || 0)} / ${this.utils.formatBytes(mount.bytes.total || 0)}`;
              if (index < result.length - 1) {
                subtitle += '\n';
              }
            });
            icon = 'drive-harddisk-symbolic';
            break;
          case 'LocalIP':
            if (result.ip) {
              title = result.name ? `Local IP (${result.name})` : 'Local IP';
              subtitle = result.ip;
              icon = 'network-wired-symbolic';
            }
            break;
          case 'Battery':
            // Battery data comes as an array, take the first battery
            const battery = Array.isArray(result) ? result[0] : result;
            if (battery) {
              title = `Battery${battery.modelName ? ' (' + battery.modelName + ')' : ''}`;
              const status = battery.status ? ` [${battery.status}]` : '';
              const battPct = battery.capacity !== undefined ? `${battery.capacity.toFixed(1)}%` : 'N/A';
              subtitle = `${battPct}${status}`;
              icon = battery.status === 'Charging' ? 'battery-full-charging-symbolic' : 'battery-symbolic';
            }
            break;
          case 'Locale':
            title = 'Locale';
            subtitle = result.result;
            icon = 'preferences-desktop-locale-symbolic';
            break;
          default:
            continue;
        }
        
        if (title && subtitle) {
          this.addInfoRow(title, subtitle, icon);
        }
      }
    } catch (e) {
      console.error('Error loading system info:', e);
    }
  }

  private addInfoRow(title: string, subtitle: string, iconName: string): void {
    const row = new Adw.ActionRow({
      title: title,
      subtitle: subtitle,
    });
    
    if (iconName) {
      const icon = new Gtk.Image({
        icon_name: iconName,
        pixel_size: 16,
      });
      row.add_prefix(icon);
    }
    
    this.listBox.append(row);
  }

  private formatUptime(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    
    const parts = [];
    if (days > 0) parts.push(`${days} days`);
    if (hours > 0) parts.push(`${hours} hours`);
    if (mins > 0) parts.push(`${mins} mins`);
    
    return parts.join(', ') || '0 mins';
  }

  public getWidget(): Gtk.Box {
    return this.container;
  }
}
