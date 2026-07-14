import Peer from 'peerjs';

export class MultiplayerService {
  peer: Peer | null = null;
  connections: Map<string, any> = new Map();
  onStateUpdate: ((id: string, state: any) => void) | null = null;
  onPlayerJoined: ((id: string) => void) | null = null;
  myId: string = '';

  init(id: string) {
    this.myId = id;
    this.peer = new Peer(id);
    
    this.peer.on('connection', (conn) => {
      this.setupConnection(conn);
    });
  }

  connect(peerId: string) {
    if (!this.peer) return;
    const conn = this.peer.connect(peerId);
    conn.on('open', () => {
      this.setupConnection(conn);
    });
  }

  private setupConnection(conn: any) {
    this.connections.set(conn.peer, conn);
    if (this.onPlayerJoined) this.onPlayerJoined(conn.peer);
    
    conn.on('data', (data: any) => {
      if (this.onStateUpdate) this.onStateUpdate(conn.peer, data);
    });
    
    conn.on('close', () => {
        this.connections.delete(conn.peer);
    });
  }

  broadcast(state: any) {
    this.connections.forEach(conn => {
      if (conn.open) {
        conn.send(state);
      }
    });
  }
}

export const multiplayerService = new MultiplayerService();
