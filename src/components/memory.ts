import Gtk from '@girs/gtk-4.0';
import GLib from '@girs/glib-2.0';
import { UtilsService } from '../services/utils-service';

export class MemoryComponent {
  private container: Gtk.Box;
  private memoryChart!: Gtk.DrawingArea;
  private memoryTotalValue!: Gtk.Label;
  private memoryUsedValue!: Gtk.Label;
  private memoryFreeValue!: Gtk.Label;
  private memoryAvailableValue!: Gtk.Label;
  private memoryCachedValue!: Gtk.Label;
  private memoryBuffersValue!: Gtk.Label;
  private memorySwapTotalValue!: Gtk.Label;
  private memorySwapUsedValue!: Gtk.Label;
  private memoryUsageValue!: Gtk.Label;
  private updateTimeoutId: number | null = null;
  private utils: UtilsService;
  private usageHistory: number[] = [];
  private readonly maxHistoryPoints = 60;

  constructor() {
    this.utils = UtilsService.instance;
    const builder = Gtk.Builder.new();
    
    try {
      try {
        builder.add_from_file('/usr/share/com.obision.ObisionStatus/ui/memory.ui');
      } catch (e) {
        builder.add_from_file('data/ui/memory.ui');
      }
    } catch (e) {
      console.error('Could not load memory.ui:', e);
      this.container = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 12,
      });
      return;
    }

    this.container = builder.get_object('memory_container') as Gtk.Box;
    this.memoryChart = builder.get_object('memory_chart') as Gtk.DrawingArea;
    this.memoryTotalValue = builder.get_object('memory_total_value') as Gtk.Label;
    this.memoryUsedValue = builder.get_object('memory_used_value') as Gtk.Label;
    this.memoryFreeValue = builder.get_object('memory_free_value') as Gtk.Label;
    this.memoryAvailableValue = builder.get_object('memory_available_value') as Gtk.Label;
    this.memoryCachedValue = builder.get_object('memory_cached_value') as Gtk.Label;
    this.memoryBuffersValue = builder.get_object('memory_buffers_value') as Gtk.Label;
    this.memorySwapTotalValue = builder.get_object('memory_swap_total_value') as Gtk.Label;
    this.memorySwapUsedValue = builder.get_object('memory_swap_used_value') as Gtk.Label;
    this.memoryUsageValue = builder.get_object('memory_usage_value') as Gtk.Label;
    
    // Initialize history with zeros
    for (let i = 0; i < this.maxHistoryPoints; i++) {
      this.usageHistory.push(0);
    }
    
    // Setup drawing function for chart
    this.memoryChart.set_draw_func((area, cr, width, height) => {
      this.drawLineChart(cr, width, height);
    });
    
    // Load memory info
    this.loadMemoryInfo();
    
    // Initial update
    this.updateData();
    
    // Update every 2 seconds
    this.updateTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
      this.updateData();
      return GLib.SOURCE_CONTINUE;
    });
  }

  private loadMemoryInfo(): void {
    try {
      const [memInfoOut] = this.utils.executeCommand('cat', ['/proc/meminfo']);
      const lines = memInfoOut.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('MemTotal:')) {
          const kb = parseInt(line.split(/\s+/)[1]);
          this.memoryTotalValue.set_label(this.formatBytes(kb * 1024));
        }
      }
    } catch (error) {
      console.error('Error loading memory info:', error);
    }
  }

  private updateData(): void {
    try {
      const [memInfoOut] = this.utils.executeCommand('cat', ['/proc/meminfo']);
      const lines = memInfoOut.split('\n');
      
      let memTotal = 0;
      let memFree = 0;
      let memAvailable = 0;
      let cached = 0;
      let buffers = 0;
      let swapTotal = 0;
      let swapFree = 0;
      
      for (const line of lines) {
        const parts = line.split(/\s+/);
        const key = parts[0];
        const value = parseInt(parts[1]) || 0;
        
        if (key === 'MemTotal:') memTotal = value;
        else if (key === 'MemFree:') memFree = value;
        else if (key === 'MemAvailable:') memAvailable = value;
        else if (key === 'Cached:') cached = value;
        else if (key === 'Buffers:') buffers = value;
        else if (key === 'SwapTotal:') swapTotal = value;
        else if (key === 'SwapFree:') swapFree = value;
      }
      
      // Calculate used memory
      const memUsed = memTotal - memFree - buffers - cached;
      const swapUsed = swapTotal - swapFree;
      
      // Calculate usage percentage
      const usagePercentage = memTotal > 0 ? (memUsed / memTotal) * 100 : 0;
      
      // Update labels
      this.memoryUsedValue.set_label(this.formatBytes(memUsed * 1024));
      this.memoryFreeValue.set_label(this.formatBytes(memFree * 1024));
      this.memoryAvailableValue.set_label(this.formatBytes(memAvailable * 1024));
      this.memoryCachedValue.set_label(this.formatBytes(cached * 1024));
      this.memoryBuffersValue.set_label(this.formatBytes(buffers * 1024));
      this.memorySwapTotalValue.set_label(this.formatBytes(swapTotal * 1024));
      this.memorySwapUsedValue.set_label(this.formatBytes(swapUsed * 1024));
      this.memoryUsageValue.set_label(`${usagePercentage.toFixed(1)}%`);
      
      // Update history
      this.usageHistory.push(usagePercentage);
      if (this.usageHistory.length > this.maxHistoryPoints) {
        this.usageHistory.shift();
      }
      
      // Redraw chart
      this.memoryChart.queue_draw();
    } catch (error) {
      console.error('Error updating memory data:', error);
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
    
    // Horizontal grid lines (0%, 25%, 50%, 75%, 100%)
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
    
    // Draw data line
    if (this.usageHistory.length > 1) {
      cr.setSourceRGB(0.8, 0.3, 0.1);
      cr.setLineWidth(2);
      
      const pointSpacing = chartWidth / (this.maxHistoryPoints - 1);
      
      cr.moveTo(padding, height - padding - (this.usageHistory[0] / 100) * chartHeight);
      
      for (let i = 1; i < this.usageHistory.length; i++) {
        const x = padding + i * pointSpacing;
        const y = height - padding - (this.usageHistory[i] / 100) * chartHeight;
        cr.lineTo(x, y);
      }
      
      cr.stroke();
      
      // Fill area under the line
      cr.setSourceRGBA(0.8, 0.3, 0.1, 0.2);
      cr.lineTo(width - padding, height - padding);
      cr.lineTo(padding, height - padding);
      cr.closePath();
      cr.fill();
    }
    
    // Draw labels
    cr.setSourceRGB(0.3, 0.3, 0.3);
    cr.selectFontFace('Sans', 0, 0);
    cr.setFontSize(10);
    
    // Y-axis labels
    for (let i = 0; i <= 4; i++) {
      const y = padding + (chartHeight * i / 4);
      const label = `${100 - (i * 25)}%`;
      cr.moveTo(5, y + 3);
      cr.showText(label);
    }
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
