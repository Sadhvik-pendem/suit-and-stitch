import PDFDocument from 'pdfkit';
import { Response } from 'express';

interface PatternCardData {
  orderId: string;
  createdAt: Date | string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  boutiqueName: string;
  boutiqueLocation: string;
  designName: string;
  category: string;
  price: number;
  selectedFabric: string;
  measurements: {
    chest: number;
    waist: number;
    hips: number;
    inseam: number;
    neck: number;
    shoulders: number;
  } | null;
  tailorNotes: string | null;
}

/**
 * Builds and streams a bespoke Pattern Card PDF directly to the HTTP response stream.
 */
export function generatePatternCardPdf(data: PatternCardData, res: Response): void {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 40,
    info: {
      Title: `Pattern Card - ${data.orderId}`,
      Author: 'Suit & Stitch Atelier Platform',
      Subject: 'Bespoke Garment Cutting Ticket',
    },
  });

  // Set HTTP headers for PDF streaming
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="PatternCard-${data.orderId}.pdf"`);

  doc.pipe(res);

  const goldColor = '#C5A880';
  const charcoal = '#121212';
  const lightGrey = '#FAF8F5';
  const borderGrey = '#D6D0C2';

  // 1. Top Decorative Bar
  doc.rect(40, 40, 515, 6).fill(goldColor);

  // 2. Header Branding
  doc.moveDown(1.5);
  doc
    .font('Helvetica-Bold')
    .fontSize(22)
    .fillColor(charcoal)
    .text('SUIT & STITCH', 40, 58, { characterSpacing: 3 });

  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(goldColor)
    .text('BESPOKE PATTERN CARD & PRODUCTION TICKET', 40, 84, { characterSpacing: 1.5 });

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#777777')
    .text(`Order Ref: ${data.orderId}`, 360, 62, { align: 'right' })
    .text(`Generated: ${new Date().toLocaleDateString('en-IN', { dateStyle: 'medium' })}`, 360, 76, { align: 'right' });

  // Divider
  doc.moveTo(40, 105).lineTo(555, 105).strokeColor(borderGrey).lineWidth(1).stroke();

  // 3. Overview Grid: Atelier & Garment Information (Left) vs Client Information (Right)
  const metaTop = 120;
  
  // Left Box: Atelier & Garment
  doc.rect(40, metaTop, 250, 110).fillAndStroke(lightGrey, borderGrey);
  doc.fillColor(charcoal).font('Helvetica-Bold').fontSize(10).text('GARMENT SPECIFICATIONS', 52, metaTop + 12);
  
  doc.font('Helvetica').fontSize(9).fillColor('#444444');
  doc.text(`Studio:`, 52, metaTop + 32).font('Helvetica-Bold').text(data.boutiqueName, 115, metaTop + 32);
  doc.font('Helvetica').text(`Garment:`, 52, metaTop + 48).font('Helvetica-Bold').text(data.designName, 115, metaTop + 48);
  doc.font('Helvetica').text(`Category:`, 52, metaTop + 64).font('Helvetica-Bold').text(data.category, 115, metaTop + 64);
  doc.font('Helvetica').text(`Fabric:`, 52, metaTop + 80).font('Helvetica-Bold').fillColor(goldColor).text(data.selectedFabric, 115, metaTop + 80);
  doc.fillColor('#444444').font('Helvetica').text(`Value:`, 52, metaTop + 96).font('Helvetica-Bold').text(`₹${data.price.toLocaleString('en-IN')}`, 115, metaTop + 96);

  // Right Box: Client & Delivery
  doc.rect(305, metaTop, 250, 110).fillAndStroke(lightGrey, borderGrey);
  doc.fillColor(charcoal).font('Helvetica-Bold').fontSize(10).text('CLIENT & LOGISTICS', 317, metaTop + 12);

  doc.font('Helvetica').fontSize(9).fillColor('#444444');
  doc.text(`Client:`, 317, metaTop + 32).font('Helvetica-Bold').text(data.customerName, 370, metaTop + 32);
  doc.font('Helvetica').text(`Phone:`, 317, metaTop + 48).font('Helvetica-Bold').text(data.customerPhone, 370, metaTop + 48);
  doc.font('Helvetica').text(`Address:`, 317, metaTop + 64).font('Helvetica').text(data.deliveryAddress, 370, metaTop + 64, { width: 175 });

  // 4. Biometric Dimensions Grid (Main Cutting Table Telemetry)
  const measurementsTop = 250;
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(charcoal)
    .text('BODY MEASUREMENT TELEMETRY (INCHES)', 40, measurementsTop, { characterSpacing: 1 });

  doc.moveTo(40, measurementsTop + 18).lineTo(555, measurementsTop + 18).strokeColor(borderGrey).stroke();

  const gridTop = measurementsTop + 28;
  const metrics = data.measurements
    ? [
        { label: 'CHEST', value: `${data.measurements.chest}"` },
        { label: 'WAIST', value: `${data.measurements.waist}"` },
        { label: 'HIPS', value: `${data.measurements.hips}"` },
        { label: 'INSEAM', value: `${data.measurements.inseam}"` },
        { label: 'NECK', value: `${data.measurements.neck}"` },
        { label: 'SHOULDERS', value: `${data.measurements.shoulders}"` },
      ]
    : [
        { label: 'CHEST', value: 'PENDING' },
        { label: 'WAIST', value: 'PENDING' },
        { label: 'HIPS', value: 'PENDING' },
        { label: 'INSEAM', value: 'PENDING' },
        { label: 'NECK', value: 'PENDING' },
        { label: 'SHOULDERS', value: 'PENDING' },
      ];

  const colWidth = 80;
  const colGap = 7;
  metrics.forEach((m, idx) => {
    const x = 40 + idx * (colWidth + colGap);
    // Outer card
    doc.rect(x, gridTop, colWidth, 68).fillAndStroke('#FFFFFF', borderGrey);
    // Header tag
    doc.rect(x, gridTop, colWidth, 18).fill(charcoal);
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#FFFFFF').text(m.label, x, gridTop + 5, { width: colWidth, align: 'center' });
    // Dimension display
    doc.font('Helvetica-Bold').fontSize(16).fillColor(goldColor).text(m.value, x, gridTop + 32, { width: colWidth, align: 'center' });
  });

  // 5. Custom Tailor Cutting Instructions
  const notesTop = gridTop + 90;
  doc.rect(40, notesTop, 515, 80).fillAndStroke(lightGrey, borderGrey);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(charcoal).text('CUSTOM CUTTING & SILHOUETTE NOTES', 52, notesTop + 12);
  doc
    .font('Helvetica-Oblique')
    .fontSize(9.5)
    .fillColor('#333333')
    .text(
      data.tailorNotes && data.tailorNotes.trim().length > 0
        ? `"${data.tailorNotes}"`
        : 'Standard relaxed silhouette. No specialized anatomical adjustments recorded.',
      52,
      notesTop + 30,
      { width: 490, lineGap: 3 }
    );

  // 6. Atelier Quality Assurance Sign-off Ticket
  const signTop = notesTop + 100;
  doc.rect(40, signTop, 515, 85).fillAndStroke('#FFFFFF', borderGrey);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(charcoal).text('ATELIER QUALITY CONTROL & CUTTING VERIFICATION', 52, signTop + 12);

  const signCols = [
    { title: 'PATTERN CUTTER', sub: 'Sign & Date' },
    { title: 'MASTER STITCHER', sub: 'Sign & Date' },
    { title: 'QUALITY CONTROL (QC)', sub: 'Passed & Checked' },
  ];

  signCols.forEach((col, idx) => {
    const x = 52 + idx * 170;
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#555555').text(col.title, x, signTop + 34);
    doc.moveTo(x, signTop + 58).lineTo(x + 140, signTop + 58).strokeColor('#AAAAAA').lineWidth(0.5).stroke();
    doc.font('Helvetica').fontSize(7).fillColor('#888888').text(col.sub, x, signTop + 62);
  });

  // 7. Footer Notice
  doc
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor('#999999')
    .text(
      'SUIT & STITCH BESPOKE ATELIER NETWORK • HYPER-PERSONALIZED FIT PRODUCTION TELEMETRY • STRICTLY CONFIDENTIAL',
      40,
      760,
      { align: 'center', width: 515 }
    );

  doc.end();
}
