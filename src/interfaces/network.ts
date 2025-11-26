export interface NetworkInterface {
    name: string;
    type: string;
    state: string;
    ipv4: string;
    ipv6: string;
    mac: string;
    rxBytes: number;
    txBytes: number;
    rxSpeed: string;
    txSpeed: string;
}

export interface NetworkData {
    interfaces: NetworkInterface[];
}
