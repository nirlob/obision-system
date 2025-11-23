import Gtk from '@girs/gtk-4.0';
import GLib from '@girs/glib-2.0';
import { UtilsService } from '../services/utils-service';

export class GpuComponent {
  private container: Gtk.Box;
  private gpuChart!: Gtk.DrawingArea;
  private gpuNameValue!: Gtk.Label;
  private gpuDriverValue!: Gtk.Label;
  private gpuMemoryTotalValue!: Gtk.Label;
  private gpuMemoryUsedValue!: Gtk.Label;
  private gpuUsageValue!: Gtk.Label;
  private gpuTemperatureValue!: Gtk.Label;
  private gpuPowerValue!: Gtk.Label;
  private updateTimeoutId: number | null = null;
  private utils: UtilsService;
  private usageHistory: number[] = [];
  private readonly maxHistoryPoints = 60;
  private hasNvidiaGpu: boolean = false;
  private gpuType: 'nvidia' | 'amd' | 'intel' | 'unknown' = 'unknown';
  private gpuCount: number = 0;

  constructor() {
    this.utils = UtilsService.instance;
    const builder = Gtk.Builder.new();
    
    try {
      try {
        builder.add_from_file('/usr/share/com.obision.ObisionStatus/ui/gpu.ui');
      } catch (e) {
        builder.add_from_file('data/ui/gpu.ui');
      }
    } catch (e) {
      console.error('Could not load gpu.ui:', e);
      this.container = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 12,
      });
      return;
    }

    this.container = builder.get_object('gpu_container') as Gtk.Box;
    this.gpuChart = builder.get_object('gpu_chart') as Gtk.DrawingArea;
    this.gpuNameValue = builder.get_object('gpu_name_value') as Gtk.Label;
    this.gpuDriverValue = builder.get_object('gpu_driver_value') as Gtk.Label;
    this.gpuMemoryTotalValue = builder.get_object('gpu_memory_total_value') as Gtk.Label;
    this.gpuMemoryUsedValue = builder.get_object('gpu_memory_used_value') as Gtk.Label;
    this.gpuUsageValue = builder.get_object('gpu_usage_value') as Gtk.Label;
    this.gpuTemperatureValue = builder.get_object('gpu_temperature_value') as Gtk.Label;
    this.gpuPowerValue = builder.get_object('gpu_power_value') as Gtk.Label;
    
    // Initialize history with zeros
    for (let i = 0; i < this.maxHistoryPoints; i++) {
      this.usageHistory.push(0);
    }
    
    // Setup drawing function for chart
    this.gpuChart.set_draw_func((area, cr, width, height) => {
      this.drawLineChart(cr, width, height);
    });
    
    // Detect GPU type and count
    this.detectGPU();
    
    // Load static GPU info
    this.loadGpuInfo();
    
    // Initial update
    this.updateData();
    
    // Update every 2 seconds
    this.updateTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
      this.updateData();
      return GLib.SOURCE_CONTINUE;
    });
  }

  private detectGPU(): void {
    // Try NVIDIA first
    try {
      const [whichOut] = this.utils.executeCommand('which', ['nvidia-smi']);
      if (whichOut.trim()) {
        try {
          const [testOut] = this.utils.executeCommand('nvidia-smi', ['-L']);
          if (testOut.trim()) {
            this.hasNvidiaGpu = true;
            this.gpuType = 'nvidia';
            this.gpuCount = testOut.trim().split('\n').filter(l => l.trim()).length;
            console.log(`NVIDIA GPU detected: ${this.gpuCount} GPU(s)`);
            return;
          }
        } catch (testError) {
          console.error('nvidia-smi test failed:', testError);
        }
      }
    } catch (error) {
      console.log('nvidia-smi not found');
    }

    // Try AMD
    try {
      const [lspciOut] = this.utils.executeCommand('lspci', []);
      const amdLines = lspciOut.split('\n').filter(line => 
        (line.includes('VGA') || line.includes('3D')) && 
        (line.includes('AMD') || line.includes('ATI') || line.includes('Radeon'))
      );
      if (amdLines.length > 0) {
        this.gpuType = 'amd';
        this.gpuCount = amdLines.length;
        console.log(`AMD GPU detected: ${this.gpuCount} GPU(s)`);
        return;
      }
    } catch (error) {
      console.log('Error checking for AMD GPU:', error);
    }

    // Try Intel
    try {
      const [lspciOut] = this.utils.executeCommand('lspci', []);
      const intelLines = lspciOut.split('\n').filter(line => 
        (line.includes('VGA') || line.includes('3D')) && line.includes('Intel')
      );
      if (intelLines.length > 0) {
        this.gpuType = 'intel';
        this.gpuCount = intelLines.length;
        console.log(`Intel GPU detected: ${this.gpuCount} GPU(s)`);
        return;
      }
    } catch (error) {
      console.log('Error checking for Intel GPU:', error);
    }

    // Fallback: count all VGA devices
    try {
      const [lspciOut] = this.utils.executeCommand('lspci', []);
      const gpuLines = lspciOut.split('\n').filter(line => 
        line.includes('VGA') || line.includes('3D')
      );
      this.gpuCount = gpuLines.length;
      if (this.gpuCount > 0) {
        console.log(`Generic GPU(s) detected: ${this.gpuCount}`);
      }
    } catch (error) {
      console.log('Error detecting GPUs:', error);
    }
  }

  private loadGpuInfo(): void {
    try {
      if (this.hasNvidiaGpu) {
        // NVIDIA GPU
        const [nameOut] = this.utils.executeCommand('nvidia-smi', ['--query-gpu=name', '--format=csv,noheader']);
        if (nameOut.trim()) {
          const gpuNames = nameOut.trim().split('\n');
          const label = this.gpuCount > 1 ? `${gpuNames[0]} (${this.gpuCount}x)` : gpuNames[0];
          this.gpuNameValue.set_label(label);
        }
        
        const [driverOut] = this.utils.executeCommand('nvidia-smi', ['--query-gpu=driver_version', '--format=csv,noheader']);
        if (driverOut.trim()) {
          this.gpuDriverValue.set_label(driverOut.trim().split('\n')[0]);
        }
        
        const [memoryOut] = this.utils.executeCommand('nvidia-smi', ['--query-gpu=memory.total', '--format=csv,noheader']);
        if (memoryOut.trim()) {
          this.gpuMemoryTotalValue.set_label(memoryOut.trim().split('\n')[0]);
        }
      } else if (this.gpuType === 'amd') {
        // AMD GPU
        const [lspciOut] = this.utils.executeCommand('lspci', []);
        const amdLines = lspciOut.split('\n').filter(line => 
          (line.includes('VGA') || line.includes('3D')) && 
          (line.includes('AMD') || line.includes('ATI') || line.includes('Radeon'))
        );
        if (amdLines.length > 0) {
          const parts = amdLines[0].split(':');
          const gpuName = parts.length > 2 ? parts.slice(2).join(':').trim() : 'AMD GPU';
          const label = this.gpuCount > 1 ? `${gpuName} (${this.gpuCount}x)` : gpuName;
          this.gpuNameValue.set_label(label);
        }
        
        try {
          const [modInfoOut] = this.utils.executeCommand('modinfo', ['amdgpu']);
          const versionLine = modInfoOut.split('\n').find(line => line.includes('version:'));
          this.gpuDriverValue.set_label(versionLine ? versionLine.split(':')[1].trim() : 'amdgpu');
        } catch {
          this.gpuDriverValue.set_label('amdgpu');
        }
        this.gpuMemoryTotalValue.set_label('N/A (use radeontop)');
      } else if (this.gpuType === 'intel') {
        // Intel GPU
        const [lspciOut] = this.utils.executeCommand('lspci', []);
        const intelLines = lspciOut.split('\n').filter(line => 
          (line.includes('VGA') || line.includes('3D')) && line.includes('Intel')
        );
        if (intelLines.length > 0) {
          const parts = intelLines[0].split(':');
          const gpuName = parts.length > 2 ? parts.slice(2).join(':').trim() : 'Intel GPU';
          const label = this.gpuCount > 1 ? `${gpuName} (${this.gpuCount}x)` : gpuName;
          this.gpuNameValue.set_label(label);
        }
        
        try {
          const [modInfoOut] = this.utils.executeCommand('modinfo', ['i915']);
          const versionLine = modInfoOut.split('\n').find(line => line.includes('version:'));
          this.gpuDriverValue.set_label(versionLine ? versionLine.split(':')[1].trim() : 'i915');
        } catch {
          this.gpuDriverValue.set_label('i915');
        }
        this.gpuMemoryTotalValue.set_label('Shared System RAM');
      } else {
        // Unknown/Generic GPU
        const [lspciOut] = this.utils.executeCommand('lspci', []);
        const gpuLines = lspciOut.split('\n').filter(line => 
          line.includes('VGA') || line.includes('3D')
        );
        if (gpuLines.length > 0) {
          const parts = gpuLines[0].split(':');
          const gpuName = parts.length > 2 ? parts.slice(2).join(':').trim() : 'Unknown GPU';
          const label = this.gpuCount > 1 ? `${gpuName} (${this.gpuCount}x)` : gpuName;
          this.gpuNameValue.set_label(label);
        } else {
          this.gpuNameValue.set_label('No GPU detected');
        }
        this.gpuDriverValue.set_label('N/A');
        this.gpuMemoryTotalValue.set_label('N/A');
      }
    } catch (error) {
      console.error('Error loading GPU info:', error);
      this.gpuNameValue.set_label('Unable to detect GPU');
    }
  }

  private updateData(): void {
    try {
      if (this.hasNvidiaGpu) {
        try {
          // Get GPU utilization (average if multiple GPUs)
          const [utilizationOut] = this.utils.executeCommand('nvidia-smi', 
            ['--query-gpu=utilization.gpu', '--format=csv,noheader,nounits']);
          const utilizationValues = utilizationOut.trim().split('\n').map(v => parseFloat(v));
          const avgUtilization = utilizationValues.reduce((a, b) => a + b, 0) / utilizationValues.length;
          
          if (!isNaN(avgUtilization)) {
            const label = this.gpuCount > 1 ? 
              `${avgUtilization.toFixed(1)}% (avg of ${this.gpuCount})` : 
              `${avgUtilization.toFixed(1)}%`;
            this.gpuUsageValue.set_label(label);
            
            this.usageHistory.push(avgUtilization);
            if (this.usageHistory.length > this.maxHistoryPoints) {
              this.usageHistory.shift();
            }
          }
          
          // Get memory used (sum if multiple GPUs)
          const [memoryUsedOut] = this.utils.executeCommand('nvidia-smi', 
            ['--query-gpu=memory.used', '--format=csv,noheader']);
          if (memoryUsedOut.trim()) {
            const memValues = memoryUsedOut.trim().split('\n');
            this.gpuMemoryUsedValue.set_label(memValues[0]);
          }
          
          // Get temperature (average if multiple GPUs)
          const [tempOut] = this.utils.executeCommand('nvidia-smi', 
            ['--query-gpu=temperature.gpu', '--format=csv,noheader,nounits']);
          if (tempOut.trim()) {
            const temps = tempOut.trim().split('\n').map(v => parseFloat(v));
            const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
            const label = this.gpuCount > 1 ? 
              `${avgTemp.toFixed(0)}°C (avg)` : 
              `${temps[0]}°C`;
            this.gpuTemperatureValue.set_label(label);
          }
          
          // Get power usage (sum if multiple GPUs)
          const [powerOut] = this.utils.executeCommand('nvidia-smi', 
            ['--query-gpu=power.draw', '--format=csv,noheader']);
          if (powerOut.trim()) {
            const powers = powerOut.trim().split('\n');
            this.gpuPowerValue.set_label(powers[0]);
          }
        } catch (cmdError) {
          console.error('nvidia-smi command failed, disabling GPU monitoring:', cmdError);
          this.hasNvidiaGpu = false;
          this.gpuUsageValue.set_label('N/A (nvidia-smi error)');
          this.gpuMemoryUsedValue.set_label('N/A');
          this.gpuTemperatureValue.set_label('N/A');
          this.gpuPowerValue.set_label('N/A');
        }
      } else if (this.gpuType === 'amd') {
        // AMD GPUs: Try to read from sysfs
        try {
          const [drmOut] = this.utils.executeCommand('ls', ['/sys/class/drm']);
          const cards = drmOut.split('\n').filter(line => line.startsWith('card'));
          
          if (cards.length > 0) {
            // Try to read GPU usage from first card
            try {
              const [usageOut] = this.utils.executeCommand('cat', 
                [`/sys/class/drm/${cards[0]}/device/gpu_busy_percent`]);
              const usage = parseFloat(usageOut.trim());
              if (!isNaN(usage)) {
                this.gpuUsageValue.set_label(`${usage.toFixed(1)}%`);
                this.usageHistory.push(usage);
                if (this.usageHistory.length > this.maxHistoryPoints) {
                  this.usageHistory.shift();
                }
              } else {
                throw new Error('Invalid usage value');
              }
            } catch {
              this.gpuUsageValue.set_label('N/A (install radeontop)');
              this.usageHistory.push(0);
              if (this.usageHistory.length > this.maxHistoryPoints) {
                this.usageHistory.shift();
              }
            }
          }
        } catch {
          this.gpuUsageValue.set_label('N/A');
        }
        
        this.gpuMemoryUsedValue.set_label('N/A');
        this.gpuTemperatureValue.set_label('N/A');
        this.gpuPowerValue.set_label('N/A');
      } else if (this.gpuType === 'intel') {
        // Intel GPUs: Limited monitoring available
        this.gpuUsageValue.set_label('N/A (intel_gpu_top required)');
        this.gpuMemoryUsedValue.set_label('N/A');
        this.gpuTemperatureValue.set_label('N/A');
        this.gpuPowerValue.set_label('N/A');
        
        this.usageHistory.push(0);
        if (this.usageHistory.length > this.maxHistoryPoints) {
          this.usageHistory.shift();
        }
      } else {
        this.gpuUsageValue.set_label('N/A');
        this.gpuMemoryUsedValue.set_label('N/A');
        this.gpuTemperatureValue.set_label('N/A');
        this.gpuPowerValue.set_label('N/A');
        
        this.usageHistory.push(0);
        if (this.usageHistory.length > this.maxHistoryPoints) {
          this.usageHistory.shift();
        }
      }
      
      // Redraw chart
      this.gpuChart.queue_draw();
    } catch (error) {
      console.error('Error updating GPU data:', error);
      this.usageHistory.push(0);
      if (this.usageHistory.length > this.maxHistoryPoints) {
        this.usageHistory.shift();
      }
      this.gpuChart.queue_draw();
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
      cr.setSourceRGB(0.1, 0.8, 0.3);
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
      cr.setSourceRGBA(0.1, 0.8, 0.3, 0.2);
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
