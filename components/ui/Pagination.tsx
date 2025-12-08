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
    const pageNumbers: number[] = [];
    const maxPagesToShow = 5;

    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      let startPage = Math.max(1, currentPage - 2);
      let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

      if (endPage - startPage + 1 < maxPagesToShow) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
      }
    }
    return pageNumbers;
  };

  const pages = getPageNumbers();

  return (
    <div className="flex items-center justify-between text-sm text-gray-700">
        <span className="text-gray-500">
            第 {startItem}-{endItem} 条/总共 {totalItems} 条
        </span>
        <nav className="flex items-center space-x-1" aria-label="Pagination">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-2 py-1 text-gray-500 hover:text-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Previous Page"
          >
            &lt;
          </button>

          {pages.map((pageNumber) => (
             <button
                key={pageNumber}
                onClick={() => onPageChange(pageNumber)}
                aria-current={currentPage === pageNumber ? 'page' : undefined}
                className={`w-8 h-8 flex items-center justify-center rounded-md border text-sm font-medium transition-colors ${
                    currentPage === pageNumber
                    ? 'border-blue-500 text-blue-500 bg-white'
                    : 'border-transparent text-gray-700 hover:bg-gray-100'
                }`}
             >
                {pageNumber}
             </button>
          ))}
      
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-2 py-1 text-gray-500 hover:text-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Next Page"
          >
            &gt;
          </button>
        </nav>
    </div>
  );
};

export default Pagination;
