import Gtk from '@girs/gtk-4.0';
import GLib from '@girs/glib-2.0';
import { UtilsService } from '../services/utils-service';
import { DataService } from '../services/data-service';

export class CpuComponent {
  private container: Gtk.Box;
  private cpuChart!: Gtk.DrawingArea;
  private cpuUsageBar!: Gtk.LevelBar;
  private cpuUsageTitle!: Gtk.Label;
  private cpuUsagePercent!: Gtk.Label;
  private cpuPerCoreChart!: Gtk.DrawingArea;
  private chartStack!: Gtk.Stack;
  private generalButton!: Gtk.ToggleButton;
  private coresButton!: Gtk.ToggleButton;
  private cpuModelValue!: Gtk.Label;
  private cpuCoresValue!: Gtk.Label;
  private cpuLogicalCoresValue!: Gtk.Label;
  private cpuThreadsValue!: Gtk.Label;
  private cpuUsageValue!: Gtk.Label;
  private cpuFrequencyValue!: Gtk.Label;
  private cpuMaxFrequencyValue!: Gtk.Label;
  private cpuArchitectureValue!: Gtk.Label;
  private cpuVendorValue!: Gtk.Label;
  private cpuFamilyValue!: Gtk.Label;
  private cpuModelIdValue!: Gtk.Label;
  private cpuSteppingValue!: Gtk.Label;
  private cpuL1dCacheValue!: Gtk.Label;
  private cpuL1iCacheValue!: Gtk.Label;
  private cpuL2CacheValue!: Gtk.Label;
  private cpuL3CacheValue!: Gtk.Label;
  private cpuVirtualizationValue!: Gtk.Label;
  private cpuBogomipsValue!: Gtk.Label;
  private updateTimeoutId: number | null = null;
  private utils: UtilsService;
  private dataService: DataService;
  private usageHistory: number[] = [];
  private perCoreUsage: number[] = [];
  private prevCoreIdle: number[] = [];
  private prevCoreTotal: number[] = [];
  private readonly maxHistoryPoints = 60; // 60 data points for history
  private prevIdle: number = 0;
  private prevTotal: number = 0;
  private numCores: number = 0;

  constructor() {
    this.utils = UtilsService.instance;
    this.dataService = DataService.instance;
    const builder = Gtk.Builder.new();
    
    try {
      try {
        builder.add_from_file('/usr/share/com.obision.ObisionSystem/ui/cpu.ui');
      } catch (e) {
        builder.add_from_file('data/ui/cpu.ui');
      }
    } catch (e) {
      console.error('Could not load cpu.ui:', e);
      this.container = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 12,
      });
      return;
    }

    this.container = builder.get_object('cpu_container') as Gtk.Box;
    this.cpuChart = builder.get_object('cpu_chart') as Gtk.DrawingArea;
    this.cpuUsageBar = builder.get_object('cpu_usage_bar') as Gtk.LevelBar;
    this.cpuUsageTitle = builder.get_object('cpu_usage_title') as Gtk.Label;
    this.cpuUsagePercent = builder.get_object('cpu_usage_percent') as Gtk.Label;
    this.cpuPerCoreChart = builder.get_object('cpu_percore_chart') as Gtk.DrawingArea;
    this.chartStack = builder.get_object('chart_stack') as Gtk.Stack;
    this.generalButton = builder.get_object('general_button') as Gtk.ToggleButton;
    this.coresButton = builder.get_object('cores_button') as Gtk.ToggleButton;
    this.cpuModelValue = builder.get_object('cpu_model_value') as Gtk.Label;
    this.cpuCoresValue = builder.get_object('cpu_cores_value') as Gtk.Label;
    this.cpuLogicalCoresValue = builder.get_object('cpu_logical_cores_value') as Gtk.Label;
    this.cpuThreadsValue = builder.get_object('cpu_threads_value') as Gtk.Label;
    this.cpuUsageValue = builder.get_object('cpu_usage_value') as Gtk.Label;
    this.cpuFrequencyValue = builder.get_object('cpu_frequency_value') as Gtk.Label;
    this.cpuMaxFrequencyValue = builder.get_object('cpu_max_frequency_value') as Gtk.Label;
    this.cpuArchitectureValue = builder.get_object('cpu_architecture_value') as Gtk.Label;
    this.cpuVendorValue = builder.get_object('cpu_vendor_value') as Gtk.Label;
    this.cpuFamilyValue = builder.get_object('cpu_family_value') as Gtk.Label;
    this.cpuModelIdValue = builder.get_object('cpu_model_id_value') as Gtk.Label;
    this.cpuSteppingValue = builder.get_object('cpu_stepping_value') as Gtk.Label;
    this.cpuL1dCacheValue = builder.get_object('cpu_l1d_cache_value') as Gtk.Label;
    this.cpuL1iCacheValue = builder.get_object('cpu_l1i_cache_value') as Gtk.Label;
    this.cpuL2CacheValue = builder.get_object('cpu_l2_cache_value') as Gtk.Label;
    this.cpuL3CacheValue = builder.get_object('cpu_l3_cache_value') as Gtk.Label;
    this.cpuVirtualizationValue = builder.get_object('cpu_virtualization_value') as Gtk.Label;
    this.cpuBogomipsValue = builder.get_object('cpu_bogomips_value') as Gtk.Label;
    
    // Initialize history with zeros
    for (let i = 0; i < this.maxHistoryPoints; i++) {
      this.usageHistory.push(0);
    }
    
    // Setup drawing function for overall chart
    this.cpuChart.set_draw_func((area, cr, width, height) => {
      this.drawLineChart(cr, width, height);
    });
    
    // Setup drawing function for per-core chart
    this.cpuPerCoreChart.set_draw_func((area, cr, width, height) => {
      this.drawPerCoreChart(cr, width, height);
    });
    
    // Setup toggle button handlers
    this.generalButton.connect('toggled', () => {
      if (this.generalButton.get_active()) {
        this.chartStack.set_visible_child_name('overall');
      }
    });
    
    this.coresButton.connect('toggled', () => {
      if (this.coresButton.get_active()) {
        this.chartStack.set_visible_child_name('percore');
      }
    });
    
    // Load static CPU info
    this.loadCpuInfo();
    
    // Initial update
    this.updateData();
    
    // Update every 2 seconds
    this.updateTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
      this.updateData();
      return GLib.SOURCE_CONTINUE;
    });
  }

  private loadCpuInfo(): void {
    try {
      const cpuInfo = this.dataService.getCpuInfo();
      
      if (cpuInfo.model) {
        this.cpuModelValue.set_label(cpuInfo.model);
      }
      
      if (cpuInfo.cores) {
        this.cpuCoresValue.set_label(cpuInfo.cores.toString());
      }
      
      if (cpuInfo.threads) {
        this.cpuThreadsValue.set_label(cpuInfo.threads.toString());
      }
      
      if (cpuInfo.logicalCores) {
        this.cpuLogicalCoresValue.set_label(cpuInfo.logicalCores.toString());
      }
      
      if (cpuInfo.architecture) {
        this.cpuArchitectureValue.set_label(cpuInfo.architecture);
      }
      
      if (cpuInfo.vendor) {
        this.cpuVendorValue.set_label(cpuInfo.vendor);
      }
      
      if (cpuInfo.family) {
        this.cpuFamilyValue.set_label(cpuInfo.family);
      }
      
      if (cpuInfo.modelId) {
        this.cpuModelIdValue.set_label(cpuInfo.modelId);
      }
      
      if (cpuInfo.stepping) {
        this.cpuSteppingValue.set_label(cpuInfo.stepping);
      }
      
      if (cpuInfo.l1dCache) {
        this.cpuL1dCacheValue.set_label(cpuInfo.l1dCache);
      }
      
      if (cpuInfo.l1iCache) {
        this.cpuL1iCacheValue.set_label(cpuInfo.l1iCache);
      }
      
      if (cpuInfo.l2Cache) {
        this.cpuL2CacheValue.set_label(cpuInfo.l2Cache);
      }
      
      if (cpuInfo.l3Cache) {
        this.cpuL3CacheValue.set_label(cpuInfo.l3Cache);
      }
      
      if (cpuInfo.virtualization) {
        this.cpuVirtualizationValue.set_label(cpuInfo.virtualization);
      }
      
      if (cpuInfo.bogomips) {
        this.cpuBogomipsValue.set_label(cpuInfo.bogomips);
      }
      
      if (cpuInfo.maxFrequency) {
        this.cpuMaxFrequencyValue.set_label(`${cpuInfo.maxFrequency} GHz`);
      }
    } catch (error) {
      console.error('Error loading CPU info:', error);
    }
  }

  private updateData(): void {
    try {
      // Get current CPU usage
      const cpuUsage = this.getCpuUsage();
      this.cpuUsageValue.set_label(`${cpuUsage.toFixed(1)}%`);
      // Update CPU usage bar and percent label
      if (this.cpuUsageBar) {
        this.cpuUsageBar.set_value(Math.min(1, Math.max(0, cpuUsage / 100)));
      }
      if (this.cpuUsageTitle) {
        this.cpuUsageTitle.set_label('Actual Load');
      }
      if (this.cpuUsagePercent) {
        this.cpuUsagePercent.set_label(`${cpuUsage.toFixed(1)}%`);
      }
      
      // Update history
      this.usageHistory.push(cpuUsage);
      if (this.usageHistory.length > this.maxHistoryPoints) {
        this.usageHistory.shift();
      }
      
      // Get current frequency
      try {
        const [freqOut] = this.utils.executeCommand('cat', ['/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq']);
        const freqKhz = parseInt(freqOut.trim());
        if (!isNaN(freqKhz)) {
          const freqGhz = (freqKhz / 1000000).toFixed(2);
          this.cpuFrequencyValue.set_label(`${freqGhz} GHz`);
        }
      } catch (e) {
        // Frequency info not available
        this.cpuFrequencyValue.set_label('N/A');
      }
      
      // Redraw charts
      this.cpuChart.queue_draw();
      this.cpuPerCoreChart.queue_draw();
    } catch (error) {
      console.error('Error updating CPU data:', error);
    }
  }

  private getCpuUsage(): number {
    try {
      const [stdout] = this.utils.executeCommand('cat', ['/proc/stat']);
      const lines = stdout.split('\n');
      const cpuLine = lines.find(line => line.startsWith('cpu '));
      
      // Get per-core usage
      const cpuLines = lines.filter(line => /^cpu\d+/.test(line));
      this.numCores = cpuLines.length;
      
      if (this.perCoreUsage.length === 0) {
        this.perCoreUsage = new Array(this.numCores).fill(0);
        this.prevCoreIdle = new Array(this.numCores).fill(0);
        this.prevCoreTotal = new Array(this.numCores).fill(0);
      }
      
      cpuLines.forEach((line, index) => {
        const values = line.split(/\s+/).slice(1).map(v => parseInt(v));
        const idle = values[3] + values[4]; // idle + iowait
        const total = values.reduce((a, b) => a + b, 0);
        
        if (this.prevCoreTotal[index] !== 0) {
          const diffIdle = idle - this.prevCoreIdle[index];
          const diffTotal = total - this.prevCoreTotal[index];
          this.perCoreUsage[index] = diffTotal > 0 ? ((diffTotal - diffIdle) / diffTotal) * 100 : 0;
        }
        
        this.prevCoreIdle[index] = idle;
        this.prevCoreTotal[index] = total;
      });
      
      // Get overall usage
      if (cpuLine) {
        const values = cpuLine.split(/\s+/).slice(1).map(v => parseInt(v));
        const idle = values[3] + values[4]; // idle + iowait
        const total = values.reduce((a, b) => a + b, 0);
        
        if (this.prevTotal !== 0) {
          const diffIdle = idle - this.prevIdle;
          const diffTotal = total - this.prevTotal;
          const usage = diffTotal > 0 ? ((diffTotal - diffIdle) / diffTotal) * 100 : 0;
          this.prevIdle = idle;
          this.prevTotal = total;
          return usage;
        }
        
        this.prevIdle = idle;
        this.prevTotal = total;
      }
    } catch (error) {
      console.error('Error getting CPU usage:', error);
    }
    return 0;
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
      cr.setSourceRGB(0.2, 0.6, 1.0);
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
      cr.setSourceRGBA(0.2, 0.6, 1.0, 0.2);
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

  private drawPerCoreChart(cr: any, width: number, height: number): void {
    if (this.numCores === 0) return;
    
    const padding = 20;
    const chartWidth = width - 2 * padding;
    const chartHeight = height - 2 * padding;
    
    // Clear background
    cr.setSourceRGBA(0, 0, 0, 0);
    cr.paint();
    
    // Draw grid lines
    cr.setSourceRGBA(0.8, 0.8, 0.8, 0.5);
    cr.setLineWidth(1);
    
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
    
    // Calculate bar dimensions
    const barSpacing = 4;
    const totalSpacing = barSpacing * (this.numCores - 1);
    const barWidth = (chartWidth - totalSpacing) / this.numCores;
    
    // Draw bars for each core
    for (let i = 0; i < this.numCores; i++) {
      const x = padding + (barWidth + barSpacing) * i;
      const usage = this.perCoreUsage[i] || 0;
      const barHeight = (usage / 100) * chartHeight;
      const y = height - padding - barHeight;
      
      // Color gradient based on usage
      if (usage < 50) {
        cr.setSourceRGB(0.2, 0.8, 0.4); // Green
      } else if (usage < 80) {
        cr.setSourceRGB(0.9, 0.7, 0.2); // Yellow
      } else {
        cr.setSourceRGB(0.9, 0.3, 0.3); // Red
      }
      
      cr.rectangle(x, y, barWidth, barHeight);
      cr.fill();
      
      // Draw usage percentage on top of bar
      cr.setSourceRGB(0.3, 0.3, 0.3);
      cr.selectFontFace('Sans', 0, 0);
      cr.setFontSize(9);
      const usageText = `${usage.toFixed(0)}%`;
      const textExtents = cr.textExtents(usageText);
      const textX = x + (barWidth - textExtents.width) / 2;
      const textY = y - 4;
      if (textY > padding) {
        cr.moveTo(textX, textY);
        cr.showText(usageText);
      }
      
      // Draw core label below bar (starting from 1)
      cr.setFontSize(8);
      const coreLabel = `${i + 1}`;
      const labelExtents = cr.textExtents(coreLabel);
      const labelX = x + (barWidth - labelExtents.width) / 2;
      cr.moveTo(labelX, height - padding + 12);
      cr.showText(coreLabel);
    }
    
    // Draw Y-axis labels
    cr.setSourceRGB(0.3, 0.3, 0.3);
    cr.setFontSize(10);
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
