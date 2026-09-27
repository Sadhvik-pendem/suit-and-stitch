import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';

/**
 * Public: List all bespoke tailoring boutiques and their signature designs
 */
export async function getAllBoutiques(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const boutiques = await prisma.boutique.findMany({
      include: {
        designs: {
          select: {
            id: true,
            name: true,
            category: true,
            price: true,
            leadTimeDays: true,
            imageUrl: true,
            description: true,
            fabrics: true,
          },
        },
      },
      orderBy: {
        rating: 'desc',
      },
    });

    res.status(200).json({
      success: true,
      count: boutiques.length,
      data: boutiques,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Public: Retrieve single atelier profile and its complete design catalog
 */
export async function getBoutiqueById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const boutique = await prisma.boutique.findUnique({
      where: { id },
      include: {
        designs: true,
      },
    });

    if (!boutique) {
      res.status(404).json({
        success: false,
        message: `Atelier studio with ID '${id}' was not found.`,
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: boutique,
    });
  } catch (error) {
    next(error);
  }
}
