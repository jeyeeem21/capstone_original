const Card = ({ children, className = '', ...props }) => {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg shadow-primary-100/50 dark:shadow-gray-900/30 border-2 border-primary-300 dark:border-primary-700 transition-colors duration-300 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

const CardHeader = ({ children, className = '' }) => {
  return (
    <div className={`px-6 py-4 border-b-2 border-primary-200 dark:border-primary-700 ${className}`}>
      {children}
    </div>
  );
};

const CardContent = ({ children, className = '' }) => {
  return (
    <div className={`px-6 py-4 ${className}`}>
      {children}
    </div>
  );
};

const CardFooter = ({ children, className = '' }) => {
  return (
    <div className={`px-6 py-4 border-t-2 border-primary-200 dark:border-primary-700 ${className}`}>
      {children}
    </div>
  );
};

export { Card, CardHeader, CardContent, CardFooter };
export default Card;
