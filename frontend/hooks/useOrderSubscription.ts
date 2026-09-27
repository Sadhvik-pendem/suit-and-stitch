import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface MeasurementDimensions {
  chest: number;
  waist: number;
  hips: number;
  inseam: number;
  neck: number;
  shoulders: number;
}

export interface OrderItem {
  id: string;
  customerId?: string;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  boutiqueId: string;
  boutiqueName: string;
  designId: string;
  designName: string;
  price: number;
  selectedFabric: string;
  deliveryAddress: string;
  appointmentSlot: string;
  status: 'booked' | 'associate_arriving' | 'measurements_taken' | 'in_production' | 'dispatched' | 'delivered';
  associate: {
    name: string;
    phone: string;
  };
  otp?: string;
  measurements?: MeasurementDimensions | null;
  tailorNotes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SocketOrderUpdatePayload {
  orderId: string;
  status: string;
  order: OrderItem;
  extraData?: any;
  timestamp: string;
}

export interface UseOrderSubscriptionOptions {
  token: string | null;
  serverUrl?: string;
  initialOrders?: OrderItem[];
  onOrderUpdated?: (updatedOrder: OrderItem, payload: SocketOrderUpdatePayload) => void;
}

export function useOrderSubscription({
  token,
  serverUrl = 'http://localhost:5000',
  initialOrders = [],
  onOrderUpdated,
}: UseOrderSubscriptionOptions) {
  const [orders, setOrders] = useState<OrderItem[]>(initialOrders);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastEvent, setLastEvent] = useState<SocketOrderUpdatePayload | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Sync initialOrders if they change from external fetch
  useEffect(() => {
    if (initialOrders && initialOrders.length > 0) {
      setOrders(initialOrders);
    }
  }, [initialOrders]);

  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    // Initialize authenticated socket connection
    const socket: Socket = io(serverUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[WS] Connected to Suit & Stitch Real-Time Hub. Socket ID:', socket.id);
      setIsConnected(true);

      // Auto-subscribe to all currently tracked orders
      orders.forEach((o) => {
        socket.emit('subscribe:order', o.id);
      });
    });

    socket.on('disconnect', (reason) => {
      console.log('[WS] Disconnected from server. Reason:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('[WS] Connection Error:', error.message);
      setIsConnected(false);
    });

    /**
     * Real-time Order State Transition Listener
     * Triggers dynamic UI updates for the 6-stage tracker, measurement telemetry, and order cards
     */
    socket.on('order:updated', (payload: SocketOrderUpdatePayload) => {
      console.log('[WS REAL-TIME EVENT] order:updated received:', payload);
      setLastEvent(payload);

      setOrders((prevOrders) => {
        const incomingOrder = payload.order;
        const exists = prevOrders.some((ord) => ord.id === incomingOrder.id);

        let updatedList: OrderItem[];
        if (exists) {
          updatedList = prevOrders.map((ord) =>
            ord.id === incomingOrder.id ? { ...ord, ...incomingOrder } : ord
          );
        } else {
          // Prepend new order if placed dynamically
          updatedList = [incomingOrder, ...prevOrders];
        }

        return updatedList;
      });

      if (onOrderUpdated) {
        onOrderUpdated(payload.order, payload);
      }
    });

    return () => {
      console.log('[WS] Cleaning up socket connection on unmount.');
      socket.off('order:updated');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, serverUrl]);

  // Subscribe to a specific order room manually (e.g. after booking wizard creation)
  const subscribeToOrder = useCallback((orderId: string) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('subscribe:order', orderId);
      console.log(`[WS] Explicitly subscribed to order:${orderId}`);
    }
  }, []);

  // Unsubscribe from a specific order room
  const unsubscribeFromOrder = useCallback((orderId: string) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('unsubscribe:order', orderId);
      console.log(`[WS] Explicitly unsubscribed from order:${orderId}`);
    }
  }, []);

  return {
    orders,
    setOrders,
    isConnected,
    lastEvent,
    subscribeToOrder,
    unsubscribeFromOrder,
  };
}

export default useOrderSubscription;
