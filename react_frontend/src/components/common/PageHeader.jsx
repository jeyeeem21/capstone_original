const PageHeader = ({ title, description, icon: Icon }) => {
  return (
    <div className="mb-8 pb-6 border-b-2 border-primary-200 dark:border-primary-700">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="p-2.5 bg-gradient-to-br from-button-500 to-button-600 rounded-xl shadow-lg shadow-button-500/25">
            <Icon size={22} className="text-white" />
          </div>
        )}
        <h1 
          className="text-2xl font-bold tracking-tight"
          style={{ color: 'var(--color-text-content)', fontSize: 'calc(var(--font-size-base) * 1.5)' }}
        >
          {title}
        </h1>
      </div>
      {description && (
        <p 
          className="mt-2 ml-[52px]"
          style={{ color: 'var(--color-text-secondary)', fontSize: 'calc(var(--font-size-base) * 0.875)' }}
        >
          {description}
        </p>
      )}
    </div>
  );
};

export default PageHeader;
