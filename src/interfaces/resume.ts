export interface SystemData {
    cpu: { usage: number; model: string; cores: number };
    gpu: { usage: number; name: string };
    memory: { used: number; total: number; percentage: number };
    disk: { used: number; total: number; percentage: number };
    network: { download: string; upload: string };
    cpuTemp: number;
    gpuTemp: number;
    systemLoad: { load1: number; load5: number; load15: number };
    topProcesses: Array<{ name: string; cpu: number; memory: number }>;
    systemInfo: { os: string; kernel: string; uptime: string };
}
