import GLib from "@girs/glib-2.0";
import { UtilsService } from "./utils-service";
import { NetworkInterface, NetworkData } from "../interfaces/network";

export class NetworkService {
    private static _instance: NetworkService;
    private utils: UtilsService;
    private updateTimeoutId: number | null = null;
    private dataCallbacks: Array<(data: NetworkData) => void> = [];
    private previousStats: Map<string, { rx: number; tx: number; timestamp: number }> = new Map();

    private constructor() {
        this.utils = UtilsService.instance;
    }

    public static get instance(): NetworkService {
        if (!NetworkService._instance) {
            NetworkService._instance = new NetworkService();
        }
        return NetworkService._instance;
    }

    public subscribeToUpdates(callback: (data: NetworkData) => void): void {
        this.dataCallbacks.push(callback);
        
        if (this.dataCallbacks.length === 1) {
            this.startUpdateLoop();
        }
        
        this.updateData();
    }

    public unsubscribe(callback: (data: NetworkData) => void): void {
        const index = this.dataCallbacks.indexOf(callback);
        if (index > -1) {
            this.dataCallbacks.splice(index, 1);
        }
        
        if (this.dataCallbacks.length === 0) {
            this.stopUpdateLoop();
        }
    }

    private startUpdateLoop(): void {
        if (this.updateTimeoutId !== null) {
            return;
        }

        this.updateTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
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
        const data: NetworkData = {
            interfaces: this.getNetworkInterfaces(),
        };

        this.dataCallbacks.forEach(callback => callback(data));
    }

    private getNetworkInterfaces(): NetworkInterface[] {
        const interfaces: NetworkInterface[] = [];
        
        try {
            const [stdout] = this.utils.executeCommand('ip', ['-j', 'addr']);
            const ipData = JSON.parse(stdout);
            
            for (const iface of ipData) {
                if (iface.ifname === 'lo') continue;
                
                let ipv4 = '';
                let ipv6 = '';
                
                if (iface.addr_info) {
                    for (const addr of iface.addr_info) {
                        if (addr.family === 'inet') {
                            ipv4 = `${addr.local}/${addr.prefixlen}`;
                        } else if (addr.family === 'inet6' && addr.scope === 'global') {
                            ipv6 = `${addr.local}/${addr.prefixlen}`;
                        }
                    }
                }
                
                const stats = this.getInterfaceStats(iface.ifname);
                
                interfaces.push({
                    name: iface.ifname,
                    type: this.getInterfaceType(iface.ifname),
                    state: iface.operstate || 'unknown',
                    ipv4: ipv4 || 'Not assigned',
                    ipv6: ipv6 || 'Not assigned',
                    mac: iface.address || '',
                    rxBytes: stats.rx,
                    txBytes: stats.tx,
                    rxSpeed: stats.rxSpeed,
                    txSpeed: stats.txSpeed,
                });
            }
        } catch (error) {
            console.error('Error reading network interfaces:', error);
        }
        
        return interfaces;
    }

    private getInterfaceType(ifname: string): string {
        if (ifname.startsWith('wl')) return 'Wi-Fi';
        if (ifname.startsWith('en') || ifname.startsWith('eth')) return 'Ethernet';
        if (ifname.startsWith('ww')) return 'Mobile';
        if (ifname.startsWith('docker') || ifname.startsWith('br')) return 'Bridge';
        if (ifname.startsWith('veth')) return 'Virtual';
        return 'Unknown';
    }

    private getInterfaceStats(ifname: string): { rx: number; tx: number; rxSpeed: string; txSpeed: string } {
        try {
            const [rxBytes] = this.utils.executeCommand('cat', [`/sys/class/net/${ifname}/statistics/rx_bytes`]);
            const [txBytes] = this.utils.executeCommand('cat', [`/sys/class/net/${ifname}/statistics/tx_bytes`]);
            
            const rx = parseInt(rxBytes.trim()) || 0;
            const tx = parseInt(txBytes.trim()) || 0;
            
            const currentTime = Date.now();
            let rxSpeed = '0 B/s';
            let txSpeed = '0 B/s';
            
            const previousStat = this.previousStats.get(ifname);
            if (previousStat) {
                const timeDiff = (currentTime - previousStat.timestamp) / 1000;
                const rxDiff = rx - previousStat.rx;
                const txDiff = tx - previousStat.tx;
                
                if (timeDiff > 0) {
                    rxSpeed = this.utils.formatBytes(rxDiff / timeDiff) + '/s';
                    txSpeed = this.utils.formatBytes(txDiff / timeDiff) + '/s';
                }
            }
            
            this.previousStats.set(ifname, { rx, tx, timestamp: currentTime });
            
            return { rx, tx, rxSpeed, txSpeed };
        } catch (error) {
            return { rx: 0, tx: 0, rxSpeed: '0 B/s', txSpeed: '0 B/s' };
        }
    }
}
