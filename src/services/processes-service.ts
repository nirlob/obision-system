import GLib from "@girs/glib-2.0";
import { UtilsService } from "./utils-service";
import { ProcessInfo, ProcessesData } from "../interfaces/processes";

export class ProcessesService {
    private static _instance: ProcessesService;
    private utils: UtilsService;
    private updateTimeoutId: number | null = null;
    private dataCallbacks: Array<(data: ProcessesData) => void> = [];
    private currentSortColumn: string = 'cpu';
    private currentSortAscending: boolean = false;
    private currentSearchQuery: string = '';

    private constructor() {
        this.utils = UtilsService.instance;
    }

    public static get instance(): ProcessesService {
        if (!ProcessesService._instance) {
            ProcessesService._instance = new ProcessesService();
        }
        return ProcessesService._instance;
    }

    public subscribeToUpdates(callback: (data: ProcessesData) => void): void {
        this.dataCallbacks.push(callback);
        
        if (this.dataCallbacks.length === 1) {
            this.startUpdateLoop();
        }
        
        this.updateData();
    }

    public unsubscribe(callback: (data: ProcessesData) => void): void {
        const index = this.dataCallbacks.indexOf(callback);
        if (index > -1) {
            this.dataCallbacks.splice(index, 1);
        }
        
        if (this.dataCallbacks.length === 0) {
            this.stopUpdateLoop();
        }
    }

    public setSortColumn(column: string, ascending: boolean): void {
        this.currentSortColumn = column;
        this.currentSortAscending = ascending;
        this.updateData();
    }

    public setSearchQuery(query: string): void {
        this.currentSearchQuery = query;
        this.updateData();
    }

    public killProcess(pid: string): boolean {
        try {
            this.utils.executeCommand('kill', ['-9', pid]);
            this.updateData();
            return true;
        } catch (error) {
            console.error('Error killing process:', error);
            return false;
        }
    }

    private startUpdateLoop(): void {
        if (this.updateTimeoutId !== null) {
            return;
        }

        this.updateTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10000, () => {
            this.updateData();
            return GLib.SOURCE_CONTINUE;
        });
    }

    private stopUpdateLoop(): void {
        if (this.updateTimeoutId !== null) {
            GLib.source_remove(this.updateTimeoutId);
            this.updateTimeoutId = null;
        }
    }

    private updateData(): void {
        const processes = this.loadProcesses();
        const data: ProcessesData = {
            processes,
            totalCount: processes.length,
        };

        this.dataCallbacks.forEach(callback => callback(data));
    }

    private loadProcesses(): ProcessInfo[] {
        try {
            const sortMap: { [key: string]: string } = {
                'pid': '-p',
                'user': '-U',
                'cpu': '-%cpu',
                'memory': '-%mem',
                'command': '-c',
            };

            const sortOption = sortMap[this.currentSortColumn] || '-%cpu';
            const [stdout] = this.utils.executeCommand('ps', [
                'aux',
                `--sort=${sortOption}`,
                '--no-headers'
            ]);

            const lines = stdout.trim().split('\n');
            let processes: ProcessInfo[] = [];

            for (const line of lines) {
                const parts = line.split(/\s+/);
                if (parts.length < 11) continue;

                const processInfo: ProcessInfo = {
                    user: parts[0],
                    pid: parts[1],
                    cpu: parts[2],
                    memory: parts[3],
                    vsz: parts[4],
                    rss: parts[5],
                    tty: parts[6],
                    stat: parts[7],
                    start: parts[8],
                    time: parts[9],
                    command: parts.slice(10).join(' '),
                };

                if (this.currentSearchQuery) {
                    const query = this.currentSearchQuery.toLowerCase();
                    if (!processInfo.command.toLowerCase().includes(query) &&
                        !processInfo.pid.includes(query) &&
                        !processInfo.user.toLowerCase().includes(query)) {
                        continue;
                    }
                }

                processes.push(processInfo);
            }

            if (this.currentSortAscending) {
                processes.reverse();
            }

            return processes;
        } catch (error) {
            console.error('Error loading processes:', error);
            return [];
        }
    }
}
