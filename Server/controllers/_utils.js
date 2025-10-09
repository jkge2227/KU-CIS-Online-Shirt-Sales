// controllers/_utils.js

// Prisma error → HTTP mapping
exports.prismaError = (err) => {
  // PrismaClientKnownRequestError
  if (err?.code === 'P2002') return { status: 409, message: 'Name already exists' };
  if (err?.code === 'P2003') return { status: 409, message: 'Foreign key constraint failed' };
  if (err?.code === 'P2021') return { status: 500, message: 'Table not found (did you run migration?)' };
  if (err?.code === 'P2022') return { status: 500, message: 'Column not found (schema mismatch)' };
  return { status: 500, message: 'Server Error' };
};

// Build pagination/search/sort safely for { id, name, createdAt, updatedAt } models
exports.buildPaging = (req) => {
  const {
    page = '1',
    limit = '20',
    query = '',
    sort = 'createdAt',
    order = 'desc',
  } = req.query || {};

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

  // เฉพาะ field ที่มีจริงใน Size model
  const ALLOWED_SORT = new Set(['id', 'name', 'createdAt', 'updatedAt']);
  const sortKey = ALLOWED_SORT.has(sort) ? sort : 'createdAt';
  const sortDir = String(order).toLowerCase() === 'asc' ? 'asc' : 'desc';

  const where = query
    ? { OR: [{ name: { contains: query, mode: 'insensitive' } }] }
    : {};

  const orderBy = { [sortKey]: sortDir };

  return { pageNum, pageSize, where, orderBy };
};
