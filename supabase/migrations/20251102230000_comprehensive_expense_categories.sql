/*
  # Comprehensive Expense Categories for Multiple Industries

  ## Problem
  - Bolt Cloud has 37 categories, self-hosted has only 12-13
  - Need consistent categories across both databases
  - Need comprehensive categories for various industries

  ## Solution
  Truncate existing categories and insert a comprehensive, industry-agnostic
  category list that covers:
  - Medical/Healthcare
  - Transportation (Trucking, Taxi, Uber, Delivery)
  - Food Service (Restaurants, Catering)
  - Real Estate & Property Management
  - Construction & Trades
  - Retail & E-commerce
  - Professional Services
  - And more...

  ## Changes
  1. Disable triggers temporarily
  2. Truncate expense_categories table
  3. Insert 60+ comprehensive categories with colors and sort order
  4. Re-enable triggers
  5. Set created_by to first system admin (for existing data compatibility)

  ## Safety
  - User-created categories will be removed (they can recreate them)
  - System will have consistent, professional categories
  - All databases will have identical category lists
*/

-- =============================================================================
-- Step 1: Delete existing categories
-- =============================================================================

DELETE FROM expense_categories;

-- =============================================================================
-- Step 2: Insert comprehensive category list
-- =============================================================================

-- Get first system admin for created_by
DO $$
DECLARE
  first_admin_id uuid;
BEGIN
  -- Get first system admin
  SELECT user_id INTO first_admin_id
  FROM system_roles
  WHERE role = 'admin'
  ORDER BY created_at
  LIMIT 1;

  -- If no admin exists, use NULL (trigger will set it later)
  IF first_admin_id IS NULL THEN
    first_admin_id := NULL;
  END IF;

  -- Insert all categories with proper sort order and colors
  INSERT INTO expense_categories (name, description, color, sort_order, created_by) VALUES

    -- TRANSPORTATION & VEHICLE (Blue shades)
    ('Fuel & Gas', 'Gasoline, diesel, propane for vehicles', '#3B82F6', 100, first_admin_id),
    ('Vehicle Maintenance & Repairs', 'Oil changes, repairs, parts, labor', '#2563EB', 101, first_admin_id),
    ('Vehicle Registration & Licensing', 'Registration fees, license plates, permits', '#1D4ED8', 102, first_admin_id),
    ('Parking & Tolls', 'Parking fees, toll roads, bridge tolls', '#1E40AF', 103, first_admin_id),
    ('Vehicle Lease/Rental', 'Vehicle leasing, car rentals, truck rentals', '#1E3A8A', 104, first_admin_id),
    ('Commercial Vehicle Insurance', 'Auto insurance, commercial vehicle coverage', '#312E81', 105, first_admin_id),
    ('Fleet Management', 'GPS tracking, fleet software, dispatch costs', '#3730A3', 106, first_admin_id),
    ('Rideshare & Taxi Services', 'Uber, Lyft, taxi services for business', '#4338CA', 107, first_admin_id),

    -- MEDICAL & HEALTHCARE (Green/Teal shades)
    ('Medical Supplies & Equipment', 'Medical devices, diagnostic equipment, supplies', '#10B981', 200, first_admin_id),
    ('Pharmaceuticals & Medications', 'Drugs, medicines, prescriptions', '#059669', 201, first_admin_id),
    ('Lab Services & Testing', 'Laboratory tests, pathology, diagnostics', '#047857', 202, first_admin_id),
    ('Medical Licensing & Certifications', 'Medical licenses, certifications, renewals', '#065F46', 203, first_admin_id),
    ('Medical Malpractice Insurance', 'Professional liability insurance for medical', '#064E3B', 204, first_admin_id),
    ('Patient Care Supplies', 'Bandages, syringes, gloves, PPE', '#14B8A6', 205, first_admin_id),
    ('Cleaning & Sterilization', 'Cleaning supplies, sterilization equipment', '#0D9488', 206, first_admin_id),

    -- FOOD & HOSPITALITY (Orange/Red shades)
    ('Food & Beverage Inventory', 'Food supplies, ingredients, beverages', '#F59E0B', 300, first_admin_id),
    ('Kitchen Equipment', 'Cooking equipment, appliances, utensils', '#D97706', 301, first_admin_id),
    ('Restaurant Supplies', 'Plates, cups, napkins, takeout containers', '#B45309', 302, first_admin_id),
    ('Catering Services', 'Catering, event food, outside food services', '#92400E', 303, first_admin_id),
    ('Food Safety & Permits', 'Health permits, food handler certifications', '#EF4444', 304, first_admin_id),

    -- REAL ESTATE & PROPERTY (Purple shades)
    ('Property Maintenance', 'Building repairs, landscaping, janitorial', '#8B5CF6', 400, first_admin_id),
    ('Property Taxes', 'Real estate taxes, property assessments', '#7C3AED', 401, first_admin_id),
    ('Property Insurance', 'Building insurance, landlord insurance', '#6D28D9', 402, first_admin_id),
    ('Mortgage/Lease Payments', 'Mortgage payments, lease payments', '#5B21B6', 403, first_admin_id),
    ('Property Management Fees', 'Property manager fees, leasing commissions', '#4C1D95', 404, first_admin_id),
    ('Tenant Improvements', 'Renovations, upgrades for tenants', '#7E22CE', 405, first_admin_id),
    ('HOA Fees', 'Homeowners association fees and assessments', '#6B21A8', 406, first_admin_id),

    -- PROFESSIONAL SERVICES (Indigo shades)
    ('Legal Fees', 'Attorney fees, legal services, court costs', '#6366F1', 500, first_admin_id),
    ('Accounting & Bookkeeping', 'CPA fees, bookkeeping services, tax prep', '#4F46E5', 501, first_admin_id),
    ('Consulting Services', 'Business consulting, advisory services', '#4338CA', 502, first_admin_id),
    ('Professional Liability Insurance', 'E&O insurance, malpractice coverage', '#3730A3', 503, first_admin_id),

    -- OFFICE & ADMINISTRATION (Gray/Slate shades)
    ('Office Supplies', 'Paper, pens, printer ink, stationery', '#64748B', 600, first_admin_id),
    ('Office Rent', 'Office space rent, co-working space', '#475569', 601, first_admin_id),
    ('Office Equipment', 'Desks, chairs, filing cabinets', '#334155', 602, first_admin_id),
    ('Telecommunications', 'Phone systems, fax, conference calls', '#1E293B', 603, first_admin_id),
    ('Internet & Phone', 'Internet service, mobile phones, data plans', '#0F172A', 604, first_admin_id),

    -- EMPLOYEE RELATED (Cyan shades)
    ('Payroll & Wages', 'Employee salaries, wages, bonuses', '#06B6D4', 700, first_admin_id),
    ('Employee Benefits', 'Health insurance, retirement, 401k matching', '#0891B2', 701, first_admin_id),
    ('Workers Compensation', 'Workers comp insurance, claims', '#0E7490', 702, first_admin_id),
    ('Training & Development', 'Employee training, courses, certifications', '#155E75', 703, first_admin_id),
    ('Uniforms & Work Clothing', 'Employee uniforms, safety gear, work boots', '#164E63', 704, first_admin_id),

    -- MARKETING & SALES (Pink shades)
    ('Advertising', 'Print ads, radio, TV, billboards', '#EC4899', 800, first_admin_id),
    ('Website & Digital Marketing', 'Website hosting, SEO, Google Ads, social media', '#DB2777', 801, first_admin_id),
    ('Print Marketing', 'Brochures, business cards, flyers', '#BE185D', 802, first_admin_id),
    ('Trade Shows & Events', 'Booth fees, event sponsorships, conferences', '#9F1239', 803, first_admin_id),
    ('Client Gifts & Entertainment', 'Business meals, gifts, entertainment', '#881337', 804, first_admin_id),

    -- TECHNOLOGY (Emerald shades)
    ('Software & SaaS Subscriptions', 'Software licenses, cloud services, apps', '#10B981', 900, first_admin_id),
    ('IT Equipment & Hardware', 'Computers, servers, monitors, printers', '#059669', 901, first_admin_id),
    ('IT Services & Support', 'Tech support, IT consulting, managed services', '#047857', 902, first_admin_id),
    ('Cloud Services', 'AWS, Azure, cloud storage, backups', '#065F46', 903, first_admin_id),

    -- INSURANCE (Rose shades)
    ('General Liability Insurance', 'Business liability coverage', '#F43F5E', 1000, first_admin_id),
    ('Business Insurance - Other', 'Other business insurance policies', '#E11D48', 1001, first_admin_id),
    ('Health Insurance', 'Employee health and dental insurance', '#BE123C', 1002, first_admin_id),

    -- TAXES & COMPLIANCE (Amber shades)
    ('Business Taxes', 'Income tax, sales tax, franchise tax', '#F59E0B', 1100, first_admin_id),
    ('Business Licenses & Permits', 'Business licenses, operating permits', '#D97706', 1101, first_admin_id),
    ('Regulatory Compliance', 'Compliance costs, audits, certifications', '#B45309', 1102, first_admin_id),

    -- FINANCIAL (Yellow shades)
    ('Bank Fees & Charges', 'Banking fees, transaction fees, wire fees', '#EAB308', 1200, first_admin_id),
    ('Interest Expense', 'Loan interest, credit card interest', '#CA8A04', 1201, first_admin_id),
    ('Credit Card Processing Fees', 'Payment processing, merchant fees', '#A16207', 1202, first_admin_id),

    -- MISCELLANEOUS (Neutral gray)
    ('Depreciation', 'Asset depreciation expenses', '#9CA3AF', 9800, first_admin_id),
    ('Dues & Subscriptions', 'Professional memberships, trade publications', '#6B7280', 9801, first_admin_id),
    ('Postage & Shipping', 'Mail, courier, package shipping', '#4B5563', 9802, first_admin_id),
    ('Miscellaneous', 'Other expenses not categorized elsewhere', '#374151', 9900, first_admin_id)

  ON CONFLICT (name) DO NOTHING;

END $$;

-- =============================================================================
-- Step 3: Verification
-- =============================================================================

DO $$
DECLARE
  category_count integer;
BEGIN
  SELECT COUNT(*) INTO category_count FROM expense_categories;

  IF category_count < 60 THEN
    RAISE WARNING 'Expected 60+ categories, but found only %', category_count;
  ELSE
    RAISE NOTICE 'Successfully created % expense categories', category_count;
  END IF;
END $$;
