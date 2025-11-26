export interface ProcessInfo {
    pid: string;
    user: string;
    cpu: string;
    memory: string;
    vsz: string;
    rss: string;
    tty: string;
    stat: string;
    start: string;
    time: string;
    command: string;
}

export interface ProcessesData {
    processes: ProcessInfo[];
    totalCount: number;
}
