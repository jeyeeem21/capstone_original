import { Eye, Edit, Trash2, Archive, MoreHorizontal } from 'lucide-react';

const ActionButtons = ({ onView, onEdit, onDelete, onArchive, size = 'sm' }) => {
  const iconSize = size === 'sm' ? 15 : 18;
  const btnClass = size === 'sm' ? 'p-1.5' : 'p-2';

  return (
    <div className="flex items-center gap-1">
      {onView && (
        <button
          onClick={(e) => { e.stopPropagation(); onView(); }}
          className={`${btnClass} rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-500 hover:text-blue-700 dark:text-blue-300 transition-colors`}
          title="View"
        >
          <Eye size={iconSize} />
        </button>
      )}
      {onEdit && (
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className={`${btnClass} rounded-md hover:bg-button-50 dark:hover:bg-button-900/30 text-button-500 hover:text-button-700 dark:text-button-300 transition-colors`}
          title="Edit"
        >
          <Edit size={iconSize} />
        </button>
      )}
      {onArchive && (
        <button
          onClick={(e) => { e.stopPropagation(); onArchive(); }}
          className={`${btnClass} rounded-md hover:bg-amber-50 dark:hover:bg-amber-900/30 text-amber-500 hover:text-amber-700 dark:text-amber-300 transition-colors`}
          title="Archive"
        >
          <Archive size={iconSize} />
        </button>
      )}
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className={`${btnClass} rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 hover:text-red-700 dark:text-red-300 transition-colors`}
          title="Delete"
        >
          <Trash2 size={iconSize} />
        </button>
      )}
    </div>
  );
};

export default ActionButtons;
