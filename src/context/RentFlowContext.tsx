import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Organization,
  UserRole,
  Category,
  EquipmentModel,
  Customer,
  Booking,
  Invoice,
  MaintenanceWorkOrder,
  InspectionRecord,
  PaymentRecord,
} from '../types';

interface RentFlowContextType {
  currentOrg: Organization;
  organizations: Organization[];
  currentRole: UserRole;
  categories: Category[];
  equipmentList: EquipmentModel[];
  customers: Customer[];
  bookings: Booking[];
  invoices: Invoice[];
  maintenanceOrders: MaintenanceWorkOrder[];
  activeView: string;
  setActiveView: (view: string) => void;
  setCurrentRole: (role: UserRole) => void;
  switchOrganization: (orgId: string) => void;
  addEquipment: (item: Omit<EquipmentModel, 'id'>) => void;
  updateEquipment: (id: string, item: Partial<EquipmentModel>) => void;
  deleteEquipment: (id: string) => void;
  addCustomer: (customer: Omit<Customer, 'id' | 'currentBalance'>) => void;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  createBooking: (bookingData: Omit<Booking, 'id' | 'bookingNumber' | 'createdAt'>) => Booking;
  updateBookingStatus: (id: string, status: Booking['status']) => void;
  processCheckoutInspection: (bookingId: string, record: Omit<InspectionRecord, 'id' | 'timestamp' | 'type'>) => void;
  processReturnInspection: (
    bookingId: string,
    record: Omit<InspectionRecord, 'id' | 'timestamp' | 'type'>,
    damageCharge: number,
    cleaningFee: number,
    refuelFee: number
  ) => void;
  createInvoice: (invoiceData: Omit<Invoice, 'id' | 'invoiceNumber' | 'issuedDate' | 'payments' | 'amountPaid'>) => Invoice;
  recordPayment: (invoiceId: string, payment: Omit<PaymentRecord, 'id' | 'invoiceId' | 'date'>) => void;
  createMaintenanceOrder: (order: Omit<MaintenanceWorkOrder, 'id' | 'orderNumber'>) => void;
  updateMaintenanceStatus: (id: string, status: MaintenanceWorkOrder['status']) => void;
  updateStorefront: (settings: Partial<Organization['storefront']>) => void;
  resetToDemoDefaults: () => void;
}

const RentFlowContext = createContext<RentFlowContextType | undefined>(undefined);

const SEED_ORGANIZATIONS: Organization[] = [
  {
    id: 'org-apex',
    name: 'Apex Equipment Hire',
    slug: 'apex-hire',
    currency: 'USD',
    timezone: 'America/Chicago',
    taxRatePercent: 8.25,
    phone: '+1 (512) 890-4420',
    email: 'rentals@apexhire.com',
    address: '4500 Industrial Blvd, Austin, TX 78744',
    planTier: 'GROWTH',
    locations: [
      { id: 'loc-1', name: 'Austin Central Yard', code: 'ATX-01', address: '4500 Industrial Blvd, Austin, TX', phone: '(512) 890-4420' },
      { id: 'loc-2', name: 'Round Rock North Depot', code: 'RR-02', address: '1201 Innovation Way, Round Rock, TX', phone: '(512) 890-4421' },
      { id: 'loc-3', name: 'San Marcos Fleet Hub', code: 'SM-03', address: '880 River Rd, San Marcos, TX', phone: '(512) 890-4422' },
    ],
    storefront: {
      subdomain: 'apex-hire',
      storeName: 'Apex Equipment Hire & Machinery',
      heroHeading: 'Heavy Duty Equipment Rental, Delivered On-Site',
      heroTagline: 'Excavators, boom lifts, generators, and compaction gear. Servicing Central Texas with 99.4% on-time dispatch.',
      primaryColor: '#1d4ed8',
      contactPhone: '(512) 890-4420',
      contactEmail: 'rentals@apexhire.com',
      pickupAddress: '4500 Industrial Blvd, Austin, TX 78744',
      isOpenForQuotes: true,
      featuredCategoryIds: ['cat-earth', 'cat-aerial', 'cat-power'],
    },
  },
  {
    id: 'org-titan',
    name: 'Titan Plant & Machinery',
    slug: 'titan-plant',
    currency: 'USD',
    timezone: 'America/Denver',
    taxRatePercent: 8.5,
    phone: '+1 (303) 772-9100',
    email: 'dispatch@titanplant.com',
    address: '9200 Rockies Expressway, Denver, CO 80216',
    planTier: 'BUSINESS',
    locations: [
      { id: 'loc-t1', name: 'Denver North Hub', code: 'DEN-01', address: '9200 Rockies Pkwy, Denver, CO', phone: '(303) 772-9100' },
      { id: 'loc-t2', name: 'Aurora Logistics Center', code: 'AUR-02', address: '400 Airport Blvd, Aurora, CO', phone: '(303) 772-9101' },
    ],
    storefront: {
      subdomain: 'titan-plant',
      storeName: 'Titan Plant & Heavy Machinery Hire',
      heroHeading: 'Industrial Mining & Civil Machinery Rental',
      heroTagline: 'Complete fleet solutions for general contractors, civil engineers, and infrastructure projects.',
      primaryColor: '#0f766e',
      contactPhone: '(303) 772-9100',
      contactEmail: 'dispatch@titanplant.com',
      pickupAddress: '9200 Rockies Expressway, Denver, CO 80216',
      isOpenForQuotes: true,
      featuredCategoryIds: ['cat-earth', 'cat-paving', 'cat-power'],
    },
  },
];

const SEED_CATEGORIES: Category[] = [
  { id: 'cat-earth', name: 'Earthmoving & Excavation', slug: 'earthmoving', description: 'Mini excavators, skid steers, backhoes, track loaders' },
  { id: 'cat-aerial', name: 'Aerial & Access Lifts', slug: 'aerial-lifts', description: 'Boom lifts, scissor lifts, vertical mast lifts, telehandlers' },
  { id: 'cat-power', name: 'Power & Generation', slug: 'power-generation', description: 'Towable diesel generators, light towers, air compressors' },
  { id: 'cat-paving', name: 'Compaction & Paving', slug: 'compaction-paving', description: 'Ride-on tandem rollers, plate compactors, trench rammers' },
  { id: 'cat-bulk', name: 'Site Safety & Bulk Gear', slug: 'bulk-equipment', description: 'Trench shoring boxes, crowd barricades, heavy duty cable ramps' },
];

const SEED_EQUIPMENT: EquipmentModel[] = [
  {
    id: 'eq-cat305',
    categoryId: 'cat-earth',
    name: 'Caterpillar 305.5 CR Mini Hydraulic Excavator',
    sku: 'CAT-305-CR',
    makeModel: 'Caterpillar 305.5 CR (5.5 Ton)',
    description: 'Zero tail-swing hydraulic mini excavator with enclosed cab, climate control, thumb attachment, and auxiliary hydraulics. Ideal for trenching and foundation work.',
    imageUrl: 'https://images.unsplash.com/photo-1581094288338-2314dddb7ece?auto=format&fit=crop&w=800&q=80',
    isSerialized: true,
    totalStock: 3,
    dailyRate: 340,
    weeklyRate: 1360,
    monthlyRate: 3900,
    securityDeposit: 600,
    replacementValue: 68000,
    maintenanceIntervalHours: 250,
    meterUnit: 'hours',
    specifications: {
      'Operating Weight': '11,958 lbs (5,424 kg)',
      'Max Dig Depth': '12 ft 7 in (3.84 m)',
      'Engine Power': '45.0 hp (33.6 kW)',
      'Tail Swing': 'Compact / Zero Tail Swing',
      'Bucket Capacity': '0.15 cu yd',
    },
    assetUnits: [
      { id: 'u-cat305-1', equipmentModelId: 'eq-cat305', unitIdentifier: 'EXC-001', serialNumber: 'CAT03055K700142', locationId: 'loc-1', currentMeterHours: 842.5, status: 'AVAILABLE', conditionNote: 'Excellent condition, fresh 800h hydraulic service completed.' },
      { id: 'u-cat305-2', equipmentModelId: 'eq-cat305', unitIdentifier: 'EXC-002', serialNumber: 'CAT03055K700189', locationId: 'loc-1', currentMeterHours: 1120.0, status: 'CHECKED_OUT', conditionNote: 'Checked out on Booking BK-2026-0041 to BuildCraft.' },
      { id: 'u-cat305-3', equipmentModelId: 'eq-cat305', unitIdentifier: 'EXC-003', serialNumber: 'CAT03055K700205', locationId: 'loc-2', currentMeterHours: 490.2, status: 'AVAILABLE', conditionNote: 'Pristine unit stationed at Round Rock.' },
    ],
  },
  {
    id: 'eq-genie-s65',
    categoryId: 'cat-aerial',
    name: 'Genie S-65 TraX 4WD Telescopic Boom Lift',
    sku: 'GEN-S65-TX',
    makeModel: 'Genie S-65 TraX (65ft / 21.8m)',
    description: 'Rough-terrain 4-point track telescopic boom lift providing 71 ft working height and 56 ft 2 in horizontal reach. Outstanding mud and rough ground performance.',
    imageUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80',
    isSerialized: true,
    totalStock: 2,
    dailyRate: 420,
    weeklyRate: 1650,
    monthlyRate: 4700,
    securityDeposit: 800,
    replacementValue: 92000,
    maintenanceIntervalHours: 250,
    meterUnit: 'hours',
    specifications: {
      'Working Height': '71 ft (21.80 m)',
      'Horizontal Reach': '56 ft 2 in (17.10 m)',
      'Lift Capacity': '660 lbs (300 kg)',
      'Drive': 'TraX 4-Point Track System',
      'Power Source': 'Deutz 48 hp Turbo Diesel',
    },
    assetUnits: [
      { id: 'u-s65-1', equipmentModelId: 'eq-genie-s65', unitIdentifier: 'BOM-001', serialNumber: 'S65-TX-98442', locationId: 'loc-1', currentMeterHours: 1410.0, status: 'AVAILABLE', conditionNote: 'Certified annual inspection valid until Oct 2027.' },
      { id: 'u-s65-2', equipmentModelId: 'eq-genie-s65', unitIdentifier: 'BOM-002', serialNumber: 'S65-TX-98510', locationId: 'loc-3', currentMeterHours: 980.4, status: 'MAINTENANCE', conditionNote: 'Scheduled boom cable tension adjustment and 1000h service.' },
    ],
  },
  {
    id: 'eq-bobcat-t770',
    categoryId: 'cat-earth',
    name: 'Bobcat T770 Compact Track Loader',
    sku: 'BOB-T770',
    makeModel: 'Bobcat T770 High-Flow',
    description: 'High-flow auxiliary hydraulic rubber track skid steer with heavy tipping load, enclosed pressurized cab, and 84-inch tooth bucket.',
    imageUrl: 'https://images.unsplash.com/photo-1581094288338-2314dddb7ece?auto=format&fit=crop&w=800&q=80',
    isSerialized: true,
    totalStock: 2,
    dailyRate: 295,
    weeklyRate: 1180,
    monthlyRate: 3400,
    securityDeposit: 500,
    replacementValue: 58000,
    maintenanceIntervalHours: 200,
    meterUnit: 'hours',
    specifications: {
      'Rated Operating Capacity': '3,475 lbs (1,576 kg)',
      'Tipping Load': '9,929 lbs (4,504 kg)',
      'Operating Weight': '10,515 lbs (4,769 kg)',
      'Engine Power': '92 hp Turbo Diesel',
      'Hydraulic Flow': 'High Flow 36.6 gpm',
    },
    assetUnits: [
      { id: 'u-t770-1', equipmentModelId: 'eq-bobcat-t770', unitIdentifier: 'CTL-001', serialNumber: 'B39P11880', locationId: 'loc-1', currentMeterHours: 640.8, status: 'AVAILABLE', conditionNote: 'Tracks at 85% tread. Ready for site.' },
      { id: 'u-t770-2', equipmentModelId: 'eq-bobcat-t770', unitIdentifier: 'CTL-002', serialNumber: 'B39P11942', locationId: 'loc-2', currentMeterHours: 720.0, status: 'RESERVED', conditionNote: 'Reserved for upcoming civil infrastructure contract.' },
    ],
  },
  {
    id: 'eq-mq-gen70',
    categoryId: 'cat-power',
    name: 'Multiquip WhisperWatt 70kVA Sound-Attenuated Diesel Generator',
    sku: 'MQ-DCA70',
    makeModel: 'Multiquip DCA70SSIU4F',
    description: 'Ultra-quiet 70 kVA prime towable diesel generator with multi-voltage selector switch (120/240V single phase, 208/480V 3-phase).',
    imageUrl: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=800&q=80',
    isSerialized: true,
    totalStock: 3,
    dailyRate: 260,
    weeklyRate: 980,
    monthlyRate: 2750,
    securityDeposit: 400,
    replacementValue: 42000,
    maintenanceIntervalHours: 300,
    meterUnit: 'hours',
    specifications: {
      'Prime Output': '56 kW / 70 kVA',
      'Sound Level': '65 dBA at 23 ft',
      'Fuel Tank Capacity': '103 Gallons (24hr run time at 75% load)',
      'Voltage Switch': 'Multi-voltage selector (120V to 480V)',
      'Weight with Fuel': '4,150 lbs',
    },
    assetUnits: [
      { id: 'u-gen70-1', equipmentModelId: 'eq-mq-gen70', unitIdentifier: 'GEN-001', serialNumber: 'MQ70-2024-81', locationId: 'loc-1', currentMeterHours: 1950.0, status: 'AVAILABLE', conditionNote: 'Full fuel tank, load bank tested Oct 2026.' },
      { id: 'u-gen70-2', equipmentModelId: 'eq-mq-gen70', unitIdentifier: 'GEN-002', serialNumber: 'MQ70-2024-82', locationId: 'loc-1', currentMeterHours: 1620.5, status: 'CHECKED_OUT', conditionNote: 'On hire to Horizon Live Event Productions.' },
      { id: 'u-gen70-3', equipmentModelId: 'eq-mq-gen70', unitIdentifier: 'GEN-003', serialNumber: 'MQ70-2025-04', locationId: 'loc-3', currentMeterHours: 420.0, status: 'AVAILABLE', conditionNote: 'Stationed at San Marcos yard.' },
    ],
  },
  {
    id: 'eq-bomag-roller',
    categoryId: 'cat-paving',
    name: 'Bomag BW120AD-5 Tandem Vibratory Asphalt Roller',
    sku: 'BOM-BW120',
    makeModel: 'Bomag BW120AD-5 (47.2 in drum)',
    description: 'Double drum vibratory compaction roller with pressurized water sprinkler system, dual scrapers, and intuitive central control.',
    imageUrl: 'https://images.unsplash.com/photo-1584467735871-8e85353a8413?auto=format&fit=crop&w=800&q=80',
    isSerialized: true,
    totalStock: 2,
    dailyRate: 275,
    weeklyRate: 1050,
    monthlyRate: 2950,
    securityDeposit: 500,
    replacementValue: 46000,
    maintenanceIntervalHours: 250,
    meterUnit: 'hours',
    specifications: {
      'Drum Width': '47.2 in (1,200 mm)',
      'Operating Weight': '5,952 lbs (2,700 kg)',
      'Centrifugal Force': '9,225 lbs',
      'Engine': 'Kubota 33 hp Diesel Tier 4 Final',
      'Water Tank': '58 Gallons',
    },
    assetUnits: [
      { id: 'u-roller-1', equipmentModelId: 'eq-bomag-roller', unitIdentifier: 'ROL-001', serialNumber: 'BW120-0931', locationId: 'loc-1', currentMeterHours: 512.0, status: 'AVAILABLE', conditionNote: 'Drums smooth and clean. Water pumps inspected.' },
      { id: 'u-roller-2', equipmentModelId: 'eq-bomag-roller', unitIdentifier: 'ROL-002', serialNumber: 'BW120-0945', locationId: 'loc-2', currentMeterHours: 890.0, status: 'AVAILABLE', conditionNote: 'Stationed at Round Rock.' },
    ],
  },
  {
    id: 'eq-bulk-ramps',
    categoryId: 'cat-bulk',
    name: 'Heavy-Duty 5-Channel Industrial Cable Protector Ramps (Bundle of 10)',
    sku: 'BLK-RAMP-5CH',
    makeModel: 'UltraTread 5-Channel High-Load (20,000 lbs/axle)',
    description: 'Heavy duty commercial polyurethane cable protectors with yellow safety lid and interlocking connectors. Perfect for festival, film, and construction job sites.',
    imageUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80',
    isSerialized: false, // Bulk item
    totalStock: 25, // 25 bundles in inventory
    dailyRate: 45,
    weeklyRate: 150,
    monthlyRate: 390,
    securityDeposit: 150,
    replacementValue: 1200,
    maintenanceIntervalHours: 0,
    meterUnit: 'units',
    specifications: {
      'Bundle Quantity': '10 Ramps (33 ft total coverage)',
      'Load Rating': '20,000 lbs per axle (heavy trucks)',
      'Channel Size': '1.38 in x 1.38 in each channel',
      'Material': 'Commercial Grade Polyurethane / PVC lid',
    },
  },
];

const SEED_CUSTOMERS: Customer[] = [
  {
    id: 'cust-1',
    name: 'Marcus Vance',
    companyName: 'BuildCraft Commercial Contractors',
    email: 'mvance@buildcrafttx.com',
    phone: '(512) 555-0192',
    billingAddress: '100 Congress Ave Suite 1400, Austin, TX 78701',
    taxId: 'TX-74-8921004',
    creditLimit: 35000,
    currentBalance: 3240,
    notes: 'Premium commercial tier. Approved for Net 30 billing. High volume accounts.',
    isApproved: true,
  },
  {
    id: 'cust-2',
    name: 'Elena Rostova',
    companyName: 'Lone Star Civil Infrastructure LLC',
    email: 'elena@lonestarcivil.com',
    phone: '(512) 555-0144',
    billingAddress: '3400 E 7th St, Austin, TX 78702',
    taxId: 'TX-74-6630129',
    creditLimit: 50000,
    currentBalance: 0,
    notes: 'TxDOT approved contractor. Uses excavators and rollers for roadway repair.',
    isApproved: true,
  },
  {
    id: 'cust-3',
    name: 'Julian Hayes',
    companyName: 'Horizon Live Event Productions',
    email: 'jhayes@horizonevents.org',
    phone: '(512) 555-0188',
    billingAddress: '2201 S Lakeshore Blvd, Austin, TX 78741',
    creditLimit: 20000,
    currentBalance: 1475,
    notes: 'Concert & festival power generation. Requires quiet WhisperWatt generators.',
    isApproved: true,
  },
  {
    id: 'cust-4',
    name: 'David Kim',
    companyName: 'Apex Precision Grading & Landscaping',
    email: 'dkim@apexgrading.com',
    phone: '(512) 555-0163',
    billingAddress: '8100 Burnet Rd, Austin, TX 78757',
    creditLimit: 15000,
    currentBalance: 0,
    notes: 'Regular skid steer and mini ex hirer. Excellent payment record.',
    isApproved: true,
  },
];

const SEED_BOOKINGS: Booking[] = [
  {
    id: 'bk-01',
    bookingNumber: 'BK-2026-0041',
    customerId: 'cust-1',
    customerName: 'Marcus Vance (BuildCraft)',
    customerEmail: 'mvance@buildcrafttx.com',
    customerPhone: '(512) 555-0192',
    locationId: 'loc-1',
    startDate: '2026-11-08',
    endDate: '2026-11-16',
    status: 'CHECKED_OUT',
    items: [
      {
        id: 'bi-1',
        equipmentModelId: 'eq-cat305',
        assetUnitId: 'u-cat305-2',
        equipmentName: 'Caterpillar 305.5 CR Mini Excavator (Unit EXC-002)',
        quantity: 1,
        dailyRate: 340,
        totalDays: 8,
        lineSubtotal: 1360 + 340, // 1 week + 1 day = $1700
        securityDeposit: 600,
      },
    ],
    subtotal: 1700,
    discountPercent: 5,
    discountAmount: 85,
    taxRatePercent: 8.25,
    taxAmount: 141.44,
    deliveryFee: 150,
    pickupFee: 150,
    depositAmount: 600,
    totalAmount: 2056.44, // 1615 + 300 logistics + 141.44 tax
    totalDueNow: 2656.44, // includes $600 refundable deposit
    deliveryAddress: 'Job Site: Austin Medical Tower, 1500 Red River St, Austin, TX',
    customerNotes: 'Deliver by 7:00 AM. Site contact is Mike on (512) 555-9811.',
    internalNotes: 'Dispatched with 36-inch trenching bucket and hydraulic thumb.',
    createdAt: '2026-11-06T14:30:00Z',
    inspections: [
      {
        id: 'insp-1',
        bookingId: 'bk-01',
        type: 'CHECKOUT',
        performedBy: 'Jake Thornton (Yard Mgr)',
        timestamp: '2026-11-08T07:15:00Z',
        meterReading: 1120.0,
        checklist: {
          cleanCondition: true,
          fluidsChecked: true,
          safetyEquipmentOk: true,
          controlsTested: true,
          tiresTracksOk: true,
          accessoriesPresent: true,
        },
        damageCharge: 0,
        cleaningFee: 0,
        refuelFee: 0,
        notes: 'Handover complete. Machine clean, tank 100% full. Customer acknowledged safety guide.',
        customerSignature: 'Marcus Vance [Verified Digital Auth]',
      },
    ],
  },
  {
    id: 'bk-02',
    bookingNumber: 'BK-2026-0042',
    customerId: 'cust-3',
    customerName: 'Julian Hayes (Horizon Live)',
    customerEmail: 'jhayes@horizonevents.org',
    customerPhone: '(512) 555-0188',
    locationId: 'loc-1',
    startDate: '2026-11-10',
    endDate: '2026-11-14',
    status: 'CHECKED_OUT',
    items: [
      {
        id: 'bi-2',
        equipmentModelId: 'eq-mq-gen70',
        assetUnitId: 'u-gen70-2',
        equipmentName: 'Multiquip WhisperWatt 70kVA Generator (Unit GEN-002)',
        quantity: 1,
        dailyRate: 260,
        totalDays: 4,
        lineSubtotal: 1040,
        securityDeposit: 400,
      },
      {
        id: 'bi-3',
        equipmentModelId: 'eq-bulk-ramps',
        equipmentName: 'Heavy-Duty 5-Channel Cable Ramps (Bundle of 10)',
        quantity: 3, // 3 bundles
        dailyRate: 45,
        totalDays: 4,
        lineSubtotal: 540,
        securityDeposit: 450,
      },
    ],
    subtotal: 1580,
    discountPercent: 0,
    discountAmount: 0,
    taxRatePercent: 8.25,
    taxAmount: 142.73,
    deliveryFee: 75,
    pickupFee: 75,
    depositAmount: 850,
    totalAmount: 1872.73,
    totalDueNow: 2722.73,
    deliveryAddress: 'Zilker Park Main Stage, Austin, TX',
    customerNotes: 'Event load-in requires sound-attenuated unit tested to 65 dBA.',
    createdAt: '2026-11-09T09:00:00Z',
  },
  {
    id: 'bk-03',
    bookingNumber: 'BK-2026-0043',
    customerId: 'cust-2',
    customerName: 'Elena Rostova (Lone Star Civil)',
    customerEmail: 'elena@lonestarcivil.com',
    customerPhone: '(512) 555-0144',
    locationId: 'loc-2',
    startDate: '2026-11-18',
    endDate: '2026-11-22',
    status: 'CONFIRMED',
    items: [
      {
        id: 'bi-4',
        equipmentModelId: 'eq-bobcat-t770',
        assetUnitId: 'u-t770-2',
        equipmentName: 'Bobcat T770 Track Loader (Unit CTL-002)',
        quantity: 1,
        dailyRate: 295,
        totalDays: 4,
        lineSubtotal: 1180,
        securityDeposit: 500,
      },
    ],
    subtotal: 1180,
    discountPercent: 10,
    discountAmount: 118,
    taxRatePercent: 8.25,
    taxAmount: 99.99,
    deliveryFee: 75,
    pickupFee: 75,
    depositAmount: 500,
    totalAmount: 1311.99,
    totalDueNow: 1811.99,
    deliveryAddress: 'FM 1431 Highway Expansion Project, Round Rock, TX',
    createdAt: '2026-11-10T11:20:00Z',
  },
  {
    id: 'bk-04',
    bookingNumber: 'BK-2026-0044',
    customerId: 'cust-4',
    customerName: 'David Kim (Apex Grading)',
    customerEmail: 'dkim@apexgrading.com',
    customerPhone: '(512) 555-0163',
    locationId: 'loc-1',
    startDate: '2026-11-25',
    endDate: '2026-11-28',
    status: 'REQUEST',
    items: [
      {
        id: 'bi-5',
        equipmentModelId: 'eq-cat305',
        equipmentName: 'Caterpillar 305.5 CR Mini Excavator',
        quantity: 1,
        dailyRate: 340,
        totalDays: 3,
        lineSubtotal: 1020,
        securityDeposit: 600,
      },
    ],
    subtotal: 1020,
    discountPercent: 0,
    discountAmount: 0,
    taxRatePercent: 8.25,
    taxAmount: 96.53,
    deliveryFee: 75,
    pickupFee: 75,
    depositAmount: 600,
    totalAmount: 1266.53,
    totalDueNow: 1866.53,
    customerNotes: 'Online Storefront Quote Request. Requesting customer pickup from Central Yard.',
    createdAt: '2026-11-11T10:15:00Z',
  },
];

const SEED_INVOICES: Invoice[] = [
  {
    id: 'inv-01',
    invoiceNumber: 'INV-2026-0041',
    bookingId: 'bk-01',
    bookingNumber: 'BK-2026-0041',
    customerId: 'cust-1',
    customerName: 'BuildCraft Commercial Contractors',
    customerEmail: 'mvance@buildcrafttx.com',
    status: 'PARTIALLY_PAID',
    subtotal: 1700,
    taxAmount: 141.44,
    deliveryFee: 300,
    depositHeld: 600,
    totalDue: 2656.44,
    amountPaid: 1000,
    dueDate: '2026-11-20',
    issuedDate: '2026-11-08',
    payments: [
      {
        id: 'pay-1',
        invoiceId: 'inv-01',
        amount: 1000,
        paymentMethod: 'BANK_TRANSFER',
        referenceCode: 'ACH-889021-BC',
        date: '2026-11-08T10:00:00Z',
      },
    ],
  },
  {
    id: 'inv-02',
    invoiceNumber: 'INV-2026-0042',
    bookingId: 'bk-02',
    bookingNumber: 'BK-2026-0042',
    customerId: 'cust-3',
    customerName: 'Horizon Live Event Productions',
    customerEmail: 'jhayes@horizonevents.org',
    status: 'PAID',
    subtotal: 1580,
    taxAmount: 142.73,
    deliveryFee: 150,
    depositHeld: 850,
    totalDue: 2722.73,
    amountPaid: 2722.73,
    dueDate: '2026-11-10',
    issuedDate: '2026-11-09',
    payments: [
      {
        id: 'pay-2',
        invoiceId: 'inv-02',
        amount: 2722.73,
        paymentMethod: 'CREDIT_CARD',
        referenceCode: 'AUTH-VISA-9042',
        date: '2026-11-09T14:45:00Z',
      },
    ],
  },
];

const SEED_MAINTENANCE: MaintenanceWorkOrder[] = [
  {
    id: 'maint-1',
    orderNumber: 'WO-2026-0012',
    assetUnitId: 'u-s65-2',
    equipmentName: 'Genie S-65 TraX (BOM-002)',
    unitIdentifier: 'BOM-002',
    title: '1,000-Hour Hydraulic Overhaul & Cable Rigging Inspection',
    description: 'Inspect boom extension cables, calibrate platform overload pressure sensors, replace hydraulic return filters, fluid analysis.',
    technician: 'Carlos Mendez (Senior Field Tech)',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    scheduledDate: '2026-11-10',
    currentHoursAtService: 980.4,
    costParts: 480,
    costLabor: 350,
  },
  {
    id: 'maint-2',
    orderNumber: 'WO-2026-0011',
    assetUnitId: 'u-cat305-1',
    equipmentName: 'Caterpillar 305.5 CR (EXC-001)',
    unitIdentifier: 'EXC-001',
    title: '250-Hour Engine Oil & Fuel Filter Service',
    description: 'Replaced 15W-40 engine oil, fuel water separator, greased slew ring bearing and bucket pivot pins.',
    technician: 'Ray Henderson',
    status: 'COMPLETED',
    priority: 'MEDIUM',
    scheduledDate: '2026-11-02',
    completedDate: '2026-11-02',
    currentHoursAtService: 820.0,
    costParts: 145,
    costLabor: 120,
  },
];

export const RentFlowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [organizations, setOrganizations] = useState<Organization[]>(() => {
    const saved = localStorage.getItem('rentflow_orgs');
    return saved ? JSON.parse(saved) : SEED_ORGANIZATIONS;
  });

  const [currentOrgId, setCurrentOrgId] = useState<string>(() => {
    return localStorage.getItem('rentflow_current_org_id') || 'org-apex';
  });

  const [currentRole, setCurrentRole] = useState<UserRole>('ORG_OWNER');
  const [activeView, setActiveView] = useState<string>('dashboard');

  const [categories, setCategories] = useState<Category[]>(() => {
    const saved = localStorage.getItem('rentflow_categories');
    return saved ? JSON.parse(saved) : SEED_CATEGORIES;
  });

  const [equipmentList, setEquipmentList] = useState<EquipmentModel[]>(() => {
    const saved = localStorage.getItem('rentflow_equipment');
    return saved ? JSON.parse(saved) : SEED_EQUIPMENT;
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem('rentflow_customers');
    return saved ? JSON.parse(saved) : SEED_CUSTOMERS;
  });

  const [bookings, setBookings] = useState<Booking[]>(() => {
    const saved = localStorage.getItem('rentflow_bookings');
    return saved ? JSON.parse(saved) : SEED_BOOKINGS;
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const saved = localStorage.getItem('rentflow_invoices');
    return saved ? JSON.parse(saved) : SEED_INVOICES;
  });

  const [maintenanceOrders, setMaintenanceOrders] = useState<MaintenanceWorkOrder[]>(() => {
    const saved = localStorage.getItem('rentflow_maintenance');
    return saved ? JSON.parse(saved) : SEED_MAINTENANCE;
  });

  // Save to localStorage whenever states change
  useEffect(() => {
    localStorage.setItem('rentflow_orgs', JSON.stringify(organizations));
  }, [organizations]);

  useEffect(() => {
    localStorage.setItem('rentflow_current_org_id', currentOrgId);
  }, [currentOrgId]);

  useEffect(() => {
    localStorage.setItem('rentflow_equipment', JSON.stringify(equipmentList));
  }, [equipmentList]);

  useEffect(() => {
    localStorage.setItem('rentflow_customers', JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem('rentflow_bookings', JSON.stringify(bookings));
  }, [bookings]);

  useEffect(() => {
    localStorage.setItem('rentflow_invoices', JSON.stringify(invoices));
  }, [invoices]);

  useEffect(() => {
    localStorage.setItem('rentflow_maintenance', JSON.stringify(maintenanceOrders));
  }, [maintenanceOrders]);

  const currentOrg = organizations.find((o) => o.id === currentOrgId) || organizations[0];

  const switchOrganization = (orgId: string) => {
    setCurrentOrgId(orgId);
  };

  const addEquipment = (newItem: Omit<EquipmentModel, 'id'>) => {
    const id = `eq-${Date.now()}`;
    const created: EquipmentModel = {
      ...newItem,
      id,
      assetUnits: newItem.isSerialized
        ? Array.from({ length: newItem.totalStock || 1 }).map((_, i) => ({
            id: `u-${id}-${i + 1}`,
            equipmentModelId: id,
            unitIdentifier: `${newItem.sku.slice(0, 3).toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
            serialNumber: `SN-${Date.now().toString().slice(-6)}-${i + 1}`,
            locationId: currentOrg.locations[0]?.id || 'loc-1',
            currentMeterHours: 0,
            status: 'AVAILABLE',
            conditionNote: 'New unit added to fleet inventory.',
          }))
        : undefined,
    };
    setEquipmentList((prev) => [created, ...prev]);
  };

  const updateEquipment = (id: string, updates: Partial<EquipmentModel>) => {
    setEquipmentList((prev) =>
      prev.map((eq) => (eq.id === id ? { ...eq, ...updates } : eq))
    );
  };

  const deleteEquipment = (id: string) => {
    setEquipmentList((prev) => prev.filter((eq) => eq.id !== id));
  };

  const addCustomer = (customerData: Omit<Customer, 'id' | 'currentBalance'>) => {
    const newCust: Customer = {
      ...customerData,
      id: `cust-${Date.now()}`,
      currentBalance: 0,
    };
    setCustomers((prev) => [newCust, ...prev]);
  };

  const updateCustomer = (id: string, updates: Partial<Customer>) => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const createBooking = (
    bookingData: Omit<Booking, 'id' | 'bookingNumber' | 'createdAt'>
  ): Booking => {
    const sequence = bookings.length + 45;
    const bookingNumber = `BK-2026-${String(sequence).padStart(4, '0')}`;
    const newBooking: Booking = {
      ...bookingData,
      id: `bk-${Date.now()}`,
      bookingNumber,
      createdAt: new Date().toISOString(),
    };

    setBookings((prev) => [newBooking, ...prev]);

    // Update equipment status if confirmed
    if (newBooking.status === 'CONFIRMED' || newBooking.status === 'CHECKED_OUT') {
      newBooking.items.forEach((item) => {
        if (item.assetUnitId) {
          setEquipmentList((prev) =>
            prev.map((eq) => {
              if (eq.id === item.equipmentModelId && eq.assetUnits) {
                return {
                  ...eq,
                  assetUnits: eq.assetUnits.map((u) =>
                    u.id === item.assetUnitId
                      ? {
                          ...u,
                          status: newBooking.status === 'CHECKED_OUT' ? 'CHECKED_OUT' : 'RESERVED',
                        }
                      : u
                  ),
                };
              }
              return eq;
            })
          );
        }
      });
    }

    // Automatically generate invoice
    const invSequence = invoices.length + 45;
    const invoiceNumber = `INV-2026-${String(invSequence).padStart(4, '0')}`;
    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber,
      bookingId: newBooking.id,
      bookingNumber: newBooking.bookingNumber,
      customerId: newBooking.customerId,
      customerName: newBooking.customerName,
      customerEmail: newBooking.customerEmail,
      status: 'SENT',
      subtotal: newBooking.subtotal - newBooking.discountAmount,
      taxAmount: newBooking.taxAmount,
      deliveryFee: newBooking.deliveryFee + newBooking.pickupFee,
      depositHeld: newBooking.depositAmount,
      totalDue: newBooking.totalDueNow,
      amountPaid: 0,
      dueDate: newBooking.startDate,
      issuedDate: new Date().toISOString().split('T')[0],
      payments: [],
    };
    setInvoices((prev) => [newInvoice, ...prev]);

    return newBooking;
  };

  const updateBookingStatus = (id: string, status: Booking['status']) => {
    setBookings((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        return { ...b, status };
      })
    );

    // If returned or closed, free up asset units
    if (status === 'RETURNED' || status === 'CLOSED' || status === 'CANCELLED') {
      const target = bookings.find((b) => b.id === id);
      if (target) {
        target.items.forEach((item) => {
          if (item.assetUnitId) {
            setEquipmentList((prev) =>
              prev.map((eq) => {
                if (eq.id === item.equipmentModelId && eq.assetUnits) {
                  return {
                    ...eq,
                    assetUnits: eq.assetUnits.map((u) =>
                      u.id === item.assetUnitId
                        ? { ...u, status: 'AVAILABLE' }
                        : u
                    ),
                  };
                }
                return eq;
              })
            );
          }
        });
      }
    }
  };

  const processCheckoutInspection = (
    bookingId: string,
    record: Omit<InspectionRecord, 'id' | 'timestamp' | 'type'>
  ) => {
    const fullRecord: InspectionRecord = {
      ...record,
      id: `insp-${Date.now()}`,
      type: 'CHECKOUT',
      timestamp: new Date().toISOString(),
    };

    setBookings((prev) =>
      prev.map((b) => {
        if (b.id !== bookingId) return b;
        return {
          ...b,
          status: 'CHECKED_OUT',
          inspections: [...(b.inspections || []), fullRecord],
        };
      })
    );

    // Set asset unit to CHECKED_OUT and update meter
    const targetBooking = bookings.find((b) => b.id === bookingId);
    if (targetBooking) {
      targetBooking.items.forEach((item) => {
        if (item.assetUnitId) {
          setEquipmentList((prev) =>
            prev.map((eq) => {
              if (eq.id === item.equipmentModelId && eq.assetUnits) {
                return {
                  ...eq,
                  assetUnits: eq.assetUnits.map((u) =>
                    u.id === item.assetUnitId
                      ? {
                          ...u,
                          status: 'CHECKED_OUT',
                          currentMeterHours: record.meterReading || u.currentMeterHours,
                        }
                      : u
                  ),
                };
              }
              return eq;
            })
          );
        }
      });
    }
  };

  const processReturnInspection = (
    bookingId: string,
    record: Omit<InspectionRecord, 'id' | 'timestamp' | 'type'>,
    damageCharge: number,
    cleaningFee: number,
    refuelFee: number
  ) => {
    const fullRecord: InspectionRecord = {
      ...record,
      id: `insp-${Date.now()}`,
      type: 'RETURN',
      timestamp: new Date().toISOString(),
      damageCharge,
      cleaningFee,
      refuelFee,
    };

    setBookings((prev) =>
      prev.map((b) => {
        if (b.id !== bookingId) return b;
        const deposit = b.depositAmount;
        const totalCharges = damageCharge + cleaningFee + refuelFee;
        const depositRefunded = Math.max(0, deposit - totalCharges);

        return {
          ...b,
          status: 'RETURNED',
          depositRefunded,
          depositSettled: true,
          inspections: [...(b.inspections || []), fullRecord],
        };
      })
    );

    // Free equipment or mark maintenance if damaged
    const target = bookings.find((b) => b.id === bookingId);
    if (target) {
      target.items.forEach((item) => {
        if (item.assetUnitId) {
          setEquipmentList((prev) =>
            prev.map((eq) => {
              if (eq.id === item.equipmentModelId && eq.assetUnits) {
                return {
                  ...eq,
                  assetUnits: eq.assetUnits.map((u) =>
                    u.id === item.assetUnitId
                      ? {
                          ...u,
                          status: damageCharge > 0 ? 'MAINTENANCE' : 'AVAILABLE',
                          currentMeterHours: record.meterReading || u.currentMeterHours,
                          conditionNote:
                            damageCharge > 0
                              ? `Returned with damage: ${record.damageDescription || 'Flagged during return inspection'}`
                              : 'Returned clean and inspected. Available for hire.',
                        }
                      : u
                  ),
                };
              }
              return eq;
            })
          );
        }
      });
    }
  };

  const createInvoice = (
    invoiceData: Omit<Invoice, 'id' | 'invoiceNumber' | 'issuedDate' | 'payments' | 'amountPaid'>
  ): Invoice => {
    const invSeq = invoices.length + 50;
    const invoiceNumber = `INV-2026-${String(invSeq).padStart(4, '0')}`;
    const newInvoice: Invoice = {
      ...invoiceData,
      id: `inv-${Date.now()}`,
      invoiceNumber,
      issuedDate: new Date().toISOString().split('T')[0],
      amountPaid: 0,
      payments: [],
    };
    setInvoices((prev) => [newInvoice, ...prev]);
    return newInvoice;
  };

  const recordPayment = (
    invoiceId: string,
    payment: Omit<PaymentRecord, 'id' | 'invoiceId' | 'date'>
  ) => {
    const newPayment: PaymentRecord = {
      ...payment,
      id: `pay-${Date.now()}`,
      invoiceId,
      date: new Date().toISOString(),
    };

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id !== invoiceId) return inv;
        const updatedPaid = inv.amountPaid + payment.amount;
        const newStatus =
          updatedPaid >= inv.totalDue
            ? 'PAID'
            : updatedPaid > 0
            ? 'PARTIALLY_PAID'
            : inv.status;

        return {
          ...inv,
          amountPaid: updatedPaid,
          status: newStatus,
          payments: [...inv.payments, newPayment],
        };
      })
    );
  };

  const createMaintenanceOrder = (
    orderData: Omit<MaintenanceWorkOrder, 'id' | 'orderNumber'>
  ) => {
    const orderSeq = maintenanceOrders.length + 15;
    const orderNumber = `WO-2026-${String(orderSeq).padStart(4, '0')}`;
    const newOrder: MaintenanceWorkOrder = {
      ...orderData,
      id: `wo-${Date.now()}`,
      orderNumber,
    };
    setMaintenanceOrders((prev) => [newOrder, ...prev]);

    // Mark unit as in maintenance
    setEquipmentList((prev) =>
      prev.map((eq) => {
        if (eq.assetUnits) {
          return {
            ...eq,
            assetUnits: eq.assetUnits.map((u) =>
              u.id === orderData.assetUnitId ? { ...u, status: 'MAINTENANCE' } : u
            ),
          };
        }
        return eq;
      })
    );
  };

  const updateMaintenanceStatus = (
    id: string,
    status: MaintenanceWorkOrder['status']
  ) => {
    setMaintenanceOrders((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        return {
          ...m,
          status,
          completedDate: status === 'COMPLETED' ? new Date().toISOString().split('T')[0] : m.completedDate,
        };
      })
    );

    if (status === 'COMPLETED') {
      const target = maintenanceOrders.find((m) => m.id === id);
      if (target) {
        setEquipmentList((prev) =>
          prev.map((eq) => {
            if (eq.assetUnits) {
              return {
                ...eq,
                assetUnits: eq.assetUnits.map((u) =>
                  u.id === target.assetUnitId ? { ...u, status: 'AVAILABLE', conditionNote: 'Servicing complete. Certified ready for dispatch.' } : u
                ),
              };
            }
            return eq;
          })
        );
      }
    }
  };

  const updateStorefront = (settings: Partial<Organization['storefront']>) => {
    setOrganizations((prev) =>
      prev.map((org) => {
        if (org.id !== currentOrgId) return org;
        return {
          ...org,
          storefront: {
            ...org.storefront,
            ...settings,
          },
        };
      })
    );
  };

  const resetToDemoDefaults = () => {
    localStorage.removeItem('rentflow_orgs');
    localStorage.removeItem('rentflow_current_org_id');
    localStorage.removeItem('rentflow_equipment');
    localStorage.removeItem('rentflow_customers');
    localStorage.removeItem('rentflow_bookings');
    localStorage.removeItem('rentflow_invoices');
    localStorage.removeItem('rentflow_maintenance');

    setOrganizations(SEED_ORGANIZATIONS);
    setCurrentOrgId('org-apex');
    setCategories(SEED_CATEGORIES);
    setEquipmentList(SEED_EQUIPMENT);
    setCustomers(SEED_CUSTOMERS);
    setBookings(SEED_BOOKINGS);
    setInvoices(SEED_INVOICES);
    setMaintenanceOrders(SEED_MAINTENANCE);
    setCurrentRole('ORG_OWNER');
    setActiveView('dashboard');
  };

  return (
    <RentFlowContext.Provider
      value={{
        currentOrg,
        organizations,
        currentRole,
        categories,
        equipmentList,
        customers,
        bookings,
        invoices,
        maintenanceOrders,
        activeView,
        setActiveView,
        setCurrentRole,
        switchOrganization,
        addEquipment,
        updateEquipment,
        deleteEquipment,
        addCustomer,
        updateCustomer,
        createBooking,
        updateBookingStatus,
        processCheckoutInspection,
        processReturnInspection,
        createInvoice,
        recordPayment,
        createMaintenanceOrder,
        updateMaintenanceStatus,
        updateStorefront,
        resetToDemoDefaults,
      }}
    >
      {children}
    </RentFlowContext.Provider>
  );
};

export const useRentFlow = () => {
  const context = useContext(RentFlowContext);
  if (!context) {
    throw new Error('useRentFlow must be used within a RentFlowProvider');
  }
  return context;
};
