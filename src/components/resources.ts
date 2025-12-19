import Gtk from '@girs/gtk-4.0';
import GLib from '@girs/glib-2.0';
import { UtilsService } from '../services/utils-service';

interface HistoryData {
  values: number[];
  maxPoints: number;
}

export class ResourcesComponent {
  private container: Gtk.Box;
  private utils: UtilsService;
  private updateTimeoutId: number | null = null;
  
  // CPU
  private cpuCoresContainer!: Gtk.Box;
  private cpuHistoryChart!: Gtk.DrawingArea;
  private cpuCoreProgressBars: Gtk.ProgressBar[] = [];
  private cpuCoreLabels: Gtk.Label[] = [];
  private cpuHistory: HistoryData = { values: [], maxPoints: 60 };
  private prevIdle: number[] = [];
  private prevTotal: number[] = [];
  
  // Memory
  private memoryLabel!: Gtk.Label;
  private memoryPercent!: Gtk.Label;
  private memoryProgress!: Gtk.ProgressBar;
  private memoryHistoryChart!: Gtk.DrawingArea;
  private memoryHistory: HistoryData = { values: [], maxPoints: 60 };
  
  // Swap
  private swapLabel!: Gtk.Label;
  private swapPercent!: Gtk.Label;
  private swapProgress!: Gtk.ProgressBar;
  
  // Disk I/O
  private diskReadLabel!: Gtk.Label;
  private diskWriteLabel!: Gtk.Label;
  private diskHistoryChart!: Gtk.DrawingArea;
  private diskReadHistory: HistoryData = { values: [], maxPoints: 60 };
  private diskWriteHistory: HistoryData = { values: [], maxPoints: 60 };
  private prevDiskRead: number = 0;
  private prevDiskWrite: number = 0;
  
  // Network I/O
  private networkDownloadLabel!: Gtk.Label;
  private networkUploadLabel!: Gtk.Label;
  private networkHistoryChart!: Gtk.DrawingArea;
  private networkDownloadHistory: HistoryData = { values: [], maxPoints: 60 };
  private networkUploadHistory: HistoryData = { values: [], maxPoints: 60 };
  private prevNetworkRx: number = 0;
  private prevNetworkTx: number = 0;
  
  // GPU
  private gpuSection!: Gtk.Box;
  private gpuLabel!: Gtk.Label;
  private gpuPercent!: Gtk.Label;
  private gpuProgress!: Gtk.ProgressBar;
  
  // Temperatures
  private temperaturesContainer!: Gtk.Box;

  constructor() {
    this.utils = UtilsService.instance;
    const builder = Gtk.Builder.new();
    
    try {
      try {
        builder.add_from_file('/usr/share/com.obision.app.system/ui/resources.ui');
      } catch (e) {
        builder.add_from_file('data/ui/resources.ui');
      }
    } catch (e) {
      console.error('Could not load resources.ui:', e);
      this.container = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 12,
      });
      return;
    }

    this.container = builder.get_object('resources_container') as Gtk.Box;
    
    // Get widgets
    this.cpuCoresContainer = builder.get_object('cpu_cores_container') as Gtk.Box;
    this.cpuHistoryChart = builder.get_object('cpu_history_chart') as Gtk.DrawingArea;
    
    this.memoryLabel = builder.get_object('memory_label') as Gtk.Label;
    this.memoryPercent = builder.get_object('memory_percent') as Gtk.Label;
    this.memoryProgress = builder.get_object('memory_progress') as Gtk.ProgressBar;
    this.memoryHistoryChart = builder.get_object('memory_history_chart') as Gtk.DrawingArea;
    
    this.swapLabel = builder.get_object('swap_label') as Gtk.Label;
    this.swapPercent = builder.get_object('swap_percent') as Gtk.Label;
    this.swapProgress = builder.get_object('swap_progress') as Gtk.ProgressBar;
    
    this.diskReadLabel = builder.get_object('disk_read_label') as Gtk.Label;
    this.diskWriteLabel = builder.get_object('disk_write_label') as Gtk.Label;
    this.diskHistoryChart = builder.get_object('disk_history_chart') as Gtk.DrawingArea;
    
    this.networkDownloadLabel = builder.get_object('network_download_label') as Gtk.Label;
    this.networkUploadLabel = builder.get_object('network_upload_label') as Gtk.Label;
    this.networkHistoryChart = builder.get_object('network_history_chart') as Gtk.DrawingArea;
    
    this.gpuSection = builder.get_object('gpu_section') as Gtk.Box;
    this.gpuLabel = builder.get_object('gpu_label') as Gtk.Label;
    this.gpuPercent = builder.get_object('gpu_percent') as Gtk.Label;
    this.gpuProgress = builder.get_object('gpu_progress') as Gtk.ProgressBar;
    
    this.temperaturesContainer = builder.get_object('temperatures_container') as Gtk.Box;
    
    // Setup CPU cores
    this.setupCpuCores();
    
    // Setup drawing functions
    this.cpuHistoryChart.set_draw_func((area, cr, width, height) => {
      this.drawHistory(cr, width, height, this.cpuHistory, 'CPU', 0.2, 0.6, 0.9);
    });
    
    this.memoryHistoryChart.set_draw_func((area, cr, width, height) => {
      this.drawHistory(cr, width, height, this.memoryHistory, 'Memory', 0.9, 0.6, 0.2);
    });
    
    this.diskHistoryChart.set_draw_func((area, cr, width, height) => {
      this.drawDualHistory(cr, width, height, this.diskReadHistory, this.diskWriteHistory, 'Disk I/O', 0.2, 0.7, 0.3, 0.9, 0.3, 0.3);
    });
    
    this.networkHistoryChart.set_draw_func((area, cr, width, height) => {
      this.drawDualHistory(cr, width, height, this.networkDownloadHistory, this.networkUploadHistory, 'Network I/O', 0.2, 0.4, 0.8, 0.2, 0.8, 0.3);
    });
    
    // Initial update
    this.updateData();
    
    // Update every 2 seconds
    this.updateTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
      this.updateData();
      return GLib.SOURCE_CONTINUE;
    });
  }

  private setupCpuCores(): void {
    const numCores = this.getNumCores();
    
    for (let i = 0; i < numCores; i++) {
      const label = new Gtk.Label({
        label: `Core ${i}`,
        halign: Gtk.Align.START,
        hexpand: true,
      });
      
      const percent = new Gtk.Label({
        label: '--%',
        halign: Gtk.Align.END,
      });
      
      const progress = new Gtk.ProgressBar({
        hexpand: true,
        show_text: false,
      });
      
      const container = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 3,
      });
      
      const labelBox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 6,
      });
      
      labelBox.append(label);
      labelBox.append(percent);
      
      container.append(labelBox);
      container.append(progress);
      
      this.cpuCoresContainer.append(container);
      this.cpuCoreLabels.push(percent);
      this.cpuCoreProgressBars.push(progress);
      this.prevIdle.push(0);
      this.prevTotal.push(0);
    }
  }

  private getNumCores(): number {
    try {
      const [stdout] = this.utils.executeCommand('nproc', []);
      return parseInt(stdout.trim()) || 1;
    } catch {
      return 1;
    }
  }

  private updateData(): void {
    this.updateCPU();
    this.updateMemory();
    this.updateSwap();
    this.updateDiskIO();
    this.updateNetworkIO();
    this.updateGPU();
    this.updateTemperatures();
  }

  private updateCPU(): void {
    try {
      const [stdout] = this.utils.executeCommand('cat', ['/proc/stat']);
      const lines = stdout.split('\n');
      
      let totalUsage = 0;
      let validCores = 0;
      
      for (let i = 0; i < this.cpuCoreProgressBars.length; i++) {
        const cpuLine = lines.find(line => line.startsWith(`cpu${i} `));
        if (!cpuLine) continue;
        
        const values = cpuLine.split(/\s+/).slice(1).map(v => parseInt(v));
        const idle = values[3] + values[4];
        const total = values.reduce((a, b) => a + b, 0);
        
        if (this.prevTotal[i] !== 0) {
          const diffIdle = idle - this.prevIdle[i];
          const diffTotal = total - this.prevTotal[i];
          const usage = diffTotal > 0 ? ((diffTotal - diffIdle) / diffTotal) * 100 : 0;
          
          this.cpuCoreLabels[i].set_label(`${Math.round(usage)}%`);
          this.cpuCoreProgressBars[i].set_fraction(usage / 100);
          totalUsage += usage;
          validCores++;
        }
        
        this.prevIdle[i] = idle;
        this.prevTotal[i] = total;
      }
      
      if (validCores > 0) {
        const avgUsage = totalUsage / validCores;
        this.addToHistory(this.cpuHistory, avgUsage);
        this.cpuHistoryChart.queue_draw();
      }
    } catch (e) {
      console.error('Error updating CPU:', e);
    }
  }

  private updateMemory(): void {
    try {
      const [stdout] = this.utils.executeCommand('free', ['-m']);
      const lines = stdout.split('\n');
      const memLine = lines.find(line => line.startsWith('Mem:'));
      
      if (memLine) {
        const values = memLine.split(/\s+/);
        const total = parseInt(values[1]);
        const used = parseInt(values[2]);
        const percentage = (used / total) * 100;
        
        this.memoryLabel.set_label(`Used: ${used} MB / ${total} MB`);
        this.memoryPercent.set_label(`${Math.round(percentage)}%`);
        this.memoryProgress.set_fraction(percentage / 100);
        
        this.addToHistory(this.memoryHistory, percentage);
        this.memoryHistoryChart.queue_draw();
      }
    } catch (e) {
      console.error('Error updating memory:', e);
    }
  }

  private updateSwap(): void {
    try {
      const [stdout] = this.utils.executeCommand('free', ['-m']);
      const lines = stdout.split('\n');
      const swapLine = lines.find(line => line.startsWith('Swap:'));
      
      if (swapLine) {
        const values = swapLine.split(/\s+/);
        const total = parseInt(values[1]);
        const used = parseInt(values[2]);
        
        if (total > 0) {
          const percentage = (used / total) * 100;
          this.swapLabel.set_label(`Used: ${used} MB / ${total} MB`);
          this.swapPercent.set_label(`${Math.round(percentage)}%`);
          this.swapProgress.set_fraction(percentage / 100);
        } else {
          this.swapLabel.set_label('No swap configured');
          this.swapPercent.set_label('--');
          this.swapProgress.set_fraction(0);
        }
      }
    } catch (e) {
      console.error('Error updating swap:', e);
    }
  }

  private updateDiskIO(): void {
    try {
      const [stdout] = this.utils.executeCommand('cat', ['/proc/diskstats']);
      const lines = stdout.split('\n');
      
      let totalRead = 0;
      let totalWrite = 0;
      
      for (const line of lines) {
        if (!line.trim()) continue;
        const parts = line.trim().split(/\s+/);
        if (parts.length < 14) continue;
        
        const device = parts[2];
        // Only count physical devices (sda, nvme0n1, etc.)
        if (!device.match(/^(sd[a-z]|nvme\d+n\d+)$/)) continue;
        
        const sectorsRead = parseInt(parts[5]) || 0;
        const sectorsWritten = parseInt(parts[9]) || 0;
        
        totalRead += sectorsRead;
        totalWrite += sectorsWritten;
      }
      
      if (this.prevDiskRead !== 0) {
        const readDelta = totalRead - this.prevDiskRead;
        const writeDelta = totalWrite - this.prevDiskWrite;
        
        // Convert sectors to MB (assuming 512 bytes per sector, over 2 seconds)
        const readMBps = (readDelta * 512) / (2 * 1024 * 1024);
        const writeMBps = (writeDelta * 512) / (2 * 1024 * 1024);
        
        this.diskReadLabel.set_label(`Read: ${readMBps.toFixed(2)} MB/s`);
        this.diskWriteLabel.set_label(`Write: ${writeMBps.toFixed(2)} MB/s`);
        
        this.addToHistory(this.diskReadHistory, readMBps);
        this.addToHistory(this.diskWriteHistory, writeMBps);
        this.diskHistoryChart.queue_draw();
      }
      
      this.prevDiskRead = totalRead;
      this.prevDiskWrite = totalWrite;
    } catch (e) {
      console.error('Error updating disk I/O:', e);
    }
  }

  private updateNetworkIO(): void {
    try {
      const [stdout] = this.utils.executeCommand('cat', ['/proc/net/dev']);
      const lines = stdout.split('\n').slice(2);
      
      let totalRx = 0;
      let totalTx = 0;
      
      for (const line of lines) {
        if (!line.trim()) continue;
        const parts = line.trim().split(/\s+/);
        if (parts.length < 10) continue;
        
        const iface = parts[0].replace(':', '');
        if (iface === 'lo') continue;
        
        totalRx += parseInt(parts[1]) || 0;
        totalTx += parseInt(parts[9]) || 0;
      }
      
      if (this.prevNetworkRx !== 0) {
        const rxDelta = totalRx - this.prevNetworkRx;
        const txDelta = totalTx - this.prevNetworkTx;
        
        // Convert to MB/s (over 2 seconds)
        const downloadMBps = rxDelta / (2 * 1024 * 1024);
        const uploadMBps = txDelta / (2 * 1024 * 1024);
        
        this.networkDownloadLabel.set_label(`Download: ${downloadMBps.toFixed(2)} MB/s`);
        this.networkUploadLabel.set_label(`Upload: ${uploadMBps.toFixed(2)} MB/s`);
        
        this.addToHistory(this.networkDownloadHistory, downloadMBps);
        this.addToHistory(this.networkUploadHistory, uploadMBps);
        this.networkHistoryChart.queue_draw();
      }
      
      this.prevNetworkRx = totalRx;
      this.prevNetworkTx = totalTx;
    } catch (e) {
      console.error('Error updating network I/O:', e);
    }
  }

  private updateGPU(): void {
    try {
      // Try nvidia-smi for NVIDIA GPUs
      const [stdout] = this.utils.executeCommand('nvidia-smi', ['--query-gpu=utilization.gpu', '--format=csv,noheader,nounits']);
      const usage = parseInt(stdout.trim());
      
      if (!isNaN(usage)) {
        this.gpuLabel.set_label(`Usage: ${usage}%`);
        this.gpuPercent.set_label(`${usage}%`);
        this.gpuProgress.set_fraction(usage / 100);
        this.gpuSection.set_visible(true);
        return;
      }
    } catch (e) {
      // nvidia-smi not available
    }
    
    // Hide GPU section if not available
    this.gpuSection.set_visible(false);
  }

  private updateTemperatures(): void {
    // Clear existing temperature widgets
    let child = this.temperaturesContainer.get_first_child();
    while (child) {
      const next = child.get_next_sibling();
      this.temperaturesContainer.remove(child);
      child = next;
    }
    
    try {
      const [stdout] = this.utils.executeCommand('sensors', []);
      const lines = stdout.split('\n');
      
      const temps: { label: string; value: string }[] = [];
      
      for (const line of lines) {
        if (line.includes('°C') && line.includes(':')) {
          const match = line.match(/([^:]+):\s*\+?([\d.]+)°C/);
          if (match) {
            const label = match[1].trim();
            const value = match[2];
            
            // Filter out irrelevant sensors
            if (!label.includes('crit') && !label.includes('high') && !label.includes('hyst')) {
              temps.push({ label, value: `${value}°C` });
            }
          }
        }
      }
      
      for (const temp of temps) {
        const box = new Gtk.Box({
          orientation: Gtk.Orientation.HORIZONTAL,
          spacing: 6,
        });
        
        const nameLabel = new Gtk.Label({
          label: temp.label,
          halign: Gtk.Align.START,
          hexpand: true,
        });
        
        const valueLabel = new Gtk.Label({
          label: temp.value,
          halign: Gtk.Align.END,
        });
        
        box.append(nameLabel);
        box.append(valueLabel);
        this.temperaturesContainer.append(box);
      }
      
      if (temps.length === 0) {
        const noDataLabel = new Gtk.Label({
          label: 'No temperature sensors found',
          halign: Gtk.Align.START,
        });
        this.temperaturesContainer.append(noDataLabel);
      }
    } catch (e) {
      const errorLabel = new Gtk.Label({
        label: 'sensors command not available (install lm-sensors)',
        halign: Gtk.Align.START,
      });
      this.temperaturesContainer.append(errorLabel);
    }
  }

  private addToHistory(history: HistoryData, value: number): void {
    history.values.push(value);
    if (history.values.length > history.maxPoints) {
      history.values.shift();
    }
  }

  private drawHistory(cr: any, width: number, height: number, history: HistoryData, title: string, r: number, g: number, b: number): void {
    // Background
    cr.setSourceRGBA(0, 0, 0, 0);
    cr.rectangle(0, 0, width, height);
    cr.fill();
    
    if (history.values.length < 2) return;
    
    const padding = 20;
    const chartWidth = width - 2 * padding;
    const chartHeight = height - 2 * padding;
    
    // Grid
    cr.setSourceRGBA(0.3, 0.3, 0.3, 0.3);
    cr.setLineWidth(1);
    for (let i = 0; i <= 4; i++) {
      const y = padding + (chartHeight / 4) * i;
      cr.moveTo(padding, y);
      cr.lineTo(width - padding, y);
      cr.stroke();
    }
    
    // Find max value
    const maxValue = Math.max(...history.values, 10);
    
    // Draw line
    cr.setSourceRGBA(r, g, b, 1);
    cr.setLineWidth(2);
    
    cr.moveTo(padding, height - padding);
    
    for (let i = 0; i < history.values.length; i++) {
      const x = padding + (chartWidth / (history.maxPoints - 1)) * i;
      const y = height - padding - (history.values[i] / maxValue) * chartHeight;
      cr.lineTo(x, y);
    }
    
    cr.stroke();
  }

  private drawDualHistory(cr: any, width: number, height: number, history1: HistoryData, history2: HistoryData, title: string, r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): void {
    // Background
    cr.setSourceRGBA(0, 0, 0, 0);
    cr.rectangle(0, 0, width, height);
    cr.fill();
    
    if (history1.values.length < 2) return;
    
    const padding = 20;
    const chartWidth = width - 2 * padding;
    const chartHeight = height - 2 * padding;
    
    // Grid
    cr.setSourceRGBA(0.3, 0.3, 0.3, 0.3);
    cr.setLineWidth(1);
    for (let i = 0; i <= 4; i++) {
      const y = padding + (chartHeight / 4) * i;
      cr.moveTo(padding, y);
      cr.lineTo(width - padding, y);
      cr.stroke();
    }
    
    // Find max value
    const maxValue = Math.max(...history1.values, ...history2.values, 1);
    
    // Draw first line
    cr.setSourceRGBA(r1, g1, b1, 1);
    cr.setLineWidth(2);
    cr.moveTo(padding, height - padding);
    for (let i = 0; i < history1.values.length; i++) {
      const x = padding + (chartWidth / (history1.maxPoints - 1)) * i;
      const y = height - padding - (history1.values[i] / maxValue) * chartHeight;
      cr.lineTo(x, y);
    }
    cr.stroke();
    
    // Draw second line
    cr.setSourceRGBA(r2, g2, b2, 1);
    cr.setLineWidth(2);
    cr.moveTo(padding, height - padding);
    for (let i = 0; i < history2.values.length; i++) {
      const x = padding + (chartWidth / (history2.maxPoints - 1)) * i;
      const y = height - padding - (history2.values[i] / maxValue) * chartHeight;
      cr.lineTo(x, y);
    }
    cr.stroke();
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
