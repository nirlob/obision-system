import Gtk from '@girs/gtk-4.0';
import Adw from '@girs/adw-1';
import { ResumeService } from '../services/resume-service';
import { SystemData } from '../interfaces/resume';
import { UtilsService } from '../services/utils-service';

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
  private load1minLabel!: Gtk.Label;
  private load5minLabel!: Gtk.Label;
  private load15minLabel!: Gtk.Label;
  private load1minBar!: Gtk.LevelBar;
  private load5minBar!: Gtk.LevelBar;
  private load15minBar!: Gtk.LevelBar;
  private topProcessesList!: Gtk.ListBox;
  private systemInfoList!: Gtk.ListBox;
  private resumeService: ResumeService;
  private utils: UtilsService;
  private dataCallback!: (data: SystemData) => void;
  private cpuUsage: number = 0;
  private gpuUsage: number = 0;
  private memoryUsage: number = 0;
  private diskUsage: number = 0;
  private networkDownloadSpeed: number = 0;
  private networkUploadSpeed: number = 0;
  private cpuTemp: number = 0;
  private gpuTemp: number = 0;

  constructor() {
    this.resumeService = ResumeService.instance;
    this.utils = UtilsService.instance;
    const builder = Gtk.Builder.new();
    
    try {
      try {
        builder.add_from_file('/usr/share/com.obision.ObisionSystem/ui/resume.ui');
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
    this.load1minLabel = builder.get_object('load_1min') as Gtk.Label;
    this.load5minLabel = builder.get_object('load_5min') as Gtk.Label;
    this.load15minLabel = builder.get_object('load_15min') as Gtk.Label;
    this.load1minBar = builder.get_object('load_1min_bar') as Gtk.LevelBar;
    this.load5minBar = builder.get_object('load_5min_bar') as Gtk.LevelBar;
    this.load15minBar = builder.get_object('load_15min_bar') as Gtk.LevelBar;
    this.topProcessesList = builder.get_object('top_processes_list') as Gtk.ListBox;
    this.systemInfoList = builder.get_object('system_info_list') as Gtk.ListBox;
    
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
    
    // Update system load
    this.load1minLabel.set_label(data.systemLoad.load1.toFixed(2));
    this.load5minLabel.set_label(data.systemLoad.load5.toFixed(2));
    this.load15minLabel.set_label(data.systemLoad.load15.toFixed(2));
    this.load1minBar.set_value(data.systemLoad.load1);
    this.load5minBar.set_value(data.systemLoad.load5);
    this.load15minBar.set_value(data.systemLoad.load15);
    
    // Update top processes
    let child = this.topProcessesList.get_first_child();
    while (child) {
      const next = child.get_next_sibling();
      this.topProcessesList.remove(child);
      child = next;
    }
    
    for (const process of data.topProcesses) {
      const row = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 8,
        margin_start: 8,
        margin_end: 8,
        margin_top: 4,
        margin_bottom: 4,
      });
      
      const nameLabel = new Gtk.Label({
        label: process.name,
        halign: Gtk.Align.START,
        hexpand: true,
        ellipsize: 3,
        max_width_chars: 20,
      });
      
      const cpuLabel = new Gtk.Label({
        label: `${process.cpu.toFixed(1)}%`,
        halign: Gtk.Align.END,
      });
      
      row.append(nameLabel);
      row.append(cpuLabel);
      this.topProcessesList.append(row);
    }
    
    // Update system info
    child = this.systemInfoList.get_first_child();
    while (child) {
      const next = child.get_next_sibling();
      this.systemInfoList.remove(child);
      child = next;
    }
    
    this.addSystemInfoRow('OS', data.systemInfo.os);
    this.addSystemInfoRow('Kernel', data.systemInfo.kernel);
    this.addSystemInfoRow('Uptime', data.systemInfo.uptime);
    this.addSystemInfoRow('CPU', data.cpu.model);
    this.addSystemInfoRow('Cores', `${data.cpu.cores}`);
    this.addSystemInfoRow('GPU', data.gpu.name);
    this.addSystemInfoRow('Memory', `${this.utils.formatBytes(data.memory.used)} / ${this.utils.formatBytes(data.memory.total)}`);
    this.addSystemInfoRow('Disk', `${this.utils.formatBytes(data.disk.used)} / ${this.utils.formatBytes(data.disk.total)}`);
    
    // Redraw charts
    this.cpuChart.queue_draw();
    this.gpuChart.queue_draw();
    this.memoryChart.queue_draw();
    this.diskChart.queue_draw();
    this.networkChart.queue_draw();
    this.cpuTempChart.queue_draw();
    this.gpuTempChart.queue_draw();
  }
  
  private addSystemInfoRow(title: string, value: string): void {
    const row = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 8,
      margin_start: 8,
      margin_end: 8,
      margin_top: 4,
      margin_bottom: 4,
    });
    
    const titleLabel = new Gtk.Label({
      label: title,
      halign: Gtk.Align.START,
      hexpand: true,
    });
    titleLabel.add_css_class('dim-label');
    
    const valueLabel = new Gtk.Label({
      label: value,
      halign: Gtk.Align.END,
    });
    
    row.append(titleLabel);
    row.append(valueLabel);
    this.systemInfoList.append(row);
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
  }
}
