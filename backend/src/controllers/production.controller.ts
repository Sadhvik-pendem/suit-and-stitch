import { Request, Response, NextFunction } from 'express';
import { OrderStatus } from '@prisma/client';
import prisma from '../config/prisma';
import { broadcastOrderTransition } from '../socket/socket.service';
import { generatePatternCardPdf } from '../utils/pdf.util';

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
 * PUT /api/production/orders/:id/start-stitching
 * Workshop accepts sizing telemetry and transitions order from MEASUREMENTS_TAKEN to IN_PRODUCTION.
 */
export async function startStitching(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      res.status(404).json({ success: false, message: `Order '${id}' not found.` });
      return;
    }

    if (order.status !== OrderStatus.MEASUREMENTS_TAKEN) {
      res.status(400).json({
        success: false,
        message: `Cannot start stitching: Order '${id}' is in status '${order.status}'. Required status: MEASUREMENTS_TAKEN.`,
      });
      return;
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status: OrderStatus.IN_PRODUCTION },
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

    // Broadcast WebSocket state transition
    broadcastOrderTransition(formattedOrder);

    res.status(200).json({
      success: true,
      message: 'Order accepted into active production. Stitching started.',
      order: formattedOrder,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/production/orders/:id/mark-ready
 * Workshop finishes handcrafting and marks order ready for pickup (DISPATCHED).
 * Emits real-time notification to the logistics delivery network.
 */
export async function markReady(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      res.status(404).json({ success: false, message: `Order '${id}' not found.` });
      return;
    }

    if (order.status !== OrderStatus.IN_PRODUCTION) {
      res.status(400).json({
        success: false,
        message: `Cannot dispatch order: Current status is '${order.status}'. Required status: IN_PRODUCTION.`,
      });
      return;
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status: OrderStatus.DISPATCHED },
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

    // Broadcast to order room, customer room, and notifies delivery fleet
    broadcastOrderTransition(formattedOrder, {
      alert: 'Parcels ready for studio pickup by logistics fleet.',
    });

    res.status(200).json({
      success: true,
      message: 'Garment stitching complete. Order marked as DISPATCHED and notified to delivery fleet.',
      order: formattedOrder,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/production/orders/:id/pattern-card
 * Generates and streams a printable A4 PDF Pattern Card and Production Ticket.
 */
export async function downloadPatternCard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        boutique: true,
        design: true,
        measurementTelemetry: true,
      },
    });

    if (!order) {
      res.status(404).json({ success: false, message: `Order '${id}' not found.` });
      return;
    }

    generatePatternCardPdf(
      {
        orderId: order.id,
        createdAt: order.createdAt,
        customerName: order.customer.name,
        customerPhone: order.customer.phone,
        deliveryAddress: order.deliveryAddress,
        boutiqueName: order.boutique.name,
        boutiqueLocation: order.boutique.location,
        designName: order.design.name,
        category: order.design.category,
        price: order.design.price,
        selectedFabric: order.selectedFabric,
        measurements: order.measurementTelemetry
          ? {
              chest: order.measurementTelemetry.chest,
              waist: order.measurementTelemetry.waist,
              hips: order.measurementTelemetry.hips,
              inseam: order.measurementTelemetry.inseam,
              neck: order.measurementTelemetry.neck,
              shoulders: order.measurementTelemetry.shoulders,
            }
          : null,
        tailorNotes: order.measurementTelemetry?.tailorNotes || null,
      },
      res
    );
  } catch (error) {
    next(error);
  }
}
