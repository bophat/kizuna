import { useState, useEffect, useMemo } from 'react';

export function usePagination<T>(
  items: T[],
  resetDeps: unknown[] = [],
  initialPageSize = 20
) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(initialPageSize);

  const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage) || 1);

  const paginatedItems = useMemo(
    () => items.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
    [items, currentPage, itemsPerPage]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [...resetDeps, itemsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const start =
    items.length === 0 ? 0 : Math.min(items.length, (currentPage - 1) * itemsPerPage + 1);
  const end = Math.min(items.length, currentPage * itemsPerPage);

  return {
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    totalPages,
    paginatedItems,
    totalItems: items.length,
    start,
    end,
  };
}
