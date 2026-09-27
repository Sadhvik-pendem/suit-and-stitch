import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt.util';
import { ENV } from '../config/env';
import { AuthUserPayload } from '../types/express';
import prisma from '../config/prisma';

let ioInstance: SocketIOServer | null = null;

export interface SocketOrderUpdatePayload {
  orderId: string;
  status: string;
  order: any;
  extraData?: any;
  timestamp: string;
}

/**
 * Initializes and configures the Socket.io WebSocket server.
 */
export function initSocket(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: ENV.CORS_ORIGIN === '*' ? true : ENV.CORS_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  // Authentication Middleware for WebSocket Connections
  io.use(async (socket: Socket, next) => {
    try {
      let token: string | undefined;

      // 1. Extract from handshake auth payload
      if (socket.handshake.auth && socket.handshake.auth.token) {
        token = socket.handshake.auth.token;
      }
      // 2. Extract from handshake authorization header
      else if (socket.handshake.headers.authorization && socket.handshake.headers.authorization.startsWith('Bearer ')) {
        token = socket.handshake.headers.authorization.split(' ')[1];
      }
      // 3. Extract from handshake cookie
      else if (socket.handshake.headers.cookie) {
        const cookieMatches = socket.handshake.headers.cookie.match(/token=([^;]+)/);
        if (cookieMatches) {
          token = cookieMatches[1];
        }
      }

      if (!token) {
        return next(new Error('Authentication failed: Missing session token.'));
      }

      const decoded = verifyToken(token) as AuthUserPayload;
      socket.data.user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication failed: Invalid or expired token.'));
    }
  });

  // Client Connection Handler
  io.on('connection', async (socket: Socket) => {
    const user = socket.data.user as AuthUserPayload;
    console.log(`[WS] Client Connected: ${user.name} (${user.email}) | Role: ${user.role} | Socket ID: ${socket.id}`);

    // Automatically join private user & role channels
    socket.join(`user:${user.userId}`);
    socket.join(`role:${user.role}`);

    if (user.role === 'CUSTOMER') {
      socket.join(`customer:${user.userId}`);
    } else if (user.role === 'BOUTIQUE_PARTNER') {
      // Find boutique linked to this partner and join boutique channel
      try {
        const boutique = await prisma.boutique.findUnique({
          where: { userId: user.userId },
        });
        if (boutique) {
          socket.join(`boutique:${boutique.id}`);
          console.log(`[WS] Joined Atelier Channel: boutique:${boutique.id}`);
        }
      } catch (e) {
        console.error('[WS] Failed to resolve boutique for socket connection:', e);
      }
    }

    /**
     * Client joins specific order tracking room
     * e.g. socket.emit('subscribe:order', 'ORD-7291-2026')
     */
    socket.on('subscribe:order', (orderId: string) => {
      if (orderId && typeof orderId === 'string') {
        const room = `order:${orderId}`;
        socket.join(room);
        console.log(`[WS] Client ${socket.id} subscribed to room: ${room}`);
      }
    });

    /**
     * Client leaves specific order tracking room
     */
    socket.on('unsubscribe:order', (orderId: string) => {
      if (orderId && typeof orderId === 'string') {
        const room = `order:${orderId}`;
        socket.leave(room);
        console.log(`[WS] Client ${socket.id} unsubscribed from room: ${room}`);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`[WS] Client Disconnected: ${user.name} | Reason: ${reason}`);
    });
  });

  ioInstance = io;
  return io;
}

/**
 * Accessor for the active Socket.io instance
 */
export function getIO(): SocketIOServer {
  if (!ioInstance) {
    throw new Error('Socket.io has not been initialized. Call initSocket(server) first.');
  }
  return ioInstance;
}

/**
 * Real-time Order State Transition Broadcaster.
 * Emits 'order:updated' to:
 * - order:{orderId}
 * - boutique:{boutiqueId}
 * - customer:{customerId}
 * - operational role rooms (ASSOCIATE, DELIVERY_AGENT)
 */
export function broadcastOrderTransition(order: any, extraData: any = {}): void {
  if (!ioInstance) {
    console.warn('[WS] Cannot broadcast order update: Socket.io instance is not initialized.');
    return;
  }

  const payload: SocketOrderUpdatePayload = {
    orderId: order.id,
    status: (order.status || '').toLowerCase(),
    order,
    extraData,
    timestamp: new Date().toISOString(),
  };

  console.log(`[WS BROADCAST] Emitting 'order:updated' for ${order.id} (Status: ${payload.status})`);

  // 1. Broadcast to the specific Order Room
  ioInstance.to(`order:${order.id}`).emit('order:updated', payload);

  // 2. Broadcast to the Atelier Boutique Room
  if (order.boutiqueId) {
    ioInstance.to(`boutique:${order.boutiqueId}`).emit('order:updated', payload);
  }

  // 3. Broadcast to the Customer Room
  if (order.customerId) {
    ioInstance.to(`customer:${order.customerId}`).emit('order:updated', payload);
  }

  // 4. Notify Operational Fleet channels
  ioInstance.to('role:ASSOCIATE').emit('order:updated', payload);
  ioInstance.to('role:DELIVERY_AGENT').emit('order:updated', payload);
}
