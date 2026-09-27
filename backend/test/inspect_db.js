const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  console.log('\n========================================================================');
  console.log('            SUIT & STITCH - LIVE DATABASE INSPECTION            ');
  console.log('========================================================================\n');

  // 1. Registered Accounts & Roles
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' }
  });
  console.log(`[+] Total Registered Accounts: ${users.length}`);
  console.table(users.map(u => ({
    Role: u.role,
    Name: u.name,
    Email: u.email,
    Phone: u.phone || 'N/A',
    Created: u.createdAt.toISOString().split('T')[0]
  })));

  // 2. Luxury Ateliers
  const boutiques = await prisma.boutique.findMany({
    include: {
      user: { select: { name: true, email: true } },
      designs: { select: { id: true, name: true, price: true } }
    }
  });
  console.log(`\n[+] Registered Luxury Boutiques / Studios: ${boutiques.length}`);
  console.table(boutiques.map(b => ({
    Studio: b.name,
    Partner: b.user?.name,
    Email: b.user?.email,
    Location: b.location,
    Designs: b.designs.length
  })));

  // 3. Orders & Tracking Telemetry
  const orders = await prisma.order.findMany({
    include: {
      customer: { select: { name: true, email: true, phone: true } },
      boutique: { select: { name: true } },
      design: { select: { name: true, price: true } },
      assignedAssociate: { select: { name: true, phone: true } },
      assignedDelivery: { select: { name: true, phone: true } },
      measurementTelemetry: true
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`\n[+] Total Orders in Pipeline: ${orders.length}`);
  for (const o of orders) {
    console.log('\n------------------------------------------------------------------------');
    console.log(`Order ID:     ${o.id}  |  Current Status: [ ${o.status} ]`);
    console.log(`Customer:     ${o.customer.name} (${o.customer.email} | ${o.customer.phone || 'No phone'})`);
    console.log(`Garment:      ${o.design.name} (Rs. ${o.design.price.toLocaleString()})`);
    console.log(`Fabric:       ${o.selectedFabric}`);
    console.log(`Atelier:      ${o.boutique.name}`);
    console.log(`Address:      ${o.deliveryAddress}`);
    console.log(`Associate:    ${o.assignedAssociate ? o.assignedAssociate.name : 'Unassigned'}`);
    console.log(`Delivery:     ${o.assignedDelivery ? o.assignedDelivery.name : 'Unassigned'}`);
    if (o.measurementTelemetry) {
      const m = o.measurementTelemetry;
      console.log(`Measurements: Chest: ${m.chest}" | Waist: ${m.waist}" | Hips: ${m.hips}" | Inseam: ${m.inseam}" | Neck: ${m.neck}" | Shoulders: ${m.shoulders}"`);
      console.log(`Tailor Notes: "${m.tailorNotes || 'None'}"`);
    } else {
      console.log(`Measurements: Not recorded yet.`);
    }
  }
  console.log('\n========================================================================\n');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
