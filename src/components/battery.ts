import Gtk from '@girs/gtk-4.0';
import GLib from '@girs/glib-2.0';
import { UtilsService } from '../services/utils-service';
import { DataService } from '../services/data-service';
import { ProcessesService } from '../services/processes-service';
import { TopProcessesList, ProcessInfo } from './atoms/top-processes-list';

export class BatteryComponent {
  private container: Gtk.Box;
  private batteryChart!: Gtk.DrawingArea;
  private batteryLevelBar!: Gtk.LevelBar;
  private batteryLevelTitle!: Gtk.Label;
  private batteryLevelPercent!: Gtk.Label;
  private batteryStatusValue!: Gtk.Label;
  private batteryCapacityValue!: Gtk.Label;
  private batteryHealthValue!: Gtk.Label;
  private batteryTechnologyValue!: Gtk.Label;
  private batteryVoltageValue!: Gtk.Label;
  private batteryCyclesValue!: Gtk.Label;
  private batteryManufacturerValue!: Gtk.Label;
  private batteryModelValue!: Gtk.Label;
  private batteryTemperatureValue!: Gtk.Label;
  private batteryTimeRemainingValue!: Gtk.Label;
  private updateTimeoutId: number | null = null;
  private utils: UtilsService;
  private dataService: DataService;
  private processesService: ProcessesService;
  private topProcessesList!: TopProcessesList;
  private hourlyData: Map<number, number[]> = new Map(); // hour -> [levels]
  private readonly hoursToShow = 24;

  constructor() {
    this.utils = UtilsService.instance;
    this.dataService = DataService.instance;
    this.processesService = ProcessesService.instance;
    const builder = Gtk.Builder.new();
    
    try {
      try {
        builder.add_from_file('/usr/share/com.obision.app.system/ui/battery.ui');
      } catch (e) {
        builder.add_from_file('data/ui/battery.ui');
      }
    } catch (e) {
      console.error('Could not load battery.ui:', e);
      this.container = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 12,
      });
      const label = new Gtk.Label({
        label: 'Error loading battery UI',
      });
      this.container.append(label);
      return;
    }

    this.container = builder.get_object('battery_container') as Gtk.Box;
    this.batteryChart = builder.get_object('battery_chart') as Gtk.DrawingArea;
    this.batteryLevelBar = builder.get_object('battery_level_bar') as Gtk.LevelBar;
    this.batteryLevelTitle = builder.get_object('battery_level_title') as Gtk.Label;
    this.batteryLevelPercent = builder.get_object('battery_level_percent') as Gtk.Label;
    this.batteryStatusValue = builder.get_object('battery_status_value') as Gtk.Label;
    this.batteryCapacityValue = builder.get_object('battery_capacity_value') as Gtk.Label;
    this.batteryHealthValue = builder.get_object('battery_health_value') as Gtk.Label;
    this.batteryTechnologyValue = builder.get_object('battery_technology_value') as Gtk.Label;
    this.batteryVoltageValue = builder.get_object('battery_voltage_value') as Gtk.Label;
    this.batteryCyclesValue = builder.get_object('battery_cycles_value') as Gtk.Label;
    this.batteryManufacturerValue = builder.get_object('battery_manufacturer_value') as Gtk.Label;
    this.batteryModelValue = builder.get_object('battery_model_value') as Gtk.Label;
    this.batteryTemperatureValue = builder.get_object('battery_temperature_value') as Gtk.Label;
    this.batteryTimeRemainingValue = builder.get_object('battery_time_remaining_value') as Gtk.Label;
    
    // Create and add TopProcessesList
    this.topProcessesList = new TopProcessesList('cpu', 8);
    const topProcessesContainer = builder.get_object('top_processes_container') as Gtk.Box;
    if (topProcessesContainer) {
      topProcessesContainer.append(this.topProcessesList.getWidget());
    }
    
    // Load historical battery data
    this.loadHistoricalData();
    
    // Setup drawing function for chart
    this.batteryChart.set_draw_func((area, cr, width, height) => {
      this.drawBarChart(cr, width, height);
    });
    
    // Load battery info
    this.loadBatteryInfo();
    
    // Initial update
    this.updateData();
    
    // Update every 5 minutes
    this.updateTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300000, () => {
      this.updateData();
      this.loadHistoricalData(); // Refresh historical data
      return GLib.SOURCE_CONTINUE;
    });
  }

  private loadHistoricalData(): void {
    // Clear existing data
    this.hourlyData.clear();
    
    // Get battery history from DataService
    const history = this.dataService.getBatteryHistory();
    
    if (history.length === 0) {
      // If no historical data, create empty buckets for last 24 hours
      const now = new Date();
      for (let i = 23; i >= 0; i--) {
        const hour = new Date(now.getTime() - i * 60 * 60 * 1000).getHours();
        this.hourlyData.set(hour, []);
      }
      return;
    }
    
    // Group battery levels by hour
    for (const entry of history) {
      const date = new Date(entry.timestamp);
      const hour = date.getHours();
      
      if (!this.hourlyData.has(hour)) {
        this.hourlyData.set(hour, []);
      }
      this.hourlyData.get(hour)!.push(entry.level);
    }
    
    // Update top processes
    this.updateTopProcesses();
    
    // Redraw chart
    this.batteryChart.queue_draw();
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

  private loadBatteryInfo(): void {
    try {
      const [stdout, stderr] = this.utils.executeCommand('fastfetch', ['--format', 'json']);
      if (!stdout) {
        console.error('No output from fastfetch');
        return;
      }
      
      const data = JSON.parse(stdout);
      if (!data || !Array.isArray(data)) {
        return;
      }
      
      // Find Battery module
      const batteryModule = data.find((item: any) => item.type === 'Battery');
      if (!batteryModule || !batteryModule.result) {
        console.log('No battery information found');
        return;
      }
      
      const batteryArray = Array.isArray(batteryModule.result) ? batteryModule.result : [batteryModule.result];
      if (batteryArray.length === 0) {
        return;
      }
      
      const battery = batteryArray[0];
      
      // Update static battery information
      if (battery.manufacturer) {
        this.batteryManufacturerValue.set_label(battery.manufacturer);
      }
      
      if (battery.modelName) {
        this.batteryModelValue.set_label(battery.modelName);
      }
      
      if (battery.technology) {
        this.batteryTechnologyValue.set_label(battery.technology);
      }
      
      if (battery.cycleCount !== undefined) {
        this.batteryCyclesValue.set_label(battery.cycleCount.toString());
      }
      
    } catch (error) {
      console.error('Error loading battery info:', error);
    }
  }

  private updateData(): void {
    try {
      const [stdout, stderr] = this.utils.executeCommand('fastfetch', ['--format', 'json']);
      if (!stdout) {
        return;
      }
      
      const data = JSON.parse(stdout);
      if (!data || !Array.isArray(data)) {
        return;
      }
      
      // Find Battery module
      const batteryModule = data.find((item: any) => item.type === 'Battery');
      if (!batteryModule || !batteryModule.result) {
        return;
      }
      
      const batteryArray = Array.isArray(batteryModule.result) ? batteryModule.result : [batteryModule.result];
      if (batteryArray.length === 0) {
        return;
      }
      
      const battery = batteryArray[0];
      
      // Update dynamic battery information
      const capacity = battery.capacity !== undefined ? battery.capacity : 0;
      
      // Update level bar and labels
      if (this.batteryLevelBar) {
        this.batteryLevelBar.set_value(capacity / 100);
      }
      if (this.batteryLevelTitle) {
        this.batteryLevelTitle.set_label('Battery Level');
      }
      if (this.batteryLevelPercent) {
        this.batteryLevelPercent.set_label(`${capacity.toFixed(1)}%`);
      }
      
      // Update status
      if (this.batteryStatusValue && battery.status) {
        this.batteryStatusValue.set_label(battery.status);
      }
      
      // Update capacity
      if (this.batteryCapacityValue) {
        this.batteryCapacityValue.set_label(`${capacity.toFixed(1)}%`);
      }
      
      // Calculate health (design capacity vs current full capacity)
      if (this.batteryHealthValue) {
        // Health is typically 100% when new and decreases with age
        // We use capacity as a proxy if health is not directly available
        const health = battery.health !== undefined ? battery.health : capacity;
        this.batteryHealthValue.set_label(`${health.toFixed(1)}%`);
      }
      
      // Update voltage
      if (this.batteryVoltageValue && battery.voltage !== undefined) {
        this.batteryVoltageValue.set_label(`${battery.voltage.toFixed(2)} V`);
      }
      
      // Update temperature
      if (this.batteryTemperatureValue && battery.temperature !== undefined && battery.temperature !== null) {
        this.batteryTemperatureValue.set_label(`${battery.temperature.toFixed(1)} °C`);
      }
      
      // Calculate time remaining (approximate)
      if (this.batteryTimeRemainingValue) {
        if (battery.status && battery.status.includes('Charging')) {
          // Estimate time to full charge (rough calculation)
          const remaining = 100 - capacity;
          const estimatedMinutes = Math.round((remaining / 100) * 120); // Assume 2 hours for full charge
          const hours = Math.floor(estimatedMinutes / 60);
          const minutes = estimatedMinutes % 60;
          this.batteryTimeRemainingValue.set_label(`${hours}h ${minutes}m (charging)`);
        } else if (battery.status && battery.status.includes('Discharging')) {
          // Estimate time remaining (rough calculation)
          const estimatedMinutes = Math.round((capacity / 100) * 240); // Assume 4 hours at full capacity
          const hours = Math.floor(estimatedMinutes / 60);
          const minutes = estimatedMinutes % 60;
          this.batteryTimeRemainingValue.set_label(`${hours}h ${minutes}m remaining`);
        } else {
          this.batteryTimeRemainingValue.set_label('N/A');
        }
      }

      // Update hourly data with current capacity
      const currentHour = new Date().getHours();
      if (!this.hourlyData.has(currentHour)) {
        this.hourlyData.set(currentHour, []);
      }
      this.hourlyData.get(currentHour)!.push(capacity);
      
      // Redraw chart
      this.batteryChart.queue_draw();
    } catch (error) {
      console.error('Error updating battery data:', error);
    }
  }

  private drawBarChart(cr: any, width: number, height: number): void {
    const padding = 40;
    const bottomPadding = 50;
    const chartWidth = width - 2 * padding;
    const chartHeight = height - padding - bottomPadding;
    
    // Clear background with transparent color
    cr.setSourceRGBA(0, 0, 0, 0);
    cr.paint();
    
    // Draw grid lines
    cr.setSourceRGBA(0.8, 0.8, 0.8, 0.3);
    cr.setLineWidth(1);
    
    // Horizontal grid lines (0%, 25%, 50%, 75%, 100%)
    for (let i = 0; i <= 4; i++) {
      const y = padding + (chartHeight * i / 4);
      cr.moveTo(padding, y);
      cr.lineTo(width - padding, y);
      cr.stroke();
      
      // Draw percentage labels
      cr.setSourceRGB(0.5, 0.5, 0.5);
      cr.setFontSize(10);
      const percentage = 100 - (i * 25);
      cr.moveTo(padding - 30, y + 4);
      cr.showText(`${percentage}%`);
    }
    
    // Draw axes
    cr.setSourceRGB(0.5, 0.5, 0.5);
    cr.setLineWidth(2);
    cr.moveTo(padding, padding);
    cr.lineTo(padding, height - bottomPadding);
    cr.lineTo(width - padding, height - bottomPadding);
    cr.stroke();
    
    if (this.hourlyData.size === 0) {
      // No data message
      cr.setSourceRGB(0.5, 0.5, 0.5);
      cr.setFontSize(14);
      const msg = 'No historical data available';
      const extents = cr.textExtents(msg);
      cr.moveTo((width - extents.width) / 2, height / 2);
      cr.showText(msg);
      return;
    }
    
    // Calculate bar width
    const barCount = this.hoursToShow;
    const barSpacing = 4;
    const barWidth = (chartWidth - (barCount - 1) * barSpacing) / barCount;
    
    // Get hours in order (last 24 hours)
    const currentHour = new Date().getHours();
    const hours: number[] = [];
    for (let i = 0; i < this.hoursToShow; i++) {
      const hour = (currentHour - this.hoursToShow + 1 + i + 24) % 24;
      hours.push(hour);
    }
    
    // Draw bars
    hours.forEach((hour, index) => {
      const levels = this.hourlyData.get(hour) || [];
      if (levels.length === 0) {
        // Draw empty bar
        const x = padding + index * (barWidth + barSpacing);
        cr.setSourceRGBA(0.7, 0.7, 0.7, 0.2);
        cr.rectangle(x, height - bottomPadding - 5, barWidth, 5);
        cr.fill();
      } else {
        // Calculate average level for this hour
        const avgLevel = levels.reduce((sum, val) => sum + val, 0) / levels.length;
        const barHeight = (avgLevel / 100) * chartHeight;
        
        const x = padding + index * (barWidth + barSpacing);
        const y = height - bottomPadding - barHeight;
        
        // Color based on battery level
        if (avgLevel > 50) {
          cr.setSourceRGB(0.2, 0.8, 0.2); // Green
        } else if (avgLevel > 20) {
          cr.setSourceRGB(0.9, 0.7, 0.2); // Yellow/Orange
        } else {
          cr.setSourceRGB(0.9, 0.2, 0.2); // Red
        }
        
        // Draw bar
        cr.rectangle(x, y, barWidth, barHeight);
        cr.fill();
        
        // Draw border
        cr.setSourceRGB(0.3, 0.3, 0.3);
        cr.setLineWidth(1);
        cr.rectangle(x, y, barWidth, barHeight);
        cr.stroke();
      }
      
      // Draw hour label (every 3 hours to avoid crowding)
      if (index % 3 === 0 || index === hours.length - 1) {
        cr.setSourceRGB(0.5, 0.5, 0.5);
        cr.setFontSize(10);
        const label = `${hour}h`;
        const x = padding + index * (barWidth + barSpacing);
        const extents = cr.textExtents(label);
        cr.moveTo(x + (barWidth - extents.width) / 2, height - bottomPadding + 20);
        cr.showText(label);
      }
    });
    
    // Draw title
    cr.setSourceRGB(0.3, 0.3, 0.3);
    cr.setFontSize(12);
    const title = 'Battery Level - Last 24 Hours';
    const extents = cr.textExtents(title);
    cr.moveTo((width - extents.width) / 2, padding - 10);
    cr.showText(title);
  }

  public getWidget(): Gtk.Box {
    return this.container;
  }

  public destroy(): void {
    if (this.updateTimeoutId !== null) {
      GLib.source_remove(this.updateTimeoutId);
    }
    if (this.topProcessesList) {
      this.topProcessesList.destroy();
    }
  }
}
