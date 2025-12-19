import Gtk from '@girs/gtk-4.0';
import Adw from '@girs/adw-1';
import { UtilsService } from '../services/utils-service';
import { NetworkService } from '../services/network-service';
import { NetworkData, NetworkInterface } from '../interfaces/network';
import { ProcessesService } from '../services/processes-service';
import { TopProcessesList, ProcessInfo } from './atoms/top-processes-list';
import { InfoRow } from './atoms/info-row';

export class NetworkComponent {
  private container: Gtk.Box;
  private networkChart!: Gtk.DrawingArea;
  private networkInterfacesGroup!: Adw.PreferencesGroup;
  private networkDownloadSpeed!: Gtk.Label;
  private networkUploadSpeed!: Gtk.Label;
  private networkTotalDownload!: Gtk.Label;
  private networkTotalUpload!: Gtk.Label;
  private utils: UtilsService;
  private networkService: NetworkService;
  private dataCallback!: (data: NetworkData) => void;
  private downloadHistory: number[] = [];
  private uploadHistory: number[] = [];
  private readonly maxHistoryPoints = 60;
  private interfaceRows: Map<string, Adw.ExpanderRow> = new Map();
  private processesService: ProcessesService;
  private topProcessesList!: TopProcessesList;

  constructor() {
    this.utils = UtilsService.instance;
    this.networkService = NetworkService.instance;
    this.processesService = ProcessesService.instance;
    const builder = Gtk.Builder.new();
    
    try {
      try {
        builder.add_from_file('/usr/share/com.obision.app.system/ui/network.ui');
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
    
    // Create and add TopProcessesList
    this.topProcessesList = new TopProcessesList('cpu', 8);
    const topProcessesContainer = builder.get_object('top_processes_container') as Gtk.Box;
    if (topProcessesContainer) {
      topProcessesContainer.append(this.topProcessesList.getWidget());
    }
    
    // Initialize history with zeros
    for (let i = 0; i < this.maxHistoryPoints; i++) {
      this.downloadHistory.push(0);
      this.uploadHistory.push(0);
    }
    
    // Setup drawing function for chart
    this.networkChart.set_draw_func((area, cr, width, height) => {
      this.drawLineChart(cr, width, height);
    });
    
    // Subscribe to network service
    this.dataCallback = this.onDataUpdate.bind(this);
    this.networkService.subscribeToUpdates(this.dataCallback);
  }

  private onDataUpdate(data: NetworkData): void {
    // Calculate totals
    let totalRxBytes = 0;
    let totalTxBytes = 0;
    let totalDownloadSpeed = 0;
    let totalUploadSpeed = 0;
    
    for (const iface of data.interfaces) {
      if (iface.name === 'lo') continue;
      totalRxBytes += iface.rxBytes;
      totalTxBytes += iface.txBytes;
      
      // Parse speed strings to get bytes per second
      const rxMatch = iface.rxSpeed.match(/([\d.]+)\s*([KMGT]?B)/);
      const txMatch = iface.txSpeed.match(/([\d.]+)\s*([KMGT]?B)/);
      
      if (rxMatch) {
        const value = parseFloat(rxMatch[1]);
        const unit = rxMatch[2];
        const multiplier = unit === 'KB' ? 1024 : unit === 'MB' ? 1024*1024 : unit === 'GB' ? 1024*1024*1024 : 1;
        totalDownloadSpeed += value * multiplier;
      }
      
      if (txMatch) {
        const value = parseFloat(txMatch[1]);
        const unit = txMatch[2];
        const multiplier = unit === 'KB' ? 1024 : unit === 'MB' ? 1024*1024 : unit === 'GB' ? 1024*1024*1024 : 1;
        totalUploadSpeed += value * multiplier;
      }
    }
    
    // Update speed labels
    this.networkDownloadSpeed.set_label(this.formatSpeed(totalDownloadSpeed));
    this.networkUploadSpeed.set_label(this.formatSpeed(totalUploadSpeed));
    this.networkTotalDownload.set_label(this.utils.formatBytes(totalRxBytes));
    this.networkTotalUpload.set_label(this.utils.formatBytes(totalTxBytes));
    
    // Update history for chart (convert to Mbps)
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
    
    // Update interface details
    for (const iface of data.interfaces) {
      if (iface.name === 'lo') continue;
      
      let expanderRow = this.interfaceRows.get(iface.name);
      if (!expanderRow) {
        expanderRow = this.createInterfaceRow(iface.name);
      }
      
      expanderRow.set_subtitle(`Status: ${iface.state}`);
      
      const ipLabel = (expanderRow as any)._ipLabel as Gtk.Label;
      if (ipLabel) ipLabel.set_label(iface.ipv4 || 'No IP');
      
      const macLabel = (expanderRow as any)._macLabel as Gtk.Label;
      if (macLabel) macLabel.set_label(iface.mac || '-');
      
      const speedLabel = (expanderRow as any)._speedLabel as Gtk.Label;
      if (speedLabel) speedLabel.set_label('-'); // Speed not in current interface
      
      const rxLabel = (expanderRow as any)._rxLabel as Gtk.Label;
      if (rxLabel) rxLabel.set_label(this.utils.formatBytes(iface.rxBytes));
      
      const txLabel = (expanderRow as any)._txLabel as Gtk.Label;
      if (txLabel) txLabel.set_label(this.utils.formatBytes(iface.txBytes));
    }
    
    // Update top processes
    this.updateTopProcesses();
    
    // Redraw chart
    this.networkChart.queue_draw();
  }
  
  private updateTopProcesses(): void {
    try {
      const allProcesses = this.processesService['loadProcesses']();
      const processInfoList: ProcessInfo[] = allProcesses.map(p => ({
        name: p.command.split(' ')[0].split('/').pop() || p.command,
        cpu: parseFloat(p.cpu) || 0,
        memory: parseFloat(p.rss) || 0
      }));
      this.topProcessesList.updateProcesses(processInfoList);
    } catch (error) {
      console.error('Error updating top processes:', error);
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

  private createInterfaceRow(interfaceName: string): Adw.ExpanderRow {
    const expanderRow = new Adw.ExpanderRow({
      title: interfaceName,
      subtitle: 'Loading...',
    });
    
    // Create detail rows
    const ipRow = new InfoRow('IP Address', '-').getWidget();
    const ipLabel = (ipRow.get_child() as Gtk.Box).get_last_child() as Gtk.Label;
    
    const macRow = new InfoRow('MAC Address', '-').getWidget();
    const macLabel = (macRow.get_child() as Gtk.Box).get_last_child() as Gtk.Label;
    
    const speedRow = new InfoRow('Link Speed', '-', 'Maximum connection speed').getWidget();
    const speedLabel = (speedRow.get_child() as Gtk.Box).get_last_child() as Gtk.Label;
    
    const rxRow = new InfoRow('Received', '-', 'Total bytes received').getWidget();
    const rxLabel = (rxRow.get_child() as Gtk.Box).get_last_child() as Gtk.Label;
    
    const txRow = new InfoRow('Transmitted', '-', 'Total bytes transmitted').getWidget();
    const txLabel = (txRow.get_child() as Gtk.Box).get_last_child() as Gtk.Label;
    
    expanderRow.add_row(ipRow as any);
    expanderRow.add_row(macRow as any);
    expanderRow.add_row(speedRow as any);
    expanderRow.add_row(rxRow as any);
    expanderRow.add_row(txRow as any);
    
    this.networkInterfacesGroup.add(expanderRow);
    this.interfaceRows.set(interfaceName, expanderRow);
    
    // Store labels for updates
    (expanderRow as any)._ipLabel = ipLabel;
    (expanderRow as any)._macLabel = macLabel;
    (expanderRow as any)._speedLabel = speedLabel;
    (expanderRow as any)._rxLabel = rxLabel;
    (expanderRow as any)._txLabel = txLabel;
    
    return expanderRow;
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
    this.networkService.unsubscribe(this.dataCallback);
    if (this.topProcessesList) {
      this.topProcessesList.destroy();
    }
  }
}
