// Reusable border styles for consistency across the application
export const borderStyles = {
  // Primary card border - green theme
  card: 'border-2 border-primary-300 dark:border-primary-700 shadow-lg shadow-primary-100/50',
  
  // Table container border
  table: 'border-2 border-primary-300 dark:border-primary-700 shadow-lg shadow-primary-100/50',
  
  // Input field border
  input: 'border-2 border-primary-200 dark:border-primary-700 focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20',
  
  // Selected/Active state border
  active: 'border-2 border-primary-500 bg-primary-50 shadow-md shadow-primary-200/50',
  
  // Hover state
  hover: 'hover:border-primary-400 hover:shadow-md',
  
  // Chart/Stats card border
  stats: 'border-2 border-primary-400 shadow-lg shadow-primary-100/50',
};

// Combined class names for common use cases
export const cardBorder = `${borderStyles.card} rounded-xl`;
export const tableBorder = `${borderStyles.table} rounded-xl`;
export const inputBorder = `${borderStyles.input} rounded-xl`;
export const activeBorder = `${borderStyles.active} rounded-xl`;

export default borderStyles;
