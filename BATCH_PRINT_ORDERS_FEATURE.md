# Batch Print Orders Feature

## Overview
Added multi-select functionality to the Orders page in the admin panel, allowing users to select multiple orders across all paginations and print them simultaneously on short bond paper (4 receipts per page, 2 per row).

## Changes Made

### 1. Orders Page (`react_frontend/src/pages/admin/Orders/Orders.jsx`)

#### New State
- `selectedOrderIds`: Array to track selected order IDs across all pages

#### New Functions

**`printBatchReceipts(orders, bizName)`**
- Prints multiple order receipts on short bond paper (8.5" x 11")
- Layout: 4 receipts per page in a 2x2 grid (2 receipts per row)
- Automatically handles pagination when more than 4 orders are selected
- Maintains the same receipt format as single prints but scaled for batch printing

**`handleBatchPrint()`**
- Validates that orders are selected
- Retrieves full order objects from selected IDs
- Calls `printBatchReceipts()` with selected orders
- Clears selection after printing

#### DataTable Integration
- Enabled `selectable={true}` prop
- Added `selectedRows={selectedOrderIds}` for external state management
- Added `onSelectionChange={setSelectedOrderIds}` callback
- Added "Print Selected" button in `headerRight` that:
  - Only appears when orders are selected
  - Shows count of selected orders
  - Triggers batch print on click

### 2. DataTable Component (`react_frontend/src/components/ui/DataTable.jsx`)

#### Enhanced Selection Management
- Added `selectedRows` prop for external selection state (optional)
- Added `onSelectionChange` prop for external selection handler (optional)
- Falls back to internal state if external props not provided (backward compatible)

#### Improved Select All Functionality
- Now selects/deselects ALL filtered items (not just current page)
- Shows indeterminate state (dash) when some items are selected
- Checkbox states:
  - Empty: No items selected
  - Dash: Some items selected
  - Check: All filtered items selected

## Usage

### For Users
1. Navigate to Admin → Orders page
2. Use checkboxes to select orders you want to print
3. Selection persists across pagination and filters
4. Click "Print Selected (X)" button in the header
5. Print dialog opens with all receipts formatted for short bond paper
6. 4 receipts per page, arranged in 2 rows × 2 columns

### Print Layout Specifications
- **Paper Size**: 8.5" × 11" (Short Bond Paper)
- **Receipts Per Page**: 4
- **Layout**: 2 rows × 2 columns (box type)
- **Margins**: 0.5 inch on all sides
- **Gap Between Receipts**: 0.3 inch
- **Receipt Border**: 1px solid border for clear separation
- **Font Sizes**: Scaled down to fit multiple receipts per page

### Features
- ✅ Multi-select across all pages
- ✅ Select all filtered orders with one click
- ✅ Selection count indicator
- ✅ Batch print with optimized layout
- ✅ Automatic page breaks for large batches
- ✅ Same receipt content as single prints
- ✅ Clear selection after printing

## Technical Details

### Print Styling
The batch print uses CSS Grid layout with:
- Flexbox for row arrangement
- Fixed receipt cell sizing
- Page break controls for multi-page prints
- Responsive font scaling
- Border styling for visual separation

### Selection Persistence
- Selection state managed at parent component level
- IDs stored in array, not page-specific
- Works with search, filters, and pagination
- Cleared only on explicit user action or successful print

## Browser Compatibility
- Works in all modern browsers with print support
- Uses `window.open()` for print preview
- CSS `@page` and `@media print` for print-specific styling
