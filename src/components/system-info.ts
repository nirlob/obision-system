import Gtk from '@girs/gtk-4.0';
import Adw from '@girs/adw-1';
import Gio from '@girs/gio-2.0';
import { UtilsService } from '../services/utils-service';
import { DataService } from '../services/data-service';
import { InfoRow } from './atoms/info-row';

export class SystemInfoComponent {
  private container: Gtk.Box;
  private scrolledWindow!: Gtk.ScrolledWindow;
  private utils: UtilsService;
  private dataService: DataService;
  private authenticateButton!: Gtk.Button;
  private expandCollapseButton!: Gtk.Button;
  private exportButton!: Gtk.Button;
  private allExpanded: boolean = true;
  private isAuthenticated: boolean = false;
  
  // Category expander rows
  private systemExpander!: Adw.ExpanderRow;
  private hardwareExpander!: Adw.ExpanderRow;
  private softwareExpander!: Adw.ExpanderRow;
  private networkExpander!: Adw.ExpanderRow;

  constructor() {
    this.utils = UtilsService.instance;
    this.dataService = DataService.instance;
    const builder = Gtk.Builder.new();
    
    // Load UI file with fallback
    try {
      try {
        builder.add_from_file('/usr/share/com.obision.ObisionSystem/ui/system-info.ui');
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
    this.scrolledWindow = builder.get_object('system_info_scrolled') as Gtk.ScrolledWindow;
    this.authenticateButton = builder.get_object('authenticate_button') as Gtk.Button;
    this.expandCollapseButton = builder.get_object('expand_collapse_button') as Gtk.Button;
    this.exportButton = builder.get_object('export_button') as Gtk.Button;
    
    // Setup button handlers
    this.setupButtons();
    
    // Create category expanders
    this.createCategoryExpanders();
    
    // Load system info
    this.loadSystemInfo();
    
    // Load software info
    this.loadSoftwareInfo();
  }
  
  private setupButtons(): void {
    // Authenticate button
    this.authenticateButton.connect('clicked', () => {
      this.authenticate();
    });
    
    // Expand/Collapse button
    this.expandCollapseButton.connect('clicked', () => {
      this.allExpanded = !this.allExpanded;
      this.systemExpander.set_expanded(this.allExpanded);
      this.hardwareExpander.set_expanded(this.allExpanded);
      this.softwareExpander.set_expanded(this.allExpanded);
      this.networkExpander.set_expanded(this.allExpanded);
      
      // Update icon
      const iconName = this.allExpanded ? 'view-sort-descending-symbolic' : 'view-sort-ascending-symbolic';
      this.expandCollapseButton.set_icon_name(iconName);
    });
    
    // Export button
    this.exportButton.connect('clicked', () => {
      this.exportToJSON();
    });
  }
  
  private authenticate(): void {
    try {
      // Try to execute a privileged command to verify authentication
      const [stdout, stderr] = this.utils.executeCommand('pkexec', ['true']);
      
      if (stderr === '' || stdout !== '') {
        this.isAuthenticated = true;
        this.authenticateButton.set_sensitive(false);
        this.authenticateButton.set_label('Authenticated');
        
        // Refresh all information
        this.refreshAllInfo();
      }
    } catch (e) {
      console.error('Authentication failed:', e);
      const dialog = new Adw.MessageDialog({
        heading: 'Authentication Failed',
        body: 'Could not authenticate as root user.',
      });
      dialog.add_response('ok', 'OK');
      dialog.present();
    }
  }
  
  private refreshAllInfo(): void {
    // Clear all existing rows from expanders
    this.clearExpanderRows(this.systemExpander);
    this.clearExpanderRows(this.hardwareExpander);
    this.clearExpanderRows(this.softwareExpander);
    this.clearExpanderRows(this.networkExpander);
    
    // Reload all information
    this.loadSystemInfo();
    this.loadNetworkInterfaces();
  }
  
  private clearExpanderRows(expander: Adw.ExpanderRow): void {
    // Remove all child rows
    let child = expander.get_first_child();
    while (child) {
      const next = child.get_next_sibling();
      if (child instanceof Adw.ActionRow || child instanceof Adw.ExpanderRow || child instanceof Adw.PreferencesGroup) {
        expander.remove(child);
      }
      child = next;
    }
  }
  
  private createCategoryExpanders(): void {
    const contentBox = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 0,
    });
    
    const listBox = new Gtk.ListBox({
      selection_mode: Gtk.SelectionMode.NONE,
    });
    listBox.add_css_class('boxed-list');
    
    // System expander
    this.systemExpander = new Adw.ExpanderRow({
      title: 'System',
      subtitle: 'Operating system and kernel information',
      icon_name: 'computer-symbolic',
      expanded: true,
    });
    listBox.append(this.systemExpander);
    
    // Hardware expander
    this.hardwareExpander = new Adw.ExpanderRow({
      title: 'Hardware',
      subtitle: 'CPU, GPU, memory, and storage information',
      icon_name: 'drive-harddisk-solidstate-symbolic',
      expanded: true,
    });
    listBox.append(this.hardwareExpander);
    
    // Software expander
    this.softwareExpander = new Adw.ExpanderRow({
      title: 'Software',
      subtitle: 'Installed packages and development tools',
      icon_name: 'application-x-executable-symbolic',
      expanded: true,
    });
    listBox.append(this.softwareExpander);
    
    // Network expander
    this.networkExpander = new Adw.ExpanderRow({
      title: 'Network',
      subtitle: 'Network interfaces and connectivity',
      icon_name: 'network-wired-symbolic',
      expanded: true,
    });
    listBox.append(this.networkExpander);
    
    // Load network interfaces
    this.loadNetworkInterfaces();
    
    contentBox.append(listBox);
    this.scrolledWindow.set_child(contentBox);
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
        let category: 'system' | 'hardware' | 'software' | 'network' = 'system';
        
        switch (item.type) {
          case 'OS':
            title = 'OS';
            subtitle = result.prettyName || result.name;
            icon = 'computer-symbolic';
            category = 'system';
            break;
          case 'Host':
            title = 'Host';
            subtitle = result.name;
            icon = 'computer-symbolic';
            category = 'system';
            break;
          case 'Kernel':
            title = 'Kernel';
            subtitle = `${result.name} ${result.release}`;
            icon = 'emblem-system-symbolic';
            category = 'system';
            break;
          case 'Uptime':
            title = 'Uptime';
            subtitle = this.formatUptime(result.uptime);
            icon = 'document-open-recent-symbolic';
            category = 'system';
            break;
          case 'Packages':
            // Skip packages - shown in Software section instead
            continue;
          case 'Shell':
            title = 'Shell';
            subtitle = result.version ? `${result.exeName} ${result.version}` : result.exeName;
            icon = 'utilities-terminal-symbolic';
            category = 'system';
            break;
          case 'Display':
            // Create PreferencesGroup for Display details
            const displayGroup = new Adw.PreferencesGroup();
            (displayGroup as any).set_margin_start(40);
            (displayGroup as any).set_margin_end(12);
            (displayGroup as any).set_margin_top(6);
            (displayGroup as any).set_margin_bottom(6);
            
            if (!result || result.length === 0) {
              // No Display detected
              const noDisplayRow = this.createDetailRow('Display', 'No display detected');
              (noDisplayRow as any).set_margin_start(40);
              this.hardwareExpander.add_row(noDisplayRow);
              continue;
            }
            
            if (result.length === 1) {
              // Single Display - simple expander
              const display = result[0];
              const resolution = display.output.refreshRate 
                ? `${display.output.width}x${display.output.height}@${display.output.refreshRate} Hz` 
                : `${display.output.width}x${display.output.height}`;
              
              const displayExpander = new Adw.ExpanderRow({
                title: 'Display',
                subtitle: `${display.name} - ${resolution}`,
                icon_name: 'video-display-symbolic',
                show_enable_switch: false,
              });
              
              // Add Display information rows
              const nameRow = this.createDetailRow('Name', display.name);
              displayExpander.add_row(nameRow as any);
              
              const resolutionRow = this.createDetailRow('Resolution', `${display.output.width}x${display.output.height}`);
              displayExpander.add_row(resolutionRow as any);
              
              if (display.output.refreshRate) {
                const refreshRow = this.createDetailRow('Refresh Rate', `${display.output.refreshRate} Hz`);
                displayExpander.add_row(refreshRow as any);
              }
              
              if (display.type) {
                const typeRow = this.createDetailRow('Type', display.type);
                displayExpander.add_row(typeRow as any);
              }
              
              displayGroup.add(displayExpander);
            } else {
              // Multiple Displays - main expander with sub-expanders
              const mainDisplayExpander = new Adw.ExpanderRow({
                title: 'Displays',
                subtitle: `${result.length} display${result.length !== 1 ? 's' : ''} detected`,
                icon_name: 'video-display-symbolic',
                show_enable_switch: false,
              });
              
              result.forEach((display: {name: string, output: any, type?: string}, index: number) => {
                const resolution = display.output.refreshRate 
                  ? `${display.output.width}x${display.output.height}@${display.output.refreshRate} Hz` 
                  : `${display.output.width}x${display.output.height}`;
                
                const displaySubExpander = new Adw.ExpanderRow({
                  title: display.name,
                  subtitle: resolution,
                  show_enable_switch: false,
                });
                
                // Add Display information rows
                const nameRow = this.createDetailRow('Name', display.name);
                displaySubExpander.add_row(nameRow as any);
                
                const resolutionRow = this.createDetailRow('Resolution', `${display.output.width}x${display.output.height}`);
                displaySubExpander.add_row(resolutionRow as any);
                
                if (display.output.refreshRate) {
                  const refreshRow = this.createDetailRow('Refresh Rate', `${display.output.refreshRate} Hz`);
                  displaySubExpander.add_row(refreshRow as any);
                }
                
                if (display.type) {
                  const typeRow = this.createDetailRow('Type', display.type);
                  displaySubExpander.add_row(typeRow as any);
                }
                
                mainDisplayExpander.add_row(displaySubExpander);
              });
              
              displayGroup.add(mainDisplayExpander);
            }
            
            const displayWrapper = new Gtk.Box({
              orientation: Gtk.Orientation.VERTICAL,
            });
            displayWrapper.append(displayGroup);
            
            const displayGroupRow = new Gtk.ListBoxRow();
            displayGroupRow.set_child(displayWrapper);
            (displayGroupRow as any).set_activatable(false);
            (displayGroupRow as any).set_selectable(false);
            
            this.hardwareExpander.add_row(displayGroupRow);
            continue;
          case 'DE':
            title = 'Desktop Environment';
            subtitle = result.version ? `${result.prettyName} ${result.version}` : result.prettyName || result.name;
            icon = 'computer-symbolic';
            category = 'system';
            break;
          case 'WM':
            title = 'Window Manager';
            subtitle = `${result.prettyName} (${result.protocolName})`;
            icon = 'computer-apple-ipad-symbolic';
            category = 'system';
            break;
          case 'Theme':
            title = 'Theme';
            subtitle = result.pretty || result.name;
            icon = 'preferences-desktop-theme-symbolic';
            category = 'system';
            break;
          case 'Icons':
            title = 'Icons';
            subtitle = result.pretty || result.name;
            icon = 'preferences-desktop-icons-symbolic';
            category = 'system';
            break;
          case 'Font':
            if (result.pretty || result.name) {
              title = 'Font';
              subtitle = result.pretty || result.name;
              icon = 'font-x-generic-symbolic';
              category = 'system';
            }
            break;
          case 'Cursor':
            if (result.name) {
              title = 'Cursor';
              subtitle = result.size ? `${result.name} (${result.size}px)` : result.name;
              icon = 'input-mouse-symbolic';
              category = 'system';
            }
            break;
          case 'CPU':
            // Create PreferencesGroup for CPU details
            const cpuGroup = new Adw.PreferencesGroup();
            (cpuGroup as any).set_margin_start(40);
            (cpuGroup as any).set_margin_end(12);
            (cpuGroup as any).set_margin_top(6);
            (cpuGroup as any).set_margin_bottom(6);
            
            const cpuInfo = this.dataService.getCpuInfo();
            const cpuExpander = new Adw.ExpanderRow({
              title: 'CPU',
              subtitle: `${cpuInfo.model}`,
              icon_name: 'drive-harddisk-solidstate-symbolic',
              show_enable_switch: false,
            });
            
            // Add CPU information rows
            if (cpuInfo.model && cpuInfo.model !== 'Unknown') {
              const modelRow = this.createDetailRow('Model', cpuInfo.model, 'CPU model name');
              cpuExpander.add_row(modelRow as any);
            }
            
            if (cpuInfo.vendor && cpuInfo.vendor !== 'Unknown') {
              const vendorRow = this.createDetailRow('Vendor', cpuInfo.vendor);
              cpuExpander.add_row(vendorRow as any);
            }
            
            if (cpuInfo.architecture && cpuInfo.architecture !== 'Unknown') {
              const archRow = this.createDetailRow('Architecture', cpuInfo.architecture);
              cpuExpander.add_row(archRow as any);
            }
            
            if (cpuInfo.cores > 0) {
              const coresRow = this.createDetailRow('Cores', cpuInfo.cores.toString(), 'Physical processor cores');
              cpuExpander.add_row(coresRow as any);
            }
            
            if (cpuInfo.logicalCores > 0) {
              const logicalCoresRow = this.createDetailRow('Logical Cores', cpuInfo.logicalCores.toString());
              cpuExpander.add_row(logicalCoresRow as any);
            }
            
            if (cpuInfo.threads > 0) {
              const threadsRow = this.createDetailRow('Threads', cpuInfo.threads.toString(), 'Threads per core');
              cpuExpander.add_row(threadsRow as any);
            }
            
            if (cpuInfo.currentFrequency && cpuInfo.currentFrequency !== 'Unknown') {
              const freqRow = this.createDetailRow('Frequency', cpuInfo.currentFrequency, 'Current operating frequency');
              cpuExpander.add_row(freqRow as any);
            }
            
            if (cpuInfo.maxFrequency && cpuInfo.maxFrequency !== 'Unknown') {
              const maxFreqRow = this.createDetailRow('Max Frequency', cpuInfo.maxFrequency);
              cpuExpander.add_row(maxFreqRow as any);
            }
            
            if (cpuInfo.family && cpuInfo.family !== 'Unknown') {
              const familyRow = this.createDetailRow('Family', cpuInfo.family);
              cpuExpander.add_row(familyRow as any);
            }
            
            if (cpuInfo.modelId && cpuInfo.modelId !== 'Unknown') {
              const modelIdRow = this.createDetailRow('Model ID', cpuInfo.modelId);
              cpuExpander.add_row(modelIdRow as any);
            }
            
            if (cpuInfo.stepping && cpuInfo.stepping !== 'Unknown') {
              const steppingRow = this.createDetailRow('Stepping', cpuInfo.stepping);
              cpuExpander.add_row(steppingRow as any);
            }
            
            // Cache information
            if (cpuInfo.l1dCache && cpuInfo.l1dCache !== 'Unknown') {
              const l1dRow = this.createDetailRow('L1d Cache', cpuInfo.l1dCache);
              cpuExpander.add_row(l1dRow as any);
            }
            
            if (cpuInfo.l1iCache && cpuInfo.l1iCache !== 'Unknown') {
              const l1iRow = this.createDetailRow('L1i Cache', cpuInfo.l1iCache);
              cpuExpander.add_row(l1iRow as any);
            }
            
            if (cpuInfo.l2Cache && cpuInfo.l2Cache !== 'Unknown') {
              const l2Row = this.createDetailRow('L2 Cache', cpuInfo.l2Cache);
              cpuExpander.add_row(l2Row as any);
            }
            
            if (cpuInfo.l3Cache && cpuInfo.l3Cache !== 'Unknown') {
              const l3Row = this.createDetailRow('L3 Cache', cpuInfo.l3Cache);
              cpuExpander.add_row(l3Row as any);
            }
            
            if (cpuInfo.virtualization && cpuInfo.virtualization !== 'Unknown') {
              const virtRow = this.createDetailRow('Virtualization', cpuInfo.virtualization);
              cpuExpander.add_row(virtRow as any);
            }
            
            if (cpuInfo.bogomips && cpuInfo.bogomips !== 'Unknown') {
              const bogomipsRow = this.createDetailRow('BogoMIPS', cpuInfo.bogomips);
              cpuExpander.add_row(bogomipsRow as any);
            }
            
            cpuGroup.add(cpuExpander);
            
            // Wrap in a box and listboxrow to add to hardware expander
            const cpuWrapper = new Gtk.Box({
              orientation: Gtk.Orientation.VERTICAL,
            });
            cpuWrapper.append(cpuGroup);
            
            const cpuGroupRow = new Gtk.ListBoxRow();
            cpuGroupRow.set_child(cpuWrapper);
            (cpuGroupRow as any).set_activatable(false);
            (cpuGroupRow as any).set_selectable(false);
            
            this.hardwareExpander.add_row(cpuGroupRow);
            continue;
          case 'GPU':
            // Create PreferencesGroup for GPU details
            const gpuGroup = new Adw.PreferencesGroup();
            (gpuGroup as any).set_margin_start(40);
            (gpuGroup as any).set_margin_end(12);
            (gpuGroup as any).set_margin_top(6);
            (gpuGroup as any).set_margin_bottom(6);
            
            const gpuInfoList = this.dataService.getGpuInfo();
            
            if (gpuInfoList.length === 0) {
              // No GPU detected
              const noGpuRow = this.createDetailRow('GPU', 'No GPU detected');
              (noGpuRow as any).set_margin_start(40);
              this.hardwareExpander.add_row(noGpuRow);
              continue;
            }
            
            if (gpuInfoList.length === 1) {
              // Single GPU - simple expander
              const gpuInfo = gpuInfoList[0];
              const gpuExpander = new Adw.ExpanderRow({
                title: 'GPU',
                subtitle: gpuInfo.name,
                icon_name: 'video-display-symbolic',
                show_enable_switch: false,
              });
              
              // Add GPU information rows
              if (gpuInfo.name) {
                const nameRow = this.createDetailRow('Name', gpuInfo.name);
                gpuExpander.add_row(nameRow as any);
              }
              
              if (gpuInfo.vendor && gpuInfo.vendor !== 'Unknown') {
                const vendorRow = this.createDetailRow('Vendor', gpuInfo.vendor);
                gpuExpander.add_row(vendorRow as any);
              }
              
              if (gpuInfo.driver && gpuInfo.driver !== 'Unknown') {
                const driverRow = this.createDetailRow('Driver', gpuInfo.driver);
                gpuExpander.add_row(driverRow as any);
              }
              
              if (gpuInfo.memoryTotal && gpuInfo.memoryTotal !== 'N/A') {
                const memTotalRow = this.createDetailRow('Memory Total', gpuInfo.memoryTotal);
                gpuExpander.add_row(memTotalRow as any);
              }
              
              if (gpuInfo.memoryUsed && gpuInfo.memoryUsed !== 'N/A') {
                const memUsedRow = this.createDetailRow('Memory Used', gpuInfo.memoryUsed);
                gpuExpander.add_row(memUsedRow as any);
              }
              
              if (gpuInfo.clockSpeed && gpuInfo.clockSpeed !== 'N/A') {
                const clockRow = this.createDetailRow('Clock Speed', gpuInfo.clockSpeed);
                gpuExpander.add_row(clockRow as any);
              }
              
              if (gpuInfo.temperature && gpuInfo.temperature !== 'N/A') {
                const tempRow = this.createDetailRow('Temperature', gpuInfo.temperature);
                gpuExpander.add_row(tempRow as any);
              }
              
              if (gpuInfo.power && gpuInfo.power !== 'N/A') {
                const powerRow = this.createDetailRow('Power Draw', gpuInfo.power);
                gpuExpander.add_row(powerRow as any);
              }
              
              if (gpuInfo.pciId && gpuInfo.pciId !== 'N/A') {
                const pciRow = this.createDetailRow('PCI ID', gpuInfo.pciId);
                gpuExpander.add_row(pciRow as any);
              }
              
              gpuGroup.add(gpuExpander);
            } else {
              // Multiple GPUs - main expander with sub-expanders
              const mainGpuExpander = new Adw.ExpanderRow({
                title: 'GPUs',
                subtitle: `${gpuInfoList.length} graphics card${gpuInfoList.length !== 1 ? 's' : ''} detected`,
                icon_name: 'video-display-symbolic',
                show_enable_switch: false,
              });
              
              gpuInfoList.forEach((gpuInfo, index) => {
                const gpuSubExpander = new Adw.ExpanderRow({
                  title: `GPU ${index + 1}`,
                  subtitle: gpuInfo.name,
                  show_enable_switch: false,
                });
                
                // Add GPU information rows
                if (gpuInfo.name) {
                  const nameRow = this.createDetailRow('Name', gpuInfo.name);
                  gpuSubExpander.add_row(nameRow as any);
                }
                
                if (gpuInfo.vendor && gpuInfo.vendor !== 'Unknown') {
                  const vendorRow = this.createDetailRow('Vendor', gpuInfo.vendor);
                  gpuSubExpander.add_row(vendorRow as any);
                }
                
                if (gpuInfo.driver && gpuInfo.driver !== 'Unknown') {
                  const driverRow = this.createDetailRow('Driver', gpuInfo.driver);
                  gpuSubExpander.add_row(driverRow as any);
                }
                
                if (gpuInfo.memoryTotal && gpuInfo.memoryTotal !== 'N/A') {
                  const memTotalRow = this.createDetailRow('Memory Total', gpuInfo.memoryTotal);
                  gpuSubExpander.add_row(memTotalRow as any);
                }
                
                if (gpuInfo.memoryUsed && gpuInfo.memoryUsed !== 'N/A') {
                  const memUsedRow = this.createDetailRow('Memory Used', gpuInfo.memoryUsed);
                  gpuSubExpander.add_row(memUsedRow as any);
                }
                
                if (gpuInfo.clockSpeed && gpuInfo.clockSpeed !== 'N/A') {
                  const clockRow = this.createDetailRow('Clock Speed', gpuInfo.clockSpeed);
                  gpuSubExpander.add_row(clockRow as any);
                }
                
                if (gpuInfo.temperature && gpuInfo.temperature !== 'N/A') {
                  const tempRow = this.createDetailRow('Temperature', gpuInfo.temperature);
                  gpuSubExpander.add_row(tempRow as any);
                }
                
                if (gpuInfo.power && gpuInfo.power !== 'N/A') {
                  const powerRow = this.createDetailRow('Power Draw', gpuInfo.power);
                  gpuSubExpander.add_row(powerRow as any);
                }
                
                if (gpuInfo.pciId && gpuInfo.pciId !== 'N/A') {
                  const pciRow = this.createDetailRow('PCI ID', gpuInfo.pciId);
                  gpuSubExpander.add_row(pciRow as any);
                }
                
                mainGpuExpander.add_row(gpuSubExpander);
              });
              
              gpuGroup.add(mainGpuExpander);
            }
            
            // Wrap in a box and listboxrow to add to hardware expander
            const gpuWrapper = new Gtk.Box({
              orientation: Gtk.Orientation.VERTICAL,
            });
            gpuWrapper.append(gpuGroup);
            
            const gpuGroupRow = new Gtk.ListBoxRow();
            gpuGroupRow.set_child(gpuWrapper);
            (gpuGroupRow as any).set_activatable(false);
            (gpuGroupRow as any).set_selectable(false);
            
            this.hardwareExpander.add_row(gpuGroupRow);
            continue;
          case 'Memory':
            // Create PreferencesGroup for memory details
            const memoryGroup = new Adw.PreferencesGroup();
            (memoryGroup as any).set_margin_start(40);
            (memoryGroup as any).set_margin_end(12);
            (memoryGroup as any).set_margin_top(6);
            (memoryGroup as any).set_margin_bottom(6);
            
            const memPct = result.total !== undefined ? `${(result.used * 100 / result.total).toFixed(1)}%` : '';
            const memoryExpander = new Adw.ExpanderRow({
              title: 'Memory',
              subtitle: `${this.utils.formatBytes(result.used || 0)} / ${this.utils.formatBytes(result.total || 0)} (${memPct})`,
              icon_name: 'auth-sim-symbolic',
              show_enable_switch: false,
            });
            
            // Get detailed memory information from DataService
            try {
              const memInfo = this.dataService.getMemoryInfo();
              
              // Add basic information
              if (memInfo.total > 0) {
                const totalRow = this.createDetailRow('Total', this.utils.formatBytes(memInfo.total * 1024));
                memoryExpander.add_row(totalRow as any);
              }
              
              if (memInfo.used > 0) {
                const usedRow = this.createDetailRow('Used', this.utils.formatBytes(memInfo.used * 1024));
                memoryExpander.add_row(usedRow as any);
              }
              
              if (memInfo.free > 0) {
                const freeRow = this.createDetailRow('Free', this.utils.formatBytes(memInfo.free * 1024));
                memoryExpander.add_row(freeRow as any);
              }
              
              if (memInfo.available > 0) {
                const availableRow = this.createDetailRow('Available', this.utils.formatBytes(memInfo.available * 1024));
                memoryExpander.add_row(availableRow as any);
              }
              
              if (memInfo.buffers > 0) {
                const buffersRow = this.createDetailRow('Buffers', this.utils.formatBytes(memInfo.buffers * 1024));
                memoryExpander.add_row(buffersRow as any);
              }
              
              if (memInfo.cached > 0) {
                const cachedRow = this.createDetailRow('Cached', this.utils.formatBytes(memInfo.cached * 1024));
                memoryExpander.add_row(cachedRow as any);
              }
              
              if (memInfo.shared > 0) {
                const sharedRow = this.createDetailRow('Shared', this.utils.formatBytes(memInfo.shared * 1024), 'Shared memory between processes');
                memoryExpander.add_row(sharedRow as any);
              }
              
              if (memInfo.slab > 0) {
                const slabRow = this.createDetailRow('Slab', this.utils.formatBytes(memInfo.slab * 1024), 'Kernel slab allocator cache');
                memoryExpander.add_row(slabRow as any);
              }
              
              if (memInfo.active > 0) {
                const activeRow = this.createDetailRow('Active', this.utils.formatBytes(memInfo.active * 1024), 'Recently accessed memory');
                memoryExpander.add_row(activeRow as any);
              }
              
              if (memInfo.inactive > 0) {
                const inactiveRow = this.createDetailRow('Inactive', this.utils.formatBytes(memInfo.inactive * 1024), 'Not recently accessed memory');
                memoryExpander.add_row(inactiveRow as any);
              }
              
              if (memInfo.dirty > 0) {
                const dirtyRow = this.createDetailRow('Dirty', this.utils.formatBytes(memInfo.dirty * 1024), 'Modified pages waiting to be written');
                memoryExpander.add_row(dirtyRow as any);
              }
              
              if (memInfo.writeback > 0) {
                const writebackRow = this.createDetailRow('Writeback', this.utils.formatBytes(memInfo.writeback * 1024), 'Memory being written to disk');
                memoryExpander.add_row(writebackRow as any);
              }
              
              if (memInfo.mapped > 0) {
                const mappedRow = this.createDetailRow('Mapped', this.utils.formatBytes(memInfo.mapped * 1024), 'Memory-mapped files');
                memoryExpander.add_row(mappedRow as any);
              }
              
              if (memInfo.pageTables > 0) {
                const pageTablesRow = this.createDetailRow('Page Tables', this.utils.formatBytes(memInfo.pageTables * 1024), 'Memory used by page tables');
                memoryExpander.add_row(pageTablesRow as any);
              }
              
              if (memInfo.kernelStack > 0) {
                const kernelStackRow = this.createDetailRow('Kernel Stack', this.utils.formatBytes(memInfo.kernelStack * 1024), 'Memory used by kernel stacks');
                memoryExpander.add_row(kernelStackRow as any);
              }
              
              // Add swap information
              if (memInfo.swapTotal > 0) {
                const swapTotalRow = this.createDetailRow('Swap Total', this.utils.formatBytes(memInfo.swapTotal * 1024));
                memoryExpander.add_row(swapTotalRow as any);
                
                const swapUsedRow = this.createDetailRow('Swap Used', this.utils.formatBytes(memInfo.swapUsed * 1024));
                memoryExpander.add_row(swapUsedRow as any);
                
                if (memInfo.swapCached > 0) {
                  const swapCachedRow = this.createDetailRow('Swap Cached', this.utils.formatBytes(memInfo.swapCached * 1024), 'Swap pages cached in memory');
                  memoryExpander.add_row(swapCachedRow as any);
                }
              }
            } catch (error) {
              console.error('Error reading /proc/meminfo:', error);
              
              // Fallback to fastfetch data if /proc/meminfo fails
              if (result.used !== undefined) {
                const usedRow = this.createDetailRow('Used', this.utils.formatBytes(result.used));
                memoryExpander.add_row(usedRow as any);
              }
              
              if (result.total !== undefined && result.used !== undefined) {
                const freeRow = this.createDetailRow('Available', this.utils.formatBytes(result.total - result.used));
                memoryExpander.add_row(freeRow as any);
              }
              
              if (result.total !== undefined) {
                const totalRow = this.createDetailRow('Total', this.utils.formatBytes(result.total));
                memoryExpander.add_row(totalRow as any);
              }
            }
            
            memoryGroup.add(memoryExpander);
            
            // Wrap in a box and listboxrow to add to hardware expander
            const memoryWrapper = new Gtk.Box({
              orientation: Gtk.Orientation.VERTICAL,
            });
            memoryWrapper.append(memoryGroup);
            
            const memoryGroupRow = new Gtk.ListBoxRow();
            memoryGroupRow.set_child(memoryWrapper);
            (memoryGroupRow as any).set_activatable(false);
            (memoryGroupRow as any).set_selectable(false);
            
            this.hardwareExpander.add_row(memoryGroupRow);
            continue;
          case 'Swap':
            // Store swap data to add to mount points later
            (this as any).swapData = result;
            continue;
          case 'Disk':
            // Create PreferencesGroup for disks
            const disksGroup = new Adw.PreferencesGroup();
            (disksGroup as any).set_margin_start(40);
            (disksGroup as any).set_margin_end(12);
            (disksGroup as any).set_margin_top(6);
            (disksGroup as any).set_margin_bottom(6);
            
            // Calculate total disk space
            let totalDiskSpace = 0;
            let totalDiskUsed = 0;
            result.forEach((mount: { bytes: any; }) => {
              if (mount.bytes && mount.bytes.total) {
                totalDiskSpace += mount.bytes.total;
                totalDiskUsed += mount.bytes.used || 0;
              }
            });
            
            const diskPct = totalDiskSpace > 0 ? `${(totalDiskUsed * 100 / totalDiskSpace).toFixed(1)}%` : '';
            const disksExpander = new Adw.ExpanderRow({
              title: 'Disks',
              subtitle: `${this.utils.formatBytes(totalDiskUsed)} / ${this.utils.formatBytes(totalDiskSpace)} (${diskPct})`,
              icon_name: 'drive-harddisk-symbolic',
              show_enable_switch: false,
            });
            
            // Check if swap exists
            const swapData = (this as any).swapData;
            const hasSwap = swapData && swapData.total > 0;
            const mountCount = result.length + (hasSwap ? 1 : 0);
            
            // Create nested mount points expander
            const mountExpander = new Adw.ExpanderRow({
              title: 'Mount points',
              subtitle: `${mountCount} mount point${mountCount !== 1 ? 's' : ''}`,
              icon_name: 'folder-symbolic',
              show_enable_switch: false,
            });
            
            result.forEach((mount: { mountpoint: any; bytes: any; }) => {
              const mountPct = mount.bytes.total > 0 ? `(${(mount.bytes.used * 100 / mount.bytes.total).toFixed(1)}%)` : '';
              const mountRow = this.createDetailRow(mount.mountpoint, `${this.utils.formatBytes(mount.bytes.used || 0)} / ${this.utils.formatBytes(mount.bytes.total || 0)} ${mountPct}`);
              mountExpander.add_row(mountRow as any);
            });
            
            // Add swap if available and total > 0 (inside mount points)
            if (hasSwap) {
              const swapPct = `(${(swapData.used * 100 / swapData.total).toFixed(1)}%)`;
              const swapSubtitle = `${this.utils.formatBytes(swapData.used || 0)} / ${this.utils.formatBytes(swapData.total || 0)} ${swapPct}`;
              const swapRow = this.createDetailRow('Swap', swapSubtitle, 'Virtual memory on disk');
              mountExpander.add_row(swapRow as any);
            }
            
            // Add mount points expander to disks expander
            disksExpander.add_row(mountExpander);
            
            // Create physical drives expander
            const physicalDrivesExpander = new Adw.ExpanderRow({
              title: 'Physical drives',
              subtitle: 'Hardware disk information',
              icon_name: 'drive-harddisk-symbolic',
              show_enable_switch: false,
            });
            
            // Get list of physical drives
            try {
              const [lsblkOut] = this.utils.executeCommand('lsblk', ['-d', '-o', 'NAME,MODEL,SIZE,ROTA,TYPE', '-n']);
              const lines = lsblkOut.trim().split('\n');
              let driveCount = 0;
              
              for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 4) {
                  const device = parts[0];
                  const type = parts[parts.length - 1];
                  
                  // Only show disk type (not partitions)
                  if (type === 'disk') {
                    driveCount++;
                    const model = parts.slice(1, parts.length - 3).join(' ') || 'Unknown';
                    const size = parts[parts.length - 3];
                    const rota = parts[parts.length - 2];
                    const driveType = rota === '1' ? 'HDD' : 'SSD';
                    
                    // Create expander for each drive
                    const driveExpander = new Adw.ExpanderRow({
                      title: `/dev/${device}`,
                      subtitle: `${model} - ${size}`,
                      show_enable_switch: false,
                    });
                    
                    // Drive Type (HDD/SSD)
                    const typeRow = this.createDetailRow('Type', driveType, 'Storage technology');
                    driveExpander.add_row(typeRow as any);
                    
                    // Model
                    const modelRow = this.createDetailRow('Model', model, 'Disk model identifier');
                    driveExpander.add_row(modelRow as any);
                    
                    // Size
                    const sizeRow = this.createDetailRow('Size', size, 'Total capacity');
                    driveExpander.add_row(sizeRow as any);
                    
                    // Get partitions for this drive
                    try {
                      const [partOut] = this.utils.executeCommand('lsblk', ['-o', 'NAME,SIZE,TYPE,FSTYPE,MOUNTPOINT', '-n', `/dev/${device}`]);
                      const partLines = partOut.trim().split('\n');
                      
                      if (partLines.length > 1) {
                        const partitionsExpander = new Adw.ExpanderRow({
                          title: 'Partitions',
                          subtitle: `${partLines.length - 1} partition${partLines.length - 1 !== 1 ? 's' : ''}`,
                          show_enable_switch: false,
                        });
                        
                        for (let i = 1; i < partLines.length; i++) {
                          const partLine = partLines[i].trim();
                          const partParts = partLine.split(/\s+/);
                          
                          if (partParts.length >= 3 && partParts[2] === 'part') {
                            const partName = partParts[0].replace(/[├─└─│\s]/g, '');
                            const partSize = partParts[1];
                            const fsType = partParts[3] || '-';
                            const mountPoint = partParts.slice(4).join(' ') || 'Not mounted';
                            
                            const partRow = this.createDetailRow(`/dev/${partName}`, `${partSize} • ${fsType} • ${mountPoint}`);
                            partitionsExpander.add_row(partRow as any);
                          }
                        }
                        
                        driveExpander.add_row(partitionsExpander);
                      }
                    } catch (e) {
                      console.error(`Error getting partitions for ${device}:`, e);
                    }
                    
                    // Try to get temperature if available
                    try {
                      const [tempOut] = this.utils.executeCommand('bash', ['-c', `cat /sys/block/${device}/device/hwmon/hwmon*/temp1_input 2>/dev/null || echo ""`]);
                      if (tempOut && tempOut.trim()) {
                        const temp = parseInt(tempOut.trim()) / 1000;
                        if (!isNaN(temp)) {
                          const tempRow = this.createDetailRow('Temperature', `${temp.toFixed(1)}°C`, 'Current drive temperature');
                          driveExpander.add_row(tempRow as any);
                        }
                      }
                    } catch {
                      // Temperature not available
                    }
                    
                    physicalDrivesExpander.add_row(driveExpander);
                  }
                }
              }
              
              // Update subtitle with drive count
              if (driveCount > 0) {
                physicalDrivesExpander.set_subtitle(`${driveCount} physical drive${driveCount !== 1 ? 's' : ''} detected`);
              }
            } catch (error) {
              console.error('Error loading physical drives:', error);
            }
            
            // Add physical drives expander to disks expander
            disksExpander.add_row(physicalDrivesExpander);
            
            disksGroup.add(disksExpander);
            
            // Wrap in a box and listboxrow to add to hardware expander
            const disksWrapper = new Gtk.Box({
              orientation: Gtk.Orientation.VERTICAL,
            });
            disksWrapper.append(disksGroup);
            
            const disksGroupRow = new Gtk.ListBoxRow();
            disksGroupRow.set_child(disksWrapper);
            (disksGroupRow as any).set_activatable(false);
            (disksGroupRow as any).set_selectable(false);
            
            this.hardwareExpander.add_row(disksGroupRow);
            continue;
          case 'LocalIP':
          case 'PublicIP':
          case 'WiFi':
            // Skip - network interfaces are loaded separately
            continue;
          case 'Battery':
            // Check if battery exists using DataService
            if (!this.dataService.hasBattery()) {
              continue;
            }
            // Battery data comes as an array, take the first battery  
            const batteryArray = Array.isArray(result) ? result : [result];
            if (batteryArray && batteryArray.length > 0) {
              const battery = batteryArray[0];
              const battPct = battery.capacity !== undefined ? `${battery.capacity.toFixed(1)}%` : 'N/A';
              const batteryGroup = new Adw.PreferencesGroup();
              (batteryGroup as any).set_margin_start(40);
              (batteryGroup as any).set_margin_end(12);
              (batteryGroup as any).set_margin_top(6);
              (batteryGroup as any).set_margin_bottom(6);
              
              const batteryExpander = new Adw.ExpanderRow({
                title: 'Battery',
                subtitle: `${battPct} - ${battery.status || 'Unknown'}`,
                icon_name: battery.status && battery.status.includes('Charging') ? 'battery-full-charging-symbolic' : 'battery-symbolic',
                show_enable_switch: false,
              });
              
              // Add battery details
              if (battery.modelName) {
                const modelRow = this.createDetailRow('Model', battery.modelName);
                batteryExpander.add_row(modelRow as any);
              }
              
              if (battery.manufacturer) {
                const mfgRow = this.createDetailRow('Manufacturer', battery.manufacturer);
                batteryExpander.add_row(mfgRow as any);
              }
              
              if (battery.capacity !== undefined) {
                const capacityRow = this.createDetailRow('Capacity', `${battery.capacity.toFixed(1)}%`, 'Current battery health');
                batteryExpander.add_row(capacityRow as any);
              }
              
              if (battery.status) {
                const statusRow = this.createDetailRow('Status', battery.status, 'Charging state');
                batteryExpander.add_row(statusRow as any);
              }
              
              if (battery.technology) {
                const techRow = this.createDetailRow('Technology', battery.technology, 'Battery chemistry type');
                batteryExpander.add_row(techRow as any);
              }
              
              if (battery.cycleCount !== undefined) {
                const cycleRow = this.createDetailRow('Cycle Count', battery.cycleCount.toString(), 'Number of charge cycles');
                batteryExpander.add_row(cycleRow as any);
              }
              
              if (battery.voltage !== undefined) {
                const voltageRow = this.createDetailRow('Voltage', `${battery.voltage.toFixed(2)} V`, 'Current voltage');
                batteryExpander.add_row(voltageRow as any);
              }
              
              if (battery.temperature !== undefined && battery.temperature !== null) {
                const tempRow = this.createDetailRow('Temperature', `${battery.temperature.toFixed(1)} °C`, 'Current temperature');
                batteryExpander.add_row(tempRow as any);
              }
              
              batteryGroup.add(batteryExpander);
              
              const batteryWrapper = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
              });
              batteryWrapper.append(batteryGroup);
              
              const batteryGroupRow = new Gtk.ListBoxRow();
              batteryGroupRow.set_child(batteryWrapper);
              (batteryGroupRow as any).set_activatable(false);
              (batteryGroupRow as any).set_selectable(false);
              
              this.hardwareExpander.add_row(batteryGroupRow);
            }
            continue;
          case 'Locale':
            title = 'Locale';
            subtitle = result.result;
            icon = 'preferences-desktop-locale-symbolic';
            category = 'system';
            break;
          default:
            continue;
        }
        
        if (title && subtitle) {
          this.addInfoRow(title, subtitle, icon, category);
        }
      }
    } catch (e) {
      console.error('Error loading system info:', e);
    }
  }

  private addInfoRow(title: string, subtitle: string, iconName: string, category: 'system' | 'hardware' | 'software' | 'network'): void {
    const description = this.getDescriptionForField(title);
    const infoRow = new InfoRow(title, subtitle, description);
    const row = infoRow.getWidget();
    
    // Add to appropriate category expander
    switch (category) {
      case 'system':
        this.systemExpander.add_row(row as any);
        break;
      case 'hardware':
        this.hardwareExpander.add_row(row as any);
        break;
      case 'software':
        this.softwareExpander.add_row(row as any);
        break;
      case 'network':
        this.networkExpander.add_row(row as any);
        break;
    }
  }
  
  private getDescriptionForField(field: string): string {
    const descriptions: { [key: string]: string } = {
      // System
      'OS': 'Operating system name and version',
      'Host': 'Computer manufacturer and model',
      'Kernel': 'Operating system kernel version',
      'Uptime': 'Time since last system boot',
      'Shell': 'Default command line interpreter',
      'Resolution': 'Current screen resolution',
      'DE': 'Desktop environment',
      'WM': 'Window manager',
      'WM Theme': 'Window manager theme',
      'Theme': 'GTK theme',
      'Icons': 'Icon theme',
      'Terminal': 'Default terminal emulator',
      'Terminal Font': 'Terminal font family',
      'Locale': 'System language and region',
      'Users': 'Number of user accounts',
      'Date': 'Current system date',
      'Datetime': 'Current date and time',
      
      // Hardware - Display
      'Name': 'Device identifier or model name',
      'Type': 'Connection type or category',
      'Refresh Rate': 'Screen refresh frequency',
      
      // Hardware - CPU
      'CPU': 'Central processing unit model',
      'Model': 'Processor model name',
      'Vendor': 'Manufacturer or brand',
      'Architecture': 'Processor architecture type',
      'Cores': 'Physical processor cores',
      'Logical Cores': 'Logical processors with hyperthreading',
      'Threads': 'Simultaneous execution threads',
      'Frequency': 'Current operating frequency',
      'Max Frequency': 'Maximum clock speed',
      'Family': 'Processor family identifier',
      'Model ID': 'Specific model identifier',
      'Stepping': 'CPU revision number',
      'L1d Cache': 'Level 1 data cache',
      'L1i Cache': 'Level 1 instruction cache',
      'L2 Cache': 'Level 2 cache',
      'L3 Cache': 'Level 3 cache',
      'Virtualization': 'Hardware virtualization support',
      'BogoMIPS': 'Performance measurement',
      
      // Hardware - GPU
      'GPU': 'Graphics processing unit model',
      'Driver': 'Graphics driver version',
      'Memory Total': 'Total graphics memory',
      'Memory Used': 'Currently used graphics memory',
      'Clock Speed': 'GPU operating frequency',
      'Temperature': 'Current GPU temperature',
      'Power Draw': 'Current power consumption',
      'PCI ID': 'PCI device identifier',
      
      // Hardware - Memory
      'Memory': 'Total system memory (RAM)',
      'Total': 'Total capacity',
      'Used': 'Currently in use',
      'Free': 'Available for use',
      'Available': 'Available including cache',
      'Buffers': 'Buffer memory',
      'Cached': 'Cache memory',
      'Swap Total': 'Total swap space',
      'Swap Used': 'Currently used swap',
      'Swap Free': 'Available swap space',
      
      // Hardware - Disk
      'Disk': 'Storage capacity and usage',
      'Filesystem': 'File system type',
      'Size': 'Total storage size',
      'Used Space': 'Currently used space',
      'Use Percentage': 'Percentage used',
      'Mounted On': 'Mount point location',
      
      // Hardware - Battery
      'Battery': 'Battery status and capacity',
      'Status': 'Current charging status',
      'Capacity': 'Battery health percentage',
      'Energy': 'Current energy level',
      
      // Network
      'Local IP': 'Internal network address',
      'Public IP': 'External network address',
      'Interface': 'Network interface name',
      'State': 'Connection status',
      'MTU': 'Maximum transmission unit',
      'MAC Address': 'Hardware address',
      'IPv4 Address': 'IPv4 network address',
      'IPv6 Address': 'IPv6 network address',
      
      // Media
      'Brightness': 'Current screen brightness',
      'Volume': 'System audio volume level',
      'Media': 'Currently playing media',
      'Player': 'Active media player',
      'Song': 'Current song or track',
    };
    
    return descriptions[field] || 'System information';
  }
  
  private createDetailRow(title: string, value: string, description?: string): Gtk.ListBoxRow {
    const descText = description || this.getDescriptionForField(title);
    const infoRow = new InfoRow(title, value, descText);
    return infoRow.getWidget();
  }

  private loadNetworkInterfaces(): void {
    try {
      const [stdout, stderr] = this.utils.executeCommand('ip', ['addr', 'show']);
      
      if (stderr && stderr.trim()) {
        console.error('Error executing ip command:', stderr);
      }
      
      // Parse ip addr output
      const interfaces = this.parseIpAddr(stdout);
      
      console.log('Parsed interfaces:', interfaces.length);
      
      if (interfaces.length === 0) {
        const noIfaceRow = this.createDetailRow('No interfaces found', 'Could not detect network interfaces');
        (noIfaceRow as any).set_margin_start(40);
        this.networkExpander.add_row(noIfaceRow);
        return;
      }
      
      // Create a PreferencesGroup for interfaces with a simple label header
      const interfacesGroup = new Adw.PreferencesGroup();
      
      interfacesGroup.set_title('Interfaces');
      interfacesGroup.set_description('');
      (interfacesGroup as any).set_margin_start(40);
      (interfacesGroup as any).set_margin_end(12);
      (interfacesGroup as any).set_margin_top(6);
      (interfacesGroup as any).set_margin_bottom(6);
      
      // Add expander for each interface
      for (const iface of interfaces) {
        console.log('Adding interface:', iface.name);
        
        const ifaceExpander = new Adw.ExpanderRow({
          title: iface.name,
          icon_name: this.getInterfaceIcon(iface.name),
          show_enable_switch: false,
        });
        
        interfacesGroup.add(ifaceExpander);
        
        // Add state as first detail
        if (iface.state) {
          const stateRow = this.createDetailRow('State', iface.state, 'Connection status');
          ifaceExpander.add_row(stateRow as any);
        }
        
        // Add interface details
        if (iface.ipv4) {
          const ipRow = this.createDetailRow('IPv4 Address', iface.ipv4);
          ifaceExpander.add_row(ipRow as any);
        }
        
        if (iface.ipv6) {
          const ipRow = this.createDetailRow('IPv6 Address', iface.ipv6);
          ifaceExpander.add_row(ipRow as any);
        }
        
        if (iface.netmask) {
          const maskRow = this.createDetailRow('Netmask', iface.netmask);
          ifaceExpander.add_row(maskRow as any);
        }
        
        if (iface.mac) {
          const macRow = this.createDetailRow('MAC Address', iface.mac);
          ifaceExpander.add_row(macRow as any);
        }
        
        if (iface.mtu) {
          const mtuRow = this.createDetailRow('MTU', iface.mtu, 'Maximum transmission unit');
          ifaceExpander.add_row(mtuRow as any);
        }
        
        if (iface.rx) {
          const rxRow = this.createDetailRow('RX bytes', iface.rx, 'Total bytes received');
          ifaceExpander.add_row(rxRow as any);
        }
        
        if (iface.tx) {
          const txRow = this.createDetailRow('TX bytes', iface.tx, 'Total bytes transmitted');
          ifaceExpander.add_row(txRow as any);
        }
      }
      
      // Add the group as a row to network expander instead of set_child
      // Create a wrapper box for the group
      const groupWrapper = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
      });
      groupWrapper.append(interfacesGroup);
      
      const groupRow = new Gtk.ListBoxRow();
      groupRow.set_child(groupWrapper);
      (groupRow as any).set_activatable(false);
      (groupRow as any).set_selectable(false);
      
      this.networkExpander.add_row(groupRow);
      
      // Create a PreferencesGroup for other network info
      const otherNetworkGroup = new Adw.PreferencesGroup();
      
      otherNetworkGroup.set_title('Connectivity');
      otherNetworkGroup.set_description('');
      
      (otherNetworkGroup as any).set_margin_start(40);
      (otherNetworkGroup as any).set_margin_end(12);
      (otherNetworkGroup as any).set_margin_top(6);
      (otherNetworkGroup as any).set_margin_bottom(6);
      
      // Add Firewall information
      this.loadFirewallInfo(otherNetworkGroup);
      
      // Add WiFi information
      this.loadWiFiInfo(otherNetworkGroup);
      
      // Add Ethernet information
      this.loadEthernetInfo(otherNetworkGroup);
      
      // Add DNS information
      this.loadDNSInfo(otherNetworkGroup);
      
      // Add VPN information
      this.loadVPNInfo(otherNetworkGroup);
      
      // Add the other group as a row
      const otherGroupWrapper = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
      });
      otherGroupWrapper.append(otherNetworkGroup);
      
      const otherGroupRow = new Gtk.ListBoxRow();
      otherGroupRow.set_child(otherGroupWrapper);
      (otherGroupRow as any).set_activatable(false);
      (otherGroupRow as any).set_selectable(false);
      
      this.networkExpander.add_row(otherGroupRow);
    } catch (e) {
      console.error('Error loading network interfaces:', e);
    }
  }
  
  private loadFirewallInfo(group: Adw.PreferencesGroup): void {
    try {
      const firewallExpander = new Adw.ExpanderRow({
        title: 'Firewall',
        icon_name: 'security-high-symbolic',
        show_enable_switch: false,
      });
      
      // Try to get firewall status
      let status = 'Unknown';
      let details: string[] = [];
      let needsAuth = false;
      
      try {
        const [stdout, stderr] = this.utils.executeCommand('ufw', ['status']);
        
        if (stderr && (stderr.includes('permission denied') || stderr.includes('ERROR'))) {
          needsAuth = true;
        } else if (stdout.includes('Status: active')) {
          status = 'Active';
          const lines = stdout.split('\n');
          for (const line of lines) {
            if (line.trim() && !line.includes('Status:') && !line.includes('To') && !line.includes('--')) {
              details.push(line.trim());
            }
          }
        } else if (stdout.includes('Status: inactive')) {
          status = 'Inactive';
        }
      } catch (e) {
        // Try firewalld
        try {
          const [stdout2, stderr2] = this.utils.executeCommand('firewall-cmd', ['--state']);
          if (stderr2 && stderr2.includes('authorization')) {
            needsAuth = true;
          } else {
            status = stdout2.trim();
          }
        } catch (e2) {
          status = 'Not available';
        }
      }
      
      if (!this.isAuthenticated && needsAuth) {
        const authRow = this.createDetailRow('Authentication Required', 'Click "Authenticate" button to view firewall information');
        const lockIcon = new Gtk.Image({
          icon_name: 'dialog-password-symbolic',
          css_classes: ['dim-label'],
        });
        (authRow.get_child() as Gtk.Box).append(lockIcon);
        firewallExpander.add_row(authRow as any);
        group.add(firewallExpander);
        return;
      }
      
      const statusRow = this.createDetailRow('Status', status, 'Firewall state');
      firewallExpander.add_row(statusRow as any);
      
      if (details.length > 0 && details.length <= 5) {
        for (const detail of details) {
          const row = this.createDetailRow('Rule', detail);
          firewallExpander.add_row(row as any);
        }
      }
      
      group.add(firewallExpander);
    } catch (e) {
      console.error('Error loading firewall info:', e);
    }
  }
  
  private loadWiFiInfo(group: Adw.PreferencesGroup): void {
    try {
      const wifiExpander = new Adw.ExpanderRow({
        title: 'WiFi',
        icon_name: 'network-wireless-symbolic',
        show_enable_switch: false,
      });
      
      // Try to get WiFi information using nmcli
      try {
        const [stdout] = this.utils.executeCommand('nmcli', ['-t', '-f', 'ACTIVE,SSID,SIGNAL,SECURITY', 'dev', 'wifi']);
        const lines = stdout.split('\n').filter(l => l.trim());
        
        let hasWifi = false;
        for (const line of lines) {
          const parts = line.split(':');
          if (parts.length >= 4 && parts[0] === 'yes') {
            hasWifi = true;
            const ssidRow = this.createDetailRow('Connected to', parts[1] || 'Unknown', 'WiFi network name (SSID)');
            wifiExpander.add_row(ssidRow as any);
            
            if (parts[2]) {
              const signalRow = this.createDetailRow('Signal Strength', `${parts[2]}%`, 'WiFi signal quality');
              wifiExpander.add_row(signalRow as any);
            }
            
            if (parts[3]) {
              const securityRow = this.createDetailRow('Security', parts[3], 'WiFi encryption type');
              wifiExpander.add_row(securityRow as any);
            }
            break;
          }
        }
        
        if (!hasWifi) {
          const noWifiRow = this.createDetailRow('Status', 'Not connected');
          wifiExpander.add_row(noWifiRow as any);
        }
      } catch (e) {
        const errorRow = this.createDetailRow('Status', 'Information not available');
        wifiExpander.add_row(errorRow as any);
      }
      
      group.add(wifiExpander);
    } catch (e) {
      console.error('Error loading WiFi info:', e);
    }
  }
  
  private loadEthernetInfo(group: Adw.PreferencesGroup): void {
    try {
      const ethernetExpander = new Adw.ExpanderRow({
        title: 'Ethernet',
        icon_name: 'network-wired-symbolic',
        show_enable_switch: false,
      });
      
      // Try to get Ethernet information using nmcli
      try {
        const [stdout] = this.utils.executeCommand('nmcli', ['-t', '-f', 'DEVICE,TYPE,STATE,CONNECTION', 'dev']);
        const lines = stdout.split('\n').filter(l => l.trim());
        
        let hasEthernet = false;
        for (const line of lines) {
          const parts = line.split(':');
          if (parts.length >= 4 && parts[1] === 'ethernet') {
            hasEthernet = true;
            const deviceRow = this.createDetailRow('Device', parts[0], 'Network interface name');
            ethernetExpander.add_row(deviceRow as any);
            
            const stateRow = this.createDetailRow('State', parts[2], 'Connection status');
            ethernetExpander.add_row(stateRow as any);
            
            if (parts[3]) {
              const connectionRow = this.createDetailRow('Connection', parts[3], 'Active network connection');
              ethernetExpander.add_row(connectionRow as any);
            }
          }
        }
        
        if (!hasEthernet) {
          const noEthRow = this.createDetailRow('Status', 'No ethernet devices found');
          ethernetExpander.add_row(noEthRow as any);
        }
      } catch (e) {
        const errorRow = this.createDetailRow('Status', 'Information not available');
        ethernetExpander.add_row(errorRow as any);
      }
      
      group.add(ethernetExpander);
    } catch (e) {
      console.error('Error loading Ethernet info:', e);
    }
  }
  
  private loadDNSInfo(group: Adw.PreferencesGroup): void {
    try {
      const dnsExpander = new Adw.ExpanderRow({
        title: 'DNS',
        icon_name: 'network-server-symbolic',
        show_enable_switch: false,
      });
      
      // Try to get DNS servers from resolv.conf and systemd-resolve
      try {
        const [stdout] = this.utils.executeCommand('cat', ['/etc/resolv.conf']);
        const lines = stdout.split('\n');
        let ipv4Servers: string[] = [];
        let ipv6Servers: string[] = [];
        let searchDomains: string[] = [];
        let options: string[] = [];
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('nameserver')) {
            const parts = trimmed.split(/\s+/);
            if (parts.length >= 2) {
              const ip = parts[1];
              if (ip.includes(':')) {
                ipv6Servers.push(ip);
              } else {
                ipv4Servers.push(ip);
              }
            }
          } else if (trimmed.startsWith('search')) {
            const domains = trimmed.substring(6).trim().split(/\s+/);
            searchDomains.push(...domains);
          } else if (trimmed.startsWith('options')) {
            const opts = trimmed.substring(7).trim().split(/\s+/);
            options.push(...opts);
          }
        }
        
        if (ipv4Servers.length === 0 && ipv6Servers.length === 0 && searchDomains.length === 0) {
          const noDnsRow = this.createDetailRow('Status', 'No DNS configuration found');
          dnsExpander.add_row(noDnsRow as any);
        } else {
          // Always show IPv6 row
          const ipv6Row = this.createDetailRow('Nameserver IPv6', ipv6Servers.length > 0 ? ipv6Servers.join(', ') : 'Not configured', 'IPv6 DNS servers');
          dnsExpander.add_row(ipv6Row as any);
          
          // Always show IPv4 row
          const ipv4Row = this.createDetailRow('Nameserver IPv4', ipv4Servers.length > 0 ? ipv4Servers.join(', ') : 'Not configured', 'IPv4 DNS servers');
          dnsExpander.add_row(ipv4Row as any);
          
          // Show search domains
          if (searchDomains.length > 0) {
            const searchRow = this.createDetailRow('Search Domains', searchDomains.join(', '), 'DNS search suffixes');
            dnsExpander.add_row(searchRow as any);
          }
          
          // Show options if present
          if (options.length > 0) {
            const optionsRow = this.createDetailRow('Options', options.join(', '), 'DNS resolver options');
            dnsExpander.add_row(optionsRow as any);
          }
        }
      } catch (e) {
        const errorRow = this.createDetailRow('Status', 'Information not available');
        dnsExpander.add_row(errorRow as any);
      }
      
      group.add(dnsExpander);
    } catch (e) {
      console.error('Error loading DNS info:', e);
    }
  }
  
  private loadVPNInfo(group: Adw.PreferencesGroup): void {
    try {
      const vpnExpander = new Adw.ExpanderRow({
        title: 'VPN',
        icon_name: 'network-vpn-symbolic',
        show_enable_switch: false,
      });
      
      // Try to detect active VPN connections
      try {
        const [stdout] = this.utils.executeCommand('nmcli', ['-t', '-f', 'NAME,TYPE,STATE', 'con', 'show', '--active']);
        const lines = stdout.split('\n').filter(l => l.trim());
        
        let hasVPN = false;
        for (const line of lines) {
          const parts = line.split(':');
          if (parts.length >= 3 && (parts[1].includes('vpn') || parts[1].includes('tun') || parts[1].includes('wireguard'))) {
            hasVPN = true;
            const nameRow = this.createDetailRow('Connection', parts[0], 'VPN connection name');
            vpnExpander.add_row(nameRow as any);
            
            const typeRow = this.createDetailRow('Type', parts[1], 'VPN protocol type');
            vpnExpander.add_row(typeRow as any);
            
            const stateRow = this.createDetailRow('State', parts[2], 'Connection status');
            vpnExpander.add_row(stateRow as any);
          }
        }
        
        if (!hasVPN) {
          const noVpnRow = this.createDetailRow('Status', 'No active VPN connections');
          vpnExpander.add_row(noVpnRow as any);
        }
      } catch (e) {
        const errorRow = this.createDetailRow('Status', 'Information not available');
        vpnExpander.add_row(errorRow as any);
      }
      
      group.add(vpnExpander);
    } catch (e) {
      console.error('Error loading VPN info:', e);
    }
  }
  
  
  private loadSoftwareInfo(): void {
    // Installed packages count
    try {
      let packagesCount = 'Unknown';
      let packageManager = '';
      
      // Try different package managers
      try {
        const [dpkgOut] = this.utils.executeCommand('dpkg', ['-l']);
        const count = dpkgOut.split('\n').filter(line => line.startsWith('ii')).length;
        packagesCount = count.toString();
        packageManager = 'dpkg';
      } catch (e) {
        try {
          const [rpmOut] = this.utils.executeCommand('rpm', ['-qa']);
          const count = rpmOut.split('\n').filter(line => line.trim()).length;
          packagesCount = count.toString();
          packageManager = 'rpm';
        } catch (e2) {
          try {
            const [pacmanOut] = this.utils.executeCommand('pacman', ['-Q']);
            const count = pacmanOut.split('\n').filter(line => line.trim()).length;
            packagesCount = count.toString();
            packageManager = 'pacman';
          } catch (e3) {
            // No package manager found
          }
        }
      }
      
      if (packageManager) {
        this.addInfoRow('Packages', `${packagesCount} (${packageManager})`, 'application-x-addon-symbolic', 'software');
      }
    } catch (e) {
      console.error('Error loading package count:', e);
    }
    
    // Shell
    try {
      const [shellOut] = this.utils.executeCommand('sh', ['-c', 'echo $SHELL']);
      if (shellOut.trim()) {
        const shell = shellOut.trim().split('/').pop() || shellOut.trim();
        this.addInfoRow('Shell', shell, 'utilities-terminal-symbolic', 'software');
      }
    } catch (e) {
      console.error('Error loading shell:', e);
    }
    
    // Python version
    try {
      const [pythonOut] = this.utils.executeCommand('python3', ['--version']);
      if (pythonOut.trim()) {
        const version = pythonOut.replace('Python ', '').trim();
        this.addInfoRow('Python', version, 'application-x-executable-symbolic', 'software');
      }
    } catch (e) {
      // Python not installed
    }
    
    // Node.js version
    try {
      const [nodeOut] = this.utils.executeCommand('node', ['--version']);
      if (nodeOut.trim()) {
        const version = nodeOut.trim().replace('v', '');
        this.addInfoRow('Node.js', version, 'application-x-executable-symbolic', 'software');
      }
    } catch (e) {
      // Node not installed
    }
    
    // GCC version
    try {
      const [gccOut] = this.utils.executeCommand('gcc', ['--version']);
      const firstLine = gccOut.split('\n')[0];
      const match = firstLine.match(/gcc.*?(\d+\.\d+\.\d+)/);
      if (match) {
        this.addInfoRow('GCC', match[1], 'application-x-executable-symbolic', 'software');
      }
    } catch (e) {
      // GCC not installed
    }
    
    // Git version
    try {
      const [gitOut] = this.utils.executeCommand('git', ['--version']);
      const match = gitOut.match(/git version ([\d.]+)/);
      if (match) {
        this.addInfoRow('Git', match[1], 'application-x-executable-symbolic', 'software');
      }
    } catch (e) {
      // Git not installed
    }
    
    // Docker version
    try {
      const [dockerOut] = this.utils.executeCommand('docker', ['--version']);
      const match = dockerOut.match(/Docker version ([\d.]+)/);
      if (match) {
        this.addInfoRow('Docker', match[1], 'application-x-executable-symbolic', 'software');
      }
    } catch (e) {
      // Docker not installed
    }
  }
  
  private parseIpAddr(output: string): Array<{name: string, state?: string, ipv4?: string, ipv6?: string, netmask?: string, mac?: string, mtu?: string, rx?: string, tx?: string}> {
    const interfaces: Array<any> = [];
    let currentIface: any = null;
    
    if (!output || output.trim() === '') {
      console.error('Empty output from ip command');
      return interfaces;
    }
    
    console.log('Parsing ip addr output, length:', output.length);
    
    const lines = output.split('\n');
    console.log('Total lines:', lines.length);
    
    for (const line of lines) {
      // New interface - format: "2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500"
      // Also handle: "2: eth0@if3: <BROADCAST..." for virtual interfaces
      if (line.match(/^\d+:\s+[a-z0-9@]+:/i)) {
        if (currentIface) {
          interfaces.push(currentIface);
        }
        
        const match = line.match(/^\d+:\s+([^:@]+)/);
        if (match) {
          currentIface = {
            name: match[1].trim(),
          };
          console.log('Found interface:', currentIface.name);
        }
        
        // Extract flags
        const flagMatch = line.match(/<([^>]+)>/);
        if (flagMatch) {
          currentIface.state = flagMatch[1].includes('UP') ? 'UP' : 'DOWN';
        }
        
        // Extract MTU
        const mtuMatch = line.match(/mtu (\d+)/);
        if (mtuMatch) {
          currentIface.mtu = mtuMatch[1];
        }
      } else if (currentIface) {
        const trimmed = line.trim();
        
        // MAC address - format: "link/ether 00:11:22:33:44:55"
        if (trimmed.startsWith('link/ether')) {
          const match = trimmed.match(/link\/ether\s+([a-f0-9:]+)/i);
          if (match) {
            currentIface.mac = match[1];
          }
        }
        
        // IPv4 address - format: "inet 192.168.1.100/24"
        if (trimmed.startsWith('inet ') && !trimmed.startsWith('inet6')) {
          const match = trimmed.match(/inet\s+([0-9.]+)\/?(\d+)?/);
          if (match) {
            currentIface.ipv4 = match[1];
            if (match[2]) {
              currentIface.netmask = `/${match[2]}`;
            }
          }
        }
        
        // IPv6 address - format: "inet6 fe80::1/64"
        if (trimmed.startsWith('inet6')) {
          const match = trimmed.match(/inet6\s+([a-f0-9:]+)/);
          if (match && !currentIface.ipv6) {
            currentIface.ipv6 = match[1];
          }
        }
      }
    }
    
    if (currentIface) {
      interfaces.push(currentIface);
    }
    
    // Get RX/TX statistics from /proc/net/dev
    try {
      const [stats] = this.utils.executeCommand('cat', ['/proc/net/dev']);
      const statLines = stats.split('\n');
      for (const iface of interfaces) {
        for (const statLine of statLines) {
          if (statLine.includes(iface.name + ':')) {
            const parts = statLine.split(/\s+/).filter(p => p);
            if (parts.length >= 10) {
              iface.rx = this.utils.formatBytes(parseInt(parts[1]));
              iface.tx = this.utils.formatBytes(parseInt(parts[9]));
            }
            break;
          }
        }
      }
    } catch (e) {
      console.error('Error reading network stats:', e);
    }
    
    return interfaces;
  }
  
  private getInterfaceIcon(name: string): string {
    if (name.startsWith('wl') || name.startsWith('wifi')) {
      return 'network-wireless-symbolic';
    } else if (name.startsWith('en') || name.startsWith('eth')) {
      return 'network-wired-symbolic';
    } else if (name.startsWith('lo')) {
      return 'network-server-symbolic';
    } else if (name.startsWith('docker') || name.startsWith('br')) {
      return 'network-workgroup-symbolic';
    }
    return 'network-wired-symbolic';
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

  private exportToJSON(): void {
    try {
      // Collect all system information
      const systemData: any = {
        exportDate: new Date().toISOString(),
        hostname: '',
        system: {},
        hardware: {},
        software: {},
        network: {},
        processes: []
      };

      // Get system and software info from DataService
      try {
        const sysInfo = this.dataService.getSystemInfo();
        systemData.hostname = sysInfo.hostname;
        systemData.system = {
          os: sysInfo.os,
          kernel: sysInfo.kernel,
          uptime: sysInfo.uptime
        };
        if (sysInfo.displays && sysInfo.displays.length > 0) {
          systemData.hardware.displays = sysInfo.displays;
        }
      } catch (e) {
        console.error('Error getting system info:', e);
      }

      try {
        const softInfo = this.dataService.getSoftwareInfo();
        systemData.software = softInfo;
      } catch (e) {
        console.error('Error getting software info:', e);
      }

      // Get CPU info
      try {
        const cpuInfo = this.dataService.getCpuInfo();
        systemData.hardware.cpu = cpuInfo;
      } catch (e) {
        console.error('Error getting CPU info:', e);
      }

      // Get GPU info
      try {
        const gpuInfo = this.dataService.getGpuInfo();
        systemData.hardware.gpu = gpuInfo;
      } catch (e) {
        console.error('Error getting GPU info:', e);
      }

      // Get Memory info
      try {
        const memoryInfo = this.dataService.getMemoryInfo();
        systemData.hardware.memory = memoryInfo;
      } catch (e) {
        console.error('Error getting memory info:', e);
      }

      // Get Battery info if available
      try {
        if (this.dataService.hasBattery()) {
          const [stdout] = this.utils.executeCommand('fastfetch', ['--format', 'json']);
          const fastfetchData = JSON.parse(stdout);
          const batteryModule = fastfetchData.find((item: any) => item.type === 'Battery');
          if (batteryModule?.result) {
            const batteryArray = Array.isArray(batteryModule.result) ? batteryModule.result : [batteryModule.result];
            if (batteryArray.length > 0 && batteryArray[0]) {
              systemData.hardware.battery = batteryArray[0];
            }
          }
        }
      } catch (e) {
        console.error('Error getting battery info:', e);
      }

      // Get Disk info
      try {
        const [stdout] = this.utils.executeCommand('lsblk', ['-J', '-o', 'NAME,SIZE,TYPE,MOUNTPOINT,FSTYPE,MODEL,SERIAL,VENDOR']);
        const diskData = JSON.parse(stdout);
        systemData.hardware.disks = diskData;
      } catch (e) {
        console.error('Error getting disk info:', e);
      }

      // Get Network interfaces
      try {
        const [stdout] = this.utils.executeCommand('ip', ['-j', 'addr', 'show']);
        const networkData = JSON.parse(stdout);
        systemData.network.interfaces = networkData;
      } catch (e) {
        console.error('Error getting network info:', e);
      }

      // Get Network statistics
      try {
        const [stdout] = this.utils.executeCommand('cat', ['/proc/net/dev']);
        const lines = stdout.split('\n').slice(2);
        systemData.network.statistics = [];
        for (const line of lines) {
          if (line.trim()) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 10) {
              systemData.network.statistics.push({
                interface: parts[0].replace(':', ''),
                rx_bytes: parseInt(parts[1]),
                rx_packets: parseInt(parts[2]),
                tx_bytes: parseInt(parts[9]),
                tx_packets: parseInt(parts[10])
              });
            }
          }
        }
      } catch (e) {
        console.error('Error getting network statistics:', e);
      }

      // Get Process list
      try {
        const [stdout] = this.utils.executeCommand('ps', ['aux', '--sort=-pcpu']);
        const lines = stdout.split('\n');
        systemData.processes = lines.slice(1, 21).map((line: string) => {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 11) {
            return {
              user: parts[0],
              pid: parts[1],
              cpu: parts[2],
              mem: parts[3],
              vsz: parts[4],
              rss: parts[5],
              stat: parts[7],
              start: parts[8],
              time: parts[9],
              command: parts.slice(10).join(' ')
            };
          }
          return null;
        }).filter((p: any) => p !== null);
      } catch (e) {
        console.error('Error getting process info:', e);
      }

      // Convert to JSON string
      const jsonContent = JSON.stringify(systemData, null, 2);

      // Show save file dialog
      const fileDialog = new Gtk.FileDialog();
      fileDialog.set_title('Export System Information');
      fileDialog.set_initial_name('system-info.json');

      // Create file filter for JSON
      const filter = new Gtk.FileFilter();
      filter.set_name('JSON files');
      filter.add_mime_type('application/json');
      filter.add_pattern('*.json');
      
      const filterList = new Gio.ListStore({ item_type: Gtk.FileFilter.$gtype });
      filterList.append(filter);
      fileDialog.set_filters(filterList);

      // Show save dialog
      fileDialog.save(
        this.container.get_root() as Gtk.Window,
        null,
        (dialog: any, result: any) => {
          try {
            const file = fileDialog.save_finish(result);
            if (file) {
              // Write JSON to file
              const [success] = file.replace_contents(
                jsonContent,
                null,
                false,
                Gio.FileCreateFlags.REPLACE_DESTINATION,
                null
              );

              if (success) {
                // Show success notification
                const toast = new Adw.Toast({
                  title: 'System information exported successfully',
                  timeout: 3
                });
                // Find the AdwToastOverlay parent if available
                let widget = this.container.get_parent();
                while (widget && !(widget instanceof Adw.ToastOverlay)) {
                  widget = widget.get_parent();
                }
                if (widget instanceof Adw.ToastOverlay) {
                  widget.add_toast(toast);
                }
              }
            }
          } catch (e: any) {
            // Check if user cancelled the dialog
            if (e.matches && e.matches(Gtk.DialogError, Gtk.DialogError.DISMISSED)) {
              // User cancelled, do nothing
              return;
            }
            console.error('Error saving file:', e);
            // Show error dialog only for real errors
            const errorDialog = new Adw.MessageDialog({
              heading: 'Export Failed',
              body: 'Could not save the file. Please try again.',
            });
            errorDialog.add_response('ok', 'OK');
            errorDialog.set_transient_for(this.container.get_root() as Gtk.Window);
            errorDialog.present();
          }
        }
      );
    } catch (e) {
      console.error('Error exporting to JSON:', e);
      const errorDialog = new Adw.MessageDialog({
        heading: 'Export Failed',
        body: `An error occurred while exporting: ${e}`,
      });
      errorDialog.add_response('ok', 'OK');
      errorDialog.set_transient_for(this.container.get_root() as Gtk.Window);
      errorDialog.present();
    }
  }

  public getWidget(): Gtk.Box {
    return this.container;
  }
}
