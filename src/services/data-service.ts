import { UtilsService } from './utils-service';

export interface CpuInfo {
  model: string;
  cores: number;
  logicalCores: number;
  threads: number;
  architecture: string;
  vendor: string;
  family: string;
  modelId: string;
  stepping: string;
  l1dCache: string;
  l1iCache: string;
  l2Cache: string;
  l3Cache: string;
  virtualization: string;
  bogomips: string;
  maxFrequency: string;
  currentFrequency: string;
}

export interface GpuInfo {
  name: string;
  driver: string;
  memoryTotal: string;
  memoryUsed: string;
  temperature: string;
  power: string;
  type: 'nvidia' | 'amd' | 'intel' | 'unknown';
  clockSpeed: string;
  vendor: string;
  pciId: string;
}

export interface MemoryInfo {
  total: number;
  free: number;
  available: number;
  used: number;
  buffers: number;
  cached: number;
  shared: number;
  slab: number;
  active: number;
  inactive: number;
  dirty: number;
  writeback: number;
  mapped: number;
  pageTables: number;
  kernelStack: number;
  swapTotal: number;
  swapFree: number;
  swapUsed: number;
  swapCached: number;
}

export class DataService {
  private static _instance: DataService;
  private utils: UtilsService;

  private constructor() {
    this.utils = UtilsService.instance;
  }

  public static get instance(): DataService {
    if (!DataService._instance) {
      DataService._instance = new DataService();
    }
    return DataService._instance;
  }

  public getCpuInfo(): CpuInfo {
    const info: CpuInfo = {
      model: 'Unknown',
      cores: 0,
      logicalCores: 0,
      threads: 0,
      architecture: 'Unknown',
      vendor: 'Unknown',
      family: 'Unknown',
      modelId: 'Unknown',
      stepping: 'Unknown',
      l1dCache: 'Unknown',
      l1iCache: 'Unknown',
      l2Cache: 'Unknown',
      l3Cache: 'Unknown',
      virtualization: 'Unknown',
      bogomips: 'Unknown',
      maxFrequency: 'Unknown',
      currentFrequency: 'Unknown',
    };

    try {
      const [lscpuOut] = this.utils.executeCommand('sh', ['-c', 'LC_ALL=C lscpu']);
      const lines = lscpuOut.split('\n');

      for (const line of lines) {
        if (line.includes('Model name:')) {
          info.model = line.split(':')[1]?.trim() || 'Unknown';
        } else if (line.includes('Architecture:')) {
          info.architecture = line.split(':')[1]?.trim() || 'Unknown';
        } else if (line.includes('Vendor ID:')) {
          info.vendor = line.split(':')[1]?.trim() || 'Unknown';
        } else if (line.includes('CPU family:')) {
          info.family = line.split(':')[1]?.trim() || 'Unknown';
        } else if (line.includes('Model:') && !line.includes('Model name:')) {
          info.modelId = line.split(':')[1]?.trim() || 'Unknown';
        } else if (line.includes('Stepping:')) {
          info.stepping = line.split(':')[1]?.trim() || 'Unknown';
        } else if (line.includes('CPU(s):') && !line.includes('NUMA') && !line.includes('On-line')) {
          info.logicalCores = parseInt(line.split(':')[1]?.trim() || '0');
        } else if (line.includes('Core(s) per socket:')) {
          const coresPerSocket = parseInt(line.split(':')[1]?.trim() || '0');
          const socketsMatch = lscpuOut.match(/Socket\(s\):\s+(\d+)/);
          const sockets = socketsMatch ? parseInt(socketsMatch[1]) : 1;
          info.cores = coresPerSocket * sockets;
        } else if (line.includes('Thread(s) per core:')) {
          info.threads = parseInt(line.split(':')[1]?.trim() || '0');
        } else if (line.includes('L1d cache:')) {
          info.l1dCache = line.split(':')[1]?.trim() || 'Unknown';
        } else if (line.includes('L1i cache:')) {
          info.l1iCache = line.split(':')[1]?.trim() || 'Unknown';
        } else if (line.includes('L2 cache:')) {
          info.l2Cache = line.split(':')[1]?.trim() || 'Unknown';
        } else if (line.includes('L3 cache:')) {
          info.l3Cache = line.split(':')[1]?.trim() || 'Unknown';
        } else if (line.includes('Virtualization:')) {
          info.virtualization = line.split(':')[1]?.trim() || 'Unknown';
        } else if (line.includes('BogoMIPS:')) {
          info.bogomips = line.split(':')[1]?.trim() || 'Unknown';
        } else if (line.includes('CPU max MHz:')) {
          const mhz = parseFloat(line.split(':')[1]?.trim() || '0');
          info.maxFrequency = `${(mhz / 1000).toFixed(2)} GHz`;
        } else if (line.includes('CPU MHz:')) {
          const mhz = parseFloat(line.split(':')[1]?.trim() || '0');
          info.currentFrequency = `${(mhz / 1000).toFixed(2)} GHz`;
        }
      }
    } catch (error) {
      console.error('Error getting CPU info:', error);
    }

    return info;
  }

  public getGpuInfo(): GpuInfo[] {
    const gpus: GpuInfo[] = [];

    // Try NVIDIA first
    try {
      const [whichOut] = this.utils.executeCommand('which', ['nvidia-smi']);
      if (whichOut.trim()) {
        const [smiOut] = this.utils.executeCommand('nvidia-smi', [
          '--query-gpu=name,driver_version,memory.total,memory.used,temperature.gpu,power.draw,clocks.gr,pci.bus_id',
          '--format=csv,noheader,nounits'
        ]);
        
        const lines = smiOut.trim().split('\n');
        for (const line of lines) {
          if (line.trim()) {
            const parts = line.split(',').map(p => p.trim());
            gpus.push({
              name: parts[0] || 'Unknown',
              driver: parts[1] || 'Unknown',
              memoryTotal: `${parts[2]} MB`,
              memoryUsed: `${parts[3]} MB`,
              temperature: `${parts[4]}°C`,
              power: `${parts[5]} W`,
              clockSpeed: `${parts[6]} MHz`,
              pciId: parts[7] || 'Unknown',
              type: 'nvidia',
              vendor: 'NVIDIA',
            });
          }
        }
        
        if (gpus.length > 0) return gpus;
      }
    } catch (error) {
      console.log('NVIDIA GPU not detected or nvidia-smi failed');
    }

    // Try AMD (limited info available without rocm-smi)
    try {
      const [lspciOut] = this.utils.executeCommand('lspci', ['-v']);
      const gpuBlocks = lspciOut.split('\n\n').filter(block => 
        (block.includes('VGA') || block.includes('3D')) && 
        (block.includes('AMD') || block.includes('ATI') || block.includes('Radeon'))
      );
      
      for (const block of gpuBlocks) {
        const nameMatch = block.match(/VGA compatible controller: (.+)/);
        const driverMatch = block.match(/Kernel driver in use: (.+)/);
        
        gpus.push({
          name: nameMatch ? nameMatch[1].trim() : 'AMD GPU',
          driver: driverMatch ? driverMatch[1].trim() : 'Unknown',
          memoryTotal: 'N/A',
          memoryUsed: 'N/A',
          temperature: 'N/A',
          power: 'N/A',
          clockSpeed: 'N/A',
          pciId: 'N/A',
          type: 'amd',
          vendor: 'AMD',
        });
      }
      
      if (gpus.length > 0) return gpus;
    } catch (error) {
      console.log('AMD GPU not detected');
    }

    // Try Intel
    try {
      const [lspciOut] = this.utils.executeCommand('lspci', ['-v']);
      const gpuBlocks = lspciOut.split('\n\n').filter(block => 
        (block.includes('VGA') || block.includes('3D')) && block.includes('Intel')
      );
      
      for (const block of gpuBlocks) {
        const nameMatch = block.match(/VGA compatible controller: (.+)/);
        const driverMatch = block.match(/Kernel driver in use: (.+)/);
        
        gpus.push({
          name: nameMatch ? nameMatch[1].trim() : 'Intel GPU',
          driver: driverMatch ? driverMatch[1].trim() : 'Unknown',
          memoryTotal: 'Shared',
          memoryUsed: 'N/A',
          temperature: 'N/A',
          power: 'N/A',
          clockSpeed: 'N/A',
          pciId: 'N/A',
          type: 'intel',
          vendor: 'Intel',
        });
      }
      
      if (gpus.length > 0) return gpus;
    } catch (error) {
      console.log('Intel GPU not detected');
    }

    // Fallback: Generic GPU detection
    try {
      const [lspciOut] = this.utils.executeCommand('lspci', ['-v']);
      const gpuBlocks = lspciOut.split('\n\n').filter(block => 
        block.includes('VGA') || block.includes('3D')
      );
      
      for (const block of gpuBlocks) {
        const nameMatch = block.match(/VGA compatible controller: (.+)/);
        const driverMatch = block.match(/Kernel driver in use: (.+)/);
        
        gpus.push({
          name: nameMatch ? nameMatch[1].trim() : 'Unknown GPU',
          driver: driverMatch ? driverMatch[1].trim() : 'Unknown',
          memoryTotal: 'N/A',
          memoryUsed: 'N/A',
          temperature: 'N/A',
          power: 'N/A',
          clockSpeed: 'N/A',
          pciId: 'N/A',
          type: 'unknown',
          vendor: 'Unknown',
        });
      }
    } catch (error) {
      console.log('Error detecting GPUs');
    }

    return gpus;
  }

  public getMemoryInfo(): MemoryInfo {
    const info: MemoryInfo = {
      total: 0,
      free: 0,
      available: 0,
      used: 0,
      buffers: 0,
      cached: 0,
      shared: 0,
      slab: 0,
      active: 0,
      inactive: 0,
      dirty: 0,
      writeback: 0,
      mapped: 0,
      pageTables: 0,
      kernelStack: 0,
      swapTotal: 0,
      swapFree: 0,
      swapUsed: 0,
      swapCached: 0,
    };

    try {
      const [memInfoOut] = this.utils.executeCommand('cat', ['/proc/meminfo']);
      const lines = memInfoOut.split('\n');

      for (const line of lines) {
        const parts = line.split(/\s+/);
        const key = parts[0]?.replace(':', '');
        const value = parseInt(parts[1]) || 0;

        switch (key) {
          case 'MemTotal': info.total = value; break;
          case 'MemFree': info.free = value; break;
          case 'MemAvailable': info.available = value; break;
          case 'Buffers': info.buffers = value; break;
          case 'Cached': info.cached = value; break;
          case 'Shmem': info.shared = value; break;
          case 'Slab': info.slab = value; break;
          case 'Active': info.active = value; break;
          case 'Inactive': info.inactive = value; break;
          case 'Dirty': info.dirty = value; break;
          case 'Writeback': info.writeback = value; break;
          case 'Mapped': info.mapped = value; break;
          case 'PageTables': info.pageTables = value; break;
          case 'KernelStack': info.kernelStack = value; break;
          case 'SwapTotal': info.swapTotal = value; break;
          case 'SwapFree': info.swapFree = value; break;
          case 'SwapCached': info.swapCached = value; break;
        }
      }

      // Calculate used memory
      info.used = info.total - info.free - info.buffers - info.cached;
      info.swapUsed = info.swapTotal - info.swapFree;
    } catch (error) {
      console.error('Error getting memory info:', error);
    }

    return info;
  }

  public hasBattery(): boolean {
    try {
      // Check using UPower
      const [upowerOut] = this.utils.executeCommand('upower', ['-e']);
      if (upowerOut && upowerOut.includes('battery')) {
        return true;
      }

      // Fallback: check /sys/class/power_supply/
      const [lsOut] = this.utils.executeCommand('ls', ['/sys/class/power_supply/']);
      if (lsOut) {
        const devices = lsOut.split('\n').filter(d => d.trim());
        for (const device of devices) {
          const [typeOut] = this.utils.executeCommand('cat', [`/sys/class/power_supply/${device}/type`]);
          if (typeOut && typeOut.trim() === 'Battery') {
            return true;
          }
        }
      }

      // Fallback: check with fastfetch
      const [fastfetchOut] = this.utils.executeCommand('fastfetch', ['--format', 'json']);
      if (fastfetchOut) {
        const data = JSON.parse(fastfetchOut);
        const batteryModule = data.find((item: any) => item.type === 'Battery');
        if (batteryModule?.result) {
          const batteryArray = Array.isArray(batteryModule.result) ? batteryModule.result : [batteryModule.result];
          return batteryArray.length > 0 && batteryArray[0] !== null && batteryArray[0] !== undefined;
        }
      }
    } catch (error) {
      console.log('Battery detection error:', error);
    }

    return false;
  }

  public getSystemInfo(): any {
    const systemInfo: any = {
      hostname: '',
      os: {},
      kernel: {},
      uptime: {},
      displays: []
    };

    try {
      const [stdout] = this.utils.executeCommand('fastfetch', ['--format', 'json']);
      const fastfetchData = JSON.parse(stdout);
      
      for (const item of fastfetchData) {
        if (!item.result) continue;
        
        switch (item.type) {
          case 'Title':
          case 'Host':
            systemInfo.hostname = item.result;
            break;
          case 'OS':
            systemInfo.os = {
              name: item.result.name,
              prettyName: item.result.prettyName,
              version: item.result.version,
              versionID: item.result.versionID,
              id: item.result.id,
              idLike: item.result.idLike
            };
            break;
          case 'Kernel':
            systemInfo.kernel = {
              name: item.result.name,
              release: item.result.release,
              version: item.result.version
            };
            break;
          case 'Uptime':
            systemInfo.uptime = item.result;
            break;
          case 'Display':
            if (Array.isArray(item.result)) {
              systemInfo.displays = item.result.map((d: any) => ({
                name: d.name,
                resolution: `${d.output.width}x${d.output.height}`,
                refreshRate: d.output.refreshRate,
                type: d.type
              }));
            }
            break;
        }
      }
    } catch (error) {
      console.error('Error getting system info:', error);
    }

    return systemInfo;
  }

  public getSoftwareInfo(): any {
    const softwareInfo: any = {
      packages: {},
      shell: {},
      desktopEnvironment: {},
      windowManager: {},
      terminal: ''
    };

    try {
      const [stdout] = this.utils.executeCommand('fastfetch', ['--format', 'json']);
      const fastfetchData = JSON.parse(stdout);
      
      for (const item of fastfetchData) {
        if (!item.result) continue;
        
        switch (item.type) {
          case 'Packages':
            softwareInfo.packages = item.result;
            break;
          case 'Shell':
            softwareInfo.shell = {
              name: item.result.exeName,
              version: item.result.version
            };
            break;
          case 'DE':
            softwareInfo.desktopEnvironment = {
              name: item.result.name || item.result.prettyName,
              version: item.result.version
            };
            break;
          case 'WM':
            softwareInfo.windowManager = {
              name: item.result.prettyName || item.result.name
            };
            break;
          case 'Terminal':
            softwareInfo.terminal = item.result;
            break;
        }
      }
    } catch (error) {
      console.error('Error getting software info:', error);
    }

    return softwareInfo;
  }

  public getBatteryHistory(): Array<{timestamp: number, level: number}> {
    const history: Array<{timestamp: number, level: number}> = [];
    
    try {
      // Get battery device path
      const [deviceOut] = this.utils.executeCommand('upower', ['-e']);
      const devices = deviceOut.split('\n').filter(d => d.includes('battery'));
      
      if (devices.length > 0) {
        const batteryDevice = devices[0].trim();
        
        // Use gdbus to call GetHistory method directly from UPower D-Bus API
        // This returns the actual stored history from UPower's database
        const [historyOut] = this.utils.executeCommand('gdbus', [
          'call',
          '--system',
          '--dest', 'org.freedesktop.UPower',
          '--object-path', batteryDevice,
          '--method', 'org.freedesktop.UPower.Device.GetHistory',
          'charge',  // history type: charge, rate, or time-full
          '0',       // timespec (0 = all available data)
          '1000'     // resolution (maximum number of points)
        ]);
        
        if (historyOut) {
          // Parse D-Bus array output format: [(uint32 timestamp, double value, uint32 state), ...]
          // Filter last 24 hours
          const now = Math.floor(Date.now() / 1000);
          const twentyFourHoursAgo = now - (24 * 60 * 60);
          
          // Extract tuples using regex: (timestamp, percentage, state)
          const tupleRegex = /\((\d+),\s*([\d.]+),\s*\d+\)/g;
          let match;
          
          while ((match = tupleRegex.exec(historyOut)) !== null) {
            const timestamp = parseInt(match[1]);
            const percentage = parseFloat(match[2]);
            
            // Filter out invalid data (0.0 percentage) and old data
            if (percentage > 0 && timestamp >= twentyFourHoursAgo) {
              history.push({
                timestamp: timestamp * 1000, // Convert to milliseconds for JavaScript Date
                level: percentage
              });
            }
          }
        }
      }
    } catch (error) {
      console.log('Error getting battery history:', error);
    }

    return history;
  }
}
