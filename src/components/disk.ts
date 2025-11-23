import Gtk from "@girs/gtk-4.0";
import Adw from "@girs/adw-1";
import GLib from "@girs/glib-2.0";
import { UtilsService } from "../services/utils-service";

interface DiskStats {
    device: string;
    readBytes: number;
    writeBytes: number;
    readOps: number;
    writeOps: number;
}

interface FilesystemInfo {
    device: string;
    mountPoint: string;
    size: number;
    used: number;
    available: number;
    usePercent: number;
    fsType: string;
}

export class DiskComponent {
    private container: Gtk.Box;
    private diskChart: Gtk.DrawingArea;
    private readSpeedLabel: Gtk.Label;
    private writeSpeedLabel: Gtk.Label;
    private totalReadLabel: Gtk.Label;
    private totalWriteLabel: Gtk.Label;
    private filesystemsGroup: Adw.PreferencesGroup;
    private utils: UtilsService;
    private updateTimeoutId: number | null = null;
    private readHistory: number[] = [];
    private writeHistory: number[] = [];
    private previousStats: Map<string, DiskStats> = new Map();
    private filesystemRows: Map<string, Adw.ExpanderRow> = new Map();
    private totalBytesRead: number = 0;
    private totalBytesWritten: number = 0;

    constructor() {
        this.utils = UtilsService.instance;

        const builder = Gtk.Builder.new();
        try {
            builder.add_from_file('/usr/share/com.obision.ObisionStatus/ui/disk.ui');
        } catch (e) {
            builder.add_from_file('data/ui/disk.ui');
        }

        this.container = builder.get_object('disk_container') as Gtk.Box;
        this.diskChart = builder.get_object('disk_chart') as Gtk.DrawingArea;
        this.readSpeedLabel = builder.get_object('read_speed_label') as Gtk.Label;
        this.writeSpeedLabel = builder.get_object('write_speed_label') as Gtk.Label;
        this.totalReadLabel = builder.get_object('total_read_label') as Gtk.Label;
        this.totalWriteLabel = builder.get_object('total_write_label') as Gtk.Label;
        this.filesystemsGroup = builder.get_object('disk_filesystems_group') as Adw.PreferencesGroup;

        // Initialize history arrays
        for (let i = 0; i < 60; i++) {
            this.readHistory.push(0);
            this.writeHistory.push(0);
        }

        this.setupChart();
        this.loadFilesystems();
        this.updateData();

        // Update every 2 seconds
        this.updateTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
            this.updateData();
            return GLib.SOURCE_CONTINUE;
        });
    }

    private setupChart(): void {
        this.diskChart.set_draw_func((area, cr, width, height) => {
            this.drawLineChart(cr, width, height);
        });
    }

    private drawLineChart(cr: any, width: number, height: number): void {
        const padding = 20;
        const chartWidth = width - 2 * padding;
        const chartHeight = height - 2 * padding;
        
        // Clear background with transparent color
        cr.setSourceRGBA(0, 0, 0, 0);
        cr.paint();
        
        // Find max value for scaling
        const allValues = [...this.readHistory, ...this.writeHistory];
        const maxValue = Math.max(...allValues, 10); // Minimum 10 MB/s for scale
        
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
        
        const pointSpacing = chartWidth / (this.readHistory.length - 1);
        
        // Draw read line (blue)
        if (this.readHistory.length > 1) {
            cr.setSourceRGB(0.2, 0.6, 1.0);
            cr.setLineWidth(2);
            
            cr.moveTo(padding, height - padding - (this.readHistory[0] / maxValue) * chartHeight);
            
            for (let i = 1; i < this.readHistory.length; i++) {
                const x = padding + i * pointSpacing;
                const y = height - padding - (this.readHistory[i] / maxValue) * chartHeight;
                cr.lineTo(x, y);
            }
            
            cr.stroke();
            
            // Fill area under read line
            cr.setSourceRGBA(0.2, 0.6, 1.0, 0.2);
            cr.lineTo(width - padding, height - padding);
            cr.lineTo(padding, height - padding);
            cr.closePath();
            cr.fill();
        }
        
        // Draw write line (green)
        if (this.writeHistory.length > 1) {
            cr.setSourceRGB(0.2, 0.8, 0.4);
            cr.setLineWidth(2);
            
            cr.moveTo(padding, height - padding - (this.writeHistory[0] / maxValue) * chartHeight);
            
            for (let i = 1; i < this.writeHistory.length; i++) {
                const x = padding + i * pointSpacing;
                const y = height - padding - (this.writeHistory[i] / maxValue) * chartHeight;
                cr.lineTo(x, y);
            }
            
            cr.stroke();
            
            // Fill area under write line
            cr.setSourceRGBA(0.2, 0.8, 0.4, 0.2);
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
            const value = maxValue * (1 - i / 4);
            const label = `${value.toFixed(1)}`;
            cr.moveTo(5, y + 3);
            cr.showText(label);
        }
        
        // Legend
        cr.setFontSize(10);
        cr.selectFontFace('Sans', 0, 0); // Normal font
        
        // Read legend
        cr.setSourceRGB(0.2, 0.6, 1.0);
        cr.rectangle(width - 170, 7, 15, 10);
        cr.fill();
        cr.setSourceRGB(0.5, 0.5, 0.5);
        cr.setLineWidth(1);
        cr.rectangle(width - 170, 7, 15, 10);
        cr.stroke();
        cr.setSourceRGB(1, 1, 1);
        cr.moveTo(width - 150, 15);
        cr.showText('Read');
        
        // Write legend
        cr.setSourceRGB(0.2, 0.8, 0.4);
        cr.rectangle(width - 90, 7, 15, 10);
        cr.fill();
        cr.setSourceRGB(0.5, 0.5, 0.5);
        cr.setLineWidth(1);
        cr.rectangle(width - 90, 7, 15, 10);
        cr.stroke();
        cr.setSourceRGB(1, 1, 1);
        cr.moveTo(width - 70, 15);
        cr.showText('Write');
    }

    private loadFilesystems(): void {
        try {
            const [stdout] = this.utils.executeCommand('df', ['-h', '--output=source,target,size,used,avail,pcent,fstype']);
            const lines = stdout.trim().split('\n').slice(1); // Skip header

            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 7) {
                    const device = parts[0];
                    const mountPoint = parts[1];
                    const size = parts[2];
                    const used = parts[3];
                    const available = parts[4];
                    const usePercent = parts[5];
                    const fsType = parts[6];

                    // Skip special filesystems
                    if (device.startsWith('/dev/') || device.startsWith('/')) {
                        this.createFilesystemRow(device, mountPoint, size, used, available, usePercent, fsType);
                    }
                }
            }
        } catch (error) {
            console.error('Error loading filesystems:', error);
        }
    }

    private createFilesystemRow(device: string, mountPoint: string, size: string, used: string, available: string, usePercent: string, fsType: string): void {
        if (this.filesystemRows.has(device)) {
            return;
        }

        const expanderRow = new Adw.ExpanderRow({
            title: mountPoint,
            subtitle: device,
        });

        // Device type
        const typeRow = new Adw.ActionRow({
            title: 'Filesystem Type',
        });
        const typeLabel = new Gtk.Label({
            label: fsType,
            css_classes: ['dim-label'],
        });
        typeRow.add_suffix(typeLabel);
        expanderRow.add_row(typeRow);

        // Total size
        const sizeRow = new Adw.ActionRow({
            title: 'Total Size',
        });
        const sizeLabel = new Gtk.Label({
            label: size,
            css_classes: ['dim-label'],
        });
        sizeRow.add_suffix(sizeLabel);
        expanderRow.add_row(sizeRow);

        // Used space
        const usedRow = new Adw.ActionRow({
            title: 'Used Space',
        });
        const usedLabel = new Gtk.Label({
            label: `${used} (${usePercent})`,
            css_classes: ['dim-label'],
        });
        usedRow.add_suffix(usedLabel);
        expanderRow.add_row(usedRow);

        // Available space
        const availRow = new Adw.ActionRow({
            title: 'Available Space',
        });
        const availLabel = new Gtk.Label({
            label: available,
            css_classes: ['dim-label'],
        });
        availRow.add_suffix(availLabel);
        expanderRow.add_row(availRow);

        this.filesystemsGroup.add(expanderRow);
        this.filesystemRows.set(device, expanderRow);
    }

    private updateData(): void {
        const stats = this.getDiskStats();
        let totalReadSpeed = 0;
        let totalWriteSpeed = 0;

        for (const [device, currentStats] of stats.entries()) {
            const previous = this.previousStats.get(device);
            if (previous) {
                const readDelta = currentStats.readBytes - previous.readBytes;
                const writeDelta = currentStats.writeBytes - previous.writeBytes;
                
                // Convert to MB/s (delta is in bytes over 2 seconds)
                const readSpeed = (readDelta / 2) / (1024 * 1024);
                const writeSpeed = (writeDelta / 2) / (1024 * 1024);
                
                totalReadSpeed += readSpeed;
                totalWriteSpeed += writeSpeed;
                
                this.totalBytesRead += readDelta;
                this.totalBytesWritten += writeDelta;
            }
            this.previousStats.set(device, currentStats);
        }

        // Update history
        this.readHistory.push(totalReadSpeed);
        this.writeHistory.push(totalWriteSpeed);
        if (this.readHistory.length > 60) {
            this.readHistory.shift();
            this.writeHistory.shift();
        }

        // Update labels
        this.readSpeedLabel.set_label(`${totalReadSpeed.toFixed(2)} MB/s`);
        this.writeSpeedLabel.set_label(`${totalWriteSpeed.toFixed(2)} MB/s`);
        this.totalReadLabel.set_label(this.formatBytes(this.totalBytesRead));
        this.totalWriteLabel.set_label(this.formatBytes(this.totalBytesWritten));

        // Redraw chart
        this.diskChart.queue_draw();
    }

    private getDiskStats(): Map<string, DiskStats> {
        const stats = new Map<string, DiskStats>();

        try {
            const [stdout] = this.utils.executeCommand('cat', ['/proc/diskstats']);
            const lines = stdout.trim().split('\n');

            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 14) {
                    const device = parts[2];
                    
                    // Only track physical disks (sda, nvme0n1, etc.)
                    if (device.match(/^(sd[a-z]|nvme\d+n\d+|vd[a-z])$/)) {
                        const readOps = parseInt(parts[3]);
                        const readSectors = parseInt(parts[5]);
                        const writeOps = parseInt(parts[7]);
                        const writeSectors = parseInt(parts[9]);
                        
                        // Convert sectors to bytes (sector = 512 bytes)
                        const readBytes = readSectors * 512;
                        const writeBytes = writeSectors * 512;

                        stats.set(device, {
                            device,
                            readBytes,
                            writeBytes,
                            readOps,
                            writeOps,
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error reading disk stats:', error);
        }

        return stats;
    }

    private formatBytes(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }

    public getWidget(): Gtk.Box {
        return this.container;
    }

    public destroy(): void {
        if (this.updateTimeoutId !== null) {
            GLib.source_remove(this.updateTimeoutId);
        }
    }
}
