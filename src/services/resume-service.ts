import GLib from "@girs/glib-2.0";
import { UtilsService } from "./utils-service";
import { SettingsService } from "./settings-service";
import { SystemData } from "../interfaces/resume";

export class ResumeService {
    private static _instance: ResumeService;
    private utils: UtilsService;
    private settings: SettingsService;
    private updateTimeoutId: number | null = null;
    private dataCallbacks: Array<(data: SystemData) => void> = [];
    private previousNetworkStats: { download: number; upload: number; timestamp: number } | null = null;

    private constructor() {
        this.utils = UtilsService.instance;
        this.settings = SettingsService.instance;
    }

    public static get instance(): ResumeService {
        if (!ResumeService._instance) {
            ResumeService._instance = new ResumeService();
        }
        return ResumeService._instance;
    }

    public subscribeToUpdates(callback: (data: SystemData) => void): void {
        this.dataCallbacks.push(callback);
        
        // If this is the first subscriber, start the update loop
        if (this.dataCallbacks.length === 1) {
            this.startUpdateLoop();
        }
        
        // Immediately provide initial data
        this.updateData();
    }

    public unsubscribe(callback: (data: SystemData) => void): void {
        const index = this.dataCallbacks.indexOf(callback);
        if (index > -1) {
            this.dataCallbacks.splice(index, 1);
        }
        
        // If no more subscribers, stop the update loop
        if (this.dataCallbacks.length === 0) {
            this.stopUpdateLoop();
        }
    }

    private startUpdateLoop(): void {
        if (this.updateTimeoutId !== null) {
            return;
        }

        const refreshInterval = this.settings.getRefreshInterval();
        this.updateTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, refreshInterval * 1000, () => {
            this.updateData();
            return GLib.SOURCE_CONTINUE;
        });

        // Listen for refresh interval changes
        this.settings.connectRefreshIntervalChanged((newInterval: number) => {
            if (this.updateTimeoutId !== null) {
                GLib.source_remove(this.updateTimeoutId);
                this.updateTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, newInterval * 1000, () => {
                    this.updateData();
                    return GLib.SOURCE_CONTINUE;
                });
            }
        });
    }

    private stopUpdateLoop(): void {
        if (this.updateTimeoutId !== null) {
            GLib.source_remove(this.updateTimeoutId);
            this.updateTimeoutId = null;
        }
    }

    private updateData(): void {
        const data: SystemData = {
            cpu: this.updateCpuUsage(),
            gpu: this.updateGpuUsage(),
            memory: this.updateMemoryUsage(),
            disk: this.updateDiskUsage(),
            network: this.updateNetworkUsage(),
            cpuTemp: this.updateCpuTemperature(),
            gpuTemp: this.updateGpuTemperature(),
            systemLoad: this.updateSystemLoad(),
            topProcesses: this.updateTopProcesses(),
            systemInfo: this.updateSystemInfo(),
        };

        // Notify all subscribers
        this.dataCallbacks.forEach(callback => callback(data));
    }

    private updateCpuUsage(): { usage: number; model: string; cores: number } {
        try {
            const [stdout] = this.utils.executeCommand('cat', ['/proc/stat']);
            const lines = stdout.split('\n');
            const cpuLine = lines[0];
            const values = cpuLine.split(/\s+/).slice(1).map(Number);
            
            const idle = values[3];
            const total = values.reduce((a, b) => a + b, 0);
            const usage = total > 0 ? ((total - idle) / total) * 100 : 0;

            // Get CPU model and cores
            const [cpuInfo] = this.utils.executeCommand('lscpu');
            const modelMatch = cpuInfo.match(/Model name:\s*(.+)/);
            const coresMatch = cpuInfo.match(/CPU\(s\):\s*(\d+)/);
            
            return {
                usage: Math.round(usage),
                model: modelMatch ? modelMatch[1].trim() : 'Unknown',
                cores: coresMatch ? parseInt(coresMatch[1]) : 0,
            };
        } catch (error) {
            console.error('Error reading CPU usage:', error);
            return { usage: 0, model: 'Unknown', cores: 0 };
        }
    }

    private updateGpuUsage(): { usage: number; name: string } {
        try {
            const [stdout] = this.utils.executeCommand('nvidia-smi', [
                '--query-gpu=utilization.gpu,name',
                '--format=csv,noheader,nounits'
            ]);
            const [usage, name] = stdout.trim().split(',');
            return {
                usage: parseInt(usage.trim()) || 0,
                name: name ? name.trim() : 'Unknown GPU',
            };
        } catch (error) {
            return { usage: 0, name: 'N/A' };
        }
    }

    private updateMemoryUsage(): { used: number; total: number; percentage: number } {
        try {
            const [stdout] = this.utils.executeCommand('free', ['-b']);
            const lines = stdout.split('\n');
            const memLine = lines[1].split(/\s+/);
            const total = parseInt(memLine[1]);
            const used = parseInt(memLine[2]);
            const percentage = total > 0 ? (used / total) * 100 : 0;

            return {
                used,
                total,
                percentage: Math.round(percentage),
            };
        } catch (error) {
            console.error('Error reading memory usage:', error);
            return { used: 0, total: 0, percentage: 0 };
        }
    }

    private updateDiskUsage(): { used: number; total: number; percentage: number } {
        try {
            const [stdout] = this.utils.executeCommand('df', ['-B1', '/']);
            const lines = stdout.split('\n');
            const diskLine = lines[1].split(/\s+/);
            const total = parseInt(diskLine[1]);
            const used = parseInt(diskLine[2]);
            const percentage = total > 0 ? (used / total) * 100 : 0;

            return {
                used,
                total,
                percentage: Math.round(percentage),
            };
        } catch (error) {
            console.error('Error reading disk usage:', error);
            return { used: 0, total: 0, percentage: 0 };
        }
    }

    private updateNetworkUsage(): { download: string; upload: string } {
        try {
            const [stdout] = this.utils.executeCommand('cat', ['/proc/net/dev']);
            const lines = stdout.split('\n');
            
            let totalDownload = 0;
            let totalUpload = 0;
            
            for (const line of lines) {
                if (line.includes(':') && !line.includes('lo:')) {
                    const parts = line.split(/\s+/);
                    totalDownload += parseInt(parts[1]) || 0;
                    totalUpload += parseInt(parts[9]) || 0;
                }
            }

            const currentTime = Date.now();
            let downloadSpeed = '0 B/s';
            let uploadSpeed = '0 B/s';

            if (this.previousNetworkStats) {
                const timeDiff = (currentTime - this.previousNetworkStats.timestamp) / 1000;
                const downloadDiff = totalDownload - this.previousNetworkStats.download;
                const uploadDiff = totalUpload - this.previousNetworkStats.upload;

                if (timeDiff > 0) {
                    downloadSpeed = this.utils.formatBytes(downloadDiff / timeDiff) + '/s';
                    uploadSpeed = this.utils.formatBytes(uploadDiff / timeDiff) + '/s';
                }
            }

            this.previousNetworkStats = {
                download: totalDownload,
                upload: totalUpload,
                timestamp: currentTime,
            };

            return {
                download: downloadSpeed,
                upload: uploadSpeed,
            };
        } catch (error) {
            console.error('Error reading network usage:', error);
            return { download: '0 B/s', upload: '0 B/s' };
        }
    }

    private updateCpuTemperature(): number {
        try {
            const [stdout] = this.utils.executeCommand('cat', ['/sys/class/thermal/thermal_zone0/temp']);
            const temp = parseInt(stdout.trim()) / 1000;
            return Math.round(temp);
        } catch (error) {
            return 0;
        }
    }

    private updateGpuTemperature(): number {
        try {
            const [stdout] = this.utils.executeCommand('nvidia-smi', [
                '--query-gpu=temperature.gpu',
                '--format=csv,noheader,nounits'
            ]);
            return parseInt(stdout.trim()) || 0;
        } catch (error) {
            return 0;
        }
    }

    private updateSystemLoad(): { load1: number; load5: number; load15: number } {
        try {
            const [stdout] = this.utils.executeCommand('cat', ['/proc/loadavg']);
            const loads = stdout.split(' ');
            return {
                load1: parseFloat(loads[0]) || 0,
                load5: parseFloat(loads[1]) || 0,
                load15: parseFloat(loads[2]) || 0,
            };
        } catch (error) {
            console.error('Error reading system load:', error);
            return { load1: 0, load5: 0, load15: 0 };
        }
    }

    private updateTopProcesses(): Array<{ name: string; cpu: number; memory: number }> {
        try {
            const [stdout] = this.utils.executeCommand('ps', [
                'aux',
                '--sort=-%cpu',
                '--no-headers'
            ]);
            const lines = stdout.split('\n');
            
            // Filter out 'ps' process and get top 5
            const processes = lines
                .map(line => {
                    const parts = line.split(/\s+/);
                    return {
                        name: parts[10] || 'Unknown',
                        cpu: parseFloat(parts[2]) || 0,
                        memory: parseFloat(parts[3]) || 0,
                    };
                })
                .filter(proc => proc.name !== 'Unknown' && proc.name !== 'ps')
                .slice(0, 5);
            
            return processes;
        } catch (error) {
            console.error('Error reading top processes:', error);
            return [];
        }
    }

    private updateSystemInfo(): { os: string; kernel: string; uptime: string } {
        try {
            const [osInfo] = this.utils.executeCommand('cat', ['/etc/os-release']);
            const osMatch = osInfo.match(/PRETTY_NAME="(.+)"/);
            
            const [kernelInfo] = this.utils.executeCommand('uname', ['-r']);
            
            const [uptimeInfo] = this.utils.executeCommand('uptime', ['-p']);
            
            return {
                os: osMatch ? osMatch[1] : 'Unknown',
                kernel: kernelInfo.trim(),
                uptime: uptimeInfo.trim(),
            };
        } catch (error) {
            console.error('Error reading system info:', error);
            return { os: 'Unknown', kernel: 'Unknown', uptime: 'Unknown' };
        }
    }
}
