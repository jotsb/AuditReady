# AuditReady

A comprehensive receipt management and expense tracking application built with React, TypeScript, and Supabase. AuditReady helps businesses organize receipts, track expenses, and generate professional reports for audit and tax purposes.

## Features

### Receipt Management
- **Upload & Store**: Upload receipt images (JPG, PNG) and PDF files
- **Manual Entry**: Enter receipt details manually when physical receipts aren't available
- **Auto-Extraction**: Automatic data extraction from receipt images using AI
- **Verification**: Review and verify extracted data before saving
- **Edit & Delete**: Modify receipt details or remove receipts with proper audit logging

### Organization
- **Multi-Business Support**: Manage receipts for multiple businesses from one account
- **Collections**: Organize receipts into collections (e.g., "Q1 2024", "Travel Expenses")
- **Categories**: Categorize expenses (Office Supplies, Travel, Meals, etc.)
- **Search & Filter**: Quickly find receipts by date, vendor, category, or business

### Reporting & Export
- **Dashboard Analytics**: Visual breakdown of expenses by category and recent activity
- **CSV Export**: Export receipt data to CSV for spreadsheet analysis
- **PDF Reports**: Generate professional PDF reports with detailed tax information
- **Tax Summary**: View GST/PST totals and tax-ready summaries
- **Year-End Reports**: Comprehensive annual summaries for tax filing

### Security & Compliance
- **Row-Level Security**: Data isolation ensures users only see their own receipts
- **Audit Logging**: Track all changes to receipts (edits, deletions)
- **Secure Storage**: Receipt images stored securely in Supabase Storage
- **Authentication**: Email/password authentication with secure session management

## Technology Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **Authentication**: Supabase Auth
- **AI Processing**: Supabase Edge Functions with PDF.js

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- A Supabase account and project

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd project
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables

Create a `.env` file in the root directory:
```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Run database migrations

The migrations in `supabase/migrations/` will set up the required database schema, including:
- Users and authentication
- Businesses and collections
- Receipts table with full audit trail
- Row-level security policies
- Storage buckets and policies

5. Deploy the Edge Function

The `extract-receipt-data` edge function in `supabase/functions/` handles receipt data extraction.

6. Start the development server
```bash
npm run dev
```

7. Build for production
```bash
npm run build
```

## Project Structure

```
src/
├── components/
│   ├── auth/           # Login and registration forms
│   ├── dashboard/      # Dashboard widgets and charts
│   ├── layout/         # Header, sidebar, main layout
│   ├── receipts/       # Receipt upload, entry, verification
│   └── reports/        # Export and reporting components
├── contexts/
│   └── AuthContext.tsx # Authentication state management
├── hooks/
│   └── useAuditLog.ts  # Audit logging hook
├── lib/
│   ├── supabase.ts     # Supabase client configuration
│   └── database.types.ts # TypeScript types from database
├── pages/              # Main application pages
└── App.tsx             # Main app component with routing

supabase/
├── functions/
│   └── extract-receipt-data/ # AI receipt extraction
└── migrations/         # Database schema migrations
```

## Key Features Explained

### Receipt Upload Flow
1. User uploads an image or PDF
2. File is stored in Supabase Storage
3. Edge function extracts data from the receipt
4. User reviews and verifies extracted data
5. Receipt is saved to database with audit trail

### PDF Export with Images
- Generates a comprehensive PDF report with all receipt details
- Includes table with row numbers, dates, vendors, categories, payment methods, and tax breakdown
- Optionally includes receipt images on separate pages
- Each image page references the corresponding table row number

### Audit Trail
- All receipt edits and deletions are logged
- Tracks who made changes and when
- Maintains data integrity for compliance

### Multi-Tenant Architecture
- Each user can manage multiple businesses
- Data is isolated using Row-Level Security
- Businesses can have multiple collections
- Receipts belong to collections

## Database Schema

### Core Tables
- `businesses` - Business entities owned by users
- `collections` - Receipt collections within businesses
- `receipts` - Individual receipt records with extracted data
- `audit_log` - Change tracking for compliance

### Storage
- `receipts` bucket - Stores receipt images and PDFs with RLS policies

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous key |

## Contributing

This project follows clean code principles:
- Single Responsibility Principle for components
- Type safety with TypeScript
- Modular architecture with clear separation of concerns

## License

This project is private and proprietary.

## Support

For issues or questions, please open an issue in the repository.
