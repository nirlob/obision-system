import Gtk from '@girs/gtk-4.0';
import GLib from '@girs/glib-2.0';
import { UtilsService } from '../services/utils-service';
import { DataService } from '../services/data-service';
import { ProcessesService } from '../services/processes-service';
import { TopProcessesList, ProcessInfo } from './atoms/top-processes-list';

export class MemoryComponent {
  private container: Gtk.Box;
  private memoryChart!: Gtk.DrawingArea;
  private memoryUsageBar!: Gtk.LevelBar;
  private memoryUsageTitle!: Gtk.Label;
  private memoryUsagePercent!: Gtk.Label;
  private memoryTotalValue!: Gtk.Label;
  private memoryUsedValue!: Gtk.Label;
  private memoryFreeValue!: Gtk.Label;
  private memoryAvailableValue!: Gtk.Label;
  private memoryCachedValue!: Gtk.Label;
  private memoryBuffersValue!: Gtk.Label;
  private memorySwapTotalValue!: Gtk.Label;
  private memorySwapUsedValue!: Gtk.Label;
  private memoryUsageValue!: Gtk.Label;
  private memorySharedValue!: Gtk.Label;
  private memorySlabValue!: Gtk.Label;
  private memoryActiveValue!: Gtk.Label;
  private memoryInactiveValue!: Gtk.Label;
  private memoryDirtyValue!: Gtk.Label;
  private memoryWritebackValue!: Gtk.Label;
  private memoryMappedValue!: Gtk.Label;
  private memoryPageTablesValue!: Gtk.Label;
  private memoryKernelStackValue!: Gtk.Label;
  private memorySwapCachedValue!: Gtk.Label;
  private updateTimeoutId: number | null = null;
  private utils: UtilsService;
  private dataService: DataService;
  private processesService: ProcessesService;
  private topProcessesList!: TopProcessesList;
  private usageHistory: number[] = [];
  private readonly maxHistoryPoints = 60;

  constructor() {
    this.utils = UtilsService.instance;
    this.dataService = DataService.instance;
    this.processesService = ProcessesService.instance;
    const builder = Gtk.Builder.new();
    
    try {
      try {
        builder.add_from_file('/usr/share/com.obision.app.system/ui/memory.ui');
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
    this.memoryUsageBar = builder.get_object('memory_usage_bar') as Gtk.LevelBar;
    this.memoryUsageTitle = builder.get_object('memory_usage_title') as Gtk.Label;
    this.memoryUsagePercent = builder.get_object('memory_usage_percent') as Gtk.Label;
    this.memoryTotalValue = builder.get_object('memory_total_value') as Gtk.Label;
    this.memoryUsedValue = builder.get_object('memory_used_value') as Gtk.Label;
    this.memoryFreeValue = builder.get_object('memory_free_value') as Gtk.Label;
    this.memoryAvailableValue = builder.get_object('memory_available_value') as Gtk.Label;
    this.memoryCachedValue = builder.get_object('memory_cached_value') as Gtk.Label;
    this.memoryBuffersValue = builder.get_object('memory_buffers_value') as Gtk.Label;
    this.memorySwapTotalValue = builder.get_object('memory_swap_total_value') as Gtk.Label;
    this.memorySwapUsedValue = builder.get_object('memory_swap_used_value') as Gtk.Label;
    this.memoryUsageValue = builder.get_object('memory_usage_value') as Gtk.Label;
    this.memorySharedValue = builder.get_object('memory_shared_value') as Gtk.Label;
    this.memorySlabValue = builder.get_object('memory_slab_value') as Gtk.Label;
    this.memoryActiveValue = builder.get_object('memory_active_value') as Gtk.Label;
    this.memoryInactiveValue = builder.get_object('memory_inactive_value') as Gtk.Label;
    this.memoryDirtyValue = builder.get_object('memory_dirty_value') as Gtk.Label;
    this.memoryWritebackValue = builder.get_object('memory_writeback_value') as Gtk.Label;
    this.memoryMappedValue = builder.get_object('memory_mapped_value') as Gtk.Label;
    this.memoryPageTablesValue = builder.get_object('memory_pagetables_value') as Gtk.Label;
    this.memoryKernelStackValue = builder.get_object('memory_kernelstack_value') as Gtk.Label;
    this.memorySwapCachedValue = builder.get_object('memory_swap_cached_value') as Gtk.Label;
    
    // Create and add TopProcessesList
    this.topProcessesList = new TopProcessesList('memory', 8);
    const topProcessesContainer = builder.get_object('top_processes_container') as Gtk.Box;
    if (topProcessesContainer) {
      topProcessesContainer.append(this.topProcessesList.getWidget());
    }
    
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
      const memInfo = this.dataService.getMemoryInfo();
      if (memInfo.total) {
        this.memoryTotalValue.set_label(this.utils.formatBytes(memInfo.total * 1024));
      }
    } catch (error) {
      console.error('Error loading memory info:', error);
    }
  }

  private updateData(): void {
    try {
      const memInfo = this.dataService.getMemoryInfo();
      
      const memTotal = memInfo.total || 0;
      const memFree = memInfo.free || 0;
      const memAvailable = memInfo.available || 0;
      const cached = memInfo.cached || 0;
      const buffers = memInfo.buffers || 0;
      const swapTotal = memInfo.swapTotal || 0;
      const swapFree = memInfo.swapFree || 0;
      const shared = memInfo.shared || 0;
      const slab = memInfo.slab || 0;
      const active = memInfo.active || 0;
      const inactive = memInfo.inactive || 0;
      const dirty = memInfo.dirty || 0;
      const writeback = memInfo.writeback || 0;
      const mapped = memInfo.mapped || 0;
      const pageTables = memInfo.pageTables || 0;
      const kernelStack = memInfo.kernelStack || 0;
      const swapCached = memInfo.swapCached || 0;
      
      // Calculate used memory
      const memUsed = memTotal - memFree - buffers - cached;
      const swapUsed = swapTotal - swapFree;
      
      // Calculate usage percentage
      const usagePercentage = memTotal > 0 ? (memUsed / memTotal) * 100 : 0;
      
      // Update labels
      this.memoryUsedValue.set_label(this.utils.formatBytes(memUsed * 1024));
      this.memoryFreeValue.set_label(this.utils.formatBytes(memFree * 1024));
      this.memoryAvailableValue.set_label(this.utils.formatBytes(memAvailable * 1024));
      this.memoryCachedValue.set_label(this.utils.formatBytes(cached * 1024));
      this.memoryBuffersValue.set_label(this.utils.formatBytes(buffers * 1024));
      this.memorySwapTotalValue.set_label(this.utils.formatBytes(swapTotal * 1024));
      this.memorySwapUsedValue.set_label(this.utils.formatBytes(swapUsed * 1024));
      this.memoryUsageValue.set_label(`${usagePercentage.toFixed(1)}%`);
      this.memorySharedValue.set_label(this.utils.formatBytes(shared * 1024));
      this.memorySlabValue.set_label(this.utils.formatBytes(slab * 1024));
      this.memoryActiveValue.set_label(this.utils.formatBytes(active * 1024));
      this.memoryInactiveValue.set_label(this.utils.formatBytes(inactive * 1024));
      this.memoryDirtyValue.set_label(this.utils.formatBytes(dirty * 1024));
      this.memoryWritebackValue.set_label(this.utils.formatBytes(writeback * 1024));
      this.memoryMappedValue.set_label(this.utils.formatBytes(mapped * 1024));
      this.memoryPageTablesValue.set_label(this.utils.formatBytes(pageTables * 1024));
      this.memoryKernelStackValue.set_label(this.utils.formatBytes(kernelStack * 1024));
      this.memorySwapCachedValue.set_label(this.utils.formatBytes(swapCached * 1024));
      
      // Update progress bar (0.0 to 1.0)
      if (this.memoryUsageBar) {
        this.memoryUsageBar.set_value(Math.min(1, Math.max(0, memTotal > 0 ? memUsed / memTotal : 0)));
      }
      // Update usage title and percent
      if (this.memoryUsageTitle) {
        this.memoryUsageTitle.set_label('Usage Actual');
      }
      if (this.memoryUsagePercent) {
        this.memoryUsagePercent.set_label(`${usagePercentage.toFixed(1)}%`);
      }

      // Update history
      this.usageHistory.push(usagePercentage);
      if (this.usageHistory.length > this.maxHistoryPoints) {
        this.usageHistory.shift();
      }
      
      // Update top processes
      this.updateTopProcesses();
      
      // Redraw chart
      this.memoryChart.queue_draw();
    } catch (error) {
      console.error('Error updating memory data:', error);
    }
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
    if (this.topProcessesList) {
      this.topProcessesList.destroy();
    }
  }
}
