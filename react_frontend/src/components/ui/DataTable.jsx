import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Filter, Check, Plus, MoreVertical, Calendar, RotateCcw } from 'lucide-react';
import SearchInput from './SearchInput';
import Pagination from './Pagination';
import Button from './Button';

const DataTable = ({
  columns,
  data,
  title,
  subtitle,
  onAdd,
  addLabel = 'Add New',
  searchable = true,
  searchPlaceholder = 'Search...',
  pagination = true,
  defaultItemsPerPage = 10,
  emptyMessage = 'No data available',
  onRowClick,
  onRowDoubleClick,
  selectable = false,
  selectedRows: externalSelectedRows = null, // External selection state
  onSelectionChange = null, // External selection change handler
  filterField = null,
  filterOptions = [],
  filterPlaceholder = 'All',
  cardConfig = null, // { titleField, subtitleField, badgeField, fields: [{accessor, label}] }
  dateFilterField = null, // accessor for date field to enable date range filter
  headerRight = null, // custom JSX rendered in the header area
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(defaultItemsPerPage);
  const [filterValue, setFilterValue] = useState('');
  const [internalSelectedRows, setInternalSelectedRows] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Use external selection state if provided, otherwise use internal
  const selectedRows = externalSelectedRows !== null ? externalSelectedRows : internalSelectedRows;
  const setSelectedRows = onSelectionChange || setInternalSelectedRows;

  // Generate filter options from data if not provided
  const computedFilterOptions = useMemo(() => {
    if (filterOptions.length > 0) return filterOptions;
    if (!filterField) return [];
    const uniqueValues = [...new Set(data.map(item => item[filterField]).filter(Boolean))];
    return uniqueValues.sort();
  }, [data, filterField, filterOptions]);

  // Filter data based on search query and selected filter
  const filteredData = useMemo(() => {
    let result = data;
    
    // Apply filter
    if (filterField && filterValue) {
      result = result.filter(row => row[filterField] === filterValue);
    }
    
    // Apply date range filter
    if (dateFilterField && (startDate || endDate)) {
      result = result.filter(row => {
        const dateStr = row[dateFilterField];
        if (!dateStr) return false;
        const date = new Date(dateStr);
        if (startDate) {
          const start = new Date(startDate + 'T00:00:00+08:00');
          if (date < start) return false;
        }
        if (endDate) {
          const end = new Date(endDate + 'T23:59:59+08:00');
          if (date > end) return false;
        }
        return true;
      });
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((row) =>
        columns.some((col) => {
          if (col.searchable === false) return false;
          const value = col.accessor ? row[col.accessor] : '';
          return String(value).toLowerCase().includes(query);
        })
      );
    }
    
    return result;
  }, [data, searchQuery, columns, filterField, filterValue, dateFilterField, startDate, endDate]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;

    return [...filteredData].sort((a, b) => {
      const col = columns.find((c) => c.accessor === sortConfig.key);
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      // Custom sort function
      if (col?.sortFn) {
        return sortConfig.direction === 'asc' 
          ? col.sortFn(aVal, bVal) 
          : col.sortFn(bVal, aVal);
      }

      // Default sort
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      
      if (sortConfig.direction === 'asc') {
        return aStr.localeCompare(bStr);
      }
      return bStr.localeCompare(aStr);
    });
  }, [filteredData, sortConfig, columns]);

  // Paginate data
  const paginatedData = useMemo(() => {
    if (!pagination) return sortedData;
    const start = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(start, start + itemsPerPage);
  }, [sortedData, currentPage, itemsPerPage, pagination]);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);

  // Handle sort
  const handleSort = (accessor) => {
    const col = columns.find((c) => c.accessor === accessor);
    if (col?.sortable === false) return;

    setSortConfig((prev) => ({
      key: accessor,
      direction: prev.key === accessor && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  // Reset to first page when search changes
  const handleSearch = (value) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  // Handle date filter changes
  const handleStartDateChange = (value) => {
    setStartDate(value);
    setCurrentPage(1);
  };

  const handleEndDateChange = (value) => {
    setEndDate(value);
    setCurrentPage(1);
  };

  const handleResetDates = () => {
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  // Handle filter change
  const handleFilterChange = (value) => {
    setFilterValue(value);
    setCurrentPage(1);
  };

  // Handle items per page change
  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  };

  // Handle row selection
  const handleRowSelect = (row, e) => {
    if (!selectable) return;
    e?.stopPropagation();
    const rowId = row.id;
    setSelectedRows(prev => 
      prev.includes(rowId) 
        ? prev.filter(id => id !== rowId)
        : [...prev, rowId]
    );
  };

  // Handle select all (only for current page or all filtered data)
  const handleSelectAll = () => {
    // Get all IDs from the entire filtered dataset (not just current page)
    const allFilteredIds = sortedData.map(row => row.id);
    
    // Check if all filtered items are selected
    const allSelected = allFilteredIds.every(id => selectedRows.includes(id));
    
    if (allSelected) {
      // Deselect all filtered items
      setSelectedRows(prev => prev.filter(id => !allFilteredIds.includes(id)));
    } else {
      // Select all filtered items
      setSelectedRows(prev => {
        const newSelection = [...prev];
        allFilteredIds.forEach(id => {
          if (!newSelection.includes(id)) {
            newSelection.push(id);
          }
        });
        return newSelection;
      });
    }
  };

  // Check if row is selected
  const isRowSelected = (row) => selectedRows.includes(row.id);

  // Handle row click
  const handleRowClick = (row, e) => {
    if (selectable) {
      handleRowSelect(row, e);
    }
    onRowClick?.(row);
  };

  // Handle row double click
  const handleRowDoubleClick = (row) => {
    onRowDoubleClick?.(row);
  };

  const getSortIcon = (accessor) => {
    const col = columns.find((c) => c.accessor === accessor);
    if (col?.sortable === false) return null;

    if (sortConfig.key !== accessor) {
      return <ChevronsUpDown size={14} className="text-gray-400" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ChevronUp size={14} className="text-primary-600 dark:text-primary-400" />
      : <ChevronDown size={14} className="text-primary-600 dark:text-primary-400" />;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-primary-400 dark:border-primary-700 overflow-hidden shadow-lg shadow-primary-100/50 dark:shadow-gray-900/30">
      {/* Title Header */}
      {(title || onAdd || headerRight) && (
        <div className="p-4 border-b-2 border-primary-300 dark:border-primary-700 bg-gradient-to-r from-primary-50 to-white dark:from-gray-700 dark:to-gray-800">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              {title && <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">{title}</h3>}
              {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {headerRight}
              {onAdd && (
                <Button onClick={onAdd} size="sm">
                  <Plus size={16} className="mr-1.5" />
                  {addLabel}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search and Filter */}
      {(searchable || filterField || dateFilterField) && (
        <div className="p-4 border-b-2 border-primary-200 dark:border-primary-700 bg-gray-50 dark:bg-gray-700">
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            {searchable && (
              <SearchInput
                value={searchQuery}
                onChange={handleSearch}
                placeholder={searchPlaceholder}
                className="flex-1 max-w-xs"
              />
            )}
            {filterField && computedFilterOptions.length > 0 && (
              <div className="relative">
                <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
                <select
                  value={filterValue}
                  onChange={(e) => handleFilterChange(e.target.value)}
                  className="pl-9 pr-8 py-2.5 text-sm border-2 border-primary-200 dark:border-primary-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 dark:text-white appearance-none cursor-pointer min-w-[180px] font-medium"
                >
                  <option value="">{filterPlaceholder}</option>
                  {computedFilterOptions.map((option) => {
                    const val = typeof option === 'object' ? option.value : option;
                    const label = typeof option === 'object' ? option.label : option;
                    return <option key={val} value={val}>{label}</option>;
                  })}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 pointer-events-none" />
              </div>
            )}
            {dateFilterField && (
              <div className="flex items-center gap-2 flex-wrap">
                <Calendar size={14} className="text-gray-500 dark:text-gray-400 flex-shrink-0" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="px-3 py-2 text-sm border-2 border-primary-200 dark:border-primary-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 dark:text-white font-medium"
                />
                <span className="text-xs text-gray-400 font-medium">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className="px-3 py-2 text-sm border-2 border-primary-200 dark:border-primary-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 dark:text-white font-medium"
                />
                {(startDate || endDate) && (
                  <button
                    onClick={handleResetDates}
                    className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-red-600 dark:text-red-400 bg-white dark:bg-gray-700 border-2 border-primary-200 dark:border-primary-700 rounded-xl hover:border-red-300 dark:border-red-700 transition-colors"
                    title="Reset date filter"
                  >
                    <RotateCcw size={13} />
                    Reset
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table - Desktop only */}
      <div className="overflow-x-auto hidden lg:block">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-primary-100 dark:bg-primary-900/20 border-b-2 border-primary-300 dark:border-primary-700">
              {selectable && (
                <th className="px-4 py-3.5 text-center w-12">
                  <button
                    onClick={handleSelectAll}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                      sortedData.length > 0 && sortedData.every(row => selectedRows.includes(row.id))
                        ? 'bg-button-500 border-button-500 text-white'
                        : sortedData.some(row => selectedRows.includes(row.id))
                        ? 'bg-button-300 border-button-500 text-white'
                        : 'border-primary-300 dark:border-primary-600 bg-white dark:bg-gray-800 hover:border-primary-400'
                    }`}
                    title={sortedData.every(row => selectedRows.includes(row.id)) ? 'Deselect all' : 'Select all filtered orders'}
                  >
                    {sortedData.length > 0 && sortedData.every(row => selectedRows.includes(row.id)) && <Check size={12} />}
                    {sortedData.some(row => selectedRows.includes(row.id)) && !sortedData.every(row => selectedRows.includes(row.id)) && (
                      <div className="w-2 h-0.5 bg-white rounded" />
                    )}
                  </button>
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.accessor || col.header}
                  className={`px-4 py-3.5 text-left text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider transition-colors
                    ${col.sortable !== false && col.accessor ? 'cursor-pointer table-header-hover select-none' : ''}
                    ${col.className || ''}`}
                  style={{ width: col.width }}
                  onClick={() => col.accessor && handleSort(col.accessor)}
                >
                  <div className="flex items-center gap-1.5">
                    {col.header}
                    {col.accessor && getSortIcon(col.accessor)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length > 0 ? (
              paginatedData.map((row, rowIndex) => (
                <tr
                  key={row.id || rowIndex}
                  className={`border-b border-primary-200 dark:border-primary-700 transition-all cursor-pointer table-row-hover
                    ${isRowSelected(row) ? 'table-row-selected' : 'bg-white dark:bg-gray-800'}`}
                  onClick={(e) => handleRowClick(row, e)}
                  onDoubleClick={() => handleRowDoubleClick(row)}
                >
                  {selectable && (
                    <td className="px-4 py-3.5 text-center">
                      <button
                        onClick={(e) => handleRowSelect(row, e)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                          isRowSelected(row)
                            ? 'bg-button-500 border-button-500 text-white'
                            : 'border-primary-300 dark:border-primary-600 bg-white dark:bg-gray-800 hover:border-primary-400'
                        }`}
                      >
                        {isRowSelected(row) && <Check size={12} />}
                      </button>
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.accessor || col.header}
                      className={`px-4 py-3.5 text-sm text-gray-800 dark:text-gray-100 font-medium ${col.cellClassName || ''}`}
                    >
                      {col.cell ? col.cell(row, rowIndex) : row[col.accessor]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={selectable ? columns.length + 1 : columns.length} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Cards - Mobile/Tablet only */}
      <div className="lg:hidden">
        {paginatedData.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4">
            {paginatedData.map((row, rowIndex) => {
              // Get first 2 non-action columns for card title/subtitle
              const displayColumns = columns.filter(col => col.accessor && !col.header?.toLowerCase().includes('action'));
              const titleCol = displayColumns[0];
              const subtitleCol = displayColumns[1];
              const otherCols = displayColumns.slice(2); // Show all remaining fields
              
              return (
                <div
                  key={row.id || rowIndex}
                  className={`bg-white dark:bg-gray-700 rounded-xl border-2 transition-all cursor-pointer
                    ${isRowSelected(row) 
                      ? 'border-button-500 shadow-lg shadow-button-500/20' 
                      : 'border-primary-300 dark:border-primary-700 hover:border-button-400 hover:shadow-md'
                    }`}
                  onClick={(e) => handleRowClick(row, e)}
                >
                  {/* Card Header */}
                  <div className="p-4 border-b border-primary-100 dark:border-primary-700">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {titleCol && (
                          <h4 className="font-semibold text-gray-800 dark:text-gray-100 text-base truncate">
                            {titleCol.cell ? titleCol.cell(row, rowIndex) : row[titleCol.accessor]}
                          </h4>
                        )}
                        {subtitleCol && (
                          <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                            {subtitleCol.cell ? subtitleCol.cell(row, rowIndex) : row[subtitleCol.accessor]}
                          </div>
                        )}
                      </div>
                      {selectable && (
                        <button
                          onClick={(e) => handleRowSelect(row, e)}
                          className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                            isRowSelected(row)
                              ? 'bg-button-500 border-button-500 text-white'
                              : 'border-primary-300 dark:border-primary-600 bg-white dark:bg-gray-700 hover:border-primary-400'
                          }`}
                        >
                          {isRowSelected(row) && <Check size={14} />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 space-y-2">
                    {otherCols.map((col) => (
                      <div key={col.accessor} className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">{col.header}</span>
                        <span className="font-medium text-gray-800 dark:text-gray-100">
                          {col.cell ? col.cell(row, rowIndex) : row[col.accessor]}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Card Actions - if there's an action column */}
                  {columns.find(col => col.header?.toLowerCase().includes('action')) && (
                    <div className="px-4 pb-4">
                      {columns.find(col => col.header?.toLowerCase().includes('action'))?.cell?.(row, rowIndex)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            {emptyMessage}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && sortedData.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={sortedData.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={handleItemsPerPageChange}
        />
      )}
    </div>
  );
};

export default DataTable;
