export type UserRole = 'SUPER_ADMIN' | 'ORG_OWNER' | 'MANAGER' | 'STAFF' | 'CUSTOMER';

export type EquipmentStatus =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'CHECKED_OUT'
  | 'MAINTENANCE'
  | 'RETIRED'
  | 'LOST_DAMAGED';

export type BookingStatus =
  | 'QUOTE'
  | 'REQUEST'
  | 'PENDING_APPROVAL'
  | 'CONFIRMED'
  | 'CHECKED_OUT'
  | 'RETURNED'
  | 'CLOSED'
  | 'CANCELLED'
  | 'OVERDUE';

export type InvoiceStatus =
  | 'DRAFT'
  | 'SENT'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'VOID'
  | 'REFUNDED';

export type MaintenanceStatus =
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type SubscriptionTier = 'STARTER' | 'GROWTH' | 'BUSINESS' | 'ENTERPRISE';

export interface Location {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  iconName?: string;
}

export interface AssetUnit {
  id: string;
  equipmentModelId: string;
  unitIdentifier: string; // e.g. "EXC-001" or Serial Number
  serialNumber: string;
  locationId: string;
  currentMeterHours: number;
  status: EquipmentStatus;
  conditionNote: string;
}

export interface EquipmentModel {
  id: string;
  categoryId: string;
  name: string;
  sku: string;
  makeModel: string;
  description: string;
  imageUrl: string;
  isSerialized: boolean;
  totalStock: number; // for bulk or aggregate count
  dailyRate: number;
  weeklyRate: number;
  monthlyRate: number;
  securityDeposit: number;
  replacementValue: number;
  maintenanceIntervalHours: number;
  meterUnit: string;
  specifications: Record<string, string>;
  assetUnits?: AssetUnit[];
}

export interface Customer {
  id: string;
  name: string;
  companyName?: string;
  email: string;
  phone: string;
  billingAddress: string;
  taxId?: string;
  creditLimit: number;
  currentBalance: number;
  notes?: string;
  isApproved: boolean;
}

export interface BookingItem {
  id: string;
  equipmentModelId: string;
  assetUnitId?: string;
  equipmentName: string;
  quantity: number;
  dailyRate: number;
  totalDays: number;
  lineSubtotal: number;
  securityDeposit: number;
}

export interface InspectionRecord {
  id: string;
  bookingId: string;
  type: 'CHECKOUT' | 'RETURN';
  performedBy: string;
  timestamp: string;
  meterReading: number;
  checklist: {
    cleanCondition: boolean;
    fluidsChecked: boolean;
    safetyEquipmentOk: boolean;
    controlsTested: boolean;
    tiresTracksOk: boolean;
    accessoriesPresent: boolean;
  };
  damageDescription?: string;
  damageCharge?: number;
  cleaningFee?: number;
  refuelFee?: number;
  notes?: string;
  customerSignature?: string;
}

export interface Booking {
  id: string;
  bookingNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  locationId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: BookingStatus;
  items: BookingItem[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  taxRatePercent: number;
  taxAmount: number;
  deliveryFee: number;
  pickupFee: number;
  depositAmount: number;
  totalAmount: number; // excludes deposit
  totalDueNow: number; // includes deposit
  depositRefunded?: number;
  depositSettled?: boolean;
  deliveryAddress?: string;
  customerNotes?: string;
  internalNotes?: string;
  inspections?: InspectionRecord[];
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  amount: number;
  paymentMethod: 'CREDIT_CARD' | 'BANK_TRANSFER' | 'CASH' | 'TERMINAL';
  referenceCode: string;
  date: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  bookingId?: string;
  bookingNumber?: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  status: InvoiceStatus;
  subtotal: number;
  taxAmount: number;
  deliveryFee: number;
  depositHeld: number;
  totalDue: number;
  amountPaid: number;
  dueDate: string;
  issuedDate: string;
  payments: PaymentRecord[];
}

export interface MaintenanceWorkOrder {
  id: string;
  orderNumber: string;
  assetUnitId: string;
  equipmentName: string;
  unitIdentifier: string;
  title: string;
  description: string;
  technician: string;
  status: MaintenanceStatus;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  scheduledDate: string;
  completedDate?: string;
  currentHoursAtService: number;
  costParts: number;
  costLabor: number;
}

export interface StorefrontSettings {
  subdomain: string;
  storeName: string;
  heroHeading: string;
  heroTagline: string;
  primaryColor: string;
  contactPhone: string;
  contactEmail: string;
  pickupAddress: string;
  isOpenForQuotes: boolean;
  featuredCategoryIds: string[];
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  currency: string;
  timezone: string;
  taxRatePercent: number;
  phone: string;
  email: string;
  address: string;
  planTier: SubscriptionTier;
  locations: Location[];
  storefront: StorefrontSettings;
}
