import Gtk from '@girs/gtk-4.0';
import Gdk from '@girs/gdk-4.0';
import Gio from '@girs/gio-2.0';
import GLib from '@girs/glib-2.0';
import Pango from '@girs/pango-1.0';
import { UtilsService } from '../services/utils-service';
import { ProcessesService } from '../services/processes-service';
import { ProcessesData, ProcessInfo } from '../interfaces/processes';

export class ProcessesComponent {
  private container: Gtk.Box;
  private listBox!: Gtk.ListBox;
  private processes: ProcessInfo[] = [];
  private sortColumn: string = '';
  private sortAscending: boolean = false;
  private utils: UtilsService;
  private processesService: ProcessesService;
  private dataCallback!: (data: ProcessesData) => void;
  private headerButtons: Map<string, Gtk.Button> = new Map();
  private totalCpuLabel!: Gtk.Label;
  private totalMemoryLabel!: Gtk.Label;

  constructor() {
    this.utils = UtilsService.instance;
    this.processesService = ProcessesService.instance;
    
    // Create container
    this.container = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 6,
    });
    
    // Header row with sorting buttons
    const headerBox = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 0,
      margin_start: 6,
      margin_end: 6,
      margin_bottom: 3,
    });
    headerBox.add_css_class('toolbar');
    
    const nameHeader = this.createHeaderButton('Name', 'name');
    nameHeader.set_hexpand(true);
    headerBox.append(nameHeader);
    
    const pidHeader = this.createHeaderButton('PID', 'pid');
    pidHeader.set_size_request(100, -1);
    headerBox.append(pidHeader);
    
    const cpuHeader = this.createHeaderButton('CPU', 'cpu');
    cpuHeader.set_size_request(100, -1);
    headerBox.append(cpuHeader);
    
    const memHeader = this.createHeaderButton('Memory', 'memory');
    memHeader.set_size_request(120, -1);
    headerBox.append(memHeader);
    
    this.container.append(headerBox);
    
    // Create list box for processes
    this.listBox = new Gtk.ListBox({
      selection_mode: Gtk.SelectionMode.NONE,
    });
    this.listBox.add_css_class('boxed-list');
    
    // Scrolled window - vexpand to fill available space
    const scrolled = new Gtk.ScrolledWindow({
      vexpand: true,
      hexpand: true,
    });
    scrolled.set_child(this.listBox);
    this.container.append(scrolled);
    
    // Bottom panel with totals in a card
    const totalsCard = new Gtk.Frame({
      margin_top: 12,
      vexpand: false,
    });
    totalsCard.add_css_class('view');
    
    const bottomPanel = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 24,
      margin_start: 12,
      margin_end: 12,
      margin_top: 12,
      margin_bottom: 12,
      halign: Gtk.Align.CENTER,
      vexpand: false,
    });
    
    const cpuTotalBox = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 6,
    });
    const cpuIcon = new Gtk.Image({
      icon_name: 'drive-harddisk-solidstate-symbolic',
      pixel_size: 16,
    });
    cpuTotalBox.append(cpuIcon);
    this.totalCpuLabel = new Gtk.Label({
      label: 'Total CPU: 0.0%',
    });
    cpuTotalBox.append(this.totalCpuLabel);
    bottomPanel.append(cpuTotalBox);
    
    const memTotalBox = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 6,
    });
    const memIcon = new Gtk.Image({
      icon_name: 'auth-sim-symbolic',
      pixel_size: 16,
    });
    memTotalBox.append(memIcon);
    this.totalMemoryLabel = new Gtk.Label({
      label: 'Total Memory: 0 MB',
    });
    memTotalBox.append(this.totalMemoryLabel);
    bottomPanel.append(memTotalBox);
    
    totalsCard.set_child(bottomPanel);
    this.container.append(totalsCard);
    
    // Subscribe to processes service
    this.dataCallback = this.onDataUpdate.bind(this);
    this.processesService.subscribeToUpdates(this.dataCallback);
    
    // Set sort preferences
    this.sortColumn = 'cpu';
    this.sortAscending = false;
    this.processesService.setSortColumn('cpu', false);
  }

  private createHeaderButton(label: string, column: string): Gtk.Button {
    const box = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 6,
      halign: Gtk.Align.CENTER,
    });
    
    const labelWidget = new Gtk.Label({
      label: label,
    });
    box.append(labelWidget);
    
    const icon = new Gtk.Image({
      icon_name: 'pan-down-symbolic',
      visible: column === this.sortColumn,
    });
    box.append(icon);
    
    const button = new Gtk.Button();
    button.set_child(box);
    button.add_css_class('flat');
    
    button.connect('clicked', () => {
      if (this.sortColumn === column) {
        this.sortAscending = !this.sortAscending;
      } else {
        this.sortColumn = column;
        this.sortAscending = true;
      }
      this.processesService.setSortColumn(column, this.sortAscending);
      this.updateHeaderIcons();
    });
    
    this.headerButtons.set(column, button);
    return button;
  }
  
  private updateHeaderIcons(): void {
    this.headerButtons.forEach((button, column) => {
      const box = button.get_child() as Gtk.Box;
      const icon = box.get_last_child() as Gtk.Image;
      
      if (column === this.sortColumn) {
        icon.set_visible(true);
        icon.set_from_icon_name(this.sortAscending ? 'pan-up-symbolic' : 'pan-down-symbolic');
      } else {
        icon.set_visible(false);
      }
    });
  }

  private onDataUpdate(data: ProcessesData): void {
    this.processes = data.processes;
    this.displayProcesses();
    
    // Calculate totals from process data
    let totalCpu = 0;
    let totalMemoryKB = 0;
    
    for (const process of data.processes) {
      totalCpu += parseFloat(process.cpu) || 0;
      totalMemoryKB += parseInt(process.rss) || 0;
    }
    
    this.totalCpuLabel.set_label(`Total CPU: ${totalCpu.toFixed(1)}%`);
    this.totalMemoryLabel.set_label(`Total Memory: ${this.formatMemory(totalMemoryKB)}`);
  }

  private displayProcesses(): void {
    // Note: Sorting is now handled by the service, no need to sort here
    
    
    // Clear current list
    while (this.listBox.get_first_child()) {
      const child = this.listBox.get_first_child();
      if (child) {
        this.listBox.remove(child);
      }
    }
    
    // Add processes to list
    for (const process of this.processes) {
      const row = this.createProcessRow(process);
      this.listBox.append(row);
    }
  }

  private formatMemory(kb: number): string {
    if (kb >= 1024 * 1024) {
      return `${(kb / (1024 * 1024)).toFixed(1)} GB`;
    } else if (kb >= 1024) {
      return `${(kb / 1024).toFixed(1)} MB`;
    } else {
      return `${kb.toFixed(0)} KB`;
    }
  }

  private getIconForProcess(processName: string): string | null {
    const iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default()!);
    
    // Search in desktop files for matching process
    const desktopDirs = [
      '/usr/share/applications',
      `${GLib.get_home_dir()}/.local/share/applications`
    ];
    
    for (const dir of desktopDirs) {
      const dirFile = Gio.File.new_for_path(dir);
      if (dirFile.query_exists(null)) {
        try {
          const enumerator = dirFile.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
          let fileInfo;
          
          while ((fileInfo = enumerator.next_file(null)) !== null) {
            const fileName = fileInfo.get_name();
            if (fileName.endsWith('.desktop')) {
              
              const desktopFile = dirFile.get_child(fileName);
              const [success, contents] = desktopFile.load_contents(null);
              
              if (success) {
                const text = new TextDecoder().decode(contents);
                const lines = text.split('\n');
                
                let execLine = '';
                let iconLine = '';
                
                for (const line of lines) {
                  if (line.startsWith('Exec=')) {
                    execLine = line.substring(5);
                  } else if (line.startsWith('Icon=')) {
                    iconLine = line.substring(5);
                  }
                }
                
                // Check if the Exec line contains our process name
                if (execLine && iconLine) {
                  const execLower = execLine.toLowerCase();
                  const processLower = processName.toLowerCase();
                  
                  // Match if process name appears in the exec path or command
                  if (execLower.includes(`/${processLower}`) || 
                      execLower.includes(` ${processLower} `) ||
                      execLower.startsWith(`${processLower} `)) {
                    
                    // Verify icon exists in theme
                    if (iconTheme.has_icon(iconLine)) {
                      return iconLine;
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          // Continue to next directory
        }
      }
    }
    
    return null;
  }

  private createProcessRow(process: ProcessInfo): Gtk.ListBoxRow {
    const row = new Gtk.ListBoxRow();
    
    const box = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 0,
      margin_start: 12,
      margin_end: 12,
      margin_top: 6,
      margin_bottom: 6,
    });
    
    // Try to get icon from desktop files, fallback to generic
    const iconName = this.getIconForProcess(process.command) || 'application-x-executable';
    
    const icon = new Gtk.Image({
      icon_name: iconName,
      pixel_size: 24,
      margin_end: 8,
    });
    box.append(icon);
    
    const nameLabel = new Gtk.Label({
      label: process.command,
      halign: Gtk.Align.START,
      hexpand: true,
      ellipsize: Pango.EllipsizeMode.END,
    });
    box.append(nameLabel);
    
    const pidLabel = new Gtk.Label({
      label: process.pid,
      halign: Gtk.Align.END,
      xalign: 1.0,
    });
    pidLabel.set_size_request(100, -1);
    box.append(pidLabel);
    
    const cpuLabel = new Gtk.Label({
      label: `${parseFloat(process.cpu).toFixed(1)}%`,
      halign: Gtk.Align.END,
      xalign: 1.0,
    });
    cpuLabel.set_size_request(100, -1);
    box.append(cpuLabel);
    
    const memLabel = new Gtk.Label({
      label: this.formatMemory(parseInt(process.rss) || 0),
      halign: Gtk.Align.END,
      xalign: 1.0,
    });
    memLabel.set_size_request(120, -1);
    box.append(memLabel);
    
    row.set_child(box);
    return row;
  }

  public getWidget(): Gtk.Box {
    return this.container;
  }

  public destroy(): void {
    this.processesService.unsubscribe(this.dataCallback);
  }
}
