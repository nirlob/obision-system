import Gtk from '@girs/gtk-4.0';
import Adw from '@girs/adw-1';
import GLib from '@girs/glib-2.0';
import { UtilsService } from '../services/utils-service';

interface NetworkStats {
  interface: string;
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
}

export class NetworkComponent {
  private container: Gtk.Box;
  private networkChart!: Gtk.DrawingArea;
  private networkInterfacesGroup!: Adw.PreferencesGroup;
  private networkDownloadSpeed!: Gtk.Label;
  private networkUploadSpeed!: Gtk.Label;
  private networkTotalDownload!: Gtk.Label;
  private networkTotalUpload!: Gtk.Label;
  private updateTimeoutId: number | null = null;
  private utils: UtilsService;
  private downloadHistory: number[] = [];
  private uploadHistory: number[] = [];
  private readonly maxHistoryPoints = 60;
  private previousStats: Map<string, NetworkStats> = new Map();
  private interfaceRows: Map<string, Adw.ExpanderRow> = new Map();

  constructor() {
    this.utils = UtilsService.instance;
    const builder = Gtk.Builder.new();
    
    try {
      try {
        builder.add_from_file('/usr/share/com.obision.ObisionStatus/ui/network.ui');
      } catch (e) {
        builder.add_from_file('data/ui/network.ui');
      }
    } catch (e) {
      console.error('Could not load network.ui:', e);
      this.container = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 12,
      });
      return;
    }

    this.container = builder.get_object('network_container') as Gtk.Box;
    this.networkChart = builder.get_object('network_chart') as Gtk.DrawingArea;
    this.networkInterfacesGroup = builder.get_object('network_interfaces_group') as Adw.PreferencesGroup;
    this.networkDownloadSpeed = builder.get_object('network_download_speed') as Gtk.Label;
    this.networkUploadSpeed = builder.get_object('network_upload_speed') as Gtk.Label;
    this.networkTotalDownload = builder.get_object('network_total_download') as Gtk.Label;
    this.networkTotalUpload = builder.get_object('network_total_upload') as Gtk.Label;
    
    // Initialize history with zeros
    for (let i = 0; i < this.maxHistoryPoints; i++) {
      this.downloadHistory.push(0);
      this.uploadHistory.push(0);
    }
    
    // Setup drawing function for chart
    this.networkChart.set_draw_func((area, cr, width, height) => {
      this.drawLineChart(cr, width, height);
    });
    
    // Load network interfaces
    this.loadNetworkInterfaces();
    
    // Initial update
    this.updateData();
    
    // Update every 2 seconds
    this.updateTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
      this.updateData();
      return GLib.SOURCE_CONTINUE;
    });
  }

  private loadNetworkInterfaces(): void {
    try {
      const [ifconfigOut] = this.utils.executeCommand('ip', ['link', 'show']);
      const lines = ifconfigOut.split('\n');
      
      for (const line of lines) {
        if (line.match(/^\d+:/)) {
          const match = line.match(/^\d+:\s+([^:]+):/);
          if (match) {
            const interfaceName = match[1].trim();
            if (interfaceName !== 'lo') {
              this.createInterfaceRow(interfaceName);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading network interfaces:', error);
    }
  }

  private createInterfaceRow(interfaceName: string): void {
    const expanderRow = new Adw.ExpanderRow({
      title: interfaceName,
      subtitle: 'Loading...',
    });
    
    // Create detail rows
    const ipRow = new Adw.ActionRow({
      title: 'IP Address',
    });
    const ipLabel = new Gtk.Label({
      label: '-',
      css_classes: ['dim-label'],
    });
    ipRow.add_suffix(ipLabel);
    
    const macRow = new Adw.ActionRow({
      title: 'MAC Address',
    });
    const macLabel = new Gtk.Label({
      label: '-',
      css_classes: ['dim-label'],
    });
    macRow.add_suffix(macLabel);
    
    const speedRow = new Adw.ActionRow({
      title: 'Link Speed',
    });
    const speedLabel = new Gtk.Label({
      label: '-',
      css_classes: ['dim-label'],
    });
    speedRow.add_suffix(speedLabel);
    
    const rxRow = new Adw.ActionRow({
      title: 'Received',
    });
    const rxLabel = new Gtk.Label({
      label: '-',
      css_classes: ['dim-label'],
    });
    rxRow.add_suffix(rxLabel);
    
    const txRow = new Adw.ActionRow({
      title: 'Transmitted',
    });
    const txLabel = new Gtk.Label({
      label: '-',
      css_classes: ['dim-label'],
    });
    txRow.add_suffix(txLabel);
    
    expanderRow.add_row(ipRow);
    expanderRow.add_row(macRow);
    expanderRow.add_row(speedRow);
    expanderRow.add_row(rxRow);
    expanderRow.add_row(txRow);
    
    this.networkInterfacesGroup.add(expanderRow);
    this.interfaceRows.set(interfaceName, expanderRow);
    
    // Store labels for updates
    (expanderRow as any)._ipLabel = ipLabel;
    (expanderRow as any)._macLabel = macLabel;
    (expanderRow as any)._speedLabel = speedLabel;
    (expanderRow as any)._rxLabel = rxLabel;
    (expanderRow as any)._txLabel = txLabel;
  }

  private updateData(): void {
    try {
      const currentStats = this.getNetworkStats();
      let totalDownloadSpeed = 0;
      let totalUploadSpeed = 0;
      let totalRxBytes = 0;
      let totalTxBytes = 0;
      
      for (const [iface, stats] of currentStats) {
        if (iface === 'lo') continue;
        
        totalRxBytes += stats.rxBytes;
        totalTxBytes += stats.txBytes;
        
        const previous = this.previousStats.get(iface);
        if (previous) {
          const downloadSpeed = (stats.rxBytes - previous.rxBytes) / 2; // bytes per second
          const uploadSpeed = (stats.txBytes - previous.txBytes) / 2;
          
          totalDownloadSpeed += downloadSpeed;
          totalUploadSpeed += uploadSpeed;
        }
        
        // Update interface details
        this.updateInterfaceDetails(iface, stats);
      }
      
      this.previousStats = currentStats;
      
      // Update speed labels
      this.networkDownloadSpeed.set_label(this.formatSpeed(totalDownloadSpeed));
      this.networkUploadSpeed.set_label(this.formatSpeed(totalUploadSpeed));
      this.networkTotalDownload.set_label(this.formatBytes(totalRxBytes));
      this.networkTotalUpload.set_label(this.formatBytes(totalTxBytes));
      
      // Update history (convert to Mbps for chart)
      const downloadMbps = (totalDownloadSpeed * 8) / 1000000;
      const uploadMbps = (totalUploadSpeed * 8) / 1000000;
      
      this.downloadHistory.push(downloadMbps);
      if (this.downloadHistory.length > this.maxHistoryPoints) {
        this.downloadHistory.shift();
      }
      
      this.uploadHistory.push(uploadMbps);
      if (this.uploadHistory.length > this.maxHistoryPoints) {
        this.uploadHistory.shift();
      }
      
      // Redraw chart
      this.networkChart.queue_draw();
    } catch (error) {
      console.error('Error updating network data:', error);
    }
  }

  private getNetworkStats(): Map<string, NetworkStats> {
    const stats = new Map<string, NetworkStats>();
    
    try {
      const [netDevOut] = this.utils.executeCommand('cat', ['/proc/net/dev']);
      const lines = netDevOut.split('\n').slice(2); // Skip header lines
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        const parts = line.trim().split(/\s+/);
        if (parts.length < 10) continue;
        
        const iface = parts[0].replace(':', '');
        const rxBytes = parseInt(parts[1]) || 0;
        const rxPackets = parseInt(parts[2]) || 0;
        const txBytes = parseInt(parts[9]) || 0;
        const txPackets = parseInt(parts[10]) || 0;
        
        stats.set(iface, {
          interface: iface,
          rxBytes,
          txBytes,
          rxPackets,
          txPackets,
        });
      }
    } catch (error) {
      console.error('Error getting network stats:', error);
    }
    
    return stats;
  }

  private updateInterfaceDetails(iface: string, stats: NetworkStats): void {
    const expanderRow = this.interfaceRows.get(iface);
    if (!expanderRow) return;
    
    try {
      // Get IP address
      const [ipOut] = this.utils.executeCommand('ip', ['addr', 'show', iface]);
      let ipAddress = 'No IP';
      let status = 'DOWN';
      
      if (ipOut.includes('state UP')) {
        status = 'UP';
      }
      
      const ipMatch = ipOut.match(/inet\s+([0-9.]+)/);
      if (ipMatch) {
        ipAddress = ipMatch[1];
      }
      
      expanderRow.set_subtitle(`Status: ${status}`);
      
      const ipLabel = (expanderRow as any)._ipLabel as Gtk.Label;
      if (ipLabel) ipLabel.set_label(ipAddress);
      
      // Get MAC address
      const macMatch = ipOut.match(/link\/ether\s+([0-9a-f:]+)/);
      if (macMatch) {
        const macLabel = (expanderRow as any)._macLabel as Gtk.Label;
        if (macLabel) macLabel.set_label(macMatch[1]);
      }
      
      // Get link speed
      try {
        const [speedOut] = this.utils.executeCommand('cat', [`/sys/class/net/${iface}/speed`]);
        const speed = parseInt(speedOut.trim());
        if (!isNaN(speed) && speed > 0) {
          const speedLabel = (expanderRow as any)._speedLabel as Gtk.Label;
          if (speedLabel) speedLabel.set_label(`${speed} Mbps`);
        }
      } catch {
        // Speed not available for this interface
      }
      
      // Update received/transmitted
      const rxLabel = (expanderRow as any)._rxLabel as Gtk.Label;
      const txLabel = (expanderRow as any)._txLabel as Gtk.Label;
      if (rxLabel) rxLabel.set_label(this.formatBytes(stats.rxBytes));
      if (txLabel) txLabel.set_label(this.formatBytes(stats.txBytes));
      
    } catch (error) {
      console.error(`Error updating interface ${iface}:`, error);
    }
  }

  private formatSpeed(bytesPerSecond: number): string {
    if (bytesPerSecond < 1024) {
      return `${bytesPerSecond.toFixed(2)} B/s`;
    } else if (bytesPerSecond < 1024 * 1024) {
      return `${(bytesPerSecond / 1024).toFixed(2)} KB/s`;
    } else {
      return `${(bytesPerSecond / (1024 * 1024)).toFixed(2)} MB/s`;
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  private drawLineChart(cr: any, width: number, height: number): void {
    const padding = 20;
    const chartWidth = width - 2 * padding;
    const chartHeight = height - 2 * padding;
    
    // Clear background with transparent color
    cr.setSourceRGBA(0, 0, 0, 0);
    cr.paint();
    
    // Draw grid lines
    cr.setSourceRGBA(0.8, 0.8, 0.8, 0.5);
    cr.setLineWidth(1);
    
    // Find max value for scaling
    const maxDownload = Math.max(...this.downloadHistory, 1);
    const maxUpload = Math.max(...this.uploadHistory, 1);
    const maxValue = Math.max(maxDownload, maxUpload);
    
    // Horizontal grid lines
    for (let i = 0; i <= 4; i++) {
      const y = padding + (chartHeight * i / 4);
      cr.moveTo(padding, y);
      cr.lineTo(width - padding, y);
      cr.stroke();
    }
    
    // Draw axes
    cr.setSourceRGB(0.5, 0.5, 0.5);
    cr.setLineWidth(2);
    cr.moveTo(padding, padding);
    cr.lineTo(padding, height - padding);
    cr.lineTo(width - padding, height - padding);
    cr.stroke();
    
    const pointSpacing = chartWidth / (this.maxHistoryPoints - 1);
    
    // Draw download line (blue)
    if (this.downloadHistory.length > 1) {
      cr.setSourceRGB(0.2, 0.4, 0.8);
      cr.setLineWidth(2);
      
      cr.moveTo(padding, height - padding - (this.downloadHistory[0] / maxValue) * chartHeight);
      
      for (let i = 1; i < this.downloadHistory.length; i++) {
        const x = padding + i * pointSpacing;
        const y = height - padding - (this.downloadHistory[i] / maxValue) * chartHeight;
        cr.lineTo(x, y);
      }
      
      cr.stroke();
    }
    
    // Draw upload line (green)
    if (this.uploadHistory.length > 1) {
      cr.setSourceRGB(0.2, 0.7, 0.3);
      cr.setLineWidth(2);
      
      cr.moveTo(padding, height - padding - (this.uploadHistory[0] / maxValue) * chartHeight);
      
      for (let i = 1; i < this.uploadHistory.length; i++) {
        const x = padding + i * pointSpacing;
        const y = height - padding - (this.uploadHistory[i] / maxValue) * chartHeight;
        cr.lineTo(x, y);
      }
      
      cr.stroke();
    }
    
    // Draw labels
    cr.setSourceRGB(0.3, 0.3, 0.3);
    cr.selectFontFace('Sans', 0, 0);
    cr.setFontSize(10);
    
    // Y-axis labels (show max value at top)
    for (let i = 0; i <= 4; i++) {
      const y = padding + (chartHeight * i / 4);
      const value = maxValue * (1 - i / 4);
      const label = `${value.toFixed(1)}`;
      cr.moveTo(5, y + 3);
      cr.showText(label);
    }
    
    // Legend
    cr.setFontSize(10);
    cr.selectFontFace('Sans', 0, 0); // Normal font
    
    // Download legend
    cr.setSourceRGB(0.2, 0.4, 0.8);
    cr.rectangle(width - 180, 7, 15, 10);
    cr.fill();
    cr.setSourceRGB(0.5, 0.5, 0.5);
    cr.setLineWidth(1);
    cr.rectangle(width - 180, 7, 15, 10);
    cr.stroke();
    cr.setSourceRGB(1, 1, 1);
    cr.moveTo(width - 160, 15);
    cr.showText('Download');
    
    // Upload legend
    cr.setSourceRGB(0.2, 0.7, 0.3);
    cr.rectangle(width - 85, 7, 15, 10);
    cr.fill();
    cr.setSourceRGB(0.5, 0.5, 0.5);
    cr.setLineWidth(1);
    cr.rectangle(width - 85, 7, 15, 10);
    cr.stroke();
    cr.setSourceRGB(1, 1, 1);
    cr.moveTo(width - 65, 15);
    cr.showText('Upload');
  }

  public getWidget(): Gtk.Box {
    return this.container;
  }

  public destroy(): void {
    if (this.updateTimeoutId !== null) {
      GLib.source_remove(this.updateTimeoutId);
      this.updateTimeoutId = null;
    }
  }
}
