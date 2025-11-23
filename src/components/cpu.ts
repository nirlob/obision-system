import Gtk from '@girs/gtk-4.0';
import GLib from '@girs/glib-2.0';
import { UtilsService } from '../services/utils-service';

export class CpuComponent {
  private container: Gtk.Box;
  private cpuChart!: Gtk.DrawingArea;
  private cpuModelValue!: Gtk.Label;
  private cpuCoresValue!: Gtk.Label;
  private cpuThreadsValue!: Gtk.Label;
  private cpuUsageValue!: Gtk.Label;
  private cpuFrequencyValue!: Gtk.Label;
  private cpuMaxFrequencyValue!: Gtk.Label;
  private cpuArchitectureValue!: Gtk.Label;
  private updateTimeoutId: number | null = null;
  private utils: UtilsService;
  private usageHistory: number[] = [];
  private readonly maxHistoryPoints = 60; // 60 data points for history

  constructor() {
    this.utils = UtilsService.instance;
    const builder = Gtk.Builder.new();
    
    try {
      try {
        builder.add_from_file('/usr/share/com.obision.ObisionStatus/ui/cpu.ui');
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
    this.cpuModelValue = builder.get_object('cpu_model_value') as Gtk.Label;
    this.cpuCoresValue = builder.get_object('cpu_cores_value') as Gtk.Label;
    this.cpuThreadsValue = builder.get_object('cpu_threads_value') as Gtk.Label;
    this.cpuUsageValue = builder.get_object('cpu_usage_value') as Gtk.Label;
    this.cpuFrequencyValue = builder.get_object('cpu_frequency_value') as Gtk.Label;
    this.cpuMaxFrequencyValue = builder.get_object('cpu_max_frequency_value') as Gtk.Label;
    this.cpuArchitectureValue = builder.get_object('cpu_architecture_value') as Gtk.Label;
    
    // Initialize history with zeros
    for (let i = 0; i < this.maxHistoryPoints; i++) {
      this.usageHistory.push(0);
    }
    
    // Setup drawing function for chart
    this.cpuChart.set_draw_func((area, cr, width, height) => {
      this.drawLineChart(cr, width, height);
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
      // Get CPU model
      const [modelOut] = this.utils.executeCommand('lscpu', []);
      const modelMatch = modelOut.match(/Model name:\s+(.+)/);
      if (modelMatch) {
        this.cpuModelValue.set_label(modelMatch[1].trim());
      }
      
      // Get cores and threads
      const coresMatch = modelOut.match(/Core\(s\) per socket:\s+(\d+)/);
      const socketsMatch = modelOut.match(/Socket\(s\):\s+(\d+)/);
      const threadsMatch = modelOut.match(/Thread\(s\) per core:\s+(\d+)/);
      
      if (coresMatch && socketsMatch) {
        const cores = parseInt(coresMatch[1]) * parseInt(socketsMatch[1]);
        this.cpuCoresValue.set_label(cores.toString());
        
        if (threadsMatch) {
          const threads = cores * parseInt(threadsMatch[1]);
          this.cpuThreadsValue.set_label(threads.toString());
        }
      }
      
      // Get architecture
      const archMatch = modelOut.match(/Architecture:\s+(.+)/);
      if (archMatch) {
        this.cpuArchitectureValue.set_label(archMatch[1].trim());
      }
      
      // Get max frequency
      try {
        const [maxFreqOut] = this.utils.executeCommand('cat', ['/sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_max_freq']);
        const maxFreqKhz = parseInt(maxFreqOut.trim());
        if (!isNaN(maxFreqKhz)) {
          const maxFreqGhz = (maxFreqKhz / 1000000).toFixed(2);
          this.cpuMaxFrequencyValue.set_label(`${maxFreqGhz} GHz`);
        }
      } catch (e) {
        // If cpufreq not available, try to get from lscpu
        const maxFreqMatch = modelOut.match(/CPU max MHz:\s+([\d.]+)/);
        if (maxFreqMatch) {
          const maxFreqGhz = (parseFloat(maxFreqMatch[1]) / 1000).toFixed(2);
          this.cpuMaxFrequencyValue.set_label(`${maxFreqGhz} GHz`);
        }
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
      
      // Redraw chart
      this.cpuChart.queue_draw();
    } catch (error) {
      console.error('Error updating CPU data:', error);
    }
  }

  private getCpuUsage(): number {
    try {
      const [topOut] = this.utils.executeCommand('top', ['-bn1']);
      const cpuLine = topOut.split('\n').find(line => line.includes('%Cpu(s)'));
      
      if (cpuLine) {
        const idleMatch = cpuLine.match(/([\d.]+)\s*id/);
        if (idleMatch) {
          const idle = parseFloat(idleMatch[1]);
          return 100 - idle;
        }
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
