import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange, totalItems, itemsPerPage }) => {
  if (totalItems === 0) {
    return (
       <div className="flex items-center justify-between h-[32px]">
           <span className="text-sm text-gray-500">
                共 0 条
            </span>
       </div>
    );
  }
  
  if (totalPages <= 1) {
    return (
       <div className="flex items-center justify-between h-[32px]">
           <span className="text-sm text-gray-500">
                第 1-{totalItems} 条/总共 {totalItems} 条
            </span>
       </div>
    );
  }

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(startItem + itemsPerPage - 1, totalItems);

  const getPageNumbers = () => {
    const pageNumbers: (number | string)[] = [];
    const maxPagesToShow = 10;

    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      const halfRange = Math.floor(maxPagesToShow / 2);
      let startPage = Math.max(1, currentPage - halfRange);
      let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

      if (endPage - startPage + 1 < maxPagesToShow) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
      }

      // First page
      if (startPage > 1) {
        pageNumbers.push(1);
        if (startPage > 2) {
          pageNumbers.push('...');
        }
      }

      // Middle pages
      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
      }

      // Last page
      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          pageNumbers.push('...');
        }
        pageNumbers.push(totalPages);
      }
    }
    return pageNumbers;
  };

  const pages = getPageNumbers();

  return (
    <div className="flex items-center justify-between text-sm text-gray-700">
        <span className="text-gray-500">
            第 {startItem}-{endItem} 条/总共 {totalItems} 条，共 {totalPages} 页
        </span>
        <nav className="flex items-center space-x-1" aria-label="Pagination">
          {/* First Page */}
          <button
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            className="px-2 py-1 text-gray-500 hover:text-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="First Page"
            title="首页"
          >
            &lt;&lt;
          </button>

          {/* Previous Page */}
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-2 py-1 text-gray-500 hover:text-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Previous Page"
            title="上一页"
          >
            &lt;
          </button>

          {/* Page Numbers */}
          {pages.map((pageNumber, index) => (
             pageNumber === '...' ? (
               <span
                  key={`ellipsis-${index}`}
                  className="w-8 h-8 flex items-center justify-center text-gray-400"
               >
                  ...
               </span>
             ) : (
               <button
                  key={pageNumber}
                  onClick={() => onPageChange(pageNumber as number)}
                  aria-current={currentPage === pageNumber ? 'page' : undefined}
                  className={`w-8 h-8 flex items-center justify-center rounded-md border text-sm font-medium transition-colors ${
                      currentPage === pageNumber
                      ? 'border-blue-500 text-blue-500 bg-white'
                      : 'border-transparent text-gray-700 hover:bg-gray-100'
                  }`}
               >
                  {pageNumber}
               </button>
             )
          ))}
      
          {/* Next Page */}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-2 py-1 text-gray-500 hover:text-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Next Page"
            title="下一页"
          >
            &gt;
          </button>

          {/* Last Page */}
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            className="px-2 py-1 text-gray-500 hover:text-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Last Page"
            title="末页"
          >
            &gt;&gt;
          </button>
        </nav>
    </div>
  );
};

export default Pagination;
