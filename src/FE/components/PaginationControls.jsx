export default function PaginationControls({
  page,
  totalPages,
  onPageChange,
  className = '',
}) {
  if (!totalPages || totalPages <= 1) {
    return null;
  }

  return (
    <div className={`mt-6 flex items-center justify-center gap-2 ${className}`.trim()}>
      <button
        type="button"
        disabled={page <= 0}
        onClick={() => onPageChange(page - 1)}
        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Trang trước
      </button>
      <span className="min-w-24 text-center text-sm text-gray-600">
        Trang {page + 1} / {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages - 1}
        onClick={() => onPageChange(page + 1)}
        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Trang sau
      </button>
    </div>
  );
}
