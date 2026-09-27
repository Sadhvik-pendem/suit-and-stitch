import { PrismaClient, Role, OrderStatus } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

/**
 * Standard utility to securely hash passwords and OTPs using PBKDF2 / SHA-256
 * For production, bcrypt or argon2id can also be used interchangeably.
 */
function hashSecret(secret: string): string {
  const salt = 'suit_and_stitch_bespoke_salt_2026';
  return crypto.pbkdf2Sync(secret, salt, 10000, 64, 'sha512').toString('hex');
}

async function main() {
  console.log('--- Starting Database Seeding for Suit & Stitch ---');

  // 1. Clean existing records in reverse dependency order
  await prisma.measurementTelemetry.deleteMany();
  await prisma.order.deleteMany();
  await prisma.garmentDesign.deleteMany();
  await prisma.boutique.deleteMany();
  await prisma.user.deleteMany();

  console.log('✓ Purged legacy tables.');

  const defaultPasswordHash = hashSecret('password123');

  // 2. Create the 4 Primary Demo Users (one for each role) + secondary boutique partner
  const customerUser = await prisma.user.create({
    data: {
      email: 'customer@suitstitch.com',
      passwordHash: defaultPasswordHash,
      role: Role.CUSTOMER,
      name: 'Pooja Sharma',
      phone: '+91 98765 11111',
    },
  });

  const associateUser = await prisma.user.create({
    data: {
      email: 'associate@suitstitch.com',
      passwordHash: defaultPasswordHash,
      role: Role.ASSOCIATE,
      name: 'Ramesh Kumar',
      phone: '+91 98765 22222',
    },
  });

  const boutiqueUser1 = await prisma.user.create({
    data: {
      email: 'boutique@darzi.com',
      passwordHash: defaultPasswordHash,
      role: Role.BOUTIQUE_PARTNER,
      name: 'Darzi & Co. Studio',
      phone: '+91 98765 33333',
    },
  });

  const boutiqueUser2 = await prisma.user.create({
    data: {
      email: 'priya@priyastudioluxe.com',
      passwordHash: defaultPasswordHash,
      role: Role.BOUTIQUE_PARTNER,
      name: 'Priya Studio Luxe Partner',
      phone: '+91 98765 33334',
    },
  });

  const deliveryUser = await prisma.user.create({
    data: {
      email: 'delivery@suitstitch.com',
      passwordHash: defaultPasswordHash,
      role: Role.DELIVERY_AGENT,
      name: 'Kiran Patel',
      phone: '+91 98765 44444',
    },
  });

  console.log('✓ Created 4 primary role accounts + boutique atelier partners.');

  // 3. Create the 2 Boutiques
  const boutique1 = await prisma.boutique.create({
    data: {
      name: 'Darzi & Co. Haute Atelier',
      location: 'Jayanagar, Bengaluru',
      rating: 4.9,
      description:
        'Bespoke tailoring masters specializing in structured men’s suits, tuxedo silhouettes, and pure silk heritage gowns.',
      bannerUrl:
        'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&q=80&w=800',
      userId: boutiqueUser1.id,
    },
  });

  const boutique2 = await prisma.boutique.create({
    data: {
      name: 'Priya Studio Luxe',
      location: 'Connaught Place, New Delhi',
      rating: 4.8,
      description:
        'Luxury bridal and bespoke party silhouettes cut with architectural precision and handmade zardozi detailing.',
      bannerUrl:
        'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&q=80&w=800',
      userId: boutiqueUser2.id,
    },
  });

  console.log('✓ Created 2 luxury ateliers: Darzi & Co. and Priya Studio Luxe.');

  // 4. Create Sample Garment Designs
  const suitDesign = await prisma.garmentDesign.create({
    data: {
      boutiqueId: boutique1.id,
      name: 'Classic Charcoal Double-Breasted Suit',
      category: 'Formal Men',
      price: 8500,
      leadTimeDays: 10,
      imageUrl:
        'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&q=80&w=600',
      description:
        'Handcrafted canvas chest piece with reinforced hand-stitched pick lapels.',
      fabrics: [
        'Italian Wool Blend',
        'Raymond English Tweed',
        'Egyptian Cotton Twill',
      ],
    },
  });

  const silkSlipDesign = await prisma.garmentDesign.create({
    data: {
      boutiqueId: boutique1.id,
      name: 'Cream Banarasi Silk Evening Slip',
      category: 'Women Couture',
      price: 5200,
      leadTimeDays: 7,
      imageUrl:
        'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=80&w=600',
      description:
        'Modern relaxed draped neckline crafted over fine Banarasi zari borders.',
      fabrics: ['Mulberry Silk', 'Pure Katan Silk', 'Silk Satin Sheen'],
    },
  });

  const velvetGownDesign = await prisma.garmentDesign.create({
    data: {
      boutiqueId: boutique2.id,
      name: 'Deep Emerald Velvet Evening Gown',
      category: 'Evening Gowns',
      price: 7800,
      leadTimeDays: 8,
      imageUrl:
        'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&q=80&w=600',
      description:
        'Sculpted corsetry bodice with cascading bias flare tailored to your exact height.',
      fabrics: [
        'Royal Emerald Velvet',
        'Midnight Silk Velvet',
        'Plush Black Micro-Velvet',
      ],
    },
  });

  console.log('✓ Created 3 signature bespoke garment catalogs.');

  // 5. Create Active Seed Order matching frontend INITIAL_ORDERS
  // Demo OTP is '4829'
  const activeOrderOtpHash = hashSecret('4829');

  const activeOrder = await prisma.order.create({
    data: {
      id: 'ORD-7291-2026',
      customerId: customerUser.id,
      boutiqueId: boutique1.id,
      designId: suitDesign.id,
      selectedFabric: 'Italian Wool Blend',
      deliveryAddress: 'House 45, 12th Main Road, Indiranagar, Bengaluru',
      appointmentSlot: 'Today at 11:30 AM',
      status: OrderStatus.BOOKED,
      otpHash: activeOrderOtpHash,
      assignedAssociateId: associateUser.id,
      assignedDeliveryId: deliveryUser.id,
    },
  });

  console.log(`✓ Created active demo order: ${activeOrder.id} (OTP: 4829)`);

  console.log('--- Database Seeding Completed Successfully ---');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
