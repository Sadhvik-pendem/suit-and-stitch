import { Request, Response, NextFunction } from 'express';
import { OrderStatus } from '@prisma/client';
import prisma from '../config/prisma';
import { broadcastOrderTransition } from '../socket/socket.service';

function formatOrder(o: any) {
  return {
    id: o.id,
    customerId: o.customerId,
    customerEmail: o.customer?.email || '',
    customerName: o.customer?.name || '',
    customerPhone: o.customer?.phone || '',
    boutiqueId: o.boutiqueId,
    boutiqueName: o.boutique?.name || '',
    designId: o.designId,
    designName: o.design?.name || '',
    price: o.design?.price || 0,
    selectedFabric: o.selectedFabric,
    deliveryAddress: o.deliveryAddress,
    appointmentSlot: o.appointmentSlot,
    status: (o.status || '').toLowerCase(),
    associate: o.assignedAssociate
      ? { name: o.assignedAssociate.name, phone: o.assignedAssociate.phone }
      : { name: 'Unassigned', phone: '' },
    measurements: o.measurementTelemetry
      ? {
          chest: o.measurementTelemetry.chest,
          waist: o.measurementTelemetry.waist,
          hips: o.measurementTelemetry.hips,
          inseam: o.measurementTelemetry.inseam,
          neck: o.measurementTelemetry.neck,
          shoulders: o.measurementTelemetry.shoulders,
        }
      : null,
    tailorNotes: o.measurementTelemetry?.tailorNotes || '',
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

/**
 * PUT /api/logistics/orders/:id/pickup
 * Delivery agent scans atelier parcel and takes physical custody (advancing to DISPATCHED).
 */
export async function confirmPickup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const deliveryAgentId = req.user!.userId;

    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      res.status(404).json({ success: false, message: `Order '${id}' not found.` });
      return;
    }

    if (order.status !== OrderStatus.IN_PRODUCTION && order.status !== OrderStatus.DISPATCHED) {
      res.status(400).json({
        success: false,
        message: `Cannot scan pickup: Current status is '${order.status}'. Required status: IN_PRODUCTION or DISPATCHED.`,
      });
      return;
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.DISPATCHED,
        assignedDeliveryId: deliveryAgentId,
      },
      include: {
        customer: true,
        boutique: true,
        design: true,
        assignedAssociate: true,
        assignedDelivery: true,
        measurementTelemetry: true,
      },
    });

    const formattedOrder = formatOrder(updatedOrder);

    // Broadcast Real-Time Transition
    broadcastOrderTransition(formattedOrder, {
      logisticsEvent: 'Parcel scanned at atelier workshop. Out for delivery.',
    });

    res.status(200).json({
      success: true,
      message: 'Barcode scanned successfully. Parcel custody assigned and out for delivery.',
      order: formattedOrder,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/logistics/orders/:id/deliver
 * Confirms final doorstep handover to the customer, transitioning status to DELIVERED.
 */
export async function confirmDelivery(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      res.status(404).json({ success: false, message: `Order '${id}' not found.` });
      return;
    }

    if (order.status !== OrderStatus.DISPATCHED) {
      res.status(400).json({
        success: false,
        message: `Cannot confirm delivery: Order status must be DISPATCHED. Current status: '${order.status}'.`,
      });
      return;
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.DELIVERED,
      },
      include: {
        customer: true,
        boutique: true,
        design: true,
        assignedAssociate: true,
        assignedDelivery: true,
        measurementTelemetry: true,
      },
    });

    const formattedOrder = formatOrder(updatedOrder);

    // Broadcast Final Delivery Handshake
    broadcastOrderTransition(formattedOrder, {
      logisticsEvent: 'Doorstep handover completed successfully.',
    });

    res.status(200).json({
      success: true,
      message: 'Doorstep handover confirmed. Order marked as DELIVERED.',
      order: formattedOrder,
    });
  } catch (error) {
    next(error);
  }
}
