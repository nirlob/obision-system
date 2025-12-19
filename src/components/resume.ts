import Gtk from '@girs/gtk-4.0';
import Adw from '@girs/adw-1';
import { ResumeService } from '../services/resume-service';
import { SystemData } from '../interfaces/resume';
import { UtilsService } from '../services/utils-service';
import { DataService } from '../services/data-service';
import { TopProcessesList, ProcessInfo } from './atoms/top-processes-list';

export class ResumeComponent {
  private container: Gtk.Box;
  private cpuLabel!: Gtk.Label;
  private gpuLabel!: Gtk.Label;
  private memoryLabel!: Gtk.Label;
  private diskLabel!: Gtk.Label;
  private networkLabel!: Gtk.Label;
  private cpuChart!: Gtk.DrawingArea;
  private gpuChart!: Gtk.DrawingArea;
  private memoryChart!: Gtk.DrawingArea;
  private diskChart!: Gtk.DrawingArea;
  private networkChart!: Gtk.DrawingArea;
  private cpuTempChart!: Gtk.DrawingArea;
  private gpuTempChart!: Gtk.DrawingArea;
  private cpuTempLabel!: Gtk.Label;
  private gpuTempLabel!: Gtk.Label;
  private batteryBox!: Gtk.Box;
  private batteryPercentage!: Gtk.Label;
  private batteryStatusTime!: Gtk.Label;
  private batteryHistoryChart!: Gtk.DrawingArea;
  private topProcessesBox!: Gtk.Box;
  private systemLoadBox!: Gtk.Box;
  private load1minLabel!: Gtk.Label;
  private load5minLabel!: Gtk.Label;
  private load15minLabel!: Gtk.Label;
  private load1minBar!: Gtk.LevelBar;
  private load5minBar!: Gtk.LevelBar;
  private load15minBar!: Gtk.LevelBar;
  private topProcessesWidget!: TopProcessesList;
  private systemInfoList!: Gtk.Box;
  private systemInfoGroup!: Adw.PreferencesGroup;
  private resumeService: ResumeService;
  private utils: UtilsService;
  private dataService: DataService;
  private dataCallback!: (data: SystemData) => void;
  private cpuUsage: number = 0;
  private gpuUsage: number = 0;
  private memoryUsage: number = 0;
  private diskUsage: number = 0;
  private networkDownloadSpeed: number = 0;
  private networkUploadSpeed: number = 0;
  private cpuTemp: number = 0;
  private gpuTemp: number = 0;
  private hasBattery: boolean = false;
  private batteryHourlyData: Map<number, number[]> = new Map();

  constructor() {
    this.resumeService = ResumeService.instance;
    this.utils = UtilsService.instance;
    this.dataService = DataService.instance;
    this.hasBattery = this.dataService.hasBattery();
    
    const builder = Gtk.Builder.new();
    
    try {
      try {
        builder.add_from_file('/usr/share/com.obision.app.system/ui/resume.ui');
      } catch (e) {
        builder.add_from_file('data/ui/resume.ui');
      }
    } catch (e) {
      console.error('Could not load resume.ui:', e);
      this.container = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 12,
      });
      return;
    }

    this.container = builder.get_object('resume_container') as Gtk.Box;
    this.cpuLabel = builder.get_object('cpu_value') as Gtk.Label;
    this.gpuLabel = builder.get_object('gpu_value_resume') as Gtk.Label;
    this.memoryLabel = builder.get_object('memory_value') as Gtk.Label;
    this.diskLabel = builder.get_object('disk_value') as Gtk.Label;
    this.networkLabel = builder.get_object('network_value') as Gtk.Label;
    this.cpuChart = builder.get_object('cpu_chart') as Gtk.DrawingArea;
    this.gpuChart = builder.get_object('gpu_chart_resume') as Gtk.DrawingArea;
    this.memoryChart = builder.get_object('memory_chart') as Gtk.DrawingArea;
    this.diskChart = builder.get_object('disk_chart') as Gtk.DrawingArea;
    this.networkChart = builder.get_object('network_chart') as Gtk.DrawingArea;
    this.cpuTempChart = builder.get_object('cpu_temp_chart') as Gtk.DrawingArea;
    this.gpuTempChart = builder.get_object('gpu_temp_chart') as Gtk.DrawingArea;
    this.cpuTempLabel = builder.get_object('cpu_temp_value') as Gtk.Label;
    this.gpuTempLabel = builder.get_object('gpu_temp_value') as Gtk.Label;
    this.batteryBox = builder.get_object('battery_box') as Gtk.Box;
    this.batteryPercentage = builder.get_object('battery_percentage') as Gtk.Label;
    this.batteryStatusTime = builder.get_object('battery_status_time') as Gtk.Label;
    this.batteryHistoryChart = builder.get_object('battery_history_chart') as Gtk.DrawingArea;
    this.topProcessesBox = builder.get_object('top_processes_box') as Gtk.Box;
    this.systemLoadBox = builder.get_object('system_load_box') as Gtk.Box;
    this.load1minLabel = builder.get_object('load_1min') as Gtk.Label;
    this.load5minLabel = builder.get_object('load_5min') as Gtk.Label;
    this.load15minLabel = builder.get_object('load_15min') as Gtk.Label;
    this.load1minBar = builder.get_object('load_1min_bar') as Gtk.LevelBar;
    this.load5minBar = builder.get_object('load_5min_bar') as Gtk.LevelBar;
    this.load15minBar = builder.get_object('load_15min_bar') as Gtk.LevelBar;
    this.topProcessesBox = builder.get_object('top_processes_box') as Gtk.Box;
    this.systemInfoList = builder.get_object('system_info_list') as Gtk.Box;
    
    // Create AdwPreferencesGroup for system info
    this.systemInfoGroup = new Adw.PreferencesGroup();
    this.systemInfoList.append(this.systemInfoGroup);
    
    // Create and add TopProcessesList to the widget container
    this.topProcessesWidget = new TopProcessesList('cpu', 5);
    const topProcessesWidgetContainer = builder.get_object('top_processes_widget_container') as Gtk.Box;
    topProcessesWidgetContainer.append(this.topProcessesWidget.getWidget());
    
    // Setup battery history chart drawing function
    if (this.hasBattery) {
      this.batteryHistoryChart.set_draw_func((area, cr, width, height) => {
        this.drawBatteryHistoryChart(cr, width, height);
      });
      this.loadBatteryHistoricalData();
    }
    
    // Configure layout based on battery presence
    this.configureBatteryLayout();
    
    // Setup drawing functions
    this.cpuChart.set_draw_func((area, cr, width, height) => {
      this.drawCircularChart(cr, width, height, this.cpuUsage);
    });
    
    this.gpuChart.set_draw_func((area, cr, width, height) => {
      this.drawCircularChart(cr, width, height, this.gpuUsage);
    });
    
    this.memoryChart.set_draw_func((area, cr, width, height) => {
      this.drawCircularChart(cr, width, height, this.memoryUsage);
    });
    
    this.diskChart.set_draw_func((area, cr, width, height) => {
      this.drawCircularChart(cr, width, height, this.diskUsage);
    });
    
    this.networkChart.set_draw_func((area, cr, width, height) => {
      this.drawNetworkChart(cr, width, height);
    });
    
    this.cpuTempChart.set_draw_func((area, cr, width, height) => {
      this.drawTemperatureChart(cr, width, height, this.cpuTemp);
    });
    
    this.gpuTempChart.set_draw_func((area, cr, width, height) => {
      this.drawTemperatureChart(cr, width, height, this.gpuTemp);
    });
    
    // Subscribe to resume service updates
    this.dataCallback = this.onDataUpdate.bind(this);
    this.resumeService.subscribeToUpdates(this.dataCallback);
  }

  private loadBatteryHistoricalData(): void {
    // Clear existing data
    this.batteryHourlyData.clear();
    
    // Get battery history from DataService
    const history = this.dataService.getBatteryHistory();
    
    if (history.length === 0) {
      // If no historical data, create empty buckets for last 12 hours
      const now = new Date();
      for (let i = 11; i >= 0; i--) {
        const hour = new Date(now.getTime() - i * 60 * 60 * 1000).getHours();
        this.batteryHourlyData.set(hour, []);
      }
      return;
    }
    
    // Group battery levels by hour
    for (const entry of history) {
      const date = new Date(entry.timestamp);
      const hour = date.getHours();
      
      if (!this.batteryHourlyData.has(hour)) {
        this.batteryHourlyData.set(hour, []);
      }
      this.batteryHourlyData.get(hour)!.push(entry.level);
    }
    
    // Redraw chart
    this.batteryHistoryChart.queue_draw();
  }

  private drawBatteryHistoryChart(cr: any, width: number, height: number): void {
    const padding = 20;
    const bottomPadding = 25;
    const chartWidth = width - 2 * padding;
    const chartHeight = height - padding - bottomPadding;
    
    // Clear background
    cr.setSourceRGBA(0, 0, 0, 0);
    cr.paint();
    
    // Draw grid lines
    cr.setSourceRGBA(0.8, 0.8, 0.8, 0.2);
    cr.setLineWidth(0.5);
    
    // Horizontal grid lines (0%, 50%, 100%)
    for (let i = 0; i <= 2; i++) {
      const y = padding + (chartHeight * i / 2);
      cr.moveTo(padding, y);
      cr.lineTo(width - padding, y);
      cr.stroke();
    }
    
    if (this.batteryHourlyData.size === 0) {
      // No data message
      cr.setSourceRGB(0.5, 0.5, 0.5);
      cr.setFontSize(10);
      const msg = 'No data';
      const extents = cr.textExtents(msg);
      cr.moveTo((width - extents.width) / 2, height / 2);
      cr.showText(msg);
      return;
    }
    
    // Calculate bar width for 12 hours
    const barCount = 12;
    const barSpacing = 2;
    const barWidth = (chartWidth - (barCount - 1) * barSpacing) / barCount;
    
    // Get hours in order (last 12 hours)
    const currentHour = new Date().getHours();
    const hours: number[] = [];
    for (let i = 0; i < barCount; i++) {
      const hour = (currentHour - barCount + 1 + i + 24) % 24;
      hours.push(hour);
    }
    
    // Draw bars
    hours.forEach((hour, index) => {
      const levels = this.batteryHourlyData.get(hour) || [];
      if (levels.length === 0) {
        // Draw empty bar
        const x = padding + index * (barWidth + barSpacing);
        cr.setSourceRGBA(0.7, 0.7, 0.7, 0.15);
        cr.rectangle(x, height - bottomPadding - 3, barWidth, 3);
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
      }
      
      // Draw hour label (every 3 hours)
      if (index % 3 === 0) {
        cr.setSourceRGB(0.5, 0.5, 0.5);
        cr.setFontSize(8);
        const label = `${hour}h`;
        const x = padding + index * (barWidth + barSpacing);
        const extents = cr.textExtents(label);
        cr.moveTo(x + (barWidth - extents.width) / 2, height - bottomPadding + 12);
        cr.showText(label);
      }
    });
  }

  private configureBatteryLayout(): void {
    if (!this.hasBattery) {
      // Hide battery box
      this.batteryBox.set_visible(false);
      
      // Get the grid layout manager
      const grid = this.container.get_first_child();
      if (grid) {
        // Make top processes and system load span 2 columns (columns 0-1)
        const topProcessesLayoutChild = this.topProcessesBox.get_parent();
        if (topProcessesLayoutChild) {
          (topProcessesLayoutChild as any).column = 0;
          (topProcessesLayoutChild as any).column_span = 2;
        }
        
        const systemLoadLayoutChild = this.systemLoadBox.get_parent();
        if (systemLoadLayoutChild) {
          (systemLoadLayoutChild as any).column = 2;
          (systemLoadLayoutChild as any).column_span = 1;
        }
      }
    } else {
      // Update battery info
      this.updateBatteryInfo();
    }
  }

  private updateBatteryInfo(): void {
    try {
      const [upowerOut] = this.utils.executeCommand('upower', ['-i', '/org/freedesktop/UPower/devices/battery_BAT0']);
      
      let percentage = '--';
      let state = '--';
      let timeToEmpty = '--';
      let timeToFull = '--';
      
      const lines = upowerOut.split('\n');
      for (const line of lines) {
        if (line.includes('percentage:')) {
          percentage = line.split(':')[1].trim();
        } else if (line.includes('state:')) {
          state = line.split(':')[1].trim();
        } else if (line.includes('time to empty:')) {
          timeToEmpty = line.split(':')[1].trim();
        } else if (line.includes('time to full:')) {
          timeToFull = line.split(':')[1].trim();
        }
      }
      
      this.batteryPercentage.set_label(percentage);
      
      // Combine status and time in one label (capitalized)
      let statusText = state;
      if (state === 'discharging' && timeToEmpty !== 'unknown' && timeToEmpty !== '') {
        statusText = `${this.utils.capitalizeWords(state)} - ${timeToEmpty} remaining`;
      } else if (state === 'charging' && timeToFull !== 'unknown' && timeToFull !== '') {
        statusText = `${this.utils.capitalizeWords(state)} - ${timeToFull} to full`;
      } else if (state === 'fully-charged') {
        statusText = 'Fully Charged';
      } else {
        statusText = this.utils.capitalizeWords(state);
      }
      
      this.batteryStatusTime.set_label(statusText);
    } catch (error) {
      console.error('Error updating battery info:', error);
    }
  }

  private onDataUpdate(data: SystemData): void {
    // Update usage values
    this.cpuUsage = data.cpu.usage;
    this.gpuUsage = data.gpu.usage;
    this.memoryUsage = data.memory.percentage;
    this.diskUsage = data.disk.percentage;
    this.cpuTemp = data.cpuTemp;
    this.gpuTemp = data.gpuTemp;
    
    // Update labels
    this.cpuLabel.set_label(`${data.cpu.usage}%`);
    this.gpuLabel.set_label(`${data.gpu.usage}%`);
    this.memoryLabel.set_label(`${data.memory.percentage}%`);
    this.diskLabel.set_label(`${data.disk.percentage}%`);
    this.networkLabel.set_label(`↓ ${data.network.download}\n↑ ${data.network.upload}`);
    this.cpuTempLabel.set_label(data.cpuTemp >= 0 ? `${data.cpuTemp}°C` : 'N/A');
    this.gpuTempLabel.set_label(data.gpuTemp >= 0 ? `${data.gpuTemp}°C` : 'N/A');
    
    // Update battery info if present
    if (this.hasBattery) {
      this.updateBatteryInfo();
      // Refresh battery history occasionally
      this.loadBatteryHistoricalData();
    }
    
    // Update system load
    this.load1minLabel.set_label(data.systemLoad.load1.toFixed(2));
    this.load5minLabel.set_label(data.systemLoad.load5.toFixed(2));
    this.load15minLabel.set_label(data.systemLoad.load15.toFixed(2));
    this.load1minBar.set_value(data.systemLoad.load1);
    this.load5minBar.set_value(data.systemLoad.load5);
    this.load15minBar.set_value(data.systemLoad.load15);
    
    // Update top processes
    const processInfoList: ProcessInfo[] = data.topProcesses.map(p => ({
      name: p.name,
      cpu: p.cpu,
      memory: p.memory
    }));
    this.topProcessesWidget.updateProcesses(processInfoList);
    
    // Update system info - recreate preferences group to clear rows
    this.systemInfoList.remove(this.systemInfoGroup);
    this.systemInfoGroup = new Adw.PreferencesGroup();
    this.systemInfoList.append(this.systemInfoGroup);
    
    this.addSystemInfoRow('OS', data.systemInfo.os, 'Operating system and distribution');
    this.addSystemInfoRow('Kernel', data.systemInfo.kernel, 'Linux kernel version');
    this.addSystemInfoRow('Uptime', data.systemInfo.uptime, 'Time since last boot');
    this.addSystemInfoRow('CPU', data.cpu.model, 'Processor model name');
    this.addSystemInfoRow('Cores', `${data.cpu.cores}`, 'Number of CPU cores');
    this.addSystemInfoRow('GPU', data.gpu.name, 'Graphics processing unit');
    this.addSystemInfoRow('Memory', `${this.utils.formatBytes(data.memory.used)} / ${this.utils.formatBytes(data.memory.total)}`, 'RAM usage and total capacity');
    this.addSystemInfoRow('Disk', `${this.utils.formatBytes(data.disk.used)} / ${this.utils.formatBytes(data.disk.total)}`, 'Storage usage and total capacity');
    
    // Redraw charts
    this.cpuChart.queue_draw();
    this.gpuChart.queue_draw();
    this.memoryChart.queue_draw();
    this.diskChart.queue_draw();
    this.networkChart.queue_draw();
    this.cpuTempChart.queue_draw();
    this.gpuTempChart.queue_draw();
  }
  
  private addSystemInfoRow(title: string, value: string, subtitle: string = ''): void {
    const row = new Adw.ActionRow({
      title: title,
      subtitle: subtitle,
    });
    
    const valueLabel = new Gtk.Label({
      label: value,
    });
    valueLabel.add_css_class('dim-label');
    
    row.add_suffix(valueLabel);
    this.systemInfoGroup.add(row);
  }

  private drawCircularChart(cr: any, width: number, height: number, percentage: number): void {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 10;
    const lineWidth = 12;
    
    // Gap at bottom (in radians)
    const gapAngle = Math.PI / 2.5; // 70 degrees gap at bottom
    const startAngle = Math.PI / 2 + gapAngle / 2; // Start after gap
    const backgroundEndAngle = startAngle + (2 * Math.PI - gapAngle); // End before gap
    
    // Background arc (open at bottom)
    cr.setSourceRGBA(0.3, 0.3, 0.3, 0.2);
    cr.setLineWidth(lineWidth);
    cr.arc(centerX, centerY, radius, startAngle, backgroundEndAngle);
    cr.stroke();
    
    // Progress arc
    const maxAngle = 2 * Math.PI - gapAngle;
    const progressAngle = maxAngle * percentage / 100;
    const endAngle = startAngle + progressAngle;
    
    // Color gradient based on percentage
    if (percentage < 50) {
      cr.setSourceRGBA(0.2, 0.7, 0.3, 1); // Green
    } else if (percentage < 80) {
      cr.setSourceRGBA(0.9, 0.7, 0.1, 1); // Yellow
    } else {
      cr.setSourceRGBA(0.9, 0.2, 0.2, 1); // Red
    }
    
    cr.setLineWidth(lineWidth);
    cr.arc(centerX, centerY, radius, startAngle, endAngle);
    cr.stroke();
  }

  private drawNetworkChart(cr: any, width: number, height: number): void {
    const centerX = width / 2;
    const centerY = height / 2;
    const outerRadius = Math.min(width, height) / 2 - 10;
    const innerRadius = outerRadius - 18;
    const lineWidth = 12;
    
    // Gap at bottom (in radians)
    const gapAngle = Math.PI / 2.5; // 70 degrees gap at bottom
    const startAngle = Math.PI / 2 + gapAngle / 2; // Start after gap
    const backgroundEndAngle = startAngle + (2 * Math.PI - gapAngle); // End before gap
    
    // Outer circle - Download (blue)
    // Background
    cr.setSourceRGBA(0.3, 0.3, 0.3, 0.2);
    cr.setLineWidth(lineWidth);
    cr.arc(centerX, centerY, outerRadius, startAngle, backgroundEndAngle);
    cr.stroke();
    
    // Progress
    const maxAngle = 2 * Math.PI - gapAngle;
    const downloadProgressAngle = maxAngle * this.networkDownloadSpeed / 100;
    const downloadEndAngle = startAngle + downloadProgressAngle;
    cr.setSourceRGBA(0.2, 0.4, 0.8, 1); // Blue for download
    cr.setLineWidth(lineWidth);
    cr.arc(centerX, centerY, outerRadius, startAngle, downloadEndAngle);
    cr.stroke();
    
    // Inner circle - Upload (green)
    // Background
    cr.setSourceRGBA(0.3, 0.3, 0.3, 0.2);
    cr.setLineWidth(lineWidth);
    cr.arc(centerX, centerY, innerRadius, startAngle, backgroundEndAngle);
    cr.stroke();
    
    // Progress
    const uploadProgressAngle = maxAngle * this.networkUploadSpeed / 100;
    const uploadEndAngle = startAngle + uploadProgressAngle;
    cr.setSourceRGBA(0.2, 0.7, 0.3, 1); // Green for upload
    cr.setLineWidth(lineWidth);
    cr.arc(centerX, centerY, innerRadius, startAngle, uploadEndAngle);
    cr.stroke();
  }

  private drawTemperatureChart(cr: any, width: number, height: number, temperature: number): void {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 10;
    const lineWidth = 12;
    
    // Gap at bottom (in radians)
    const gapAngle = Math.PI / 2.5; // 70 degrees gap at bottom
    const startAngle = Math.PI / 2 + gapAngle / 2; // Start after gap
    const backgroundEndAngle = startAngle + (2 * Math.PI - gapAngle); // End before gap
    
    // Background arc (open at bottom)
    cr.setSourceRGBA(0.3, 0.3, 0.3, 0.2);
    cr.setLineWidth(lineWidth);
    cr.arc(centerX, centerY, radius, startAngle, backgroundEndAngle);
    cr.stroke();
    
    // Only draw progress if temperature is available
    if (temperature >= 0) {
      // Progress arc (temperature scale from 0 to 100°C)
      const maxTemp = 100;
      const percentage = Math.min((temperature / maxTemp) * 100, 100);
      const maxAngle = 2 * Math.PI - gapAngle;
      const progressAngle = maxAngle * percentage / 100;
      const endAngle = startAngle + progressAngle;
      
      // Color gradient based on temperature
      if (temperature < 50) {
        cr.setSourceRGBA(0.2, 0.7, 0.3, 1); // Green (cool)
      } else if (temperature < 70) {
        cr.setSourceRGBA(0.9, 0.7, 0.1, 1); // Yellow (warm)
      } else {
        cr.setSourceRGBA(0.9, 0.2, 0.2, 1); // Red (hot)
      }
      
      cr.setLineWidth(lineWidth);
      cr.arc(centerX, centerY, radius, startAngle, endAngle);
      cr.stroke();
    }
  }

  public getWidget(): Gtk.Box {
    return this.container;
  }

  public destroy(): void {
    this.resumeService.unsubscribe(this.dataCallback);
    if (this.topProcessesWidget) {
      this.topProcessesWidget.destroy();
    }
  }
}
